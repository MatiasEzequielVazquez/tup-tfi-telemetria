"""Mensajes MQTT con el contrato del firmware (docs/entregas/02-arquitectura-modulos.md §3.2).

Solo se publican los tipos que el backend guarda: `km`, `horas_motor` y `dtc`. Cualquier otro tipo
(velocidad, rpm, GPS…) la ingesta lo ignora y deja una advertencia en el log, así que el simulador
usa esos datos adentro del modelo pero no los envía.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone

from .modelo import Camion, Evento

DEVICE_UID = re.compile(r"^[\w-]{3,50}$")  # la misma validación que parser.ts


def timestamp_iso(instante: datetime) -> str:
    return instante.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def construir_mensaje(camion: Camion, instante: datetime, eventos: list[Evento]) -> dict:
    j1939 = camion.protocolo == "J1939"
    if j1939:
        lecturas: list[dict] = [
            {"tipo": "km", "valor": round(camion.km, 1), "origen": {"pgn": 65248}},
            {"tipo": "horas_motor", "valor": round(camion.horas, 1), "origen": {"pgn": 65253}},
        ]
    else:
        lecturas = [
            {"tipo": "km", "valor": round(camion.km, 1), "origen": {"pid": "010D", "metodo": "integracion_velocidad"}},
        ]
    for e in eventos:
        lecturas.append(
            {"tipo": "dtc", "codigo": e.codigo, "activo": e.activo, "origen": {"pgn": "DM1"} if j1939 else {"pid": "03"}}
        )
    return {
        "device_uid": camion.device_uid,
        "protocolo": camion.protocolo,
        "timestamp": timestamp_iso(instante),
        "lecturas": lecturas,
    }
