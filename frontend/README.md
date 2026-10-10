# Frontend — Telemetría de flota

Dashboard web (React + Vite + TypeScript + Tailwind CSS), organizado por funcionalidad (*feature-based*). Está conectado por HTTP a la API mock y permite consultar y filtrar la flota, ver el detalle de cada unidad y revisar alertas. El resto de las pantallas de [`docs/prototipo-frontend.md`](../docs/prototipo-frontend.md) se agrega sobre esta base.

## Qué incluye y qué no

| Incluye | No incluye todavía |
|---|---|
| **Flota** con filtros por tenencia, estado y situación (activas / dadas de baja), guardados en la URL | Login real con Supabase Auth |
| **Detalle de unidad** (`GET /unidades/{patente}/detalle`), que vuelve al listado con sus filtros | Formularios de service y postergación |
| **Alertas**: listado con filtros y paginación, y acción "Marcar como revisada" | Carga manual de kilometraje |
| Usuario actual (`GET /me`) y selector de rol **simulado** | Historial de mantenimiento y pantallas de administración |
| Reintento que recupera la pantalla **y** la sesión del encabezado | |

## Requisitos

- **Node.js `^22.22`, `^24` o `>=26`** (campo `engines` de `package.json`). Es la intersección de lo que declaran las herramientas instaladas, verificado sobre sus `package.json`:

  | Herramienta | `engines.node` |
  |---|---|
  | `vite` 8.3, `@vitejs/plugin-react` 6.1, `oxlint` 1.87 | `^20.19.0 \|\| >=22.12.0` |
  | `react-router` 8.4 | `>=22.22.0` |
  | `vitest` 5.0 | `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` |
  | `@tailwindcss/oxide` 4.3 | `>= 20` |

  Se comprobó con Node 24.11.1. Las versiones 22.22+ y 26+ salen de la lectura de los `engines`, no se ejecutaron.
- **`npm run` debe usar el mismo Node que la terminal.** Se comprueba con `node -v` y con la salida de `npm run build` (Vite avisa si el Node es menor que el que necesita).
- El mock necesita Node 18+ y no tiene dependencias que instalar.

## Puesta en marcha

Se necesitan dos terminales: la API mock y el frontend. Las rutas son relativas a la raíz del repositorio.

**1. Instalar las dependencias** — desde `frontend/`:

```bash
cd frontend
npm install
```

**2. Ejecutar el mock** (terminal 1) — desde `mock/`:

```bash
cd mock
npm start               # http://localhost:3000/api/v1  (equivale a: node server.js)
```

Opciones del mock: `PORT`, `MOCK_DELAY_MS` (latencia simulada, útil para ver los estados "en curso") y `STRICT_AUTH=1`; ver [`mock/README.md`](../mock/README.md).

**3. Configurar las variables de entorno** — desde `frontend/`:

```bash
cp .env.example .env        # en PowerShell: Copy-Item .env.example .env
```

| Variable | Valor inicial | Descripción |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api/v1` | URL base de la API, con el prefijo `/api/v1`. |

`.env` no se versiona. Si se cambia, hay que reiniciar Vite. Apuntar a otro backend no requiere tocar las pantallas.

**4. Iniciar Vite** (terminal 2) — desde `frontend/`:

```bash
cd frontend
npm run dev                 # http://localhost:5173  (redirige a /unidades)
```

## Comandos

Todos se ejecutan desde `frontend/`.

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo de Vite. |
| `npm run api:types` | Regenera `src/api/schema.d.ts` desde `../docs/openapi.yaml`. Correrlo cada vez que cambie el contrato. |
| `npm run lint` | oxlint: reglas de React, ciclos de imports y reglas de dependencia entre capas. |
| `npm test` | Pruebas unitarias (vitest, en `tests/`). |
| `npm run build` | Chequeo de tipos (`tsc -b`, incluye `src/` y `tests/`) y build de producción en `dist/`. |
| `npm run preview` | Sirve el build de producción en `http://localhost:4173`. |

## Rutas y filtros

Los filtros viven en los parámetros de la URL: se conservan al recargar, al compartir el enlace y al volver desde el detalle. Un valor que la API no admite se **normaliza** (vuelve al valor por defecto) y la URL se reescribe; nunca se envía un filtro inválido. El filtrado lo hace siempre el servidor.

| Ruta | Pantalla | Parámetros |
|---|---|---|
| `/` | Redirige a `/unidades` | — |
| `/unidades` | Flota | `tenencia`, `estado`, `activa` |
| `/unidades/:patente` | Detalle de unidad | — |
| `/alertas` | Alertas | `estado`, `tipo`, `patente`, `page` |

### Flota (`/unidades`)

| Parámetro | Valores | Por defecto | Se envía a la API como |
|---|---|---|---|
| `tenencia` | `propia`, `fletero` | todas (se omite) | `tenencia` |
| `estado` | `al_dia`, `proxima`, `vencida`, `postergada`, `con_fallas`, `sin_reportar`, `sin_dispositivo` | todos (se omite) | `estado` |
| `activa` | `false` (dadas de baja) | activas (se omite) | `activa=true` o `activa=false` |

Ejemplo: `/unidades?tenencia=fletero&estado=con_fallas&activa=false`. "Limpiar filtros" vuelve a `/unidades`. No existe "todas" en la situación: el contrato filtra por `activa=true` o `activa=false`, y combinar ambas consultas sería un comportamiento que la API no define.

### Alertas (`/alertas`)

| Parámetro | Valores | Por defecto | Se envía a la API como |
|---|---|---|---|
| `estado` | `revisada`, `todas` (abiertas = por defecto) | abiertas | `estado=abierta`, `estado=revisada` o, para `todas`, **se omite** |
| `tipo` | `tarea_proxima`, `tarea_vencida`, `falla_nueva`, `dispositivo_sin_reportar` | todos | `tipo` |
| `patente` | una patente (se normaliza a mayúsculas) | todas | `patente` |
| `page` | entero ≥ 1 | 1 | `page` (con `page_size=20`) |

Cambiar un filtro vuelve a la página 1. "Restablecer filtros" vuelve a `/alertas` (abiertas).

## Arquitectura

Se organiza **por funcionalidad**: el código que cambia junto vive junto. La estructura sigue las convenciones del proyecto *iot-admin-panel* (carpeta por feature con `components/`, `pages/`, `hooks/`, `services/`, `utils/`; `shared/` para lo transversal; `routes/` para la composición; pruebas en `tests/` espejando `src/`), con las dependencias entre capas explicitadas y verificadas por el linter.

```
frontend/
├── index.html  package.json  vite.config.ts  tsconfig*.json  .oxlintrc.json  .env.example
├── tests/unit/                     # espejo de src/; no entra al build
└── src/
    ├── main.tsx                    # arranque: QueryClientProvider, css y token de sesión
    ├── App.tsx                     # BrowserRouter + AppRouter
    ├── config/app.ts               # configuración de la app (nombre)
    ├── api/                        # infraestructura HTTP, sin dependencias hacia arriba
    │   ├── client.ts               #   cliente HTTP: URL base, token, GET/PATCH, errores, AbortSignal
    │   ├── pagination.ts           #   listados paginados: una página o todas, con los mismos filtros
    │   ├── guards.ts               #   comprobaciones mínimas de forma de las respuestas
    │   ├── types.ts                #   alias de los tipos generados (sin redefinir entidades)
    │   └── schema.d.ts             #   GENERADO desde docs/openapi.yaml: no se edita a mano
    ├── routes/                     # composición: rutas + layout + features
    │   ├── AppRouter.tsx
    │   └── NotFoundPage.tsx
    ├── shared/                     # código sin conocimiento del dominio
    │   ├── components/             #   layout/AppLayout, ErrorBoundary, ui/ (Card, Dato, Button,
    │   │                           #   SelectField, StatusBadge, LoaderSpinner, ErrorPanel)
    │   ├── hooks/                  #   useDocumentTitle, useRetryFailedQueries
    │   ├── navigation/returnTarget.ts   # destino de regreso entre pantallas
    │   └── utils/formatDate.ts
    ├── features/
    │   ├── fleet/                  # flota: listado con filtros y detalle de unidad
    │   ├── alerts/                 # alertas: listado, filtros, paginación y revisión
    │   └── session/                # usuario actual y sesión simulada de desarrollo
    └── css/main.css                # Tailwind + colores de diseño + foco
```

Cada feature tiene `index.ts` (API pública), `pages/`, `components/`, `hooks/`, `services/`, `utils/` y, si hace falta, `types.ts`.

### Features: propósito y límites

| Feature | Qué hace | Qué NO hace |
|---|---|---|
| `fleet` | Muestra la flota (con filtros) y el detalle de una unidad con lo que calcula la API. Es la única que conoce los endpoints `/unidades` para mostrar unidades. | No recalcula reglas de mantenimiento. No sabe quién es el usuario ni cómo se obtiene el token. No conoce las alertas. |
| `alerts` | Lista y filtra alertas, pagina y marca alertas como revisadas (`/alertas`, `/alertas/revisar`). | No importa nada de `fleet`: la ruta al detalle de una unidad se la entrega `routes/AppRouter` por props. No decide qué rol puede revisar (lo resuelve la API). |
| `session` | Obtiene el usuario actual (`/me`) y encapsula la **sesión simulada** (rol → token). Expone el proveedor de token que `main.tsx` registra en el cliente HTTP. | No implementa login real. |

Dentro de cada feature, el flujo es: **página** → **hook** (TanStack Query / mutación) → **servicio** (función que llama a `api/client.ts`, sin React) → HTTP. Las páginas componen; los componentes presentan.

### Qué es código compartido

- **`api/`**: cliente HTTP, paginación, tipos generados del contrato y guardas de forma. Lo usan todas las features.
- **`shared/`**: solo lo que no conoce el dominio. Un componente o utilidad entra a `shared` cuando lo necesitan **dos o más** features, o cuando no sabe nada de flotas, alertas ni sesión.
- **`config/`**: constantes de la app.
- Lo que sabe de flotas (etiquetas de estado, formato de km, filtros) vive en `features/fleet/`; lo que sabe de alertas (tipos, identidad, cuerpo de revisión), en `features/alerts/`.

### Reglas de dependencia

```
routes ──▶ features ──▶ shared ──▶ api
   │          │            │         ▲
   └──────────┴────────────┴─────────┘   (config puede ser importado por todas;
                                          no importa a nadie)
```

1. **`api/` y `config/`** no importan de `shared`, `features` ni `routes`.
2. **`shared/`** no importa de `features` ni de `routes`: lo específico entra por props.
3. **Una feature no importa de otra feature ni de `routes`.** Si dos features necesitan algo común, se sube a `shared`; si necesitan *coordinarse*, se compone en `routes/AppRouter.tsx`.
4. **Desde fuera de una feature solo se importa su `index.ts`** (pública).
5. **Sin ciclos.**
6. **Sin alias de importación**: imports relativos, como en la referencia.

Las reglas 1–3 y 5 las comprueba `npm run lint` (`import/no-cycle` y `no-restricted-imports`, ver `.oxlintrc.json`). Al agregar una feature nueva hay que sumarle su bloque en `overrides` y actualizar los de las otras. La regla 4 se sostiene por revisión.

### Dónde agregar una funcionalidad nueva

| Quiero… | Va en… |
|---|---|
| Una pantalla nueva de flota (p. ej. historial de services) | `features/fleet/` (`pages/`, `components/`, `hooks/`, `services/`) y una ruta en `routes/AppRouter.tsx` |
| Un área distinta (p. ej. administración de usuarios) | Una feature nueva `features/<nombre>/` con su `index.ts`, su bloque en `.oxlintrc.json` y su ruta en `routes/AppRouter.tsx` |
| Un endpoint nuevo | Una función en el `services/` de la feature que lo usa; el contrato se regenera con `npm run api:types` |
| Un componente visual sin dominio que usan varias features | `shared/components/ui/` |
| Login real con Supabase Auth | Reemplazar la feature `session` y la línea `setAccessTokenProvider(...)` de `src/main.tsx` |
| Una prueba | `tests/unit/<misma ruta que en src/>/…test.ts` |

## Estilos: Tailwind CSS

- **Versión:** Tailwind CSS 4.3 con el plugin oficial `@tailwindcss/vite`. No hay `tailwind.config.js` ni PostCSS: la versión 4 no los necesita.
- **Integración:** `vite.config.ts` registra `tailwindcss()` y `src/css/main.css` empieza con `@import "tailwindcss";`. Se importa una sola vez, desde `src/main.tsx`.
- **Qué hay en `main.css`:** los colores de diseño como variables CSS (con su variante oscura según `prefers-color-scheme`), su exposición como utilidades (`bg-surface`, `text-muted`, `bg-ok-bg`…) mediante `@theme inline`, y el estilo de foco visible global.
- **Temas claro y oscuro:** siguen la preferencia del sistema; no hay selector de tema.
- **Estados:** cada estado y tipo se muestra con texto e ícono además del color (`StatusBadge`).

## Decisiones y límites a tener en cuenta

- **El mock es un proceso separado.** El frontend obtiene los datos solo por HTTP; no importa `mock/data/db.json`. El contrato vive en `docs/openapi.yaml` y el mock en `mock/`: no hay copias en `frontend/`.
- **Las escrituras del mock viven en memoria.** Marcar una alerta como revisada cambia lo que devuelven los GET siguientes hasta que se reinicia el mock o se llama a `POST /__mock/reset`.
- **El dataset tiene fecha de referencia fija (7/10/2026).** Las fechas no avanzan solas; por eso la interfaz muestra fechas absolutas y no "hace N días".
- **Sesión simulada, no autenticación.** El mock lee el header `Authorization: Bearer admin` o `Bearer mantenimiento` como si fuera el rol. El selector "Rol simulado" cambia ese valor, descarta lo cacheado y vuelve a pedir los datos. **No hay login real.** Ambos roles pueden revisar alertas (el contrato no lo restringe).
- **Paginación de la flota.** `GET /unidades` es paginado (máximo 100 por página). `getFleet` pide páginas de 100 hasta reunir el `total` que informa la API, **enviando los mismos filtros en cada página**, de modo que nunca se muestra una página parcial como si fuera el resultado. Si la API devolviera menos unidades que su `total`, se muestra un error. El conteo en pantalla es el del resultado filtrado.
- **Paginación de alertas.** Se muestra una página de 20 a la vez con "Anterior / Siguiente" y la posición ("Página X de Y"); el total es el de todo el resultado filtrado. Si tras revisar una alerta el total baja y la página queda fuera de rango, se vuelve a la última página.
- **Sin datos del filtro anterior.** Los filtros forman parte de la clave de cada consulta y no se reutilizan datos de otra combinación: al cambiar de filtro se ve "Cargando…", no el resultado previo.
- **Revisión de alertas.** Las alertas no tienen un id: se identifican por su `origen` y su `clave` completa, que se reenvía tal cual (`{ origen, ...clave }`). La acción queda deshabilitada y marcada "Marcando…" mientras se procesa y **la alerta no se muestra como revisada hasta que el servidor confirma** y las listas se vuelven a pedir. Si falla, se muestra el mensaje del servidor y el botón pasa a "Reintentar". El resultado se anuncia en una región `aria-live`. No hay modal de confirmación.
- **Unidades del filtro de alertas.** Salen de la API (`GET /unidades` con `activa=true` y con `activa=false`, para incluir las dadas de baja, que pueden tener alertas). Es un acceso mínimo propio de la feature `alerts`, que reutiliza `api/pagination` y no importa nada de `fleet`.
- **Regreso desde el detalle.** Al abrir una unidad desde la flota o desde una alerta se pasa el destino de regreso (con sus filtros) en el estado de navegación del router; el detalle lo usa para "← Volver a …". Si se entró directamente al detalle, vuelve a `/unidades`. El estado se valida (solo rutas internas).
- **Recuperación tras una caída de la API.** "Reintentar" en Flota, Detalle y Alertas vuelve a pedir **todas las consultas en uso que terminaron en error** (`useRetryFailedQueries`), no solo la de la pantalla: así también se recupera el usuario del encabezado. No conoce dominios (mira el estado de las consultas, no sus claves), no recarga la página y no vuelve a pedir lo que está bien. No hay reintentos automáticos.
- **El frontend no recalcula el mantenimiento.** El estado de cada tarea, los km restantes y el "estado más crítico" los calcula la API y se muestran tal cual.
- **Tipos generados sin `required`.** El contrato no marca campos obligatorios en las respuestas, así que `openapi-typescript` los genera todos como opcionales. `Complete<T>` en `src/api/types.ts` los vuelve obligatorios (conservando `| null`) y `api/guards.ts` verifica la forma general en tiempo de ejecución.
- **TypeScript 5.9.** Se fija en `~5.9` porque `openapi-typescript` 7 declara `typescript@^5` como peer dependency.
- **Lint con oxlint**, el que trae la plantilla de Vite.
