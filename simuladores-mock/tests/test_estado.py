import json

from simulador.cli import main
from simulador.estado import AlmacenEstado


def test_guardar_y_cargar(tmp_path):
    a = AlmacenEstado(tmp_path / "estado")
    assert a.cargar("esp32-X01") is None
    a.guardar("esp32-X01", {"km": 12.5})
    assert a.cargar("esp32-X01") == {"km": 12.5}
    a.borrar("esp32-X01")
    assert a.cargar("esp32-X01") is None


def test_archivo_danado_se_ignora(tmp_path):
    (tmp_path / "esp32-X01.json").write_text("{no es json", encoding="utf-8")
    assert AlmacenEstado(tmp_path).cargar("esp32-X01") is None


def test_el_estado_se_guarda_en_una_corrida_real_y_se_retoma(tmp_path, monkeypatch, capsys):
    """Una corrida real (con un publicador falso) deja el estado; la siguiente sigue desde ahí."""

    class Falso:
        sin_senal = False

        def __init__(self, *a, **k):
            self.config = type("C", (), {"host": "x", "puerto": 1})()
            self.enviados = []

        def conectar(self, timeout):
            pass

        def publicar(self, uid, mensaje):
            self.enviados.append(mensaje)
            return "enviado"

        def cerrar(self):
            pass

    falsos = []
    monkeypatch.setattr("simulador.cli.PublicadorMqtt", lambda cfg: falsos.append(Falso()) or falsos[-1])
    monkeypatch.setattr("simulador.cli.leer_valores", lambda: {"MQTT_BROKER_URL": "mqtt://x"})
    base = ["--carpeta-estado", str(tmp_path), "--semilla", "3", "--intervalo", "1", "--aceleracion", "600", "--rondas", "3", "--prob-falla", "0"]
    # el reloj real esperaría 1 s entre mensajes: se evita para que el test sea rápido
    monkeypatch.setattr("simulador.cli.RelojReal.esperar", lambda self, s: None)

    assert main(base) == 0
    primero = falsos[0].enviados[-1]["lecturas"][0]["valor"]
    assert json.loads((tmp_path / "esp32-SIM001.json").read_text())["km"] > 0

    assert main(base) == 0
    segundo = falsos[1].enviados[0]["lecturas"][0]["valor"]
    assert segundo >= primero  # no vuelve a 0: el backend lo marcaría inconsistente (RN09)

    assert main([*base, "--reiniciar"]) == 0
    assert falsos[2].enviados[0]["lecturas"][0]["valor"] < primero
