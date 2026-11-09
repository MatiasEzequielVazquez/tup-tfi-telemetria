"""Configuración del broker: variables de entorno, con un archivo .env opcional."""

from __future__ import annotations

import os
from collections.abc import Mapping
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlparse

RAIZ = Path(__file__).resolve().parent.parent


class ErrorConfiguracion(Exception):
    pass


def leer_valores(archivo: Path | None = None, entorno: Mapping[str, str] | None = None) -> dict[str, str]:
    """Valores MQTT_*: primero el archivo .env, y lo que esté en el entorno lo pisa."""
    valores: dict[str, str] = {}
    archivo = archivo or RAIZ / ".env"
    if archivo.is_file():
        for linea in archivo.read_text(encoding="utf-8").splitlines():
            linea = linea.strip()
            if not linea or linea.startswith("#") or "=" not in linea:
                continue
            clave, _, valor = linea.partition("=")
            valores[clave.strip()] = valor.strip().strip('"').strip("'")
    entorno = os.environ if entorno is None else entorno
    valores.update({k: v for k, v in entorno.items() if k.startswith("MQTT_")})
    return valores


@dataclass(frozen=True)
class ConfigMqtt:
    host: str
    puerto: int
    tls: bool
    usuario: str | None
    password: str | None
    topic: str  # patrón con un '+' donde va el device_uid
    client_id: str
    ca_file: str | None = None

    @classmethod
    def desde_valores(cls, v: Mapping[str, str]) -> ConfigMqtt:
        url = v.get("MQTT_BROKER_URL", "").strip()
        if not url:
            raise ErrorConfiguracion(
                "falta MQTT_BROKER_URL (por ejemplo mqtts://<dominio>:8883). "
                "Para probar sin broker, usá --dry-run."
            )
        p = urlparse(url)
        if p.scheme not in ("mqtt", "mqtts", "tcp", "ssl") or not p.hostname:
            raise ErrorConfiguracion(f"MQTT_BROKER_URL inválida: {url!r} (esperado mqtts://host:puerto)")
        tls = p.scheme in ("mqtts", "ssl")
        topic = v.get("MQTT_TOPIC_LECTURAS") or "telemetria/+/lecturas"
        if topic.count("+") != 1:
            raise ErrorConfiguracion("MQTT_TOPIC_LECTURAS debe tener un '+' donde va el device_uid")
        return cls(
            host=p.hostname,
            puerto=p.port or (8883 if tls else 1883),
            tls=tls,
            usuario=v.get("MQTT_USERNAME") or None,
            password=v.get("MQTT_PASSWORD") or None,
            topic=topic,
            client_id=v.get("MQTT_CLIENT_ID") or f"tfi-simulador-{os.getpid()}",
            ca_file=v.get("MQTT_CA_FILE") or None,
        )

    def topic_de(self, device_uid: str) -> str:
        return self.topic.replace("+", device_uid, 1)
