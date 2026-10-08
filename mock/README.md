# API mock para desarrollar el frontend

Simula la API REST del backend (`docs/prototipo-backend.md`, contrato completo en [`docs/openapi.yaml`](../docs/openapi.yaml)) con datos de ejemplo de la flota. Sirve para armar y probar todas las pantallas de `docs/prototipo-frontend.md` sin esperar al backend real.

- Se necesita **Node 18 o superior**.
- Las escrituras funcionan en memoria: registrar un service, postergar, cargar km o revisar una alerta cambia lo que devuelven los GET siguientes. Al reiniciar el servidor, o con `POST /__mock/reset`, vuelve todo al estado inicial.

## Cómo usarlo

```bash
cd mock
node server.js          # http://localhost:3000/api/v1
```

En el frontend, la URL base tiene que salir de una variable de entorno, que sera reemplazada una vez disponible el backend:

```
VITE_API_URL=http://localhost:3000/api/v1
```

Opciones (variables de entorno):

| Variable | Efecto |
|---|---|
| `PORT=3001` | Cambia el puerto (por defecto 3000). |
| `MOCK_DELAY_MS=400` | Agrega latencia a cada respuesta, para probar spinners y estados de carga. |
| `STRICT_AUTH=1` | Responde 401 si falta el header `Authorization`. Por defecto es permisivo. |

CORS está abierto, así que el frontend puede llamar directo desde Vite sin configurar proxy.

## Sesión y roles

El login real va directo contra Supabase Auth desde el frontend. El mock no valida el JWT: **lee el token como si fuera el rol** para poder probar los permisos.

| Header | Usuario que devuelve `/me` |
|---|---|
| `Authorization: Bearer admin` (o cualquier otro valor, o sin header) | Laura Gómez, `admin` |
| `Authorization: Bearer mantenimiento` | Carlos Ibarra, `mantenimiento` |

Con rol `mantenimiento`, las operaciones de admin (usuarios, dispositivos, alta/edición/baja de unidades, planes y catálogo) responden **403**, igual que va a hacer el backend (RN11). El frontend tiene que ocultar esas pantallas, pero conviene probar que maneja el 403.

## Datos de ejemplo

22 unidades (9 propias y 13 de fleteros, como en el caso de estudio), 3 tareas de catálogo, 62 planes, 63 services, 22 postergaciones, 11 fallas y 32 alertas. Los datos tienen la misma forma que las tablas de `db/schema.sql` y están en `data/db.json`.

Unidades para probar cada situación:

| Situación | Patentes |
|---|---|
| Tarea **vencida** | HC176VH, PT235CX, YH604TT |
| Tarea **próxima** | KX324HU, MJ539WD, RL848FC, RU206LB |
| Tarea **postergada** | KW849BP, KX324HU, XD891JD, YM731LJ |
| **Sin dispositivo** (km cargado a mano) | KX324HU, RU206LB, XD891JD |
| Dispositivo **sin reportar** | GR482NY, HC176VH |
| Con **fallas activas** | MJ539WD, PR739GY, SU726BP, UR137BK |
| Todo en orden | AP414XV, DT895MF, MH654VV, NF213TY |
| **Dada de baja** (`?activa=false`) | CJ411PJ |
| **Sin plan** de mantenimiento (estado vacío) | NP773EG |
| Solo 2 tareas en el plan | DT895MF |
| Aceite de motor cada 60.000 km | KW849BP, PV587GJ |
| Cambió de dispositivo (historial de vinculaciones) | MH654VV |
| Código de falla que reapareció | UR137BK |
| Services con varias tareas | CJ411PJ, DT895MF, GR482NY, HC176VH |

Usuarios: `laura.gomez` y `pablo.rinaldi` son admin; `carlos.ibarra` y `marcela.sosa`, mantenimiento (todos `@flota.example`).

Los datos están fechados al **7/10/2026**. Las fechas como `ultima_comunicacion` no avanzan solas: un dispositivo "activo" seguirá figurando como tal aunque pasen los días.

Para regenerar los datos: `node generate.js` (es determinístico; siempre produce lo mismo).

## Lo que conviene saber al armar las pantallas

- **Listados paginados** (`/unidades`, `/alertas`, `services`, `postergaciones`): `?page=1&page_size=20` y respuesta `{ data, page, page_size, total }`. Con 22 unidades, la flota ocupa dos páginas; pedí `page_size=100` si querés todo junto. El resto de los listados devuelve `{ data }`.
- **Vista de flota** (`GET /unidades`): filtros `tenencia=propia|fletero` y `estado=vencida|proxima|postergada|al_dia|con_fallas|sin_reportar|sin_dispositivo`. `estado_mantenimiento` es el estado más crítico de la unidad y es `null` si no tiene plan. `dispositivo` es `null` si no tiene.
- **Detalle** (`GET /unidades/:patente/detalle`): trae unidad, dispositivo, planes y fallas activas en una sola llamada. Cada plan incluye `km_restantes` (negativo si ya venció) y `postergacion_vigente`.
- **Alertas**: sin filtro devuelve abiertas y revisadas, de la más antigua a la más nueva. Para la pantalla pedí `?estado=abierta`. Para marcar una como revisada, mandá `PATCH /alertas/revisar` con `{ origen, ...clave }` copiando el objeto `clave` de la alerta. No hay un `id`; para el `key` de React podés armar uno con `origen` + los valores de `clave`.
- **Registrar service**: `tareas` es la lista de `codigo_tarea` marcados. Responde 400 si va vacía y 409 si ya hay un service de esa unidad ese día. Al guardar, volvé a pedir `/detalle`.
- **Postergar**: `km_limite_nuevo` tiene que ser mayor al km actual (400 si no), y con motivo `otro` la descripción es obligatoria. El valor sugerido por la pantalla es km actual + 4.000.
- **Errores**: siempre `{ error: { code, message } }`. El `message` está en español y se puede mostrar tal cual.
- **Tipos TypeScript**: se pueden generar desde el contrato con `npx openapi-typescript ../docs/openapi.yaml -o src/api/types.ts`.

No hay endpoint de lecturas (kilometraje, horas de motor) ni de historial de km: esos datos llegan por MQTT y el dashboard solo muestra el valor actual.

## Pendientes de definir en el backend

`docs/prototipo-backend.md` define las rutas y los cuerpos de entrada, pero no las respuestas. Las formas de respuesta de este mock son una propuesta y hay que confirmarlas cuando se implemente el backend (los cambios se reflejan en `docs/openapi.yaml`). Además, el mock tomó estas decisiones donde el documento no decía nada:

1. **Alertas de plan al hacer un service.** Las alertas `tarea_proxima` / `tarea_vencida` ya abiertas **no se cierran solas** cuando se registra el service; hay que marcarlas como revisadas.
2. **Plan nuevo.** Al asignar una tarea a una unidad, el mock acepta `km_ultimo_service` opcional y, si no viene, usa el km actual. Con el default de la base (0) una unidad de 400.000 km nacería con todo vencido.
3. **Estado más crítico.** Orden: vencida, próxima, postergada, al día.
4. **Baja de unidad con dispositivo vinculado:** 409; hay que desvincularlo antes.
5. **Fecha de un service sin `fecha`:** hoy en UTC. Un service cargado de noche en Argentina puede quedar con la fecha del día siguiente.
6. **Filtro de período** (`desde` / `hasta`, formato `YYYY-MM-DD`) en services y postergaciones, para el historial por período (RF16).
