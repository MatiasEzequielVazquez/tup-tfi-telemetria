# Tecnicatura Universitaria en Programación a Distancia
### Trabajo Final Integrador
**2ª Entrega — Arquitectura y Módulos (Condición de Regular)**

# Sistema de Telemetría Vehicular para el Mantenimiento Preventivo de Flotas Mixtas

**Integrantes:** Patricio Sussini Guanziroli (hardware y firmware, frontend), Matias Ezequiel Vazquez (backend, bases de datos e infraestructura)

**Tutor:** Sebastián Bruselario

Este documento presenta el esquema de base de datos y el listado de módulos a desarrollar, en base a los requerimientos funcionales (RF), no funcionales (RNF) y reglas de negocio (RN) definidos en la [1ª Entrega — Propuesta de proyecto](01-propuesta-proyecto.md).

---

## Índice

- [Tecnicatura Universitaria en Programación a Distancia](#tecnicatura-universitaria-en-programación-a-distancia)
    - [Trabajo Final Integrador](#trabajo-final-integrador)
- [Sistema de Telemetría Vehicular para el Mantenimiento Preventivo de Flotas Mixtas](#sistema-de-telemetría-vehicular-para-el-mantenimiento-preventivo-de-flotas-mixtas)
  - [Índice](#índice)
  - [1. Motor de base de datos](#1-motor-de-base-de-datos)
  - [2. Esquema de base de datos](#2-esquema-de-base-de-datos)
    - [2.1 Diagrama entidad-relación](#21-diagrama-entidad-relación)
    - [2.2 Tablas](#22-tablas)
      - [`usuarios`](#usuarios)
      - [`unidades`](#unidades)
      - [`dispositivos`](#dispositivos)
      - [`parametros` (catálogo, opcional para reportes)](#parametros-catálogo-opcional-para-reportes)
      - [`lecturas`](#lecturas)
      - [`tareas_catalogo`](#tareas_catalogo)
      - [`planes_mantenimiento`](#planes_mantenimiento)
      - [`services`](#services)
      - [`service_tareas`](#service_tareas)
      - [`postergaciones`](#postergaciones)
      - [`fallas`](#fallas)
      - [`alertas`](#alertas)
      - [`kilometraje_historial`](#kilometraje_historial)
    - [2.3 Índices](#23-índices)
    - [2.4 Decisiones de diseño](#24-decisiones-de-diseño)
  - [3. Listado de módulos](#3-listado-de-módulos)
    - [3.1 Orden de desarrollo](#31-orden-de-desarrollo)
    - [3.2 Contrato del mensaje MQTT](#32-contrato-del-mensaje-mqtt)
  - [4. Trazabilidad entre requerimientos y diseño](#4-trazabilidad-entre-requerimientos-y-diseño)

---

## 1. Motor de base de datos

**Relacional: PostgreSQL, provisto por Supabase (plan gratuito).**

Se descarta un motor documental porque el dominio central del sistema —unidades, dispositivos, planes de mantenimiento, tareas, services y postergaciones— tiene relaciones fijas y con integridad referencial importante (por ejemplo, RN02: un dispositivo vinculado como máximo a una unidad; RN06: registrar un service cierra postergaciones abiertas de esa tarea). PostgreSQL además admite columnas `JSONB`, que se usan puntualmente para datos de forma variable (el payload crudo de cada lectura MQTT), combinando ambos modelos sin necesitar dos motores. Supabase se eligió también en la propuesta ([sección 9.4](01-propuesta-proyecto.md#94-stack-de-software)) porque incluye autenticación de usuarios integrada, lo que cubre RF01 y RF17.

## 2. Esquema de base de datos

### 2.1 Diagrama entidad-relación

![Diagrama entidad-relación](../diagramas/07-diagrama-entidad-relacion.png)

### 2.2 Tablas

**Convenciones de tipos.**
- **Claves primarias:** `bigint` autoincremental (`GENERATED ALWAYS AS IDENTITY`). La única excepción es `usuarios.id`, que es `uuid` porque replica el id del usuario en Supabase Auth (`auth.users`). Por eso las FK hacia `usuarios` son `uuid` y el resto `bigint`.
- **Textos:** `varchar(n)` cuando el dato tiene un largo máximo razonable (patente, email, código de falla) y `text` solo para campos libres (`observaciones`).
- **Valores cerrados:** las columnas con un conjunto fijo de valores (rol, estados, tipos, motivos) usan tipos `ENUM` de PostgreSQL:

| Tipo | Valores |
|---|---|
| `rol_usuario` | `admin`, `mantenimiento` |
| `tenencia_unidad` | `propia`, `fletero` |
| `protocolo_vehiculo` | `J1939`, `J1979` |
| `fuente_km` | `odometro`, `estimado`, `manual` |
| `estado_dispositivo` | `activo`, `inactivo`, `sin_reportar` |
| `tipo_lectura` | `km`, `horas_motor`, `dtc`, `heartbeat` |
| `estado_plan` | `al_dia`, `proxima`, `vencida`, `postergada` |
| `motivo_postergacion` | `falta_espacio`, `salida_urgente`, `otro` |
| `estado_falla` | `activo`, `inactivo` |
| `tipo_alerta` | `tarea_proxima`, `tarea_vencida`, `falla_nueva`, `dispositivo_sin_reportar` |
| `estado_alerta` | `abierta`, `revisada` |

#### `usuarios`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid, PK | Gestionado por Supabase Auth. |
| `email` | varchar(100), único | RF01. |
| `nombre` | varchar(100), nullable | |
| `rol` | `rol_usuario` | `admin` \| `mantenimiento` (RN11). |
| `created_at` | timestamptz | |

#### `unidades`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `patente` | varchar(10), único | RF02. |
| `marca`, `modelo`, `anio` | varchar(50), varchar(50), smallint | RF02. |
| `tenencia` | `tenencia_unidad` | `propia` \| `fletero` (RF02, RN01). |
| `titular` | varchar(100), nullable | Dueño de la unidad si es de un fletero. |
| `protocolo` | `protocolo_vehiculo` | `J1939` \| `J1979`, protocolo del vehículo (RN08, RNF08). |
| `km_actual` | numeric(10,1) | Último kilometraje válido conocido (RF05). |
| `km_fuente` | `fuente_km` | `odometro` \| `estimado` \| `manual` (RF05, RN08). |
| `created_at` | timestamptz | |

#### `dispositivos`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `device_uid` | varchar(50), único | Identificador que envía el firmware (RF03). |
| `unidad_id` | bigint, FK → `unidades.id`, único, nullable | Único para que una unidad tenga a lo sumo un dispositivo activo y un dispositivo esté vinculado a lo sumo a una unidad (RN02). `NULL` mientras el dispositivo no está vinculado. |
| `estado` | `estado_dispositivo` | `activo` \| `inactivo` \| `sin_reportar` (RF03, RN10). |
| `ultima_comunicacion` | timestamptz | Actualizada en cada mensaje MQTT válido; la usa el temporizador de CU14. |
| `created_at` | timestamptz | |

#### `parametros` (catálogo, opcional para reportes)

No se modela como tabla separada en esta versión: el tipo de lectura (`km`, `horas_motor`, `dtc`) alcanza para el cálculo de mantenimiento. El detalle del parámetro de origen (PGN/SPN en J1939, PID en J1979) se conserva sin normalizar dentro de `lecturas.payload`, para no acoplar el esquema a los parámetros de un protocolo específico (RNF08, RNF09).

#### `lecturas`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `dispositivo_id` | bigint, FK → `dispositivos.id` | RF04. |
| `unidad_id` | bigint, FK → `unidades.id` | Unidad a la que estaba vinculado el dispositivo al momento de la lectura. Ver 2.4. |
| `tipo` | `tipo_lectura` | `km` \| `horas_motor` \| `dtc` \| `heartbeat`. |
| `payload` | jsonb | Datos crudos del mensaje: protocolo, y según el tipo, valor numérico o código de falla, más el identificador del parámetro de origen (PGN+SPN o PID). |
| `marca_tiempo_dispositivo` | timestamptz | Timestamp original del dispositivo (RNF02). |
| `marca_tiempo_recepcion` | timestamptz | RF04. |
| `consistente` | boolean | `false` si una lectura de `km` es menor al `km_actual` de la unidad (RN09); no actualiza el kilometraje pero queda auditada. |

#### `tareas_catalogo`

Catálogo de tipos de tarea de mantenimiento, con los intervalos por defecto relevados en el caso de estudio (RN03).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `nombre` | varchar(100), único | Ej.: "Cambio de aceite de motor", "Filtro secador de aire de frenos", "Aceite de caja y diferencial". |
| `intervalo_km_default` | int | 40.000 / 100.000 / 150.000 según la tarea. |
| `umbral_aviso_km_default` | int | 4.000 km por defecto (RN05). |

#### `planes_mantenimiento`

Instancia cada tarea del catálogo sobre una unidad concreta (RF07). Es también la tabla que concentra el estado de mantenimiento de cada tarea por unidad (RF08).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `unidad_id` | bigint, FK → `unidades.id` | |
| `tarea_id` | bigint, FK → `tareas_catalogo.id` | |
| `intervalo_km` | int | Copiado del catálogo al crear el plan; editable por unidad (RN03). |
| `umbral_aviso_km` | int | Ídem. |
| `km_ultimo_service` | numeric(10,1) | Kilometraje desde el que se cuenta el intervalo; se reinicia al registrar un service (RN06). |
| `estado` | `estado_plan` | `al_dia` \| `proxima` \| `vencida` \| `postergada`, calculado según RN04, RN05, RN07. |
| `created_at` | timestamptz | |

Restricciones: combinación `(unidad_id, tarea_id)` única, para no duplicar una tarea en la misma unidad; y `(id, unidad_id)` única, que es el destino de las FK compuestas de `service_tareas` y `alertas`.

#### `services`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `unidad_id` | bigint, FK → `unidades.id` | |
| `fecha` | date | RF09. |
| `km` | numeric(10,1) | Kilometraje al momento del service; si supera el `km_actual` de la unidad, la actualiza (RN08). |
| `observaciones` | text, nullable | |
| `usuario_id` | uuid, FK → `usuarios.id` | Trazabilidad (RNF11). |
| `created_at` | timestamptz | |

Restricción: `(id, unidad_id)` única, destino de la FK compuesta de `service_tareas`.

#### `service_tareas`

Tabla de unión: un service puede cubrir varias tareas del plan de mantenimiento (RF09, RN06).

| Columna | Tipo | Notas |
|---|---|---|
| `service_id` | bigint, PK, FK → `services.id` | FK compuesta `(service_id, unidad_id)` → `services (id, unidad_id)`. |
| `plan_id` | bigint, PK, FK → `planes_mantenimiento.id` | FK compuesta `(plan_id, unidad_id)` → `planes_mantenimiento (id, unidad_id)`. |
| `unidad_id` | bigint, FK | Unidad del service y del plan. Al formar parte de las dos FK compuestas, obliga a que ambos sean de la misma unidad. |

Clave primaria compuesta `(service_id, plan_id)`. Ver 2.4 sobre las FK compuestas.

#### `postergaciones`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `plan_id` | bigint, FK → `planes_mantenimiento.id` | |
| `motivo` | `motivo_postergacion` | `falta_espacio` \| `salida_urgente` \| `otro` (RF10, RN07). |
| `motivo_descripcion` | varchar(255), nullable | Obligatorio si `motivo = 'otro'` (restricción `postergaciones_descripcion_si_otro`). |
| `km_limite_nuevo` | int | RN07. |
| `usuario_id` | uuid, FK → `usuarios.id` | RNF11. |
| `fecha` | timestamptz | |
| `cerrada` | boolean | Se marca `true` al registrar el service correspondiente (RN06). |

#### `fallas`

Códigos de falla (DTC) informados por una unidad (RF11).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `unidad_id` | bigint, FK → `unidades.id` | |
| `codigo` | varchar(30) | Código de falla informado por el vehículo (DM1 en J1939, DTC en J1979). |
| `estado` | `estado_falla` | `activo` \| `inactivo` (RN12). |
| `fecha_aparicion` | timestamptz | |
| `fecha_cierre` | timestamptz | Nula mientras está activo. |

Restricción: `(id, unidad_id)` única, destino de la FK compuesta de `alertas`.

#### `alertas`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `unidad_id` | bigint, FK → `unidades.id` | |
| `tipo` | `tipo_alerta` | `tarea_proxima` \| `tarea_vencida` \| `falla_nueva` \| `dispositivo_sin_reportar` (RF12). |
| `plan_id` | bigint, FK → `planes_mantenimiento.id`, nullable | Cargado solo si `tipo` es `tarea_proxima` o `tarea_vencida`. FK compuesta `(plan_id, unidad_id)`: el plan tiene que ser de la misma unidad. |
| `falla_id` | bigint, FK → `fallas.id`, nullable | Cargado solo si `tipo = 'falla_nueva'`. FK compuesta `(falla_id, unidad_id)`: la falla tiene que ser de la misma unidad. |
| `dispositivo_id` | bigint, FK → `dispositivos.id`, nullable | Cargado solo si `tipo = 'dispositivo_sin_reportar'`. No se ata a la unidad: el dispositivo puede cambiar de unidad después de generada la alerta. |
| `estado` | `estado_alerta` | `abierta` \| `revisada` (RF13). |
| `usuario_revisor_id` | uuid, FK → `usuarios.id`, nullable | |
| `fecha_generada` | timestamptz | |
| `fecha_revisada` | timestamptz, nullable | |

Restricción `alertas_referencia_segun_tipo`: exactamente una de `plan_id`, `falla_id`, `dispositivo_id` tiene valor, y es la que corresponde a `tipo`.

#### `kilometraje_historial`

Registra cada carga manual de kilometraje, para trazabilidad y para el historial por unidad (RF06, RF16, RNF11).

| Columna | Tipo | Notas |
|---|---|---|
| `id` | bigint, PK autoincremental | |
| `unidad_id` | bigint, FK → `unidades.id` | |
| `km` | numeric(10,1) | |
| `fuente` | `fuente_km` | Siempre `manual` en esta tabla (las fuentes automáticas quedan en `lecturas`); se usa el mismo tipo que `unidades.km_fuente`. |
| `usuario_id` | uuid, FK → `usuarios.id` | |
| `fecha` | timestamptz | |

### 2.3 Índices

- `lecturas (dispositivo_id, marca_tiempo_recepcion)`: consultas de la última lectura por dispositivo (RF04).
- `lecturas (unidad_id, marca_tiempo_recepcion)`: histórico de lecturas de una unidad (RF04, RF16).
- `dispositivos (device_uid)` único: identificar el dispositivo emisor en cada mensaje MQTT.
- `dispositivos (unidad_id)` único parcial (`WHERE unidad_id IS NOT NULL`): refuerza RN02.
- `planes_mantenimiento (unidad_id, estado)`: la vista de la flota filtra y ordena por estado más crítico (RF14).
- `planes_mantenimiento (unidad_id, tarea_id)` único: evita duplicar el plan de una tarea sobre la misma unidad.
- `fallas (unidad_id, estado)`: contar fallas activas por unidad (RF14, RF15).
- `alertas (estado, fecha_generada)`: listar alertas abiertas ordenadas por antigüedad (RF13).
- `alertas (plan_id)`, `alertas (falla_id)`, `alertas (dispositivo_id)`, parciales (`WHERE ... IS NOT NULL`): buscar la alerta abierta de un plan, falla o dispositivo antes de generar otra.
- `postergaciones (plan_id, cerrada)`: saber si un plan tiene una postergación abierta (RN06, RN07).
- `planes_mantenimiento (id, unidad_id)`, `services (id, unidad_id)`, `fallas (id, unidad_id)` únicos: destino de las FK compuestas (ver 2.4).
- `services (unidad_id, fecha)`, `kilometraje_historial (unidad_id, fecha)`, `alertas (unidad_id)`: historial y alertas por unidad (RF13, RF16).
- `service_tareas (plan_id)`: services que cubrieron un plan (la PK ya indexa por `service_id`).
- `planes_mantenimiento (tarea_id)`, y `usuario_id` en `services`, `postergaciones` y `kilometraje_historial`, `alertas (usuario_revisor_id)`: PostgreSQL no indexa las FK automáticamente; sin estos índices, borrar o actualizar una fila referenciada obliga a recorrer toda la tabla hija.

### 2.4 Decisiones de diseño

- **Modelo agnóstico de protocolo.** Ninguna tabla depende de si la unidad usa J1939 o J1979: `unidades.protocolo` registra cuál usa cada una y el detalle del parámetro de origen (PGN/SPN o PID) queda en `lecturas.payload`. Esto sostiene RNF08 (portabilidad) y RNF09 (aislar la interpretación del protocolo en el módulo de ingesta, sin que un cambio de firmware afecte al resto del sistema).
- **`planes_mantenimiento` como entidad central del estado de mantenimiento.** En vez de recalcular el estado de cada tarea en cada consulta a partir de todo el historial de services, cada plan guarda `km_ultimo_service` y `estado`, que se actualizan al procesar una lectura de kilometraje (CU06) o al registrar un service (CU09) o una postergación (CU10). Esto resuelve directamente RF08 y las reglas RN04 a RN07.
- **`service_tareas` en vez de una tarea por service.** Un mismo evento de taller normalmente cubre varias tareas a la vez (aceite de motor y filtros, por ejemplo), tal como surge de la entrevista al mecánico. Modelarlo como tabla de unión evita duplicar `services` por cada tarea realizada el mismo día.
- **`lecturas.payload` en JSONB.** El formato exacto de cada lectura varía según el protocolo y el tipo de dato; usar una columna JSONB evita crear una tabla o columna por cada combinación de protocolo y parámetro, a costa de no poder indexar el contenido interno (aceptable: las consultas de mantenimiento se resuelven contra `planes_mantenimiento`, no contra `lecturas`).
- **Kilometraje nunca disminuye (RN09).** No se modela con una restricción de base de datos (requeriría conocer el máximo histórico en cada insert); se resuelve en el módulo de ingesta, que compara contra `unidades.km_actual` antes de escribir y marca `lecturas.consistente = false` cuando corresponde.

- **Referencias de `alertas` con una FK por tabla de origen.** Una alerta puede originarse en un plan de mantenimiento, en una falla o en un dispositivo. Un único campo genérico (`referencia_id`) que apunte a una tabla u otra según `tipo` no se puede declarar como clave foránea, por lo que la base no garantizaría que el registro referenciado exista. Por eso se usan tres FK opcionales (`plan_id`, `falla_id`, `dispositivo_id`) y una restricción `CHECK` que exige que haya exactamente una cargada y que coincida con `tipo`.
- **`lecturas.unidad_id` además de `dispositivo_id`.** Un dispositivo puede desvincularse de una unidad y vincularse a otra (RF03, RN02). Si la lectura solo guardara el dispositivo, al moverlo todo su historial pasaría a atribuirse a la unidad nueva. Guardar la unidad al momento de la recepción conserva el historial correcto de cada unidad. El módulo de ingesta solo acepta lecturas de dispositivos vinculados (precondición de CU06), por lo que la columna nunca queda vacía.

- **Claves primarias autoincrementales.** Se usa `bigint` autoincremental en todas las tablas: es más compacto que un `uuid` (8 bytes contra 16), mantiene los índices ordenados en tablas de alto volumen como `lecturas` y es legible al depurar. La exposición de ids correlativos en la API no es un riesgo en este sistema porque todos los endpoints requieren autenticación (RNF04). `usuarios` es la excepción: su PK debe coincidir con el `uuid` que asigna Supabase Auth.
- **Tipos `ENUM` para valores cerrados.** Roles, estados, tipos y motivos tienen un conjunto de valores definido por los requerimientos. Un `ENUM` documenta esos valores en el propio esquema y rechaza cualquier otro. Agregar un valor nuevo es simple (`ALTER TYPE ... ADD VALUE`); quitarlo no, pero los valores de este dominio son estables. Se descartó modelarlos como tablas de catálogo porque no tienen atributos propios ni se administran desde la aplicación.
- **`varchar(n)` para textos acotados.** En PostgreSQL `varchar(n)` y `text` se almacenan igual; `varchar(n)` se usa donde el largo máximo es una regla del dato (patente, email, código de falla), para que la base rechace valores inválidos.
- **FK compuestas para que las referencias sean de la misma unidad.** `service_tareas` relaciona un service con un plan, y ambos pertenecen a una unidad; con FK simples, la base aceptaría que un service de una unidad cubra el plan de otra. Lo mismo pasa en `alertas` entre `unidad_id` y el plan o la falla que la originó. Para evitarlo, `planes_mantenimiento`, `services` y `fallas` declaran `(id, unidad_id)` como único, y las tablas que los referencian usan FK compuestas que incluyen `unidad_id`. Así la regla la garantiza la base y no depende del backend.

## 3. Listado de módulos

| # | Módulo | Responsabilidad | RF / RN que cubre |
|---|---|---|---|
| M1 | Autenticación y autorización | Login con Supabase Auth; verificación de rol (`admin` \| `mantenimiento`) en cada operación. | RF01, RF17, RN11, RNF04 |
| M2 | Gestión de unidades y dispositivos | Alta, baja y modificación de unidades y dispositivos; vinculación dispositivo–unidad. | RF02, RF03, RN01, RN02 |
| M3 | Ingesta MQTT | Suscripción al broker, validación de mensajes, interpretación del payload según protocolo, persistencia en `lecturas`, actualización de `unidades.km_actual` y `dispositivos.ultima_comunicacion`. | RF04, RF05, RNF01, RNF02, RNF03, RNF07, RNF08, RNF09, RN08, RN09 |
| M4 | Motor de mantenimiento | Gestión del catálogo de tareas y de los planes por unidad; recalcula el estado de cada plan ante cada lectura de kilometraje relevante. | RF07, RF08, RN03, RN04, RN05 |
| M5 | Services y postergaciones | Registro de services (con sus tareas cubiertas) y de postergaciones; reinicia el conteo del plan y cierra postergaciones abiertas. | RF09, RF10, RF16, RN06, RN07, RNF11 |
| M6 | Gestión de fallas (DTC) | Alta y cierre de códigos de falla informados por cada unidad. | RF11, RN12 |
| M7 | Alertas | Generación de alertas desde M3, M4 y M6; consulta y marcado como revisada. | RF12, RF13 |
| M8 | Temporizador de dispositivos | Proceso periódico que detecta dispositivos sin reportar y genera/cierra la alerta correspondiente (CU14). | RF12, RN10 |
| M9 | API REST y dashboard | Endpoints para el frontend: vista de flota, detalle de unidad, historial, carga manual de kilometraje. | RF06, RF14, RF15, RF16, RNF06, RNF10 |

### 3.1 Orden de desarrollo

1. **M1 — Autenticación y autorización**, porque el resto de los módulos requiere un usuario y un rol para operar.
2. **M2 — Gestión de unidades y dispositivos**, porque sin unidades ni dispositivos no hay nada que monitorear.
3. **M3 — Ingesta MQTT**, con el simulador de flota ([sección 9.2 de la propuesta](01-propuesta-proyecto.md#92-estrategia-de-validación)) como fuente de datos mientras no hay hardware conectado en forma continua.
4. **M4 — Motor de mantenimiento**, que consume las lecturas de M3 y necesita M2 para saber a qué unidades aplicar los planes.
5. **M6 — Gestión de fallas**, en paralelo con M4: ambos se disparan desde M3.
6. **M5 — Services y postergaciones**, que depende de que M4 exista para tener planes sobre los cuales operar.
7. **M7 — Alertas**, una vez que M3, M4 y M6 generan los eventos que las disparan.
8. **M8 — Temporizador de dispositivos**, independiente del resto salvo por M2 (necesita la lista de dispositivos activos) y M7 (para generar la alerta).
9. **M9 — API REST y dashboard**, en paralelo con el frontend, a medida que cada módulo anterior expone datos consultables.

### 3.2 Contrato del mensaje MQTT

Mensaje publicado por el dispositivo, protocolo-agnóstico (a diferencia de un contrato atado a códigos PID de J1979):

```json
{
  "device_uid": "esp32-0F3A21",
  "protocolo": "J1939",
  "timestamp": "2026-09-20T14:32:10Z",
  "lecturas": [
    { "tipo": "km", "valor": 812430, "origen": { "pgn": 65248 } },
    { "tipo": "horas_motor", "valor": 15320, "origen": { "pgn": 65253 } },
    { "tipo": "dtc", "codigo": "SPN-100-FMI-3", "activo": true, "origen": { "pgn": "DM1" } }
  ]
}
```

Para una unidad con protocolo `J1979`, el campo `origen` usa `{ "pid": "010C" }` en vez de `pgn`/`spn`, y el kilometraje se envía como `tipo: "km"` estimado por integración de velocidad, según lo definido en RN08. El módulo de ingesta (M3) es el único que interpreta `origen`; el resto del sistema solo usa `tipo` y `valor`.

## 4. Trazabilidad entre requerimientos y diseño

| Requerimiento / regla | Tabla(s) | Módulo(s) |
|---|---|---|
| RF01, RF17, RN11 | `usuarios` | M1 |
| RF02, RN01 | `unidades` | M2 |
| RF03, RN02 | `dispositivos` | M2 |
| RF04, RF05, RNF01–03, RNF07–09, RN08, RN09 | `lecturas`, `unidades.km_actual` | M3 |
| RF06 | `kilometraje_historial` | M9 |
| RF07, RN03 | `tareas_catalogo`, `planes_mantenimiento` | M4 |
| RF08, RN04, RN05 | `planes_mantenimiento.estado` | M4 |
| RF09, RN06, RNF11 | `services`, `service_tareas` | M5 |
| RF10, RN07 | `postergaciones` | M5 |
| RF11, RN12 | `fallas` | M6 |
| RF12, RF13 | `alertas` | M7 |
| RN10 | `dispositivos.ultima_comunicacion`, `alertas` | M8 |
| RF14, RF15, RF16 | vistas sobre `unidades`, `planes_mantenimiento`, `fallas`, `services`, `postergaciones` | M9 |