#!/usr/bin/env bash
# Convierte el certificado de Let's Encrypt que obtuvo Caddy al formato de HiveMQ (PKCS#12)
# y reinicia el broker si cambió. Correr con sudo después del primer arranque y por cron.
set -euo pipefail
cd "$(dirname "$0")/.."
source .env

crt=$(find caddy/data/caddy/certificates -name "${DOMINIO}.crt" 2>/dev/null | head -1)
if [ -z "$crt" ]; then
  echo "Caddy todavía no obtuvo el certificado de ${DOMINIO}"
  exit 1
fi
key="${crt%.crt}.key"

mkdir -p hivemq/certs
if [ -f hivemq/certs/broker.crt ] && cmp -s "$crt" hivemq/certs/broker.crt; then
  echo "$(date -Is) certificado sin cambios"
  exit 0
fi

openssl pkcs12 -export -in "$crt" -inkey "$key" -name broker \
  -out hivemq/certs/broker.p12 -passout "pass:${MQTT_KEYSTORE_PASSWORD}"
cp "$crt" hivemq/certs/broker.crt
chown -R 10000:10000 hivemq/certs        # HiveMQ corre con el usuario 10000
chmod 600 hivemq/certs/broker.p12
echo "$(date -Is) certificado actualizado"

if docker ps --format '{{.Names}}' | grep -q '^tfi-hivemq$'; then
  docker restart tfi-hivemq
fi