# Prototipo de pantallas para el Frontend

Referencia para el armado del prototipo navegable, basada en los casos de uso y requerimientos de la [1ª Entrega — Propuesta de proyecto](entregas/01-propuesta-proyecto.md).

---

## 1. Login

**Cubre:** CU01 · RF01

| Elemento | Detalle |
|---|---|
| Campos | Email, contraseña |
| Acción | Botón "Iniciar sesión" |
| Estado de error | Mensaje si las credenciales son inválidas |

---

## 2. Vista de la flota (pantalla principal tras el login)

**Cubre:** CU07 · RF14

| Elemento | Detalle |
|---|---|
| Listado | Una fila por unidad: patente, marca/modelo, tenencia (propia/fletero), km actual, estado de mantenimiento más crítico, cantidad de fallas activas, estado del dispositivo |
| Indicador visual de estado | Color o ícono por estado: al día (verde), próxima (amarillo), vencida (rojo), postergada (naranja), sin dispositivo/sin reportar (gris) |
| Filtros | Por tenencia (propia / fletero) y por estado (vencida, próxima, con fallas, sin reportar) |
| Acción por fila | Click en una unidad → abre el detalle (pantalla 3) |
| Estado vacío | Mensaje "No hay unidades registradas" + botón para dar de alta (si el usuario es admin) |
| Responsive | Pensar esta pantalla primero para celular (RNF10) — el responsable de mantenimiento la usa desde el taller |

---

## 3. Detalle de unidad

**Cubre:** CU08 · RF15

| Sección | Contenido |
|---|---|
| Encabezado | Patente, marca, modelo, año, tenencia, titular (si es fletero), protocolo (J1939/J1979) |
| Kilometraje | Km actual, fuente (odómetro / estimado / manual), botón "Cargar km manual" (RF06, ver pantalla 7) |
| Tareas de mantenimiento | Lista de tareas del plan con: nombre, km restantes, estado (al día/próxima/vencida/postergada). Cada tarea con botones "Registrar service" y "Postergar" |
| Fallas activas | Lista de códigos de falla activos con fecha de aparición |
| Dispositivo | Estado (activo/inactivo/sin reportar), última comunicación |
| Historial | Link o sección expandible con services y postergaciones pasadas (pantalla 8) |

---

## 4. Registrar service

**Cubre:** CU09 · RF09

| Elemento | Detalle |
|---|---|
| Prellenado | Fecha actual, km actual de la unidad |
| Campos editables | Fecha, kilometraje |
| Selección de tareas | Checklist de tareas vencidas/próximas/postergadas de esa unidad, para marcar cuáles se cubren en este service |
| Observaciones | Campo de texto libre |
| Validación | No permite guardar si no se seleccionó ninguna tarea |
| Confirmación | Al guardar, vuelve al detalle de unidad con las tareas actualizadas |

---

## 5. Postergar tarea

**Cubre:** CU10 · RF10

| Elemento | Detalle |
|---|---|
| Contexto | Se abre desde una tarea puntual en el detalle de unidad |
| Motivo | Selector: falta de espacio en el taller / salida urgente / otro (con campo de descripción obligatorio si se elige "otro") |
| Nuevo límite en km | Prellenado con km actual + 4.000 (una semana de operación), editable |
| Validación | Rechaza si el nuevo límite es menor o igual al km actual |
| Confirmación | La tarea pasa a estado "postergada" en el detalle de unidad |

---

## 6. Alertas

**Cubre:** CU12 · RF12, RF13

| Elemento | Detalle |
|---|---|
| Listado | Alertas abiertas, ordenadas por más antiguas primero |
| Tipo de alerta | Tarea próxima / tarea vencida / falla nueva / dispositivo sin reportar, con ícono distinto por tipo |
| Por alerta | Unidad relacionada, fecha de generación, botón "Marcar como revisada" |
| Filtro | Por tipo de alerta y por unidad |

---

## 7. Carga manual de kilometraje

**Cubre:** CU11 · RF06

| Elemento | Detalle |
|---|---|
| Contexto | Accesible desde el detalle de unidad, para unidades sin dispositivo o con dispositivo fuera de servicio |
| Campos | Kilometraje, fecha |
| Confirmación | Actualiza `km_actual` de la unidad y recalcula el estado de sus tareas |

---

## 8. Historial de mantenimiento

**Cubre:** CU13 · RF16

| Elemento | Detalle |
|---|---|
| Listado | Services y postergaciones de la unidad, ordenados por fecha descendente |
| Por service | Fecha, km, tareas cubiertas, usuario que lo registró |
| Por postergación | Motivo, nuevo límite, fecha, usuario, si ya fue cerrada por un service posterior |
| Filtro | Por período (rango de fechas) |

---

## 9. Gestión de unidades (solo admin)

**Cubre:** CU02 · RF02

| Elemento | Detalle |
|---|---|
| Listado | Todas las unidades con acciones de editar/dar de baja |
| Alta/edición | Patente, marca, modelo, año, tenencia, titular, protocolo |

---

## 10. Gestión de dispositivos (solo admin)

**Cubre:** CU03 · RF03, RN02

| Elemento | Detalle |
|---|---|
| Listado | Dispositivos con su `device_uid`, estado, unidad vinculada (si tiene) |
| Alta | Nuevo dispositivo con `device_uid` |
| Vinculación | Selector de unidad; bloquea si la unidad ya tiene un dispositivo activo o el dispositivo ya está vinculado (RN02) |

---

## 11. Configurar plan de mantenimiento (solo admin)

**Cubre:** CU04 · RF07

| Elemento | Detalle |
|---|---|
| Contexto | Se accede desde el detalle de unidad o desde una pantalla de configuración general |
| Catálogo de tareas | Aceite de motor, filtro secador, aceite de caja/diferencial (editable/ampliable) |
| Por tarea asignada a una unidad | Intervalo en km, umbral de aviso, ambos con el valor por defecto precargado (RN03) y editables |

---

## 12. Gestión de usuarios (solo admin)

**Cubre:** CU05 · RF17

| Elemento | Detalle |
|---|---|
| Listado | Usuarios con email, nombre, rol |
| Alta | Email, nombre, rol (admin / mantenimiento) |

---

