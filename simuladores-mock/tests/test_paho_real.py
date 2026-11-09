"""PublicadorMqtt con paho de verdad, contra un mini-broker MQTT 3.1.1 en un socket local.

Cubre lo que el cliente falso no puede: las firmas de los callbacks de paho 2.x, la
autenticación, el PUBACK de QoS 1 y la reconexión automática tras una caída.
"""

import json
import socket
import threading
import time

import pytest

from simulador.config import ConfigMqtt
from simulador.transporte import ErrorConexion, PublicadorMqtt


class MiniBroker:
    def __init__(self, usuario="simulador", password="clave"):
        self.usuario, self.password = usuario, password
        self.recibidos: list[tuple[str, str, dict]] = []  # (usuario, topic, mensaje)
        self.conexiones = 0
        self._socks: list[socket.socket] = []
        self._srv = socket.socket()
        self._srv.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._srv.bind(("127.0.0.1", 0))
        self._srv.listen()
        self.puerto = self._srv.getsockname()[1]
        self._activo = True
        threading.Thread(target=self._aceptar, daemon=True).start()

    def _aceptar(self):
        while self._activo:
            try:
                s, _ = self._srv.accept()
            except OSError:
                return
            self._socks.append(s)
            threading.Thread(target=self._atender, args=(s,), daemon=True).start()

    @staticmethod
    def _leer(s, n):
        datos = b""
        while len(datos) < n:
            trozo = s.recv(n - len(datos))
            if not trozo:
                raise ConnectionError
            datos += trozo
        return datos

    def _paquete(self, s):
        cabecera = self._leer(s, 1)[0]
        largo, mult = 0, 1
        while True:
            b = self._leer(s, 1)[0]
            largo += (b & 0x7F) * mult
            mult *= 128
            if not b & 0x80:
                break
        return cabecera, self._leer(s, largo)

    @staticmethod
    def _cadena(datos, i):
        n = int.from_bytes(datos[i : i + 2], "big")
        return datos[i + 2 : i + 2 + n].decode(), i + 2 + n

    def _atender(self, s):
        usuario = None
        try:
            while True:
                cab, cuerpo = self._paquete(s)
                tipo = cab >> 4
                if tipo == 1:  # CONNECT
                    _, i = self._cadena(cuerpo, 0)  # "MQTT"
                    flags = cuerpo[i + 1]
                    i += 4  # nivel, flags, keepalive
                    _, i = self._cadena(cuerpo, i)  # client id
                    usuario = password = None
                    if flags & 0x80:
                        usuario, i = self._cadena(cuerpo, i)
                    if flags & 0x40:
                        password, i = self._cadena(cuerpo, i)
                    ok = (usuario, password) == (self.usuario, self.password)
                    s.sendall(bytes([0x20, 2, 0, 0 if ok else 5]))
                    if not ok:
                        return
                    self.conexiones += 1
                elif tipo == 3:  # PUBLISH
                    topic, i = self._cadena(cuerpo, 0)
                    qos = (cab >> 1) & 3
                    if qos:
                        s.sendall(bytes([0x40, 2]) + cuerpo[i : i + 2])  # PUBACK
                        i += 2
                    self.recibidos.append((usuario, topic, json.loads(cuerpo[i:])))
                elif tipo == 12:  # PINGREQ
                    s.sendall(bytes([0xD0, 0]))
                elif tipo == 14:  # DISCONNECT
                    return
        except (ConnectionError, OSError):
            return
        finally:
            s.close()

    def tirar_conexiones(self):
        for s in self._socks:
            try:
                s.shutdown(socket.SHUT_RDWR)
            except OSError:
                pass
            s.close()
        self._socks.clear()

    def cerrar(self):
        self._activo = False
        self._srv.close()
        self.tirar_conexiones()


@pytest.fixture
def broker():
    b = MiniBroker()
    yield b
    b.cerrar()


def cfg(broker, password="clave"):
    return ConfigMqtt("127.0.0.1", broker.puerto, False, "simulador", password, "telemetria/+/lecturas", "tfi-test-paho")


def esperar(condicion, timeout=8.0):
    fin = time.monotonic() + timeout
    while time.monotonic() < fin:
        if condicion():
            return True
        time.sleep(0.05)
    return False


def test_publica_en_el_topic_del_dispositivo_con_credenciales(broker):
    p = PublicadorMqtt(cfg(broker))
    p.conectar(timeout=5)
    p.publicar("esp32-REAL01", {"device_uid": "esp32-REAL01", "n": 1})
    p.cerrar()
    assert broker.recibidos == [("simulador", "telemetria/esp32-REAL01/lecturas", {"device_uid": "esp32-REAL01", "n": 1})]


def test_contrasena_incorrecta_falla_con_el_motivo(broker):
    p = PublicadorMqtt(cfg(broker, password="mala"))
    with pytest.raises(ErrorConexion) as e:
        p.conectar(timeout=3)
    assert "Not authorized" in str(e.value)


def test_tras_una_caida_reconecta_y_entrega_lo_pendiente_en_orden(broker):
    p = PublicadorMqtt(cfg(broker))
    p.conectar(timeout=5)
    p.publicar("esp32-REAL01", {"n": 1})
    assert esperar(lambda: len(broker.recibidos) == 1)

    broker.tirar_conexiones()
    assert esperar(lambda: not p._conectado.is_set())
    p.publicar("esp32-REAL01", {"n": 2})
    p.publicar("esp32-REAL01", {"n": 3})
    assert esperar(lambda: len(broker.recibidos) == 3, timeout=15)  # paho reconecta solo (1 s de espera mínima)
    p.cerrar()
    assert [m["n"] for _, _, m in broker.recibidos] == [1, 2, 3]
    assert broker.conexiones == 2


def test_corte_de_senal_simulado_con_el_broker_arriba(broker):
    p = PublicadorMqtt(cfg(broker))
    p.conectar(timeout=5)
    p.sin_senal = True
    p.publicar("esp32-REAL01", {"n": 1})
    p.publicar("esp32-REAL01", {"n": 2})
    time.sleep(0.3)
    assert broker.recibidos == []
    p.sin_senal = False
    assert esperar(lambda: len(broker.recibidos) == 2)
    p.cerrar()
    assert [m["n"] for _, _, m in broker.recibidos] == [1, 2]
