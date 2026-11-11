import random

import pytest

from simulador import rutas
from simulador.fallas import ConfigFallas
from simulador.modelo import Camion
from simulador.rutas import Tramo


def camion(protocolo="J1939", ruta="mixta", semilla=1, **kw):
    return Camion("esp32-TEST01", protocolo, rutas.elegir(ruta), rng=random.Random(semilla), **kw)


def sin_fallas():
    return ConfigFallas(por_hora=0)


def test_arranca_en_cero():
    c = camion()
    assert c.km == 0 and c.horas == 0 and c.velocidad == 0


def test_el_km_nunca_retrocede_y_las_horas_acompanan():
    c = camion(fallas=sin_fallas())
    anterior = (0.0, 0.0)
    for _ in range(200):
        c.avanzar(600)
        assert c.km >= anterior[0] and c.horas >= anterior[1]
        anterior = (c.km, c.horas)
    assert c.km > 1000


def test_la_misma_semilla_da_el_mismo_recorrido():
    a, b = camion(semilla=7), camion(semilla=7)
    for _ in range(30):
        a.avanzar(900)
        b.avanzar(900)
    assert (a.km, a.horas, a.abiertas) == (b.km, b.horas, b.abiertas)


def test_una_jornada_mixta_recorre_lo_esperado():
    c = camion(fallas=sin_fallas())
    c.avanzar(5.9 * 3600)
    assert 300 < c.km < 450


def test_el_tramo_con_motor_apagado_se_salta_sin_sumar_horas():
    ruta = (Tramo("a", 3600, 60), Tramo("noche", 10 * 3600, 0, motor=False))
    c = Camion("esp32-TEST01", "J1939", ruta, rng=random.Random(1), fallas=sin_fallas())
    c.avanzar(2 * 3600 * 1.0)
    # 2 h simuladas de marcha efectiva: la noche no cuenta y no se queda esperando en ella
    assert c.horas == pytest.approx(2.0, abs=0.01)


def test_ruta_sin_tramos_con_motor_se_rechaza():
    with pytest.raises(ValueError):
        Camion("esp32-TEST01", "J1939", (Tramo("noche", 3600, 0, motor=False),))


def test_j1979_estima_el_km_con_un_sesgo_chico_y_estable():
    a = camion("J1979", fallas=sin_fallas())
    b = camion("J1979", fallas=sin_fallas())
    assert a.sesgo == b.sesgo and abs(a.sesgo) <= 0.02
    assert camion("J1939").sesgo == 0


def test_falla_programada_aparece_al_llegar_al_km_y_una_sola_vez():
    c = camion(fallas=ConfigFallas(por_hora=0, programadas=(("SPN-110-FMI-0", 100.0),)))
    aperturas = []
    for _ in range(40):
        aperturas += [e for e in c.avanzar(600) if e.activo]
    assert [e.codigo for e in aperturas] == ["SPN-110-FMI-0"]


def test_una_falla_nunca_se_abre_y_se_cierra_en_el_mismo_mensaje():
    cfg = ConfigFallas(por_hora=0, duracion_min_s=1, duracion_max_s=2, programadas=(("P0420", 0.0),))
    c = camion("J1979", fallas=cfg)
    primero = c.avanzar(3600)
    assert [(e.codigo, e.activo) for e in primero] == [("P0420", True)]
    segundo = c.avanzar(600)
    assert [(e.codigo, e.activo) for e in segundo] == [("P0420", False)]


def test_la_sobretemperatura_limita_la_velocidad():
    cfg = ConfigFallas(por_hora=0, duracion_min_s=10**6, duracion_max_s=10**6 + 1, programadas=(("SPN-110-FMI-0", 0.0),))
    c = camion(ruta="larga", fallas=cfg)
    maximo = 0.0
    for _ in range(50):
        c.avanzar(300)
        maximo = max(maximo, c.velocidad)
    assert maximo <= 60.0 + 1e-9


def test_con_tasa_alta_aparecen_fallas_del_catalogo_del_protocolo():
    c = camion("J1979", fallas=ConfigFallas(por_hora=5))
    codigos = set()
    for _ in range(100):
        codigos |= {e.codigo for e in c.avanzar(600) if e.activo}
    assert codigos and codigos <= {"P0101", "P0217", "P0420", "P0300"}
    assert len(c.abiertas) <= 2


def test_guardar_y_restaurar_continua_donde_quedo():
    a = camion(fallas=ConfigFallas(por_hora=0, programadas=(("SPN-94-FMI-1", 50.0),)))
    for _ in range(40):
        a.avanzar(300)
    assert a.disparadas  # la falla programada ya se disparó antes de guardar
    b = camion(fallas=ConfigFallas(por_hora=0, programadas=(("SPN-94-FMI-1", 50.0),)))
    b.restaurar(a.estado())
    assert (b.km, b.horas, b.indice, b.disparadas) == (a.km, a.horas, a.indice, a.disparadas)
    # la falla ya disparada no vuelve a dispararse tras reiniciar
    assert not [e for e in b.avanzar(3600) if e.activo and e.codigo == "SPN-94-FMI-1"]
