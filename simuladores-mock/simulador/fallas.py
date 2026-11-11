"""Catálogo de códigos de falla (DTC) y parámetros de su aparición."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass(frozen=True)
class CodigoFalla:
    codigo: str
    descripcion: str
    # Modo de emergencia: mientras la falla está activa, el camión no pasa de esta velocidad.
    tope_kmh: float | None = None
    peso: float = 1.0  # probabilidad relativa de aparecer


CATALOGO: dict[str, tuple[CodigoFalla, ...]] = {
    "J1939": (
        CodigoFalla("SPN-100-FMI-3", "Presión de aceite del motor: tensión alta del sensor", peso=2),
        CodigoFalla("SPN-110-FMI-0", "Temperatura del refrigerante: sobretemperatura", tope_kmh=60),
        CodigoFalla("SPN-190-FMI-2", "Velocidad del motor: señal errática"),
        CodigoFalla("SPN-102-FMI-1", "Presión del turbo: por debajo de lo normal", tope_kmh=70),
        CodigoFalla("SPN-94-FMI-1", "Presión de combustible: baja", peso=1.5),
    ),
    "J1979": (
        CodigoFalla("P0101", "Caudalímetro de aire (MAF): fuera de rango", peso=2),
        CodigoFalla("P0217", "Sobretemperatura del motor", tope_kmh=60),
        CodigoFalla("P0420", "Eficiencia del catalizador por debajo del umbral"),
        CodigoFalla("P0300", "Fallo de encendido aleatorio", tope_kmh=80, peso=1.5),
    ),
}


def buscar(codigo: str) -> CodigoFalla | None:
    for lista in CATALOGO.values():
        for c in lista:
            if c.codigo == codigo:
                return c
    return None


@dataclass(frozen=True)
class ConfigFallas:
    por_hora: float = 0.02  # tasa base de aparición por hora de motor (sube con el desgaste)
    duracion_min_s: float = 30 * 60  # una falla dura entre estos dos valores (tiempo simulado)
    duracion_max_s: float = 5 * 3600
    # (código, km) — la falla aparece la primera vez que el camión llega a ese kilometraje.
    programadas: tuple[tuple[str, float], ...] = ()
