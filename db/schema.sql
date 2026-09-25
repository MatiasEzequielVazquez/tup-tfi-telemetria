-- Sistema de Telemetría Vehicular para el Mantenimiento Preventivo de Flotas Mixtas
-- Esquema de base de datos (PostgreSQL / Supabase)
-- Ver docs/entregas/02-arquitectura-modulos.md para el detalle y la justificación de cada tabla.

-- Requiere la extensión de UUIDs
create extension if not exists "pgcrypto";

-- =========================================================
-- usuarios
-- Nota: en Supabase, los usuarios de autenticación viven en auth.users.
-- Esta tabla extiende esa identidad con el rol de la aplicación (RN11).
-- =========================================================
create table usuarios (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       text not null unique,
    nombre      text,
    rol         text not null check (rol in ('admin', 'mantenimiento')),
    created_at  timestamptz not null default now()
);

-- =========================================================
-- unidades
-- =========================================================
create table unidades (
    id          uuid primary key default gen_random_uuid(),
    patente     text not null unique,
    marca       text not null,
    modelo      text,
    anio        int,
    tenencia    text not null check (tenencia in ('propia', 'fletero')),
    titular     text,
    protocolo   text not null check (protocolo in ('J1939', 'J1979')),
    km_actual   numeric not null default 0,
    km_fuente   text not null default 'manual' check (km_fuente in ('odometro', 'estimado', 'manual')),
    created_at  timestamptz not null default now()
);

-- =========================================================
-- dispositivos
-- =========================================================
create table dispositivos (
    id                   uuid primary key default gen_random_uuid(),
    device_uid           text not null unique,
    unidad_id            uuid references unidades(id) on delete set null,
    estado               text not null default 'inactivo' check (estado in ('activo', 'inactivo', 'sin_reportar')),
    ultima_comunicacion  timestamptz,
    created_at           timestamptz not null default now()
);

-- Refuerza RN02: un dispositivo vinculado a lo sumo a una unidad, y una unidad
-- con a lo sumo un dispositivo activo (unicidad parcial sobre unidad_id).
create unique index dispositivos_unidad_id_unico
    on dispositivos (unidad_id)
    where unidad_id is not null;

-- =========================================================
-- lecturas
-- =========================================================
create table lecturas (
    id                          uuid primary key default gen_random_uuid(),
    dispositivo_id              uuid not null references dispositivos(id) on delete cascade,
    tipo                        text not null check (tipo in ('km', 'horas_motor', 'dtc', 'heartbeat')),
    payload                     jsonb not null,
    marca_tiempo_dispositivo    timestamptz not null,
    marca_tiempo_recepcion      timestamptz not null default now(),
    consistente                 boolean not null default true
);

create index lecturas_dispositivo_recepcion_idx
    on lecturas (dispositivo_id, marca_tiempo_recepcion);

-- =========================================================
-- tareas_catalogo
-- Intervalos por defecto relevados en el caso de estudio (RN03).
-- =========================================================
create table tareas_catalogo (
    id                          uuid primary key default gen_random_uuid(),
    nombre                      text not null,
    intervalo_km_default        int not null,
    umbral_aviso_km_default     int not null default 4000
);

insert into tareas_catalogo (nombre, intervalo_km_default, umbral_aviso_km_default) values
    ('Cambio de aceite de motor', 40000, 4000),
    ('Filtro secador de aire de frenos', 100000, 4000),
    ('Aceite de caja y diferencial', 150000, 4000);

-- =========================================================
-- planes_mantenimiento
-- Instancia cada tarea sobre una unidad y concentra su estado (RF07, RF08).
-- =========================================================
create table planes_mantenimiento (
    id                  uuid primary key default gen_random_uuid(),
    unidad_id           uuid not null references unidades(id) on delete cascade,
    tarea_id            uuid not null references tareas_catalogo(id),
    intervalo_km        int not null,
    umbral_aviso_km     int not null,
    km_ultimo_service   numeric not null default 0,
    estado              text not null default 'al_dia' check (estado in ('al_dia', 'proxima', 'vencida', 'postergada')),
    created_at          timestamptz not null default now(),
    unique (unidad_id, tarea_id)
);

create index planes_unidad_estado_idx
    on planes_mantenimiento (unidad_id, estado);

-- =========================================================
-- services
-- =========================================================
create table services (
    id              uuid primary key default gen_random_uuid(),
    unidad_id       uuid not null references unidades(id) on delete cascade,
    fecha           date not null default current_date,
    km              numeric not null,
    observaciones   text,
    usuario_id      uuid not null references usuarios(id),
    created_at      timestamptz not null default now()
);

-- =========================================================
-- service_tareas
-- Un service puede cubrir varias tareas del plan de mantenimiento (RF09, RN06).
-- =========================================================
create table service_tareas (
    service_id  uuid not null references services(id) on delete cascade,
    plan_id     uuid not null references planes_mantenimiento(id) on delete cascade,
    primary key (service_id, plan_id)
);

-- =========================================================
-- postergaciones
-- =========================================================
create table postergaciones (
    id                  uuid primary key default gen_random_uuid(),
    plan_id             uuid not null references planes_mantenimiento(id) on delete cascade,
    motivo              text not null check (motivo in ('falta_espacio', 'salida_urgente', 'otro')),
    motivo_descripcion  text,
    km_limite_nuevo     int not null,
    usuario_id          uuid not null references usuarios(id),
    fecha               timestamptz not null default now(),
    cerrada             boolean not null default false
);

create index postergaciones_plan_abiertas_idx
    on postergaciones (plan_id, cerrada);

-- =========================================================
-- fallas (DTC)
-- =========================================================
create table fallas (
    id                  uuid primary key default gen_random_uuid(),
    unidad_id           uuid not null references unidades(id) on delete cascade,
    codigo              text not null,
    estado              text not null default 'activo' check (estado in ('activo', 'inactivo')),
    fecha_aparicion     timestamptz not null default now(),
    fecha_cierre        timestamptz
);

create index fallas_unidad_estado_idx
    on fallas (unidad_id, estado);

-- =========================================================
-- alertas
-- =========================================================
create table alertas (
    id                      uuid primary key default gen_random_uuid(),
    unidad_id               uuid not null references unidades(id) on delete cascade,
    tipo                    text not null check (tipo in ('tarea_proxima', 'tarea_vencida', 'falla_nueva', 'dispositivo_sin_reportar')),
    referencia_id           uuid,
    estado                  text not null default 'abierta' check (estado in ('abierta', 'revisada')),
    usuario_revisor_id      uuid references usuarios(id),
    fecha_generada          timestamptz not null default now(),
    fecha_revisada          timestamptz
);

create index alertas_estado_fecha_idx
    on alertas (estado, fecha_generada);

-- =========================================================
-- kilometraje_historial
-- Cargas manuales de kilometraje (RF06, RF16, RNF11).
-- =========================================================
create table kilometraje_historial (
    id          uuid primary key default gen_random_uuid(),
    unidad_id   uuid not null references unidades(id) on delete cascade,
    km          numeric not null,
    fuente      text not null default 'manual',
    usuario_id  uuid not null references usuarios(id),
    fecha       timestamptz not null default now()
);

-- =========================================================
-- Row Level Security
-- El acceso a estas tablas se hace únicamente desde el backend (Node.js),
-- que se conecta a Supabase con la service_role key (bypassea RLS por diseño).
-- El dashboard y cualquier otro cliente nunca hablan directo con la base:
-- pasan siempre por la API REST del backend (ver RNF04 y M9 en
-- docs/entregas/02-arquitectura-modulos.md). Por eso se habilita RLS en
-- todas las tablas sin definir políticas para los roles anon/authenticated:
-- esto bloquea cualquier acceso directo con la anon key o con un JWT de
-- usuario, que es exactamente lo que pide el warning del linter de Supabase.
-- =========================================================
alter table usuarios enable row level security;
alter table unidades enable row level security;
alter table dispositivos enable row level security;
alter table lecturas enable row level security;
alter table tareas_catalogo enable row level security;
alter table planes_mantenimiento enable row level security;
alter table services enable row level security;
alter table service_tareas enable row level security;
alter table postergaciones enable row level security;
alter table fallas enable row level security;
alter table alertas enable row level security;
alter table kilometraje_historial enable row level security;