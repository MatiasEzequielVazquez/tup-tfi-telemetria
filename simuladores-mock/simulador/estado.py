"""Estado de cada camión en disco.

Sin esto, reiniciar el simulador volvería a 0 km: el backend marcaría esas lecturas como
inconsistentes (RN09, el km no puede retroceder) y el camión "perdería" su recorrido.
"""

from __future__ import annotations

import json
import os
from pathlib import Path


class AlmacenEstado:
    def __init__(self, carpeta: Path) -> None:
        self.carpeta = carpeta

    def _ruta(self, device_uid: str) -> Path:
        return self.carpeta / f"{device_uid}.json"

    def cargar(self, device_uid: str) -> dict | None:
        try:
            return json.loads(self._ruta(device_uid).read_text(encoding="utf-8"))
        except FileNotFoundError:
            return None
        except (json.JSONDecodeError, OSError):
            return None  # archivo dañado: se arranca de cero (el usuario puede pasar --km-inicial)

    def guardar(self, device_uid: str, estado: dict) -> None:
        self.carpeta.mkdir(parents=True, exist_ok=True)
        destino = self._ruta(device_uid)
        tmp = destino.with_suffix(".tmp")
        tmp.write_text(json.dumps(estado), encoding="utf-8")
        os.replace(tmp, destino)  # atómico: nunca queda un archivo a medio escribir

    def borrar(self, device_uid: str) -> None:
        self._ruta(device_uid).unlink(missing_ok=True)
