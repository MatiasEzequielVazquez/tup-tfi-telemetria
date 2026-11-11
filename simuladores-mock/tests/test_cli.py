import json

from simulador.cli import main
from simulador.estado import AlmacenEstado


def correr(capsys, tmp_path, *args):
    code = main(["--dry-run", "--sin-espera", "--carpeta-estado", str(tmp_path), "--semilla", "1", *args])
    out = capsys.readouterr().out
    return code, [json.loads(l) for l in out.splitlines() if l.startswith("{")]


def test_dry_run_imprime_un_mensaje_por_ronda(capsys, tmp_path):
    code, mensajes = correr(capsys, tmp_path, "--rondas", "4", "--aceleracion", "600")
    assert code == 0 and len(mensajes) == 4
    kms = [m["lecturas"][0]["valor"] for m in mensajes]
    assert kms == sorted(kms) and kms[0] > 0


def test_dry_run_no_guarda_estado(capsys, tmp_path):
    correr(capsys, tmp_path, "--rondas", "2")
    assert AlmacenEstado(tmp_path).cargar("esp32-SIM001") is None


def test_flota_publica_cada_dispositivo(capsys, tmp_path):
    _, mensajes = correr(capsys, tmp_path, "--dispositivo", "esp32-A01,esp32-A02,esp32-A03", "--rondas", "2")
    assert [m["device_uid"] for m in mensajes] == ["esp32-A01", "esp32-A02", "esp32-A03"] * 2


def test_se_detiene_al_llegar_al_km(capsys, tmp_path):
    _, mensajes = correr(capsys, tmp_path, "--hasta-km", "2000", "--aceleracion", "3600", "--prob-falla", "0")
    assert mensajes[-1]["lecturas"][0]["valor"] >= 2000
    assert mensajes[-2]["lecturas"][0]["valor"] < 2000


def test_km_inicial_y_falla_programada(capsys, tmp_path):
    _, mensajes = correr(
        capsys, tmp_path, "--km-inicial", "35990", "--falla", "SPN-110-FMI-0@36000", "--rondas", "6", "--aceleracion", "300", "--prob-falla", "0"
    )
    dtcs = [(l["codigo"], l["activo"]) for m in mensajes for l in m["lecturas"] if l["tipo"] == "dtc"]
    assert dtcs[0] == ("SPN-110-FMI-0", True)


def test_dispositivo_invalido(capsys, tmp_path):
    assert main(["--dry-run", "--dispositivo", "x y", "--carpeta-estado", str(tmp_path)]) == 2


def test_sin_espera_exige_dry_run(tmp_path):
    assert main(["--sin-espera", "--carpeta-estado", str(tmp_path)]) == 2


def test_sin_broker_configurado_falla_con_mensaje_claro(monkeypatch, capsys, tmp_path):
    monkeypatch.setattr("simulador.cli.leer_valores", lambda: {})
    assert main(["--carpeta-estado", str(tmp_path)]) == 2
    assert "MQTT_BROKER_URL" in capsys.readouterr().err
