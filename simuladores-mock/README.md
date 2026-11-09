# Simulador de camiones

Simula uno o varios camiones con su dispositivo de telemetría (el ESP32) y publica sus lecturas en el broker MQTT del sistema, con el mismo contrato que el firmware ([§3.2 de la 2ª entrega](../docs/entregas/02-arquitectura-modulos.md#32-contrato-del-mensaje-mqtt)). Corre **desde tu PC** y habla con el broker de la VM por TLS (puerto 8883); no necesita acceso a la base de datos.

Un camión nuevo arranca en **0 km**, recorre jornadas (arranque, ruta, paradas, descarga), acumula kilómetros y horas de motor, y de a ratos le aparecen fallas (DTC) que luego se cierran. El backend las procesa como si vinieran de un dispositivo real: actualiza el km de la unidad, recalcula los planes de mantenimiento y genera alertas.

> **Puesta en producción en la VM, paso a paso: [DESPLIEGUE.md](DESPLIEGUE.md).** Este README es la referencia del simulador.

> No reemplaza a `backend/scripts/simulador.ts`: ese lee la flota de la base y puede procesar directo contra ella. Este solo publica por MQTT, que es lo que hace un dispositivo.

## Qué se envía (y qué no)

La ingesta solo guarda tres tipos de lectura: `km`, `horas_motor` y `dtc`. Cualquier otro tipo (velocidad, rpm, GPS…) lo ignora y deja una advertencia en el log, por eso el simulador **calcula la velocidad pero no la publica**. La velocidad se ve en la consola del simulador.

| Protocolo | Lecturas por mensaje | Fuente del km (RN08) |
|---|---|---|
| `J1939` (camión, por defecto) | `km` (pgn 65248) y `horas_motor` (pgn 65253) | `odometro`, exacto |
| `J1979` (utilitario) | `km` (pid 010D, integración de velocidad) | `estimado`, con un sesgo fijo de ±2 % por dispositivo |

Las fallas viajan como `dtc` solo cuando cambian: `activo: true` al aparecer y `activo: false` al cerrarse. Una falla dura al menos un mensaje, nunca se abre y se cierra en el mismo.

## Instalación

Requiere Python 3.11 o superior.

```bash
cd simuladores-mock
python -m venv .venv
.venv/Scripts/activate            # Windows (Git Bash). En PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt   # paho-mqtt y certifi
cp .env.example .env              # y completar MQTT_PASSWORD
```

`.env` no se versiona. Las variables del entorno pisan a las del archivo.

| Variable | Qué es |
|---|---|
| `MQTT_BROKER_URL` | `mqtts://157-151-13-187.sslip.io:8883` (VM) o `mqtt://localhost:1883` (broker local de `backend/docker-compose.dev.yml`) |
| `MQTT_USERNAME`, `MQTT_PASSWORD` | Usuario `simulador` de `credentials.xml` de HiveMQ: puede publicar en `telemetria/+/lecturas`. La contraseña la tiene quien armó la VM |
| `MQTT_TOPIC_LECTURAS` | Opcional. Por defecto `telemetria/+/lecturas`; el `+` es el `device_uid` |
| `MQTT_CA_FILE` | Opcional. CA propia; por defecto el bundle de `certifi` (ver [TLS](#tls)) |

## Preparar el camión en el sistema

El simulador no crea nada en el sistema: **el camión tiene que existir y estar vinculado antes de arrancar**, si no el backend descarta los mensajes. Desde el dashboard, con un usuario admin (sección **Administración**):

1. **Unidades → Nueva unidad**: patente, marca, modelo, tenencia y protocolo (`J1939` para un camión). Nace con `km_actual = 0`.
2. **Dispositivos → Nuevo dispositivo**: un `device_uid` de 3 a 50 caracteres (letras, números, `_` o `-`), por ejemplo `esp32-SIM001`.
3. En esa misma lista, **Vincular a una unidad** el dispositivo recién creado.
4. En el **plan de la unidad**, **Asignar tarea** del catálogo (cambio de aceite cada 40 000 km, etc.) para que el camión genere alertas de mantenimiento.

Hacelo **antes** de arrancar: la vinculación vale desde el momento en que se hace y el backend descarta las lecturas anteriores.

## Uso

```bash
python -m simulador --help
python -m simulador --listar-rutas
```

### Camión de 0 km en tiempo real

```bash
python -m simulador --dispositivo esp32-SIM001
```

Un mensaje cada 10 s. En tiempo real un camión tarda mucho en sumar kilómetros (~80 km por hora), así que para ver alertas conviene acelerar.

### Rodaje acelerado hasta el primer aviso de mantenimiento

```bash
python -m simulador --dispositivo esp32-SIM001 --aceleracion 1800 --hasta-km 37000
```

Cada mensaje equivale a 5 horas de marcha (~330 km en la ruta `mixta`). Con los valores del catálogo, el aceite de motor avisa a los 36 000 km y vence a los 40 000: llega al aviso en ~110 mensajes, unos 18 minutos.

### Otras recetas

| Quiero… | Comando |
|---|---|
| Una falla puntual de sobretemperatura a los 500 km | `--falla SPN-110-FMI-0@500` |
| Más o menos fallas espontáneas | `--prob-falla 0.2` (por hora de motor; `0` las apaga) |
| Un corte de cobertura de 2 min a partir del minuto 1 | `--sin-senal 60:120` |
| Una flota de tres camiones | `--dispositivo esp32-SIM01,esp32-SIM02,esp32-SIM03` |
| Un utilitario con km estimado | `--protocolo J1979 --ruta urbana` |
| Seguir un camión que ya tenía kilómetros | `--km-inicial 85000 --horas-iniciales 2100` |
| Un recorrido reproducible | `--semilla 42` |
| Ver los mensajes sin conectarse | `--dry-run` (con `--sin-espera` no espera entre mensajes) |
| Terminar solo | `--rondas 50`, `--duracion 600` (segundos) o `--hasta-km 37000` |

Una flota se reparte a lo largo de la jornada para que los camiones no marchen al unísono. Cada dispositivo de la flota tiene que estar dado de alta y vinculado.

### Salida

```
[  12] esp32-SIM001     ruta             84.2 km/h  km      1032.4  h    14.6 +SPN-110-FMI-0  [1 falla(s) activa(s)]  -> enviado
```

Ronda, dispositivo, tramo de la jornada, velocidad, km, horas de motor, fallas que cambiaron en ese mensaje (`+` aparece, `-` se cierra) y el resultado del envío. `en cola (N pendientes)` indica que no hay señal o conexión y los mensajes esperan.

## Cómo funciona

- **Tiempo.** Los `timestamp` son siempre la hora real. El backend rechaza lecturas con más de 10 minutos de adelanto y descarta las anteriores a la vinculación, así que no se puede "adelantar" ni "rellenar" el reloj. `--aceleracion` no toca el reloj: aumenta cuánto recorre el camión entre un mensaje y el siguiente.
- **Motor apagado.** El ESP32 se alimenta con el contacto, así que durante la noche no reporta. El simulador salta esos tramos sin esperar. (El aviso de "dispositivo sin reportar" es a las 24 h, por eso no hay un escenario para provocarlo.)
- **Estado en disco.** El km y las horas se guardan en `estado/<device_uid>.json` después de cada mensaje y se retoman al reiniciar. Sin eso, volver a 0 km haría que el backend marque las lecturas como inconsistentes (RN09). Para empezar de cero a propósito: `--reiniciar`. Un `--dry-run` no modifica el estado.
- **Corte de señal.** Los mensajes se guardan con su `timestamp` original y se mandan en orden al volver (QoS 1, como el firmware). Es el caso de lecturas atrasadas del RNF02. Si el broker se cae de verdad, ocurre lo mismo y paho reconecta solo.
- **Desgaste.** La probabilidad de falla sube con los km (`× (1 + km/100 000)`). Algunas limitan la velocidad mientras están activas (sobretemperatura, baja presión del turbo), como un modo de emergencia.

## Verificación

Con el simulador corriendo, en la VM:

```bash
curl https://157-151-13-187.sslip.io/health
# "mqtt":{"conectado":true,"recibidos":...,"procesados":...}   ← tienen que subir con cada mensaje
docker compose logs -f api                                      # "[mqtt] esp32-SIM001 (AB123CD): 2 lecturas, km actualizado"
```

En el dashboard, la unidad muestra el km creciendo, el dispositivo "activo" con su última comunicación, y aparecen las alertas de mantenimiento y de fallas.

## Problemas frecuentes

| Síntoma | Causa |
|---|---|
| `Bad user name or password` / `Not authorized` | `MQTT_USERNAME` o `MQTT_PASSWORD` no coinciden con `credentials.xml` del broker. La extensión relee el archivo cada 60 s |
| `[mqtt] ...: dispositivo no registrado` en el log de la API | El `device_uid` no se dio de alta en Dispositivos |
| `[mqtt] ...: sin vinculación al momento de la lectura` | El dispositivo existe pero no está vinculado a una unidad (o se vinculó después de arrancar el simulador) |
| El km de la unidad no sube y hay lecturas "inconsistentes" | El simulador reinició desde un km menor al de la unidad (borraste `estado/` o usaste `--reiniciar`). Usá `--km-inicial` con el km actual de la unidad |
| `no se pudo conectar a ... en 15 s` | Puerto 8883 cerrado (Security List de Oracle o iptables), broker caído, o URL equivocada |

### TLS

El broker usa el mismo certificado de Let's Encrypt que Caddy. Python en Windows valida contra el almacén de certificados del sistema, que puede traer un certificado cruzado viejo de Let's Encrypt, ya vencido, y rechazar un certificado válido con `certificate has expired`. Por eso el simulador usa el bundle de Mozilla (`certifi`) en lugar del almacén del sistema. Con otra CA, apuntá `MQTT_CA_FILE` al archivo `.pem`.

## Pruebas

```bash
pip install -r requirements-dev.txt
python -m pytest
```

Incluyen el modelo del camión, el formato de los mensajes, la persistencia, el cliente MQTT real (paho) contra un mini-broker local —autenticación, QoS 1, reconexión y cola— y un test que pasa los mensajes generados por el `parser.ts` real del backend (se saltea si no hay Node ≥ 22.18).
