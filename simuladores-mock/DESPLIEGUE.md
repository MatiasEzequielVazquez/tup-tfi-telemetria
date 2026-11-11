# Puesta en producción en la VM

Guía para dejar funcionando en **producción** (la VM de Oracle) el dashboard con las analíticas y ver un camión simulado, corrido desde tu PC, llegar hasta él: `simulador (tu PC) ──MQTT/TLS :8883──▶ HiveMQ ──▶ api ──▶ Supabase ──▶ dashboard`.

Cada paso tiene su **comprobación**: no sigas al siguiente hasta que dé lo esperado. La referencia del simulador está en el [README](README.md); la de la infraestructura, en [`docs/despliegue.md`](../docs/despliegue.md).

| | |
|---|---|
| VM | `157.151.13.187` (usuario `ubuntu`) |
| Dominio | `157-151-13-187.sslip.io` |
| Código en la VM | `~/tup-tfi-telemetria` (compose en `deploy/`) |
| Broker | HiveMQ CE, TLS en el puerto `8883` |

## Qué cambia en producción (y qué no)

- **Cambia:** los archivos del dashboard (`frontend/dist`) y, si falta, un usuario del broker.
- **No cambia:** backend, base de datos, esquema ni contenedores. **No hay que hacer `git pull` ni `docker compose up --build`**, y no hay corte de servicio: Caddy sirve los archivos nuevos sin reiniciarse.
- El simulador **no se instala en la VM**: corre en tu PC y se conecta al broker como cualquier dispositivo.

## 0. Antes de empezar

Desde tu PC, el sistema tiene que estar sano:

```bash
curl https://157-151-13-187.sslip.io/health
```

✅ Esperado: `"status":"ok"`, `"db":"ok"` y `"mqtt":{"conectado":true,…}`. Si no, resolvelo antes: no tiene sentido desplegar sobre un sistema caído.

Entrá a la VM (los pasos 1 y 2 se hacen ahí) con tu clave SSH:

```bash
ssh -i ~/.ssh/clave_tfi ubuntu@157.151.13.187
```

## 1. Dashboard con analíticas

### 1.1 Compilar (en tu PC)

```bash
cd frontend
npm ci && npm run build
```

Necesita `frontend/.env.production` (con `VITE_API_URL=/api/v1` y las claves de Supabase; ver `.env.production.example`). El build **rechaza** `VITE_AUTH_MODE=dev`: en producción la sesión es siempre Supabase.

✅ Esperado: termina sin errores y existe `dist/assets/analytics-*.js` (la pantalla de analíticas, que se descarga solo al entrar a ella).

### 1.2 Respaldo de lo que está publicado (en la VM)

```bash
cp -a ~/tup-tfi-telemetria/frontend/dist ~/respaldo-dashboard-$(date +%F)
```

### 1.3 Copiar (en tu PC)

```bash
scp -i ~/.ssh/clave_tfi -r dist/. ubuntu@157.151.13.187:~/tup-tfi-telemetria/frontend/dist/
```

El `/.` final copia el **contenido** de `dist`. No borres `frontend/dist` en la VM: Caddy la tiene montada y, si la carpeta se recrea, el contenedor queda apuntando a una vacía. Basta con pisar los archivos.

### 1.4 Comprobar

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://157-151-13-187.sslip.io/analiticas
```

✅ Esperado: `200`. Después, en el navegador, **Ctrl + F5** (por si quedó la versión vieja en caché), iniciá sesión y verificá que aparece **Analíticas** en el menú y que la pantalla carga los indicadores y los gráficos.

↩️ **Para volver atrás:** `cp -a ~/respaldo-dashboard-<fecha>/. ~/tup-tfi-telemetria/frontend/dist/`

## 2. Usuario del simulador en el broker (en la VM)

El simulador se conecta con el usuario `simulador`, que solo puede **publicar** en `telemetria/+/lecturas` (RNF03). Las contraseñas del broker están en `credentials.xml`, que no está en el repositorio.

```bash
CRED=~/tup-tfi-telemetria/deploy/hivemq/extensions/hivemq-file-rbac-extension/conf/credentials.xml
sudo grep -c '<name>simulador</name>' $CRED
sudo grep -c '<id>simulador</id>' $CRED
```

✅ Esperado: `1` y `2` (el usuario, y el rol referenciado y definido). Si ya están, **salteá al paso 3** y usá la contraseña que ya tenías.

Si falta alguno, generá una contraseña y agregalo:

```bash
openssl rand -hex 16          # guardala en tu gestor de contraseñas; no la pegues en chats ni en commits
sudo nano $CRED
```

Dentro de `<users>` agregá el usuario, y dentro de `<roles>` el rol (copialos de [`credentials.example.xml`](../deploy/hivemq/credentials.example.xml)):

```xml
<user>
    <name>simulador</name>
    <password>LA_CONTRASEÑA_GENERADA</password>
    <roles><id>simulador</id></roles>
</user>
<role>
    <id>simulador</id>
    <permissions>
        <permission>
            <topic>telemetria/+/lecturas</topic>
            <activity>PUBLISH</activity>
        </permission>
    </permissions>
</role>
```

Dejá el archivo con sus permisos de siempre y **esperá 60 segundos** (la extensión relee el archivo sola; no hay que reiniciar el broker):

```bash
sudo chown 10000:10000 $CRED && sudo chmod 600 $CRED
```

La comprobación real de este paso es el paso 4.

## 3. Crear el camión en producción

El simulador **no crea nada**: el camión tiene que existir y estar vinculado **antes** de arrancar, porque el backend descarta las lecturas de un dispositivo desconocido y las anteriores a su vinculación. En el dashboard, con un usuario administrador, sección **Administración**:

1. **Unidades → Nueva unidad:** patente `SIM001`, marca `Scania`, modelo `R 450 (simulado)`, tenencia **Propia**, protocolo **J1939**. Nace con 0 km.
2. **Dispositivos → Nuevo dispositivo:** `esp32-SIM001`.
3. En esa lista, **Vincular a una unidad** → `SIM001`.
4. Desde la unidad, **Plan de mantenimiento → Asignar tarea**: al menos `ACEITE_MOTOR` (vence cada 40 000 km, avisa a los 36 000).

✅ Esperado: en Dispositivos, `esp32-SIM001` figura vinculado a `SIM001` (inactivo hasta su primer mensaje).

> ⚠️ Esta unidad **cuenta en la flota real**: entra en los promedios y en las analíticas. Por eso se identifica con prefijo `SIM`/`esp32-SIM` y se retira al terminar (paso 6).

## 4. Correr el simulador (en tu PC)

### 4.1 Instalar

```bash
cd simuladores-mock
python -m venv .venv
.venv/Scripts/activate            # Git Bash. En PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
```

Editá `.env` y completá **`MQTT_PASSWORD`** con la contraseña del usuario `simulador`. La URL ya apunta a producción (`mqtts://157-151-13-187.sslip.io:8883`). `.env` no se versiona.

### 4.2 Prueba de conexión: un solo mensaje

```bash
python -m simulador --dispositivo esp32-SIM001 --rondas 1
```

✅ Esperado, algo así (los números varían):

```
esp32-SIM001: J1939, ruta mixta, arranca de cero (km 0.0, 0.0 h)
Conectado a 157-151-13-187.sslip.io:8883. Ctrl+C para terminar.
[   1] esp32-SIM001     arranque   0.0 km/h  km  0.0  h  0.0  -> enviado
```

| Si ves… | Es que… |
|---|---|
| `Bad user name or password` | la contraseña no coincide con `credentials.xml`, o pasaron menos de 60 s desde el paso 2 |
| `no se pudo conectar … en 15 s` | el puerto 8883 no llega: ver [problemas frecuentes](#problemas-frecuentes) |

### 4.3 Recorrido acotado

Un camión de 0 km hasta pasar el aviso de cambio de aceite, en ~18 minutos (cada mensaje equivale a 5 h de marcha; los timestamps siguen siendo reales):

```bash
python -m simulador --dispositivo esp32-SIM001 --aceleracion 1800 --hasta-km 37000
```

> **En producción, acotá siempre la corrida** (`--hasta-km`, `--rondas` o `--duracion`). Sin límite publica un mensaje cada 10 s indefinidamente: ~8 600 por día contra la base gratuita de Supabase.

Para ver también una falla y una alerta de falla nueva:

```bash
python -m simulador --dispositivo esp32-SIM001 --falla SPN-110-FMI-0@500 --aceleracion 1800 --hasta-km 2000
```

## 5. Verificar en producción

Con el simulador corriendo:

**a) Que el backend los recibe** (en la VM):

```bash
curl https://157-151-13-187.sslip.io/health
cd ~/tup-tfi-telemetria/deploy && docker compose logs --since 5m api | grep mqtt
```

✅ En `/health`, `recibidos` y `procesados` suben con cada mensaje y `pendientes` queda en 0. En el log: `[mqtt] esp32-SIM001 (SIM001): 2 lecturas, km actualizado`.

**b) Que se ve en el dashboard** (refrescá cada tanto):

- La unidad `SIM001` muestra el km creciendo y el dispositivo **Activo** con su última comunicación.
- Al pasar los 36 000 km aparece una alerta **Tarea próxima** de `ACEITE_MOTOR` en **Alertas**.
- **Analíticas** cuenta la unidad nueva (se actualiza sola cada 30 s o con **Actualizar**): sube "Unidades activas", baja el "Km promedio por unidad" y la alerta suma en "Alertas por tipo".

**c) Que la VM aguanta** (tiene 1 GB de RAM):

```bash
docker stats --no-stream
```

✅ Los tres contenedores por debajo de sus límites (api 256 MB, hivemq 400 MB, caddy 64 MB).

## 6. Cierre y limpieza

1. **Detené** el simulador (Ctrl + C). Si lo volvés a lanzar, retoma el km donde quedó (`estado/`); para empezar de cero, `--reiniciar` **y** una unidad nueva, porque si el km retrocede el backend marca las lecturas como inconsistentes.
2. **Retirá el camión de la flota real:** en Dispositivos, **Desvincular** `esp32-SIM001`; luego en Unidades, **Dar de baja** `SIM001` (el sistema no deja darla de baja con un dispositivo vinculado). Su historial queda, pero sale de las analíticas y del listado de activas.
3. **Credenciales:** si no vas a volver a usar el simulador, quitá el usuario `simulador` de `credentials.xml` (mismo archivo del paso 2).
4. **Revisá lo que quedó abierto en la VM:**

   ```bash
   grep -n despliegue-frontend ~/.ssh/authorized_keys      # una clave temporal: si aparece, borrala
   sudo crontab -l | grep cert-mqtt                          # tiene que existir la renovación del certificado
   ```

   El certificado del broker vence el **21/01/2027**; sin ese cron, HiveMQ seguiría sirviendo el viejo y todos los dispositivos dejarían de conectarse.

## Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `no se pudo conectar … en 15 s` | Puerto 8883 sin acceso: revisar la Security List de Oracle y `iptables` (`docs/despliegue.md` §2), y `docker compose ps` (hivemq `Up`) |
| `[mqtt] …: dispositivo no registrado` en el log de la API | El `device_uid` no está dado de alta en Dispositivos |
| `[mqtt] …: sin vinculación al momento de la lectura` | El dispositivo existe pero no está vinculado, o se vinculó **después** de arrancar el simulador |
| El km de la unidad no sube, lecturas "inconsistentes" | El simulador arrancó con menos km que la unidad. Usá `--km-inicial` con el km actual de la unidad |
| `/analiticas` muestra la pantalla vieja o no existe | Caché del navegador (Ctrl + F5) o el `scp` no copió: comprobá que existe `frontend/dist/assets/analytics-*.js` en la VM |
| `certificate has expired` desde Python en Windows | No es el certificado del broker: es el almacén de Windows. El simulador ya usa el bundle de `certifi`; si lo cambiaste, usá `MQTT_CA_FILE` |
| El camión aparece pero sin alertas de mantenimiento | La unidad no tiene tareas en su plan (paso 3.4) |
