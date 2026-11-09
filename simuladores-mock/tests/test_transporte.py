import json

import pytest

from simulador.config import ConfigMqtt, ErrorConfiguracion, leer_valores
from simulador.transporte import ErrorConexion, PublicadorMqtt


class Info:
    def __init__(self, rc=0):
        self.rc = rc

    def wait_for_publish(self, timeout=None):
        pass


class ClienteFalso:
    """Imita lo que el publicador usa de paho: configuración, callbacks y publish."""

    def __init__(self):
        self.publicados = []
        self.rc = 0
        self.on_connect = self.on_disconnect = None
        self.tls = self.credenciales = None
        self.cerrado = False

    def username_pw_set(self, u, p):
        self.credenciales = (u, p)

    def tls_set(self, ca_certs=None):
        self.tls = ca_certs or True

    def reconnect_delay_set(self, **kw):
        pass

    def connect_async(self, host, puerto, keepalive=60):
        self.destino = (host, puerto)

    def loop_start(self):
        pass

    def loop_stop(self):
        pass

    def disconnect(self):
        self.cerrado = True

    def publish(self, topic, payload, qos=0):
        if self.rc == 0:
            self.publicados.append((topic, json.loads(payload), qos))
        return Info(self.rc)

    def conectar(self):
        self.on_connect(self, None, {}, 0, None)

    def caer(self):
        self.on_disconnect(self, None, None, 0, None)


CFG = ConfigMqtt("broker.test", 8883, True, "simulador", "clave", "telemetria/+/lecturas", "tfi-test")


def msg(n):
    return {"device_uid": "esp32-TEST01", "n": n}


def test_publica_con_qos_1_en_el_topic_del_dispositivo():
    c = ClienteFalso()
    p = PublicadorMqtt(CFG, c)
    c.conectar()
    assert p.publicar("esp32-TEST01", msg(1)) == "enviado"
    assert c.publicados == [("telemetria/esp32-TEST01/lecturas", msg(1), 1)]
    assert c.credenciales == ("simulador", "clave") and c.tls


def test_tls_usa_el_bundle_de_certifi_salvo_que_se_indique_otro():
    import certifi

    c = ClienteFalso()
    PublicadorMqtt(CFG, c)
    assert c.tls == certifi.where()
    propio = ClienteFalso()
    PublicadorMqtt(ConfigMqtt("b", 8883, True, None, None, "t/+/l", "x", ca_file="mi-ca.pem"), propio)
    assert propio.tls == "mi-ca.pem"
    sin_tls = ClienteFalso()
    PublicadorMqtt(ConfigMqtt("b", 1883, False, None, None, "t/+/l", "x"), sin_tls)
    assert sin_tls.tls is None


def test_sin_conexion_guarda_y_al_conectar_manda_todo_en_orden():
    c = ClienteFalso()
    p = PublicadorMqtt(CFG, c)
    assert "en cola" in p.publicar("esp32-TEST01", msg(1))
    p.publicar("esp32-TEST01", msg(2))
    assert c.publicados == [] and p.pendientes == 2
    c.conectar()
    assert [m["n"] for _, m, _ in c.publicados] == [1, 2] and p.pendientes == 0


def test_corte_de_senal_acumula_y_al_volver_envia_en_orden():
    c = ClienteFalso()
    p = PublicadorMqtt(CFG, c)
    c.conectar()
    p.publicar("esp32-TEST01", msg(1))
    p.sin_senal = True
    p.publicar("esp32-TEST01", msg(2))
    p.publicar("esp32-TEST01", msg(3))
    assert [m["n"] for _, m, _ in c.publicados] == [1]
    p.sin_senal = False
    assert [m["n"] for _, m, _ in c.publicados] == [1, 2, 3]


def test_si_el_broker_cae_los_mensajes_esperan_hasta_reconectar():
    c = ClienteFalso()
    p = PublicadorMqtt(CFG, c)
    c.conectar()
    c.caer()
    p.publicar("esp32-TEST01", msg(1))
    assert c.publicados == []
    c.conectar()
    assert [m["n"] for _, m, _ in c.publicados] == [1]


def test_un_rechazo_del_broker_no_cuenta_como_conexion():
    c = ClienteFalso()
    p = PublicadorMqtt(CFG, c)
    c.on_connect(c, None, {}, 5, None)  # CONNACK 5: no autorizado
    assert "en cola" in p.publicar("esp32-TEST01", msg(1))
    with pytest.raises(ErrorConexion):
        p.conectar(timeout=0.05)


def test_cerrar_vacia_lo_pendiente():
    c = ClienteFalso()
    p = PublicadorMqtt(CFG, c)
    c.conectar()
    p.sin_senal = True
    p.publicar("esp32-TEST01", msg(1))
    p.cerrar()
    assert [m["n"] for _, m, _ in c.publicados] == [1] and c.cerrado


def test_config_desde_url():
    cfg = ConfigMqtt.desde_valores({"MQTT_BROKER_URL": "mqtts://x.sslip.io:8883", "MQTT_USERNAME": "simulador"})
    assert (cfg.host, cfg.puerto, cfg.tls, cfg.usuario) == ("x.sslip.io", 8883, True, "simulador")
    assert cfg.topic_de("esp32-A") == "telemetria/esp32-A/lecturas"
    local = ConfigMqtt.desde_valores({"MQTT_BROKER_URL": "mqtt://localhost"})
    assert (local.puerto, local.tls) == (1883, False)


@pytest.mark.parametrize(
    "valores",
    [{}, {"MQTT_BROKER_URL": "http://x"}, {"MQTT_BROKER_URL": "mqtt://x", "MQTT_TOPIC_LECTURAS": "sin/comodin"}],
)
def test_config_invalida(valores):
    with pytest.raises(ErrorConfiguracion):
        ConfigMqtt.desde_valores(valores)


def test_el_entorno_pisa_al_archivo_env(tmp_path):
    archivo = tmp_path / ".env"
    archivo.write_text('# comentario\nMQTT_BROKER_URL=mqtt://archivo\nMQTT_PASSWORD="con#numeral"\n', encoding="utf-8")
    v = leer_valores(archivo, {"MQTT_BROKER_URL": "mqtt://entorno", "OTRA": "x"})
    assert v == {"MQTT_BROKER_URL": "mqtt://entorno", "MQTT_PASSWORD": "con#numeral"}
