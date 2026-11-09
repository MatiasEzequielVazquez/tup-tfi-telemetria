"""Línea de comandos: `python -m simulador --help`."""

from __future__ import annotations

import argparse
import random
import sys
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from . import rutas
from .config import RAIZ, ConfigMqtt, ErrorConfiguracion, leer_valores
from .estado import AlmacenEstado
from .fallas import ConfigFallas, buscar
from .mensajes import DEVICE_UID, construir_mensaje
from .modelo import Camion
from .transporte import ErrorConexion, PublicadorConsola, PublicadorMqtt


class RelojReal:
    """Los timestamps son la hora real: el backend rechaza lecturas con más de 10 minutos de
    adelanto y no hay lecturas anteriores a la vinculación, así que no se puede acelerar el reloj."""

    def __init__(self) -> None:
        self._inicio = time.monotonic()

    def ahora(self) -> datetime:
        return datetime.now(timezone.utc)

    def transcurrido(self) -> float:
        return time.monotonic() - self._inicio

    def esperar(self, segundos: float) -> None:
        time.sleep(segundos)


class RelojVirtual:
    """Solo para --dry-run --sin-espera: el tiempo avanza sin esperar."""

    def __init__(self) -> None:
        self._t = datetime.now(timezone.utc)
        self._transcurrido = 0.0

    def ahora(self) -> datetime:
        return self._t

    def transcurrido(self) -> float:
        return self._transcurrido

    def esperar(self, segundos: float) -> None:
        self._t += timedelta(seconds=segundos)
        self._transcurrido += segundos


def _positivo(texto: str) -> float:
    v = float(texto)
    if v <= 0:
        raise argparse.ArgumentTypeError("debe ser mayor que 0")
    return v


def _falla(texto: str) -> tuple[str, float]:
    codigo, sep, km = texto.partition("@")
    try:
        if not sep or not codigo.strip():
            raise ValueError
        return codigo.strip().upper(), float(km)
    except ValueError:
        raise argparse.ArgumentTypeError("formato CODIGO@KM, por ejemplo SPN-110-FMI-0@500") from None


def _ventana(texto: str) -> tuple[float, float]:
    inicio, sep, duracion = texto.partition(":")
    try:
        if not sep:
            raise ValueError
        i, d = float(inicio), float(duracion)
        if i < 0 or d <= 0:
            raise ValueError
        return i, d
    except ValueError:
        raise argparse.ArgumentTypeError("formato INICIO:DURACION en segundos, por ejemplo 60:120") from None


def armar_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="python -m simulador",
        description="Simula camiones con su dispositivo de telemetría y publica sus lecturas en el broker MQTT.",
        epilog="El camión tiene que existir en el sistema con su dispositivo vinculado (ver README).",
    )
    g = p.add_argument_group("camión")
    g.add_argument("--dispositivo", default="esp32-SIM001", help="device_uid; varios separados por coma = una flota (esp32-SIM001)")
    g.add_argument("--protocolo", choices=["J1939", "J1979"], default="J1939", help="J1939 camión con odómetro; J1979 utilitario con km estimado (J1939)")
    g.add_argument("--ruta", choices=list(rutas.RUTAS), default="mixta", help="jornada tipo (mixta)")
    g.add_argument("--km-inicial", type=float, help="km con los que arranca (por defecto sigue donde quedó, o 0)")
    g.add_argument("--horas-iniciales", type=float, help="horas de motor con las que arranca")
    g.add_argument("--reiniciar", action="store_true", help="descarta el estado guardado y vuelve a 0 km")
    g = p.add_argument_group("ritmo")
    g.add_argument("--intervalo", type=_positivo, default=10.0, help="segundos reales entre mensajes (10)")
    g.add_argument("--aceleracion", type=_positivo, default=1.0, help="segundos de marcha simulados por cada segundo real (1)")
    g = p.add_argument_group("cuándo termina")
    g.add_argument("--rondas", type=int, default=0, help="cantidad de mensajes por camión; 0 = sin fin")
    g.add_argument("--duracion", type=_positivo, help="segundos reales")
    g.add_argument("--hasta-km", type=_positivo, help="termina cuando todos los camiones llegan a este km")
    g = p.add_argument_group("fallas y señal")
    g.add_argument("--prob-falla", type=float, default=0.02, help="fallas esperadas por hora de motor (0.02)")
    g.add_argument("--falla", type=_falla, action="append", default=[], metavar="CODIGO@KM", help="fuerza una falla al llegar a ese km (repetible)")
    g.add_argument("--sin-senal", type=_ventana, metavar="INICIO:DURACION", help="corte de cobertura (s reales): los mensajes se guardan y se mandan al volver")
    g = p.add_argument_group("otros")
    g.add_argument("--dry-run", action="store_true", help="no se conecta: imprime los mensajes")
    g.add_argument("--sin-espera", action="store_true", help="con --dry-run, no espera entre mensajes")
    g.add_argument("--semilla", type=int, help="semilla del azar (recorrido reproducible)")
    g.add_argument("--carpeta-estado", type=Path, default=RAIZ / "estado", help="dónde se guarda el estado de cada camión")
    g.add_argument("--listar-rutas", action="store_true", help="muestra las jornadas disponibles y sale")
    return p


def _linea(n: int, c: Camion, eventos, resultado: str) -> str:
    fallas = "".join(f" {'+' if e.activo else '-'}{e.codigo}" for e in eventos)
    activas = f" [{len(c.abiertas)} falla(s) activa(s)]" if c.abiertas else ""
    return (
        f"[{n:>4}] {c.device_uid:<16} {c.tramo.nombre:<15} {c.velocidad:5.1f} km/h  "
        f"km {c.km:>10.1f}  h {c.horas:>7.1f}{fallas}{activas}  -> {resultado}"
    )


def main(argv: list[str] | None = None) -> int:
    args = armar_parser().parse_args(argv)

    if args.listar_rutas:
        for nombre, desc in rutas.DESCRIPCIONES.items():
            print(f"{nombre:<8} {desc}")
        return 0

    uids = [u.strip() for u in args.dispositivo.split(",") if u.strip()]
    malos = [u for u in uids if not DEVICE_UID.match(u)]
    if not uids or malos or len(set(uids)) != len(uids):
        print(f"Error: device_uid inválido o repetido ({', '.join(malos) or args.dispositivo}); usar 3 a 50 letras, números, _ o -.", file=sys.stderr)
        return 2
    if args.sin_espera and not args.dry_run:
        print("Error: --sin-espera solo se puede usar con --dry-run (el backend rechaza timestamps del futuro).", file=sys.stderr)
        return 2
    desconocidas = [c for c, _ in args.falla if buscar(c) is None]
    if desconocidas:
        print(f"Aviso: {', '.join(desconocidas)} no está en el catálogo del simulador; se envía igual.", file=sys.stderr)

    try:
        publicador = PublicadorConsola() if args.dry_run else PublicadorMqtt(ConfigMqtt.desde_valores(leer_valores()))
    except ErrorConfiguracion as e:
        print(f"Error de configuración: {e}", file=sys.stderr)
        return 2

    almacen = AlmacenEstado(args.carpeta_estado)
    ruta = rutas.elegir(args.ruta)
    fallas = ConfigFallas(por_hora=args.prob_falla, programadas=tuple(args.falla))
    camiones: list[Camion] = []
    for i, uid in enumerate(uids):
        rng = random.Random(f"{args.semilla}:{uid}" if args.semilla is not None else None)
        camion = Camion(uid, args.protocolo, ruta, rng=rng, fallas=fallas)
        if args.reiniciar:
            almacen.borrar(uid)
        guardado = almacen.cargar(uid)
        if guardado:
            try:
                camion.restaurar(guardado)
            except (KeyError, TypeError, ValueError):
                guardado = None
        elif len(uids) > 1:
            camion.posicionar(i * len(ruta) // len(uids))  # cada camión en un punto distinto de la jornada
        if args.km_inicial is not None:
            camion.km = args.km_inicial
        if args.horas_iniciales is not None:
            camion.horas = args.horas_iniciales
        origen = "retoma el estado guardado" if guardado else "arranca de cero"
        print(f"{uid}: {args.protocolo}, ruta {args.ruta}, {origen} (km {camion.km:.1f}, {camion.horas:.1f} h)")
        camiones.append(camion)

    reloj = RelojVirtual() if args.sin_espera else RelojReal()
    try:
        publicador.conectar(timeout=15)
    except ErrorConexion as e:
        print(f"Error: {e}", file=sys.stderr)
        return 3
    if not args.dry_run:
        print(f"Conectado a {publicador.config.host}:{publicador.config.puerto}. Ctrl+C para terminar.")

    presupuesto = args.intervalo * args.aceleracion
    ronda = 0
    try:
        while True:
            ronda += 1
            t = reloj.transcurrido()
            if args.sin_senal:
                inicio, dur = args.sin_senal
                en_corte = inicio <= t < inicio + dur
                if en_corte != publicador.sin_senal:
                    print("--- sin señal: los mensajes se guardan" if en_corte else "--- vuelve la señal: se envían los pendientes")
                publicador.sin_senal = en_corte
            instante = reloj.ahora()
            for c in camiones:
                eventos = c.avanzar(presupuesto)
                resultado = publicador.publicar(c.device_uid, construir_mensaje(c, instante, eventos))
                if not args.dry_run:  # un ensayo no toca el estado: la corrida real sigue donde quedó
                    almacen.guardar(c.device_uid, c.estado())
                # En --dry-run el JSON va a stdout (se puede redirigir) y el resumen a stderr.
                print(_linea(ronda, c, eventos, resultado), file=sys.stderr if args.dry_run else sys.stdout)
            if args.rondas and ronda >= args.rondas:
                break
            if args.duracion and reloj.transcurrido() >= args.duracion:
                break
            if args.hasta_km and all(c.km >= args.hasta_km for c in camiones):
                break
            reloj.esperar(args.intervalo)
    except KeyboardInterrupt:
        print("\nInterrumpido.")
    finally:
        publicador.cerrar()

    for c in camiones:
        print(f"{c.device_uid}: {c.km:.1f} km, {c.horas:.1f} h de motor, {ronda} mensajes")
    return 0
