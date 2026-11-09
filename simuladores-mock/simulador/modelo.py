"""Modelo de un camión: avanza por su jornada, acumula km y horas de motor y genera fallas."""

from __future__ import annotations

import math
import random
import zlib
from dataclasses import dataclass

from .fallas import CATALOGO, ConfigFallas, buscar
from .rutas import Tramo

PASO_MAX_S = 5.0  # paso de integración (tiempo simulado)
ACELERACION_KMH_S = 2.0  # un camión cargado tarda ~40 s en llegar a 80 km/h
FRENADO_KMH_S = 5.0
RUIDO_KMH = 1.2
VARIACION = 0.15  # cada tramo dura y se maneja ±15 % distinto cada vez
MAX_FALLAS_ABIERTAS = 2


@dataclass(frozen=True)
class Evento:
    """Cambio de estado de una falla ocurrido durante un paso."""

    codigo: str
    activo: bool


class Camion:
    """Un camión con su dispositivo de telemetría.

    - J1939: el odómetro es exacto y hay horas de motor.
    - J1979: el km se estima integrando la velocidad, por eso arrastra un sesgo fijo de ±2 %
      (RN08: la fuente `estimado` es menos confiable que el `odometro`).
    """

    def __init__(
        self,
        device_uid: str,
        protocolo: str,
        ruta: tuple[Tramo, ...],
        *,
        rng: random.Random | None = None,
        km: float = 0.0,
        horas: float = 0.0,
        fallas: ConfigFallas | None = None,
    ) -> None:
        if protocolo not in CATALOGO:
            raise ValueError(f"protocolo inválido: {protocolo!r}")
        if not any(t.motor for t in ruta):
            raise ValueError("la ruta necesita al menos un tramo con el motor encendido")
        self.device_uid = device_uid
        self.protocolo = protocolo
        self.ruta = ruta
        self.rng = rng or random.Random()
        self.config_fallas = fallas or ConfigFallas()
        self.sesgo = 0.0 if protocolo == "J1939" else ((zlib.crc32(device_uid.encode()) % 401) - 200) / 10_000
        self.km = km
        self.horas = horas
        self.velocidad = 0.0  # km/h, instantánea
        self.t_sim = 0.0  # segundos simulados transcurridos
        self.ticks = 0
        self.abiertas: dict[str, float] = {}  # código -> segundos simulados que le quedan
        self._tick_apertura: dict[str, int] = {}
        self.disparadas: set[tuple[str, float]] = set()
        self._entrar_tramo(0)

    # ---- consulta -------------------------------------------------------------------------

    @property
    def tramo(self) -> Tramo:
        return self.ruta[self.indice]

    @property
    def tope_kmh(self) -> float | None:
        topes = [c.tope_kmh for codigo in self.abiertas if (c := buscar(codigo)) and c.tope_kmh]
        return min(topes) if topes else None

    # ---- simulación -----------------------------------------------------------------------

    def posicionar(self, indice: int) -> None:
        """Arranca en otro tramo de la jornada (para que una flota no marche al unísono)."""
        self._entrar_tramo(indice % len(self.ruta))

    def avanzar(self, presupuesto_s: float) -> list[Evento]:
        """Simula `presupuesto_s` segundos de marcha y devuelve los cambios de fallas."""
        self.ticks += 1
        eventos: list[Evento] = []
        restante = presupuesto_s
        while restante > 1e-9:
            if not self.tramo.motor:
                self._entrar_tramo((self.indice + 1) % len(self.ruta))  # no consume tiempo
                continue
            paso = min(restante, PASO_MAX_S, max(self.duracion_actual - self.transcurrido, 1e-6))
            self._integrar(paso)
            self._fallas(paso, eventos)
            restante -= paso
            if self.transcurrido >= self.duracion_actual - 1e-6:
                self._entrar_tramo((self.indice + 1) % len(self.ruta))
        return eventos

    def _entrar_tramo(self, indice: int) -> None:
        tramo = self.ruta[indice]
        self.indice = indice
        self.transcurrido = 0.0
        self.duracion_actual = tramo.duracion_s * (1 + self.rng.uniform(-VARIACION, VARIACION))
        self.vel_objetivo = tramo.velocidad_kmh * (1 + self.rng.uniform(-VARIACION, VARIACION)) if tramo.velocidad_kmh else 0.0

    def _integrar(self, paso: float) -> None:
        objetivo = self.vel_objetivo
        if self.tope_kmh is not None:
            objetivo = min(objetivo, self.tope_kmh)
        if self.velocidad < objetivo:
            self.velocidad = min(objetivo, self.velocidad + ACELERACION_KMH_S * paso)
        else:
            self.velocidad = max(objetivo, self.velocidad - FRENADO_KMH_S * paso)
        v = max(0.0, self.velocidad + self.rng.gauss(0, RUIDO_KMH)) if self.velocidad > 0 else 0.0
        self.km += v * paso / 3600 * (1 + self.sesgo)
        self.horas += paso / 3600
        self.transcurrido += paso
        self.t_sim += paso

    # ---- fallas ---------------------------------------------------------------------------

    def _fallas(self, paso: float, eventos: list[Evento]) -> None:
        # Una falla dura al menos un mensaje: nunca se abre y se cierra en el mismo.
        for codigo in list(self.abiertas):
            self.abiertas[codigo] -= paso
            if self.abiertas[codigo] <= 0 and self._tick_apertura[codigo] < self.ticks:
                del self.abiertas[codigo], self._tick_apertura[codigo]
                eventos.append(Evento(codigo, False))

        for programada in self.config_fallas.programadas:
            if programada not in self.disparadas and self.km >= programada[1]:
                self.disparadas.add(programada)
                self._abrir(programada[0], eventos)

        tasa = self.config_fallas.por_hora * (1 + self.km / 100_000)  # el desgaste las vuelve más frecuentes
        if tasa > 0 and len(self.abiertas) < MAX_FALLAS_ABIERTAS and self.rng.random() < 1 - math.exp(-tasa * paso / 3600):
            candidatas = [c for c in CATALOGO[self.protocolo] if c.codigo not in self.abiertas]
            if candidatas:
                elegida = self.rng.choices(candidatas, weights=[c.peso for c in candidatas])[0]
                self._abrir(elegida.codigo, eventos)

    def _abrir(self, codigo: str, eventos: list[Evento]) -> None:
        if codigo in self.abiertas:
            return
        cfg = self.config_fallas
        self.abiertas[codigo] = self.rng.uniform(cfg.duracion_min_s, cfg.duracion_max_s)
        self._tick_apertura[codigo] = self.ticks
        eventos.append(Evento(codigo, True))

    # ---- persistencia ---------------------------------------------------------------------

    def estado(self) -> dict:
        return {
            "km": self.km,
            "horas": self.horas,
            "t_sim": self.t_sim,
            "indice": self.indice,
            "transcurrido": self.transcurrido,
            "duracion_actual": self.duracion_actual,
            "vel_objetivo": self.vel_objetivo,
            "velocidad": self.velocidad,
            "abiertas": dict(self.abiertas),
            "disparadas": [list(p) for p in sorted(self.disparadas)],
        }

    def restaurar(self, d: dict) -> None:
        self.km = float(d["km"])
        self.horas = float(d["horas"])
        self.t_sim = float(d.get("t_sim", 0.0))
        if 0 <= int(d["indice"]) < len(self.ruta):  # si la ruta cambió, se empieza la jornada de nuevo
            self.indice = int(d["indice"])
            self.transcurrido = float(d["transcurrido"])
            self.duracion_actual = float(d["duracion_actual"])
            self.vel_objetivo = float(d["vel_objetivo"])
            self.velocidad = float(d["velocidad"])
        self.abiertas = {k: float(v) for k, v in d.get("abiertas", {}).items()}
        self._tick_apertura = {k: -1 for k in self.abiertas}
        self.disparadas = {(str(c), float(km)) for c, km in d.get("disparadas", [])}
