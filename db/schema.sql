-- Sistema de Telemetría Vehicular para el Mantenimiento Preventivo de Flotas Mixtas
-- Esquema de base de datos (PostgreSQL / Supabase)
-- Ver docs/entregas/02-arquitectura-modulos.md para el detalle y la justificación de cada tabla.
--
-- Cada tabla se identifica por sus propios datos (claves naturales): una unidad por su
-- patente, un dispositivo por su identificador de hardware, un plan por la unidad y la
-- tarea, etc. Las tablas que dependen de otra llevan la clave de esa tabla dentro de su PK.

-- =========================================================
-- Tipos enumerados
-- =========================================================
create type rol_usuario         as enum ('admin', 'mantenimiento');
create type tenencia_unidad     as enum ('propia', 'fletero');
create type protocolo_vehiculo  as enum ('J1939', 'J1979');
create type fuente_km           as enum ('odometro', 'estimado', 'manual');
create type estado_dispositivo  as enum ('activo', 'inactivo', 'sin_reportar');
create type tipo_lectura        as enum ('km', 'horas_motor');
create type estado_plan         as enum ('al_dia', 'proxima', 'vencida', 'postergada');
create type motivo_postergacion as enum ('falta_espacio', 'salida_urgente', 'otro');
create type tipo_alerta_plan    as enum ('tarea_proxima', 'tarea_vencida');

-- =========================================================
-- usuarios
-- Se identifican por su email, el mismo con el que inician sesión en Supabase Auth.
-- El backend obtiene el email del token de sesión y busca el rol en esta tabla (RN11).
-- =========================================================
create table usuarios (
    email       varchar(100) primary key,
    nombre      varchar(100),
    rol         rol_usuario not null,
    created_at  timestamptz not null default now()
);

-- =========================================================
-- unidades
-- =========================================================
create table unidades (
    patente     varchar(10) primary key,
    marca       varchar(50) not null,
    modelo      varchar(50),
    anio        smallint,
    tenencia    tenencia_unidad not null,
    titular     varchar(100),
    protocolo   protocolo_vehiculo not null,
    km_actual   numeric(10,1) not null default 0,
    km_fuente   fuente_km not null default 'manual',
    -- Baja lógica (RF02): una unidad dada de baja conserva todo su historial (RNF11).
    activa      boolean not null default true,
    created_at  timestamptz not null default now()
);

-- =========================================================
-- dispositivos
-- device_uid es el identificador que el firmware envía en cada mensaje MQTT.
-- patente es única: una unidad tiene a lo sumo un dispositivo vinculado, y un
-- dispositivo a lo sumo una unidad (RN02). Es NULL mientras no está vinculado.
-- =========================================================
create table dispositivos (
    device_uid           varchar(50) primary key,
    patente              varchar(10) unique references unidades (patente) on update cascade,
    estado               estado_dispositivo not null default 'inactivo',
    ultima_comunicacion  timestamptz,
    created_at           timestamptz not null default now()
);

-- =========================================================
-- lecturas
-- Una lectura queda identificada por el dispositivo que la envió, el instante en que la
-- tomó y qué se midió. Un mensaje MQTT trae a lo sumo una lectura de cada tipo; si llega
-- duplicado (reintento de QoS 1), la PK lo rechaza.
-- patente guarda la unidad a la que estaba vinculado el dispositivo en ese momento, para
-- que el historial no cambie si el dispositivo pasa a otra unidad (RF03, RN02).
-- Los códigos de falla del mensaje no se guardan acá sino en fallas.
-- =========================================================
create table lecturas (
    device_uid                  varchar(50) not null references dispositivos (device_uid) on update cascade,
    marca_tiempo_dispositivo    timestamptz not null,
    tipo                        tipo_lectura not null,
    patente                     varchar(10) not null references unidades (patente) on update cascade,
    valor                       numeric(12,1) not null,
    origen                      jsonb not null,
    marca_tiempo_recepcion      timestamptz not null default now(),
    consistente                 boolean not null default true,
    primary key (device_uid, marca_tiempo_dispositivo, tipo)
);

-- =========================================================
-- tareas_catalogo
-- Intervalos por defecto relevados en el caso de estudio (RN03).
-- =========================================================
create table tareas_catalogo (
    codigo                      varchar(20) primary key,
    nombre                      varchar(100) not null,
    intervalo_km_default        int not null check (intervalo_km_default > 0),
    umbral_aviso_km_default     int not null default 4000 check (umbral_aviso_km_default > 0)
);

insert into tareas_catalogo (codigo, nombre, intervalo_km_default, umbral_aviso_km_default) values
    ('ACEITE_MOTOR',  'Cambio de aceite de motor',         40000, 4000),
    ('SECADOR_AIRE',  'Filtro secador de aire de frenos', 100000, 4000),
    ('ACEITE_CAJA',   'Aceite de caja y diferencial',     150000, 4000);

-- =========================================================
-- planes_mantenimiento
-- Una tarea del catálogo aplicada a una unidad; concentra su estado (RF07, RF08).
-- =========================================================
create table planes_mantenimiento (
    patente             varchar(10) not null references unidades (patente) on update cascade,
    codigo_tarea        varchar(20) not null references tareas_catalogo (codigo) on update cascade,
    intervalo_km        int not null check (intervalo_km > 0),
    umbral_aviso_km     int not null check (umbral_aviso_km > 0),
    km_ultimo_service   numeric(10,1) not null default 0,
    estado              estado_plan not null default 'al_dia',
    created_at          timestamptz not null default now(),
    primary key (patente, codigo_tarea)
);

-- =========================================================
-- services
-- Un service por unidad y por día: cuando el camión entra al taller se hace todo lo
-- necesario y sale. Las tareas realizadas quedan en service_tareas.
-- =========================================================
create table services (
    patente         varchar(10) not null references unidades (patente) on update cascade,
    fecha           date not null default current_date,
    km              numeric(10,1) not null,
    observaciones   text,
    email_usuario   varchar(100) not null references usuarios (email) on update cascade,
    created_at      timestamptz not null default now(),
    primary key (patente, fecha)
);

-- =========================================================
-- service_tareas
-- Tareas del plan que cubrió cada service (RF09, RN06). La patente es la misma para el
-- service y para el plan porque forma parte de ambas claves: un service de una unidad
-- no puede cubrir el plan de otra.
-- =========================================================
create table service_tareas (
    patente         varchar(10) not null,
    fecha           date not null,
    codigo_tarea    varchar(20) not null,
    primary key (patente, fecha, codigo_tarea),
    foreign key (patente, fecha)
        references services (patente, fecha) on update cascade on delete cascade,
    foreign key (patente, codigo_tarea)
        references planes_mantenimiento (patente, codigo_tarea) on update cascade
);

-- =========================================================
-- postergaciones
-- =========================================================
create table postergaciones (
    patente             varchar(10) not null,
    codigo_tarea        varchar(20) not null,
    fecha               timestamptz not null default now(),
    motivo              motivo_postergacion not null,
    motivo_descripcion  varchar(255),
    km_limite_nuevo     int not null,
    email_usuario       varchar(100) not null references usuarios (email) on update cascade,
    cerrada             boolean not null default false,
    primary key (patente, codigo_tarea, fecha),
    foreign key (patente, codigo_tarea)
        references planes_mantenimiento (patente, codigo_tarea) on update cascade,
    -- RN07: si el motivo es "otro", la descripción es obligatoria.
    check (motivo <> 'otro' or motivo_descripcion is not null)
);

-- =========================================================
-- fallas (DTC)
-- Un mismo código puede aparecer, cerrarse y volver a aparecer: cada aparición es una fila.
-- Su estado (activa / inactiva) se deduce de fecha_cierre, no se guarda aparte.
-- =========================================================
create table fallas (
    patente             varchar(10) not null references unidades (patente) on update cascade,
    codigo              varchar(30) not null,
    fecha_aparicion     timestamptz not null default now(),
    -- La falla está activa mientras fecha_cierre sea NULL (RN12).
    fecha_cierre        timestamptz,
    primary key (patente, codigo, fecha_aparicion)
);

-- =========================================================
-- alertas (RF12, RF13)
-- Cada origen de alerta tiene su propia tabla, identificada por la clave de lo que la
-- originó. Una alerta está abierta mientras fecha_revisada sea NULL.
-- La vista "alertas" (al final) las une para listarlas juntas en el dashboard.
-- =========================================================

-- Tarea próxima o vencida. Un plan puede generar varias alertas a lo largo del tiempo.
create table alertas_plan (
    patente             varchar(10) not null,
    codigo_tarea        varchar(20) not null,
    tipo                tipo_alerta_plan not null,
    fecha_generada      timestamptz not null default now(),
    fecha_revisada      timestamptz,
    primary key (patente, codigo_tarea, tipo, fecha_generada),
    foreign key (patente, codigo_tarea)
        references planes_mantenimiento (patente, codigo_tarea) on update cascade
);

-- Falla nueva: una alerta por cada aparición de un código (RN12).
create table alertas_falla (
    patente             varchar(10) not null,
    codigo              varchar(30) not null,
    fecha_aparicion     timestamptz not null,
    fecha_generada      timestamptz not null default now(),
    fecha_revisada      timestamptz,
    primary key (patente, codigo, fecha_aparicion),
    foreign key (patente, codigo, fecha_aparicion)
        references fallas (patente, codigo, fecha_aparicion) on update cascade
);

-- Dispositivo sin reportar (RN10).
create table alertas_dispositivo (
    device_uid          varchar(50) not null references dispositivos (device_uid) on update cascade,
    fecha_generada      timestamptz not null default now(),
    fecha_revisada      timestamptz,
    primary key (device_uid, fecha_generada)
);

-- =========================================================
-- kilometraje_historial
-- Cargas manuales de kilometraje (RF06, RF16, RNF11).
-- =========================================================
create table kilometraje_historial (
    patente         varchar(10) not null references unidades (patente) on update cascade,
    fecha           timestamptz not null default now(),
    km              numeric(10,1) not null,
    fuente          fuente_km not null default 'manual',
    email_usuario   varchar(100) not null references usuarios (email) on update cascade,
    primary key (patente, fecha)
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
alter table alertas_plan enable row level security;
alter table alertas_falla enable row level security;
alter table alertas_dispositivo enable row level security;
alter table kilometraje_historial enable row level security;

-- =========================================================
-- Vista: todas las alertas juntas (RF13)
-- security_invoker hace que la vista respete el RLS de las tablas de origen.
-- =========================================================
create view alertas with (security_invoker = true) as
    select patente, tipo::text as tipo, codigo_tarea as referencia, fecha_generada, fecha_revisada
      from alertas_plan
    union all
    select patente, 'falla_nueva', codigo, fecha_generada, fecha_revisada
      from alertas_falla
    union all
    select d.patente, 'dispositivo_sin_reportar', a.device_uid, a.fecha_generada, a.fecha_revisada
      from alertas_dispositivo a
      join dispositivos d on d.device_uid = a.device_uid;
