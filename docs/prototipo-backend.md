# Prototipo Backend – Contrato de la API REST

Documento de diseño con especificación de los endpoints del backend, en base a los módulos (M1–M9) y requerimientos funcionales de la [1ª Entrega — Propuesta de proyecto](entregas/01-propuesta-proyecto.md) y la [2ª Entrega — Arquitectura y módulos](entregas/02-arquitectura-modulos.md).

**Base URL:** `/api/v1`

**Autenticación:** todas las rutas (salvo indicación contraria) requieren un JWT de Supabase Auth en el header `Authorization: Bearer <token>`. El backend valida el token contra Supabase y resuelve el rol del usuario (`usuarios.rol`) para aplicar RN11.

---

## Índice

- [Prototipo Backend – Contrato de la API REST](#prototipo-backend--contrato-de-la-api-rest)
  - [Índice](#índice)
  - [1. Sesión y usuarios (M1)](#1-sesión-y-usuarios-m1)
  - [2. Unidades y dispositivos (M2)](#2-unidades-y-dispositivos-m2)
  - [3. Motor de mantenimiento (M4)](#3-motor-de-mantenimiento-m4)
  - [4. Services y postergaciones (M5)](#4-services-y-postergaciones-m5)
  - [5. Fallas (M6)](#5-fallas-m6)
  - [6. Alertas (M7)](#6-alertas-m7)
  - [7. Vista de flota y detalle de unidad (M9)](#7-vista-de-flota-y-detalle-de-unidad-m9)
  - [8. Kilometraje manual (M9)](#8-kilometraje-manual-m9)
  - [9. Notas de diseño](#9-notas-de-diseño)

---

## 1. Sesión y usuarios (M1)

El login en sí lo maneja el cliente directo contra Supabase Auth (RF01); el backend no reimplementa login/logout. Lo que expone es:

| Método | Ruta | RF/RN | Rol | Descripción |
|---|---|---|---|---|
| GET | `/me` | RF01 | cualquiera autenticado | Devuelve el usuario actual: email, nombre, rol. |
| GET | `/usuarios` | RF17 | admin | Lista de usuarios. |
| POST | `/usuarios` | RF17, RN11 | admin | Alta de usuario (requiere que ya exista en Supabase Auth). Body: `{ email, nombre, rol }`. |
| PATCH | `/usuarios/:email` | RF17 | admin | Modifica nombre o rol. |

---

## 2. Unidades y dispositivos (M2)

| Método | Ruta | RF/RN | Rol | Descripción |
|---|---|---|---|---|
| GET | `/unidades` | RF02 | admin, mantenimiento | Lista de unidades (ver también §7 para la vista de flota con filtros). |
| POST | `/unidades` | RF02 | admin | Alta. Body: `{ patente, marca, modelo, anio, tenencia, titular, protocolo }`. |
| GET | `/unidades/:patente` | RF02 | admin, mantenimiento | Detalle básico de una unidad. |
| PATCH | `/unidades/:patente` | RF02 | admin | Modificación de datos de la unidad. |
| DELETE | `/unidades/:patente` | RF02 | admin | Baja lógica (`activa = false`); la unidad conserva su historial. |
| GET | `/dispositivos` | RF03 | admin | Lista de dispositivos con su unidad vinculada (si tiene). |
| POST | `/dispositivos` | RF03 | admin | Alta. Body: `{ device_uid }`. |
| PATCH | `/dispositivos/:device_uid/vincular` | RF03, RN02 | admin | Vincula el dispositivo a una unidad. Body: `{ patente }`. Rechaza (409) si la unidad ya tiene dispositivo activo o el dispositivo ya está vinculado. |
| PATCH | `/dispositivos/:device_uid/desvincular` | RF03, RN02 | admin | Desvincula el dispositivo de su unidad actual. |

---

## 3. Motor de mantenimiento (M4)

| Método | Ruta | RF/RN | Rol | Descripción |
|---|---|---|---|---|
| GET | `/tareas-catalogo` | RF07 | admin, mantenimiento | Catálogo de tipos de tarea con sus intervalos por defecto. |
| POST | `/tareas-catalogo` | RF07 | admin | Alta de un nuevo tipo de tarea. Body: `{ codigo, nombre, intervalo_km_default, umbral_aviso_km_default }`. |
| GET | `/unidades/:patente/planes` | RF07, RF08 | admin, mantenimiento | Planes de mantenimiento de la unidad, con su estado actual (al_dia/proxima/vencida/postergada). |
| POST | `/unidades/:patente/planes` | RF07 | admin | Asigna una tarea del catálogo a la unidad. Body: `{ codigo_tarea, intervalo_km, umbral_aviso_km }`. |
| PATCH | `/unidades/:patente/planes/:codigo_tarea` | RF07 | admin | Edita intervalo o umbral de un plan existente. |

El recálculo de `estado` (RN04, RN05) ocurre internamente al procesar una lectura de kilometraje (M3, no expuesto como endpoint HTTP — llega por MQTT) o al registrar un service o una postergación (§4). No hay endpoint para forzarlo manualmente.

---

## 4. Services y postergaciones (M5)

| Método | Ruta | RF/RN | Rol | Descripción |
|---|---|---|---|---|
| GET | `/unidades/:patente/services` | RF16 | admin, mantenimiento | Historial de services de la unidad. |
| POST | `/unidades/:patente/services` | RF09, RN06 | admin, mantenimiento | Registra un service. Body: `{ fecha, km, observaciones, tareas: [codigo_tarea, ...] }`. Reinicia `km_ultimo_service` de cada plan cubierto y cierra sus postergaciones abiertas. |
| GET | `/unidades/:patente/postergaciones` | RF16 | admin, mantenimiento | Historial de postergaciones de la unidad. |
| POST | `/unidades/:patente/planes/:codigo_tarea/postergaciones` | RF10, RN07 | admin, mantenimiento | Posterga una tarea. Body: `{ motivo, motivo_descripcion?, km_limite_nuevo }`. Rechaza (400) si `km_limite_nuevo` ≤ km actual de la unidad. |

---

## 5. Fallas (M6)

Las fallas se generan internamente a partir de las lecturas MQTT (RN12), no se crean por API. El backend solo las expone para lectura:

| Método | Ruta | RF/RN | Rol | Descripción |
|---|---|---|---|---|
| GET | `/unidades/:patente/fallas` | RF11 | admin, mantenimiento | Fallas de la unidad, con filtro opcional `?estado=activo\|inactivo`. |

---

## 6. Alertas (M7)

| Método | Ruta | RF/RN | Rol | Descripción |
|---|---|---|---|---|
| GET | `/alertas` | RF13 | admin, mantenimiento | Alertas, filtrables por `?estado=abierta\|revisada`, `?tipo=...`, `?patente=...`. |
| PATCH | `/alertas/revisar` | RF13 | admin, mantenimiento | Marca una alerta como revisada (registra `fecha_revisada`). Body: `{ origen: plan\|falla\|dispositivo, ...clave }` con la clave de la alerta según su origen. |

Las alertas se generan internamente (M4, M6, M8 disparan su creación); no hay endpoint de alta manual.

---

## 7. Vista de flota y detalle de unidad (M9)

| Método | Ruta | RF/RN | Rol | Descripción |
|---|---|---|---|---|
| GET | `/unidades?tenencia=&estado=` | RF14 | admin, mantenimiento | Vista de flota: patente, tenencia, km, estado más crítico, cantidad de fallas activas, estado del dispositivo. Filtros por tenencia y estado. |
| GET | `/unidades/:patente/detalle` | RF15 | admin, mantenimiento | Vista consolidada: datos de la unidad + planes + fallas activas + estado del dispositivo, en una sola respuesta (para no encadenar varios GET desde el frontend). |

---

## 8. Kilometraje manual (M9)

| Método | Ruta | RF/RN | Rol | Descripción |
|---|---|---|---|---|
| POST | `/unidades/:patente/kilometraje` | RF06, RN08, RN09 | admin, mantenimiento | Carga manual de km. Body: `{ km, fecha? }`. Actualiza `km_actual` solo si `km` ≥ al actual (si no, responde 409 y no lo aplica); dispara el recálculo de planes igual que una lectura MQTT. |

---

## 9. Notas de diseño

- **No hay endpoint de ingesta MQTT en esta API**: los dispositivos publican directo al broker (HiveMQ Cloud), no le pegan a la API REST. El módulo de ingesta (M3) es un proceso separado dentro del mismo backend que escucha el broker y escribe en la base — no expone rutas HTTP.
- **Todas las respuestas de error** siguen el formato `{ error: { code, message } }`, con los códigos HTTP estándar (400 validación, 401 sin token, 403 rol insuficiente, 404 no encontrado, 409 conflicto de regla de negocio).
- **Paginación**: los listados (`/unidades`, `/alertas`, historial) usan `?page=&page_size=`, default 20.
