"""Jornadas tipo de un camión: una secuencia de tramos que se repite todos los días."""

from __future__ import annotations

from dataclasses import dataclass

MIN = 60.0
HORA = 3600.0


@dataclass(frozen=True)
class Tramo:
    nombre: str
    duracion_s: float  # duración nominal, en tiempo simulado
    velocidad_kmh: float  # velocidad de crucero; 0 = detenido (con motor en ralentí)
    # motor=False: contacto apagado. El ESP32 se alimenta con el contacto, así que no reporta;
    # el simulador salta estos tramos sin esperar.
    motor: bool = True


def _reparto_urbano() -> tuple[Tramo, ...]:
    tramos = [Tramo("arranque", 5 * MIN, 0)]
    for _ in range(5):
        tramos += [Tramo("calle", 20 * MIN, 32), Tramo("entrega", 10 * MIN, 0)]
    tramos += [Tramo("regreso a base", 25 * MIN, 35), Tramo("estacionado", 12 * HORA, 0, motor=False)]
    return tuple(tramos)


RUTAS: dict[str, tuple[Tramo, ...]] = {
    "urbana": _reparto_urbano(),
    "mixta": (
        Tramo("arranque", 5 * MIN, 0),
        Tramo("salida urbana", 25 * MIN, 35),
        Tramo("ruta", 2 * HORA, 85),
        Tramo("parada", 15 * MIN, 0),
        Tramo("ruta", 2 * HORA, 85),
        Tramo("ingreso urbano", 20 * MIN, 30),
        Tramo("descarga", 30 * MIN, 0),
        Tramo("estacionado", 10 * HORA, 0, motor=False),
    ),
    "larga": (
        Tramo("arranque", 10 * MIN, 0),
        Tramo("ruta", 4 * HORA, 88),
        Tramo("descanso", 30 * MIN, 0),
        Tramo("ruta", 4 * HORA, 88),
        Tramo("descanso", 30 * MIN, 0),
        Tramo("ruta", 3 * HORA, 85),
        Tramo("estacionado", 8 * HORA, 0, motor=False),
    ),
}

DESCRIPCIONES = {
    "urbana": "reparto urbano: 5 salidas de 20 min a ~32 km/h con paradas de entrega (~70 km por jornada)",
    "mixta": "salida urbana, dos tramos de ruta de 2 h a ~85 km/h y descarga (~365 km por jornada)",
    "larga": "larga distancia: 11 h de ruta a ~88 km/h con dos descansos (~950 km por jornada)",
}


def elegir(nombre: str) -> tuple[Tramo, ...]:
    try:
        return RUTAS[nombre]
    except KeyError:
        raise ValueError(f"ruta desconocida: {nombre!r} (disponibles: {', '.join(RUTAS)})") from None
