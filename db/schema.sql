-- Sistema de Telemetría Vehicular para el Mantenimiento Preventivo de Flotas Mixtas
-- Esquema de base de datos (PostgreSQL / Supabase)
-- Ver docs/entregas/02-arquitectura-modulos.md para el detalle y la justificación de cada tabla.


-- =========================================================
-- Tipos enumerados
-- =========================================================
create type rol_usuario         as enum ('admin', 'mantenimiento');
create type tenencia_unidad     as enum ('propia', 'fletero');
create type protocolo_vehiculo  as enum ('J1939', 'J1979');
create type fuente_km           as enum ('odometro', 'estimado', 'manual');
create type estado_dispositivo  as enum ('activo', 'inactivo', 'sin_reportar');
create type tipo_lectura        as enum ('km', 'horas_motor', 'dtc', 'heartbeat');
create type estado_plan         as enum ('al_dia', 'proxima', 'vencida', 'postergada');
create type motivo_postergacion as enum ('falta_espacio', 'salida_urgente', 'otro');
create type estado_falla        as enum ('activo', 'inactivo');
create type tipo_alerta         as enum ('tarea_proxima', 'tarea_vencida', 'falla_nueva', 'dispositivo_sin_reportar');
create type estado_alerta       as enum ('abierta', 'revisada');

-- =========================================================
-- usuarios
-- En Supabase, los usuarios de autenticación viven en auth.users.
-- Esta tabla extiende esa identidad con el rol de la aplicación (RN11),
-- por eso su PK es el mismo uuid de auth.users.
-- =========================================================
create table usuarios (
    id          uuid primary key references auth.users(id) on delete cascade,
    email       varchar(100) not null unique,
    nombre      varchar(100),
    rol         rol_usuario not null,
    created_at  timestamptz not null default now()
);

-- =========================================================
-- unidades
-- =========================================================
create table unidades (
    id          bigint generated always as identity primary key,
    patente     varchar(10) not null unique,
    marca       varchar(50) not null,
    modelo      varchar(50),
    anio        smallint,
    tenencia    tenencia_unidad not null,
    titular     varchar(100),
    protocolo   protocolo_vehiculo not null,
    km_actual   numeric(10,1) not null default 0,
    km_fuente   fuente_km not null default 'manual',
    created_at  timestamptz not null default now()
);

-- =========================================================
-- dispositivos
-- =========================================================
create table dispositivos (
    id                   bigint generated always as identity primary key,
    device_uid           varchar(50) not null unique,
    unidad_id            bigint references unidades(id) on delete set null,
    estado               estado_dispositivo not null default 'inactivo',
    ultima_comunicacion  timestamptz,
    created_at           timestamptz not null default now()
);

-- Refuerza RN02: un dispositivo vinculado a lo sumo a una unidad, y una unidad
-- con a lo sumo un dispositivo (unicidad parcial sobre unidad_id).
create unique index dispositivos_unidad_id_unico
    on dispositivos (unidad_id)
    where unidad_id is not null;

-- =========================================================
-- lecturas
-- =========================================================
create table lecturas (
    id                          bigint generated always as identity primary key,
    dispositivo_id              bigint not null references dispositivos(id) on delete cascade,
    -- Unidad a la que estaba vinculado el dispositivo al recibir la lectura.
    -- Se guarda aparte porque un dispositivo puede desvincularse y pasar a otra
    -- unidad (RF03, RN02): sin esta columna el historial se atribuiría a la unidad nueva.
    unidad_id                   bigint not null references unidades(id) on delete cascade,
    tipo                        tipo_lectura not null,
    payload                     jsonb not null,
    marca_tiempo_dispositivo    timestamptz not null,
    marca_tiempo_recepcion      timestamptz not null default now(),
    consistente                 boolean not null default true
);

create index lecturas_dispositivo_recepcion_idx
    on lecturas (dispositivo_id, marca_tiempo_recepcion);

create index lecturas_unidad_recepcion_idx
    on lecturas (unidad_id, marca_tiempo_recepcion);

-- =========================================================
-- tareas_catalogo
-- Intervalos por defecto relevados en el caso de estudio (RN03).
-- =========================================================
create table tareas_catalogo (
    id                          bigint generated always as identity primary key,
    nombre                      varchar(100) not null unique,
    intervalo_km_default        int not null check (intervalo_km_default > 0),
    umbral_aviso_km_default     int not null default 4000 check (umbral_aviso_km_default > 0)
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
    id                  bigint generated always as identity primary key,
    unidad_id           bigint not null references unidades(id) on delete cascade,
    tarea_id            bigint not null references tareas_catalogo(id),
    intervalo_km        int not null check (intervalo_km > 0),
    umbral_aviso_km     int not null check (umbral_aviso_km > 0),
    km_ultimo_service   numeric(10,1) not null default 0,
    estado              estado_plan not null default 'al_dia',
    created_at          timestamptz not null default now(),
    unique (unidad_id, tarea_id),
    -- Destino de las FK compuestas (plan_id, unidad_id) de service_tareas y alertas.
    constraint planes_id_unidad_uk unique (id, unidad_id)
);

create index planes_unidad_estado_idx
    on planes_mantenimiento (unidad_id, estado);

create index planes_tarea_idx
    on planes_mantenimiento (tarea_id);

-- =========================================================
-- services
-- =========================================================
create table services (
    id              bigint generated always as identity primary key,
    unidad_id       bigint not null references unidades(id) on delete cascade,
    fecha           date not null default current_date,
    km              numeric(10,1) not null,
    observaciones   text,
    usuario_id      uuid not null references usuarios(id),
    created_at      timestamptz not null default now(),
    -- Destino de la FK compuesta (service_id, unidad_id) de service_tareas.
    constraint services_id_unidad_uk unique (id, unidad_id)
);

create index services_unidad_fecha_idx
    on services (unidad_id, fecha);

create index services_usuario_idx
    on services (usuario_id);

-- =========================================================
-- service_tareas
-- Un service puede cubrir varias tareas del plan de mantenimiento (RF09, RN06).
-- =========================================================
create table service_tareas (
    service_id  bigint not null,
    plan_id     bigint not null,
    -- Unidad del service y del plan: las dos FK compuestas obligan a que sea la misma,
    -- así un service de una unidad no puede cubrir el plan de otra.
    unidad_id   bigint not null,
    primary key (service_id, plan_id),
    constraint service_tareas_service_fk
        foreign key (service_id, unidad_id) references services (id, unidad_id) on delete cascade,
    constraint service_tareas_plan_fk
        foreign key (plan_id, unidad_id) references planes_mantenimiento (id, unidad_id) on delete cascade
);

create index service_tareas_plan_idx
    on service_tareas (plan_id);

-- =========================================================
-- postergaciones
-- =========================================================
create table postergaciones (
    id                  bigint generated always as identity primary key,
    plan_id             bigint not null references planes_mantenimiento(id) on delete cascade,
    motivo              motivo_postergacion not null,
    motivo_descripcion  varchar(255),
    km_limite_nuevo     int not null,
    usuario_id          uuid not null references usuarios(id),
    fecha               timestamptz not null default now(),
    cerrada             boolean not null default false,
    -- RN07: si el motivo es "otro", la descripción es obligatoria.
    constraint postergaciones_descripcion_si_otro
        check (motivo <> 'otro' or motivo_descripcion is not null)
);

create index postergaciones_plan_abiertas_idx
    on postergaciones (plan_id, cerrada);

create index postergaciones_usuario_idx
    on postergaciones (usuario_id);

-- =========================================================
-- fallas (DTC)
-- =========================================================
create table fallas (
    id                  bigint generated always as identity primary key,
    unidad_id           bigint not null references unidades(id) on delete cascade,
    codigo              varchar(30) not null,
    estado              estado_falla not null default 'activo',
    fecha_aparicion     timestamptz not null default now(),
    fecha_cierre        timestamptz,
    -- Destino de la FK compuesta (falla_id, unidad_id) de alertas.
    constraint fallas_id_unidad_uk unique (id, unidad_id)
);

create index fallas_unidad_estado_idx
    on fallas (unidad_id, estado);

-- =========================================================
-- alertas
-- =========================================================
create table alertas (
    id                      bigint generated always as identity primary key,
    unidad_id               bigint not null references unidades(id) on delete cascade,
    tipo                    tipo_alerta not null,
    -- Qué originó la alerta: una FK real por cada tabla posible, en lugar de un
    -- único "referencia_id" genérico (que no puede declararse como FK).
    plan_id                 bigint,
    falla_id                bigint,
    dispositivo_id          bigint references dispositivos(id) on delete cascade,
    estado                  estado_alerta not null default 'abierta',
    usuario_revisor_id      uuid references usuarios(id),
    fecha_generada          timestamptz not null default now(),
    fecha_revisada          timestamptz,
    -- El plan o la falla referenciados tienen que ser de la misma unidad que la alerta.
    -- Si plan_id o falla_id es NULL, la FK compuesta no se verifica (MATCH SIMPLE).
    -- dispositivo_id no se ata a la unidad: el dispositivo puede cambiar de unidad después.
    constraint alertas_plan_fk
        foreign key (plan_id, unidad_id) references planes_mantenimiento (id, unidad_id) on delete cascade,
    constraint alertas_falla_fk
        foreign key (falla_id, unidad_id) references fallas (id, unidad_id) on delete cascade,
    -- Exactamente una referencia cargada, y la que corresponde al tipo.
    constraint alertas_referencia_segun_tipo check (
        (tipo in ('tarea_proxima', 'tarea_vencida')
            and plan_id is not null and falla_id is null and dispositivo_id is null)
     or (tipo = 'falla_nueva'
            and falla_id is not null and plan_id is null and dispositivo_id is null)
     or (tipo = 'dispositivo_sin_reportar'
            and dispositivo_id is not null and plan_id is null and falla_id is null)
    )
);

create index alertas_estado_fecha_idx
    on alertas (estado, fecha_generada);

create index alertas_plan_idx        on alertas (plan_id)        where plan_id is not null;
create index alertas_falla_idx       on alertas (falla_id)       where falla_id is not null;
create index alertas_dispositivo_idx on alertas (dispositivo_id) where dispositivo_id is not null;
create index alertas_unidad_idx      on alertas (unidad_id);
create index alertas_revisor_idx     on alertas (usuario_revisor_id) where usuario_revisor_id is not null;

-- =========================================================
-- kilometraje_historial
-- Cargas manuales de kilometraje (RF06, RF16, RNF11).
-- =========================================================
create table kilometraje_historial (
    id          bigint generated always as identity primary key,
    unidad_id   bigint not null references unidades(id) on delete cascade,
    km          numeric(10,1) not null,
    fuente      fuente_km not null default 'manual',
    usuario_id  uuid not null references usuarios(id),
    fecha       timestamptz not null default now()
);

create index km_historial_unidad_fecha_idx
    on kilometraje_historial (unidad_id, fecha);

create index km_historial_usuario_idx
    on kilometraje_historial (usuario_id);

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