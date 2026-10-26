# Despliegue

Todo el sistema corre en una VM **Oracle Cloud Always Free** con Docker. La base de datos y la autenticación quedan en **Supabase**. El broker MQTT es **HiveMQ CE** autoalojado en la misma VM (RNF12: sin costo).

```
ESP32 / simulador ──MQTT/TLS :8883──▶ hivemq ◀──:1883 (red interna)── api ──▶ Supabase (PostgreSQL + Auth)
                                                                       ▲
Navegador ──HTTPS :443──▶ caddy ── /api/*, /health ────────────────────┘
                            └───── /  → dashboard (frontend/dist)
```

| Contenedor | Imagen | Qué hace | Memoria |
|---|---|---|---|
| `tfi-api` | `backend/Dockerfile` | API REST, ingesta MQTT y temporizador en un solo proceso. Tiene que estar siempre encendido: por eso una VM y no un PaaS que suspende procesos. | 256 MB |
| `tfi-hivemq` | `hivemq/hivemq-ce` | Broker MQTT. Usuarios y permisos por topic con la extensión File RBAC (RNF03). TLS hacia afuera, sin TLS solo en la red interna de Docker. | 400 MB |
| `tfi-caddy` | `caddy:2-alpine` | HTTPS automático con Let's Encrypt, sirve el dashboard y reenvía `/api` al backend. Dashboard y API comparten dominio, así que no hace falta CORS. | 64 MB |

Los archivos están en [`deploy/`](../deploy).

### Cambios respecto de lo planificado

- **HiveMQ Cloud → HiveMQ CE autoalojado:** HiveMQ Cloud dejó de ofrecer un plan gratuito.
- **VM ARM (A1.Flex) → AMD Micro (E2.1.Micro):** no había capacidad ARM disponible en la región. La AMD Micro tiene 1 GB de RAM; con los límites de memoria de cada contenedor y 2 GB de swap, el sistema entra.

## 1. Supabase

1. Aplicar [`db/schema.sql`](../db/schema.sql) en el SQL Editor y, si se quiere la flota de ejemplo, [`db/seed.sql`](../db/seed.sql).
2. **Authentication → Users**: crear cada usuario del sistema y darlo de alta también en la tabla `usuarios` con su rol (o con `POST /usuarios`, una vez que exista un admin).
3. Copiar la **URL** y la **anon key** (Project Settings → API) y la cadena de conexión del **Session pooler** (Connect). La conexión directa del plan gratuito es solo IPv6, y la VM sale por IPv4.

**Pausa por inactividad:** Supabase pausa los proyectos gratuitos sin actividad durante una semana. El temporizador del backend consulta la base cada 5 minutos, lo que mantiene el proyecto activo.

## 2. VM de Oracle Cloud

1. **Compute → Instances → Create**: forma **VM.Standard.E2.1.Micro** (Always Free), Ubuntu 24.04, con la clave SSH propia.
2. **IP pública**: si la instancia quedó sin IP, en *Attached VNICs → IPv4 addresses → Edit*, asignar una *Ephemeral public IP*.
3. **Security List** de la subred (Networking → Virtual Cloud Networks → la VCN → Security → Security Lists): agregar reglas de ingress *stateful* desde `0.0.0.0/0`, TCP, a los puertos **80**, **443** y **8883**.
4. **Firewall de la VM**: Ubuntu en Oracle trae reglas de iptables propias, así que también hay que abrir los puertos ahí:
   ```bash
   for p in 80 443 8883; do
     sudo iptables -I INPUT 6 -m state --state NEW -p tcp --dport $p -j ACCEPT
   done
   sudo netfilter-persistent save
   ```
5. **Swap de 2 GB** (imprescindible con 1 GB de RAM):
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
6. **Docker**:
   ```bash
   curl -fsSL https://get.docker.com | sh
   sudo usermod -aG docker $USER     # volver a iniciar sesión
   ```

## 3. Primer despliegue

### 3.1 Código y configuración

```bash
git clone https://github.com/MatiasEzequielVazquez/tup-tfi-telemetria.git
cd tup-tfi-telemetria
git config core.fileMode false

# Backend: Supabase y credenciales MQTT del usuario "backend".
# NODE_ENV, AUTH_MODE y MQTT_BROKER_URL los fija docker-compose.yml.
cp backend/.env.example backend/.env && nano backend/.env

# Despliegue: dominio y contraseña del keystore del broker.
# Sin dominio propio, sslip.io resuelve la IP: 157.151.13.187 → 157-151-13-187.sslip.io
cd deploy
IP=$(curl -s https://ifconfig.me)
printf 'DOMINIO=%s.sslip.io\nMQTT_KEYSTORE_PASSWORD=%s\n' "${IP//./-}" "$(openssl rand -hex 16)" > .env
```

### 3.2 Extensión File RBAC de HiveMQ

```bash
cd ~/tup-tfi-telemetria/deploy
mkdir -p hivemq/extensions && cd hivemq/extensions
V=4.6.19
curl -fsSLO https://github.com/hivemq/hivemq-file-rbac-extension/releases/download/$V/hivemq-file-rbac-extension-$V.zip
unzip -q hivemq-file-rbac-extension-$V.zip && rm hivemq-file-rbac-extension-$V.zip

cd hivemq-file-rbac-extension
cp ../../credentials.example.xml conf/credentials.xml
nano conf/credentials.xml              # cambiar las contraseñas
sed -i 's/HASHED/PLAIN/' conf/config.xml
cd ~/tup-tfi-telemetria/deploy
sudo chown -R 10000:10000 hivemq/extensions   # HiveMQ corre con el usuario 10000
sudo chmod 600 hivemq/extensions/hivemq-file-rbac-extension/conf/credentials.xml
```

La contraseña del usuario `backend` en `credentials.xml` tiene que ser la misma que `MQTT_PASSWORD` en `backend/.env`. Roles:

| Rol | Permiso | Usuarios |
|---|---|---|
| `backend` | SUBSCRIBE `telemetria/+/lecturas` | `backend` |
| `simulador` | PUBLISH `telemetria/+/lecturas` | `simulador` |
| `dispositivo` | PUBLISH solo en `telemetria/<su usuario>/lecturas` | uno por ESP32, con su `device_uid` como nombre |

### 3.3 Dashboard

El dashboard se compila apuntando a la API del mismo dominio (`VITE_API_URL=/api/v1`) y se copia a `frontend/dist` en la VM. Conviene compilarlo en la PC, porque con 1 GB de RAM la VM queda justa:

```bash
# En la PC
cd frontend
cp .env.production.example .env.production    # VITE_API_URL=/api/v1
npm ci && npm run build
scp -r dist ubuntu@<IP>:~/tup-tfi-telemetria/frontend/
```

### 3.4 Arranque y certificado del broker

Caddy obtiene el certificado de Let's Encrypt al arrancar. HiveMQ usa ese mismo certificado, convertido a PKCS#12 por [`deploy/scripts/cert-mqtt.sh`](../deploy/scripts/cert-mqtt.sh):

```bash
cd ~/tup-tfi-telemetria/deploy
docker compose up -d --build api caddy
docker compose logs caddy | grep -i "certificate obtained"
sudo ./scripts/cert-mqtt.sh               # genera hivemq/certs/broker.p12
docker compose up -d hivemq
```

Renovación: el script compara el certificado de Caddy con el último convertido y reinicia el broker solo si cambió. Se programa en el cron de root:

```bash
sudo crontab -e
0 4 * * * /home/ubuntu/tup-tfi-telemetria/deploy/scripts/cert-mqtt.sh >> /var/log/cert-mqtt.log 2>&1
```

### 3.5 Verificación

```bash
curl https://<DOMINIO>/health
# {"status":"ok","db":"ok","mqtt":{"conectado":true,"recibidos":...,"procesados":...,"pendientes":0}}

docker compose ps                     # los tres contenedores Up (api healthy)
docker compose logs -f api            # ingesta y temporizador
docker stats --no-stream              # consumo de memoria
```

Prueba de punta a punta desde la PC, con el simulador publicando por TLS. En `backend/.env` o en variables de entorno:

```
MQTT_BROKER_URL=mqtts://<DOMINIO>:8883
MQTT_USERNAME=simulador
MQTT_PASSWORD=<contraseña del usuario simulador>
```

```bash
npm run simulador -- --modo mqtt --rondas 1
```

Los contadores de `/health` tienen que subir. Con una contraseña incorrecta, el broker responde `Not authorized`.

## 4. Actualizar

```bash
cd ~/tup-tfi-telemetria && git pull
cd deploy && docker compose up -d --build
```

- Si cambió el dashboard, volver a compilarlo y copiar `frontend/dist` (paso 3.3). Caddy lo sirve sin reiniciar.
- Los cambios de esquema se aplican a mano en Supabase **antes** de desplegar el backend que los usa.
- Para agregar un ESP32: sumar el usuario en `credentials.xml`. La extensión relee el archivo cada 60 s (`credentials-reload-interval`), sin reiniciar el broker.

## 5. Archivos que no están en el repositorio

Viven solo en la VM y no se versionan (están en `.gitignore`):

| Archivo | Contenido |
|---|---|
| `backend/.env` | Conexión a Supabase y credenciales MQTT del backend |
| `deploy/.env` | `DOMINIO` y `MQTT_KEYSTORE_PASSWORD` |
| `deploy/hivemq/extensions/` | Extensión RBAC con `credentials.xml` (contraseñas en texto plano, permisos 600) |
| `deploy/hivemq/certs/` | Keystore del broker, generado por `cert-mqtt.sh` |
| `deploy/caddy/` | Certificados y estado de Caddy |