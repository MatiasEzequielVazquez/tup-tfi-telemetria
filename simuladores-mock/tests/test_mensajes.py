import random
from datetime import datetime, timezone

from simulador import rutas
from simulador.fallas import ConfigFallas
from simulador.mensajes import DEVICE_UID, construir_mensaje, timestamp_iso
from simulador.modelo import Camion, Evento

INSTANTE = datetime(2026, 11, 9, 19, 5, 7, 999999, tzinfo=timezone.utc)


def camion(protocolo):
    c = Camion("esp32-TEST01", protocolo, rutas.elegir("mixta"), rng=random.Random(1), fallas=ConfigFallas(por_hora=0))
    c.avanzar(3600)
    return c


def test_j1939_manda_km_y_horas_con_su_pgn():
    m = construir_mensaje(camion("J1939"), INSTANTE, [])
    assert m["protocolo"] == "J1939" and m["device_uid"] == "esp32-TEST01"
    assert [(l["tipo"], l["origen"]) for l in m["lecturas"]] == [("km", {"pgn": 65248}), ("horas_motor", {"pgn": 65253})]


def test_j1979_manda_solo_km_estimado_por_integracion():
    m = construir_mensaje(camion("J1979"), INSTANTE, [])
    assert [(l["tipo"], l["origen"]) for l in m["lecturas"]] == [("km", {"pid": "010D", "metodo": "integracion_velocidad"})]


def test_timestamp_iso_8601_en_utc_sin_fraccion():
    assert timestamp_iso(INSTANTE) == "2026-11-09T19:05:07Z"
    ar = datetime(2026, 11, 9, 16, 5, 7, tzinfo=timezone.utc).astimezone()
    assert timestamp_iso(ar) == "2026-11-09T16:05:07Z"


def test_las_fallas_viajan_como_dtc_en_orden():
    m = construir_mensaje(camion("J1939"), INSTANTE, [Evento("SPN-110-FMI-0", True), Evento("SPN-100-FMI-3", False)])
    dtcs = [(l["codigo"], l["activo"]) for l in m["lecturas"] if l["tipo"] == "dtc"]
    assert dtcs == [("SPN-110-FMI-0", True), ("SPN-100-FMI-3", False)]


def test_solo_viajan_tipos_que_el_backend_guarda():
    m = construir_mensaje(camion("J1939"), INSTANTE, [Evento("SPN-110-FMI-0", True)])
    assert {l["tipo"] for l in m["lecturas"]} <= {"km", "horas_motor", "dtc"}


def test_validacion_de_device_uid_igual_que_el_backend():
    assert DEVICE_UID.match("esp32-SIM001") and DEVICE_UID.match("abc")
    assert not DEVICE_UID.match("ab") and not DEVICE_UID.match("con espacio") and not DEVICE_UID.match("x" * 51)
