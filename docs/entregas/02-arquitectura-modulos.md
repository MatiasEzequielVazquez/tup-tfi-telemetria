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
      - [`vinculaciones`](#vinculaciones)
      - [`parametros` (catálogo, opcional para reportes)](#parametros-catálogo-opcional-para-reportes)
      - [`lecturas`](#lecturas)
      - [`tareas_catalogo`](#tareas_catalogo)
      - [`planes_mantenimiento`](#planes_mantenimiento)
      - [`services`](#services)
      - [`service_tareas`](#service_tareas)
      - [`postergaciones`](#postergaciones)
      - [`fallas`](#fallas)
      - [`alertas_plan`, `alertas_falla`, `alertas_dispositivo`](#alertas_plan-alertas_falla-alertas_dispositivo)
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

Se descarta un motor documental porque el dominio central del sistema —unidades, dispositivos, planes de mantenimiento, tareas, services y postergaciones— tiene relaciones fijas y con integridad referencial importante (por ejemplo, RN02: un dispositivo vinculado como máximo a una unidad; RN06: registrar un service cierra postergaciones abiertas de esa tarea). PostgreSQL además admite columnas `JSONB`, que se usan puntualmente para datos de forma variable (el parámetro de origen de cada lectura, que depende del protocolo), combinando ambos modelos sin necesitar dos motores. Supabase se eligió también en la propuesta ([sección 9.4](01-propuesta-proyecto.md#94-stack-de-software)) porque incluye autenticación de usuarios integrada, lo que cubre RF01 y RF17.

## 2. Esquema de base de datos

### 2.1 Diagrama entidad-relación

![Diagrama entidad-relación](../diagramas/07-diagrama-entidad-relacion.png)

### 2.2 Tablas

**Convenciones.**
- **Claves naturales:** cada tabla se identifica por sus propios datos y no por un número generado. Una unidad se identifica por su patente, un dispositivo por el identificador que envía su firmware, una tarea del catálogo por un código y un usuario por su email. Las entidades históricas agregan los datos necesarios para identificar cada hecho: una vinculación es `(device_uid, desde)`, un plan es `(patente, codigo_tarea)` y un service es `(patente, fecha)`. Ver 2.4.
- **Textos:** `varchar(n)` cuando el dato tiene un largo máximo razonable (patente, email, códigos) y `text` solo para campos libres (`observaciones`).
- **Valores cerrados:** las columnas con un conjunto fijo de valores (rol, estados, tipos, motivos) usan tipos `ENUM` de PostgreSQL:

| Tipo | Valores |
|---|---|
| `rol_usuario` | `admin`, `mantenimiento` |
| `tenencia_unidad` | `propia`, `fletero` |
| `protocolo_vehiculo` | `J1939`, `J1979` |
| `fuente_km` | `odometro`, `estimado`, `manual` |
| `estado_dispositivo` | `activo`, `inactivo`, `sin_reportar` |
| `tipo_lectura` | `km`, `horas_motor` |
| `estado_plan` | `al_dia`, `proxima`, `vencida`, `postergada` |
| `motivo_postergacion` | `falta_espacio`, `salida_urgente`, `otro` |
| `tipo_alerta_plan` | `tarea_proxima`, `tarea_vencida` |

#### `usuarios`

| Columna | Tipo | Notas |
|---|---|---|
| `email` | varchar(100), PK | Email con el que el usuario inicia sesión en Supabase Auth (RF01). |
| `nombre` | varchar(100), nullable | |
| `rol` | `rol_usuario` | `admin` \| `mantenimiento` (RN11). |
| `created_at` | timestamptz | |

#### `unidades`

| Columna | Tipo | Notas |
|---|---|---|
| `patente` | varchar(10), PK | RF02. |
| `marca`, `modelo`, `anio` | varchar(50), varchar(50), smallint | RF02. |
| `tenencia` | `tenencia_unidad` | `propia` \| `fletero` (RF02, RN01). |
| `titular` | varchar(100), nullable | Dueño de la unidad si es de un fletero. |
| `protocolo` | `protocolo_vehiculo` | `J1939` \| `J1979`, protocolo del vehículo (RN08, RNF08). |
| `km_actual` | numeric(10,1) | Último kilometraje válido conocido (RF05). |
| `km_fuente` | `fuente_km` | `odometro` \| `estimado` \| `manual` (RF05, RN08). |
| `activa` | boolean | Baja lógica (RF02): una unidad dada de baja conserva su historial. Ver 2.4. |
| `created_at` | timestamptz | |

#### `dispositivos`

| Columna | Tipo | Notas |
|---|---|---|
| `device_uid` | varchar(50), PK | Identificador que envía el firmware en cada mensaje (RF03). |
| `estado` | `estado_dispositivo` | `activo` \| `inactivo` \| `sin_reportar` (RF03, RN10). |
| `ultima_comunicacion` | timestamptz | Actualizada en cada mensaje MQTT válido; la usa el temporizador de CU14. |
| `created_at` | timestamptz | |

La relación dispositivo–unidad no se guarda como atributo actual: se registra en `vinculaciones` para conservar el historial de cambios.

#### `vinculaciones`

Historial de qué dispositivo estuvo instalado en qué unidad y durante qué intervalo (RF03, RN02). PK: `(device_uid, desde)`.

| Columna | Tipo | Notas |
|---|---|---|
| `device_uid` | varchar(50), PK, FK → `dispositivos` | Dispositivo instalado. |
| `patente` | varchar(10), FK → `unidades` | Unidad a la que se vinculó. |
| `desde` | timestamptz, PK | Inicio de la vinculación. |
| `hasta` | timestamptz, nullable | Fin de la vinculación; `NULL` significa vigente. |

Se usan restricciones `EXCLUDE` sobre rangos de tiempo para impedir que un dispositivo tenga dos unidades simultáneas ni que una unidad tenga dos dispositivos simultáneos. El rango es `[desde, hasta)`, por lo que una vinculación puede terminar exactamente cuando comienza la siguiente.

#### `parametros` (catálogo, opcional para reportes)

No se modela como tabla separada en esta versión: el tipo de lectura (`km`, `horas_motor`) alcanza para el cálculo de mantenimiento. El detalle del parámetro de origen (PGN/SPN en J1939, PID en J1979) se conserva sin normalizar en `lecturas.origen`, para no acoplar el esquema a los parámetros de un protocolo específico (RNF08, RNF09).

#### `lecturas`

PK: `(device_uid, marca_tiempo_dispositivo, tipo)`. Una lectura queda identificada por el dispositivo que la envió, el instante en que la tomó y qué midió. Además referencia la vinculación vigente al momento de la lectura mediante `(device_uid, vinculacion_desde)`. Si un mensaje llega duplicado (reintento de MQTT con QoS 1), la PK lo rechaza.

| Columna | Tipo | Notas |
|---|---|---|
| `device_uid` | varchar(50), PK | Identifica el dispositivo a través de la FK compuesta a `vinculaciones`. RF04. |
| `marca_tiempo_dispositivo` | timestamptz, PK | Timestamp original del dispositivo (RNF02). |
| `tipo` | `tipo_lectura`, PK | `km` \| `horas_motor`. |
| `vinculacion_desde` | timestamptz, FK junto con `device_uid` → `vinculaciones` | Identifica la vinculación histórica vigente al momento de la lectura; permite obtener la unidad sin duplicar `patente`. |
| `valor` | numeric(12,1) | Valor medido. |
| `origen` | jsonb | Parámetro de origen según el protocolo: `{ "pgn": ..., "spn": ... }` o `{ "pid": ... }`. |
| `marca_tiempo_recepcion` | timestamptz | RF04. |
| `consistente` | boolean | `false` si una lectura de `km` es menor al `km_actual` de la unidad (RN09); no actualiza el kilometraje pero queda auditada. |

Los códigos de falla que llegan en el mismo mensaje no se guardan en `lecturas`: el módulo de ingesta los registra directamente en `fallas`.

#### `tareas_catalogo`

Catálogo de tipos de tarea de mantenimiento, con los intervalos por defecto relevados en el caso de estudio (RN03).

| Columna | Tipo | Notas |
|---|---|---|
| `codigo` | varchar(20), PK | Ej.: `ACEITE_MOTOR`, `SECADOR_AIRE`, `ACEITE_CAJA`. |
| `nombre` | varchar(100) | Ej.: "Cambio de aceite de motor", "Filtro secador de aire de frenos", "Aceite de caja y diferencial". |
| `intervalo_km_default` | int | 40.000 / 100.000 / 150.000 según la tarea. |
| `umbral_aviso_km_default` | int | 4.000 km por defecto (RN05). |

#### `planes_mantenimiento`

Una tarea del catálogo aplicada a una unidad (RF07). Es también la tabla que concentra el estado de mantenimiento de cada tarea por unidad (RF08). PK: `(patente, codigo_tarea)`, que además impide asignar dos veces la misma tarea a una unidad.

| Columna | Tipo | Notas |
|---|---|---|
| `patente` | varchar(10), PK, FK → `unidades` | |
| `codigo_tarea` | varchar(20), PK, FK → `tareas_catalogo` | |
| `intervalo_km` | int | Copiado del catálogo al crear el plan; editable por unidad (RN03). |
| `umbral_aviso_km` | int | Ídem. |
| `km_ultimo_service` | numeric(10,1) | Kilometraje desde el que se cuenta el intervalo; se reinicia al registrar un service (RN06). |
| `estado` | `estado_plan` | `al_dia` \| `proxima` \| `vencida` \| `postergada`, calculado según RN04, RN05, RN07. |
| `created_at` | timestamptz | |

#### `services`

PK: `(patente, fecha)`. Se registra un service por unidad y por día: según el caso de estudio, cuando el camión entra al taller se hace todo lo necesario y sale. Las tareas realizadas quedan en `service_tareas`.

| Columna | Tipo | Notas |
|---|---|---|
| `patente` | varchar(10), PK, FK → `unidades` | |
| `fecha` | date, PK | RF09. |
| `km` | numeric(10,1) | Kilometraje al momento del service; si supera el `km_actual` de la unidad, la actualiza (RN08). |
| `observaciones` | text, nullable | |
| `email_usuario` | varchar(100), FK → `usuarios` | Quién lo registró (RNF11). |
| `created_at` | timestamptz | |

#### `service_tareas`

Tareas del catálogo que cubrió cada service (RF09, RN06). PK: `(patente, fecha, codigo_tarea)`.

| Columna | Tipo | Notas |
|---|---|---|
| `patente` | varchar(10), PK, FK | FK junto con `fecha` → `services`; la unidad queda determinada por el service. |
| `fecha` | date, PK, FK | FK `(patente, fecha)` → `services`. |
| `codigo_tarea` | varchar(20), PK, FK → `tareas_catalogo` | Tarea realizada en el service. |

No se referencia directamente `planes_mantenimiento`: hacerlo conectaría `service_tareas` con el plan y volvería a formar el ciclo `unidades → planes_mantenimiento → service_tareas → services → unidades`. La regla de negocio verifica que la tarea esté planificada para la unidad antes de registrar el service.

#### `postergaciones`

PK: `(patente, codigo_tarea, fecha)`: un plan puede postergarse varias veces, cada una en un momento distinto.

| Columna | Tipo | Notas |
|---|---|---|
| `patente` | varchar(10), PK, FK | FK `(patente, codigo_tarea)` → `planes_mantenimiento`. |
| `codigo_tarea` | varchar(20), PK, FK | Ídem. |
| `fecha` | timestamptz, PK | |
| `motivo` | `motivo_postergacion` | `falta_espacio` \| `salida_urgente` \| `otro` (RF10, RN07). |
| `motivo_descripcion` | varchar(255), nullable | Obligatorio si `motivo = 'otro'` (restricción `CHECK`). |
| `km_limite_nuevo` | int | RN07. |
| `email_usuario` | varchar(100), FK → `usuarios` | RNF11. |
| `cerrada` | boolean | Se marca `true` al registrar el service correspondiente (RN06). |

#### `fallas`

Códigos de falla (DTC) informados por una unidad (RF11). PK: `(patente, codigo, fecha_aparicion)`: un mismo código puede activarse, cerrarse y volver a aparecer, y cada aparición es un registro.

| Columna | Tipo | Notas |
|---|---|---|
| `patente` | varchar(10), PK, FK → `unidades` | |
| `codigo` | varchar(30), PK | Código de falla informado por el vehículo (DM1 en J1939, DTC en J1979). |
| `fecha_aparicion` | timestamptz, PK | |
| `fecha_cierre` | timestamptz, nullable | La falla está activa mientras es `NULL` y pasa a inactiva al cerrarse (RN12). |

#### `alertas_plan`, `alertas_falla`, `alertas_dispositivo`

Las alertas (RF12) se separan según lo que las origina, porque cada origen tiene una clave distinta. Una alerta está abierta mientras `fecha_revisada` es `NULL`; marcarla como revisada (RF13) es completar esa fecha.

**`alertas_plan`** — tarea próxima o vencida. PK: `(patente, codigo_tarea, tipo, fecha_generada)`.

| Columna | Tipo | Notas |
|---|---|---|
| `patente` | varchar(10), PK, FK | FK `(patente, codigo_tarea)` → `planes_mantenimiento`. |
| `codigo_tarea` | varchar(20), PK, FK | Ídem. |
| `tipo` | `tipo_alerta_plan`, PK | `tarea_proxima` \| `tarea_vencida`. |
| `fecha_generada` | timestamptz, PK | |
| `fecha_revisada` | timestamptz, nullable | |

**`alertas_falla`** — falla nueva: una alerta por cada aparición de un código (RN12). PK: `(patente, codigo, fecha_aparicion)`, que es también la FK a `fallas`.

| Columna | Tipo | Notas |
|---|---|---|
| `patente`, `codigo`, `fecha_aparicion` | varchar(10), varchar(30), timestamptz, PK, FK | FK → `fallas`. |
| `fecha_generada` | timestamptz | |
| `fecha_revisada` | timestamptz, nullable | |

**`alertas_dispositivo`** — dispositivo sin reportar (RN10). PK: `(device_uid, fecha_generada)`.

| Columna | Tipo | Notas |
|---|---|---|
| `device_uid` | varchar(50), PK, FK → `dispositivos` | |
| `fecha_generada` | timestamptz, PK | |
| `fecha_revisada` | timestamptz, nullable | |

**Vista `alertas`.** Une las tres tablas (`patente`, `tipo`, `referencia`, `fecha_generada`, `fecha_revisada`) para que el dashboard las liste juntas sin tener que consultar cada una por separado. En las alertas de dispositivo, la patente se obtiene de la vinculación vigente en `fecha_generada`.

#### `kilometraje_historial`

Registra cada carga manual de kilometraje, para trazabilidad y para el historial por unidad (RF06, RF16, RNF11). PK: `(patente, fecha)`.

| Columna | Tipo | Notas |
|---|---|---|
| `patente` | varchar(10), PK, FK → `unidades` | |
| `fecha` | timestamptz, PK | |
| `km` | numeric(10,1) | |
| `fuente` | `fuente_km` | Siempre `manual` en esta tabla (las fuentes automáticas quedan en `lecturas`). |
| `email_usuario` | varchar(100), FK → `usuarios` | |

### 2.3 Índices

No se definen índices manuales para las consultas del dominio. PostgreSQL crea un índice por cada clave primaria y las restricciones `EXCLUDE` de `vinculaciones` crean los índices GiST necesarios para controlar solapamientos temporales. La PK de `lecturas` empieza por `device_uid`; la consulta del historial de lecturas de una unidad se resuelve a través de `vinculaciones` y no requiere otro índice con el volumen previsto (22 unidades). Si en el desarrollo aparece una consulta lenta, se agregará el índice puntual para esa consulta.

### 2.4 Decisiones de diseño

- **Claves naturales en lugar de ids generados.** Ningún dato del dominio necesita un número artificial para identificarse: la patente identifica a la unidad, el `device_uid` al dispositivo, el email al usuario, y el resto de las entidades depende de alguna de ellas (un plan es una tarea en una unidad; un service, una unidad en una fecha). Usar estas claves hace que las relaciones se lean en el propio dato (`service_tareas` dice qué tarea de qué unidad se hizo en qué fecha) y que varias reglas las garantice la PK: no se puede asignar dos veces la misma tarea a una unidad, ni registrar dos veces la misma lectura. Las FK usan `ON UPDATE CASCADE`, así que corregir una patente o un email se propaga a todas las tablas que lo referencian.
- **La unidad forma parte de la clave de sus tablas dependientes.** `planes_mantenimiento`, `services`, `fallas`, `postergaciones`, `alertas_plan` y `alertas_falla` incluyen `patente` en su PK. En `service_tareas`, la unidad queda determinada por la FK al service y la tarea se referencia al catálogo; así se evita agregar una segunda relación directa con `planes_mantenimiento` y no se forma un ciclo entre las entidades.
- **`usuarios` identificado por email.** Supabase Auth asigna a cada usuario un `uuid` interno, pero ese número no representa nada del dominio. El backend obtiene el email del token de sesión y busca el rol del usuario en esta tabla, que es la que referencian las demás (quién registró un service, una postergación, etc.).
- **Una tabla de alertas por origen.** Una alerta puede originarse en un plan, en una falla o en un dispositivo, y cada uno se identifica con una clave distinta. En una única tabla habría que tener columnas de referencia que quedan vacías según el tipo, y una columna que puede estar vacía no puede formar parte de la PK. Separarlas en `alertas_plan`, `alertas_falla` y `alertas_dispositivo` deja cada alerta identificada por la clave de lo que la originó, sin columnas vacías y con FK siempre completas. La vista `alertas` las une para consultarlas juntas.
- **Estados que se deducen de una fecha no se guardan aparte.** Una falla está activa mientras no tiene `fecha_cierre`, y una alerta está abierta mientras no tiene `fecha_revisada`. Guardar además un campo `estado` permitiría que se contradigan (por ejemplo, una falla inactiva sin fecha de cierre). `planes_mantenimiento.estado` sí se guarda, porque se calcula a partir del kilometraje y las postergaciones (ver más abajo).
- **Baja lógica de unidades.** Dar de baja una unidad (RF02) marca `activa = false` en vez de borrarla, y las FK no permiten borrar una unidad que tiene historial. Así se conservan sus services, postergaciones y cargas de kilometraje (RNF11). El único borrado en cascada es el de `service_tareas` al borrar un service, porque esas filas no existen sin el service.
- **Un service por unidad y por día.** Según el caso de estudio, cuando un camión entra al taller se hace todo lo necesario y sale. Por eso la PK de `services` es `(patente, fecha)`, y las distintas tareas de esa visita se registran en `service_tareas`.
- **Historial temporal de vinculaciones.** Un dispositivo puede desvincularse de una unidad y vincularse a otra (RF03, RN02). `vinculaciones` registra cada intervalo de instalación y sus restricciones `EXCLUDE` impiden dos vinculaciones simultáneas del mismo dispositivo o de la misma unidad. `lecturas` guarda la referencia a la vinculación vigente mediante `(device_uid, vinculacion_desde)`, por lo que el historial sigue asociado a la unidad correcta aunque el dispositivo luego se instale en otra. El módulo de ingesta resuelve la vinculación correspondiente al timestamp de la lectura antes de persistirla.
- **Modelo agnóstico de protocolo.** Ninguna tabla depende de si la unidad usa J1939 o J1979: `unidades.protocolo` registra cuál usa cada una y el detalle del parámetro de origen (PGN/SPN o PID) queda en `lecturas.origen`. Esto sostiene RNF08 (portabilidad) y RNF09 (aislar la interpretación del protocolo en el módulo de ingesta, sin que un cambio de firmware afecte al resto del sistema).
- **`planes_mantenimiento` como entidad central del estado de mantenimiento.** En vez de recalcular el estado de cada tarea en cada consulta a partir de todo el historial de services, cada plan guarda `km_ultimo_service` y `estado`, que se actualizan al procesar una lectura de kilometraje (CU06) o al registrar un service (CU09) o una postergación (CU10). Esto resuelve directamente RF08 y las reglas RN04 a RN07.
- **`service_tareas` en vez de una tarea por service.** Un mismo evento de taller normalmente cubre varias tareas a la vez (aceite de motor y filtros, por ejemplo), tal como surge de la entrevista al mecánico. Modelarlo como tabla de unión evita duplicar `services` por cada tarea realizada el mismo día. La tabla referencia al catálogo de tareas; la validación de que esa tarea corresponde al plan de la unidad se realiza en la operación de registro del service, evitando una relación circular en el DER.
- **Kilometraje nunca disminuye (RN09).** No se modela con una restricción de base de datos (requeriría conocer el máximo histórico en cada insert); se resuelve en el módulo de ingesta, que compara contra `unidades.km_actual` antes de escribir y marca `lecturas.consistente = false` cuando corresponde.
- **Tipos `ENUM` para valores cerrados.** Roles, estados, tipos y motivos tienen un conjunto de valores definido por los requerimientos. Un `ENUM` documenta esos valores en el propio esquema y rechaza cualquier otro. Agregar un valor nuevo es simple (`ALTER TYPE ... ADD VALUE`); quitarlo no, pero los valores de este dominio son estables. Se descartó modelarlos como tablas de catálogo porque no tienen atributos propios ni se administran desde la aplicación.
- **`varchar(n)` para textos acotados.** En PostgreSQL `varchar(n)` y `text` se almacenan igual; `varchar(n)` se usa donde el largo máximo es una regla del dato (patente, email, códigos), para que la base rechace valores inválidos.

## 3. Listado de módulos

| # | Módulo | Responsabilidad | RF / RN que cubre |
|---|---|---|---|
| M1 | Autenticación y autorización | Login con Supabase Auth; verificación de rol (`admin` \| `mantenimiento`) en cada operación. | RF01, RF17, RN11, RNF04 |
| M2 | Gestión de unidades y dispositivos | Alta, baja y modificación de unidades y dispositivos; alta, cierre y consulta del historial de vinculaciones dispositivo–unidad. | RF02, RF03, RN01, RN02 |
| M3 | Ingesta MQTT | Suscripción al broker, validación de mensajes, resolución de la vinculación vigente según el timestamp del dispositivo, interpretación del payload según protocolo, persistencia en `lecturas` (y de los códigos de falla en `fallas`), actualización de `unidades.km_actual` y `dispositivos.ultima_comunicacion`. | RF04, RF05, RNF01, RNF02, RNF03, RNF07, RNF08, RNF09, RN08, RN09 |
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

Para una unidad con protocolo `J1979`, el campo `origen` usa `{ "pid": "010C" }` en vez de `pgn`/`spn`, y el kilometraje se envía como `tipo: "km"` estimado por integración de velocidad, según lo definido en RN08. El módulo de ingesta (M3) es el único que interpreta `origen`; el resto del sistema solo usa `tipo` y `valor`. Las entradas `km` y `horas_motor` se guardan en `lecturas`; las de tipo `dtc` se registran en `fallas`. Un mensaje sin lecturas igual actualiza `dispositivos.ultima_comunicacion`, que es lo que usa el temporizador de CU14 para detectar dispositivos sin reportar.

## 4. Trazabilidad entre requerimientos y diseño

| Requerimiento / regla | Tabla(s) | Módulo(s) |
|---|---|---|
| RF01, RF17, RN11 | `usuarios` | M1 |
| RF02, RN01 | `unidades` | M2 |
| RF03, RN02 | `dispositivos`, `vinculaciones` | M2 |
| RF04, RF05, RNF01–03, RNF07–09, RN08, RN09 | `lecturas`, `vinculaciones`, `unidades.km_actual` | M3 |
| RF06 | `kilometraje_historial` | M9 |
| RF07, RN03 | `tareas_catalogo`, `planes_mantenimiento` | M4 |
| RF08, RN04, RN05 | `planes_mantenimiento.estado` | M4 |
| RF09, RN06, RNF11 | `services`, `service_tareas` | M5 |
| RF10, RN07 | `postergaciones` | M5 |
| RF11, RN12 | `fallas` | M6 |
| RF12, RF13 | `alertas_plan`, `alertas_falla`, `alertas_dispositivo`, vista `alertas` | M7 |
| RN10 | `dispositivos.ultima_comunicacion`, `alertas_dispositivo` | M8 |
| RF14, RF15, RF16 | vistas sobre `unidades`, `planes_mantenimiento`, `fallas`, `services`, `postergaciones` | M9 |