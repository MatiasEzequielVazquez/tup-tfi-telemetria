# Backend — Sistema de Telemetría Vehicular

Un único proceso Node.js (TypeScript) con tres partes:

| Parte | Módulo | Qué hace |
|---|---|---|
| API REST (`/api/v1`) | M1, M2, M4–M7, M9 | Implementa el contrato de [`docs/openapi.yaml`](../docs/openapi.yaml). |
| Ingesta MQTT | M3 | Se suscribe al broker, valida cada mensaje y guarda lecturas y fallas. Recalcula los planes y genera alertas. |
| Temporizador | M8 | Marca como *sin reportar* a los dispositivos sin comunicación por más del plazo configurado (RN10). |

**Stack:** Node.js 22+, TypeScript, Express 5, [postgres.js](https://github.com/porsager/postgres) (PostgreSQL de Supabase), [mqtt.js](https://github.com/mqttjs/MQTT.js), `node:test`. La sesión se valida contra Supabase Auth.

## Estructura

```
backend/
├── src/
│   ├── index.ts               # Arranque: API + ingesta + temporizador, apagado ordenado
│   ├── app.ts                 # App Express (rutas, CORS, errores, /health)
│   ├── config.ts              # Variables de entorno, validadas al arrancar
│   ├── db.ts                  # Cliente PostgreSQL y helper de transacciones
│   ├── auth/                  # M1: verificación del token y control de rol (RN11)
│   ├── http/                  # Errores del contrato, validaciones, paginación
│   ├── types/                 # Tipos de Express (usuario de la sesión)
│   └── modulos/
│       ├── usuarios/          # M1  /me, /usuarios
│       ├── unidades/          # M2/M9  flota, alta/baja, detalle
│       ├── dispositivos/      # M2  alta, vincular, desvincular (RN02)
│       ├── mantenimiento/     # M4  catálogo, planes y reglas (RN04, RN05, RN07)
│       ├── services/          # M5  services (RN06, RN08)
│       ├── postergaciones/    # M5  postergaciones (RN07)
│       ├── fallas/            # M6  (RN12)
│       ├── alertas/           # M7
│       ├── kilometraje/       # M9  carga manual (RN09)
│       ├── ingesta/           # M3  parser, procesador y cliente MQTT
│       └── temporizador/      # M8
├── scripts/
│   ├── seed.ts                # Genera db/seed.sql (y con --cargar lo aplica)
│   ├── mensaje.ts             # Procesa un mensaje puntual contra la base
│   └── simulador.ts           # Simulador de flota (publica como el firmware)
├── test/                      # Unitarios + integración contra PostgreSQL real
├── docker-compose.dev.yml     # PostgreSQL y HiveMQ CE locales
└── Dockerfile                 # Imagen de producción
```

## Puesta en marcha

Requisitos: Node.js 22 o superior y una base PostgreSQL con [`db/schema.sql`](../db/schema.sql) aplicado (Supabase o local).

```bash
cd backend
npm install
cp .env.example .env      # completar DATABASE_URL y, si hace falta, Supabase y MQTT
npm run dev               # http://localhost:3000  (se reinicia al guardar)
```

Verificación: `GET http://localhost:3000/health` devuelve `{"status":"ok","db":"ok",...}`.

### Variables de entorno

| Variable | Por defecto | Descripción |
|---|---|---|
| `DATABASE_URL` | — | Cadena de conexión. En Supabase, el **Session pooler** con `?sslmode=require`. |
| `AUTH_MODE` | `dev` (`supabase` si `NODE_ENV=production`) | `supabase` valida el token contra Supabase Auth. `dev` acepta `Bearer admin`, `Bearer mantenimiento` o `Bearer <email>`. `dev` está prohibido con `NODE_ENV=production`. |con `NODE_ENV=production`. |
| `SUPABASE_URL`, `SUPABASE_ANON_KEY` | — | Project Settings → API. Obligatorias con `AUTH_MODE=supabase`. |
| `AUTH_CACHE_SEGUNDOS` | `60` | Tiempo que se recuerda un token ya validado. |
| `MQTT_BROKER_URL` | — | Sin valor, la ingesta queda deshabilitada (la API funciona igual). |
| `MQTT_HABILITADO` | según `MQTT_BROKER_URL` | `false` apaga la ingesta aunque haya URL de broker. |
| `MQTT_USERNAME`, `MQTT_PASSWORD` | — | Credenciales del backend en el broker. |
| `MQTT_TOPIC_LECTURAS` | `telemetria/+/lecturas` | Topic de suscripción. |
| `MQTT_CLIENT_ID` | `tfi-backend` | Identificador fijo (ver nota más abajo). |
| `PORT` | `3000` | |
| `NODE_ENV` | `development` | |
| `CORS_ORIGIN` | `http://localhost:5173` | Orígenes permitidos, separados por coma. |
| `PLAZO_DISPOSITIVO_SIN_REPORTAR_HORAS` | `24` | RN10. |
| `TEMPORIZADOR_INTERVALO_MINUTOS` | `5` | Frecuencia del temporizador (M8). |
| `ZONA_HORARIA` | `America/Argentina/Buenos_Aires` | Define qué día es "hoy" para services y postergaciones. |
| `TOLERANCIA_FUTURO_MINUTOS` | `10` | Adelanto máximo aceptado en el `timestamp` de un mensaje. |

### Datos de ejemplo

```bash
npx tsx scripts/seed.ts                            # regenera db/seed.sql desde mock/data/db.json
npx tsx --env-file=.env scripts/seed.ts --cargar   # además lo carga en DATABASE_URL
```

La carga borra los datos de la flota y conserva los usuarios y el catálogo de tareas. También se puede ejecutar [`db/seed.sql`](../db/seed.sql) directamente en el SQL Editor de Supabase.

### Entorno local con Docker

Para trabajar sin tocar Supabase ni un broker externo:

```bash
docker compose -f docker-compose.dev.yml up -d
# PostgreSQL 17 → localhost:5433 (usuario y contraseña postgres)
# HiveMQ CE    → mqtt://localhost:1883
```

### Usar el dashboard contra el backend

Con `AUTH_MODE=dev` el backend acepta los mismos tokens que el mock, así que el frontend funciona sin login real: alcanza con apuntar `VITE_API_URL` a `http://localhost:3000/api/v1`. Con `AUTH_MODE=supabase` el token tiene que ser el `access_token` de una sesión de Supabase Auth, y ese email tiene que estar en la tabla `usuarios` con su rol.

## Simulador de flota

Publica mensajes con el formato del firmware para probar el circuito completo sin hardware. Toma los dispositivos vinculados y su km actual de la base.

```bash
npm run simulador -- --modo mqtt --intervalo 5                         # al broker (MQTT_BROKER_URL)
npm run simulador -- --modo directo --rondas 10 --km-por-ronda 2500    # directo a la base, sin broker
```

En PowerShell el `--` se escribe entre comillas: `npm run simulador '--' --modo directo ...`. Con `--km-por-ronda` alto se ve rápido cómo las tareas pasan a *próxima* y *vencida* y aparecen las alertas. Las opciones están documentadas al principio de [`scripts/simulador.ts`](scripts/simulador.ts).

Para un mensaje puntual (por ejemplo, un retroceso de km o una falla):

```bash
npx tsx --env-file=.env scripts/mensaje.ts --device esp32-0F3A21 --km 412500 --dtc P0300
```

## Ingesta MQTT

- **Topic:** `telemetria/<device_uid>/lecturas`, QoS 1. Contrato del mensaje en la [2ª entrega, §3.2](../docs/entregas/02-arquitectura-modulos.md#32-contrato-del-mensaje-mqtt).
- **Sesión persistente** (`clean: false`): mientras el backend está caído, el broker guarda los mensajes y los entrega al reconectar. Reintenta la conexión cada 5 s.
- **Un solo backend por broker:** el `MQTT_CLIENT_ID` es fijo, así que dos instancias conectadas al mismo broker se desconectan entre sí. No correr el backend local contra el broker de producción.
- **Orden:** los mensajes se procesan en paralelo entre dispositivos y en orden dentro de cada dispositivo, con un timeout de 30 s por mensaje. `/health` informa los recibidos, procesados, descartados y pendientes.

Decisiones de la implementación (**a confirmar con el firmware**):

- `timestamp` es obligatorio y es la marca de tiempo de la lectura. Se rechazan los mensajes con más de `TOLERANCIA_FUTURO_MINUTOS` de adelanto.
- Un `dtc` con `"activo": true` (o sin `activo`) abre la falla si no estaba abierta. Con `"activo": false` la cierra (RN12). Un mensaje sin `dtc` no cierra nada.
- Las lecturas de un tipo desconocido se ignoran sin descartar el resto del mensaje.
- Se descartan los mensajes de dispositivos no registrados y las lecturas anteriores a la vinculación.
- Una lectura de km menor a una anterior se guarda con `consistente = false` y no actualiza el km (RN09). Una lectura atrasada (enviada después de estar sin señal) no se marca inconsistente.
- El km de una unidad J1939 se toma como `odometro`; en J1979 es `estimado` (RN08).

## Tests

Corren contra PostgreSQL real: cada archivo crea una base temporal con el esquema y los datos de ejemplo, y la borra al terminar. **Nunca apuntar a Supabase.**

```bash
docker compose -f docker-compose.dev.yml up -d   # PostgreSQL local en el puerto 5433
npm test                                         # lee TEST_DATABASE_URL de .env.test
npm run typecheck
```

Sin `TEST_DATABASE_URL`, los tests de integración se saltean y corren solo los unitarios.

## Producción

```bash
npm run build     # compila a dist/
npm start         # node dist/index.js
```

En producción corre como contenedor (`Dockerfile`) junto con HiveMQ CE y Caddy. Ver [`docs/despliegue.md`](../docs/despliegue.md).