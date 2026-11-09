"""Envío de los mensajes: al broker MQTT o a la consola (--dry-run)."""

from __future__ import annotations

import json
import threading
import time
from collections import deque
from typing import Any, Protocol

from .config import ConfigMqtt


MQTT_ERR_NO_CONN = 4  # paho.mqtt.client.MQTT_ERR_NO_CONN


class ErrorConexion(Exception):
    pass


class Publicador(Protocol):
    sin_senal: bool

    def conectar(self, timeout: float) -> None: ...
    def publicar(self, device_uid: str, mensaje: dict) -> str: ...
    def cerrar(self) -> None: ...


class PublicadorConsola:
    """No envía nada: imprime el JSON. Sirve para ver el contrato sin broker."""

    sin_senal = False

    def conectar(self, timeout: float) -> None:
        pass

    def publicar(self, device_uid: str, mensaje: dict) -> str:
        print(json.dumps(mensaje, ensure_ascii=False))
        return "dry-run"

    def cerrar(self) -> None:
        pass


class PublicadorMqtt:
    """Publica con QoS 1 (como el firmware). Si no hay conexión, o mientras `sin_senal` esté
    activo, los mensajes esperan en memoria con su marca de tiempo original y se mandan en orden
    al volver la señal: así se ejercita el caso de las lecturas atrasadas (RNF02)."""

    MAX_PENDIENTES = 50_000

    def __init__(self, config: ConfigMqtt, cliente: Any = None) -> None:
        self.config = config
        self._cliente = cliente or self._crear_cliente(config.client_id)
        self._configurar(self._cliente)
        self._cola: deque[tuple[str, str]] = deque(maxlen=self.MAX_PENDIENTES)
        self._lock = threading.RLock()
        self._conectado = threading.Event()
        self._sin_senal = False
        self._ultimo_error: str | None = None
        self._ultimo_envio: Any = None

    @staticmethod
    def _crear_cliente(client_id: str) -> Any:
        import paho.mqtt.client as mqtt

        return mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id=client_id, protocol=mqtt.MQTTv311)

    def _configurar(self, c: Any) -> None:
        cfg = self.config
        if cfg.usuario:
            c.username_pw_set(cfg.usuario, cfg.password)
        if cfg.tls:
            # Bundle de Mozilla en vez del almacén del sistema: el de Windows puede traer un
            # certificado cruzado viejo de Let's Encrypt, ya vencido, y rechazar un certificado válido.
            import certifi

            c.tls_set(ca_certs=cfg.ca_file or certifi.where())
        c.reconnect_delay_set(min_delay=1, max_delay=30)
        c.on_connect = self._al_conectar
        c.on_disconnect = self._al_desconectar

    # ---- callbacks (corren en el hilo de red de paho) ---------------------------------------

    def _al_conectar(self, cliente, userdata, flags, reason_code, properties=None) -> None:
        # paho 2.x entrega un ReasonCode (con .is_failure); un entero distinto de 0 también es un rechazo.
        fallo = reason_code.is_failure if hasattr(reason_code, "is_failure") else bool(reason_code)
        if fallo:
            self._ultimo_error = str(reason_code)  # p. ej. "Not authorized": usuario o contraseña incorrectos
            return
        self._ultimo_error = None
        self._conectado.set()
        self._vaciar()

    def _al_desconectar(self, cliente, userdata, disconnect_flags=None, reason_code=None, properties=None) -> None:
        self._conectado.clear()

    # ---- API ------------------------------------------------------------------------------

    @property
    def sin_senal(self) -> bool:
        return self._sin_senal

    @sin_senal.setter
    def sin_senal(self, valor: bool) -> None:
        self._sin_senal = valor
        if not valor:
            self._vaciar()

    @property
    def pendientes(self) -> int:
        return len(self._cola)

    def conectar(self, timeout: float = 15.0) -> None:
        self._cliente.connect_async(self.config.host, self.config.puerto, keepalive=60)
        self._cliente.loop_start()
        if not self._conectado.wait(timeout):
            motivo = self._ultimo_error or "sin respuesta del broker"
            self.cerrar(vaciar=False)
            raise ErrorConexion(
                f"no se pudo conectar a {self.config.host}:{self.config.puerto} en {timeout:.0f} s ({motivo})"
            )

    def publicar(self, device_uid: str, mensaje: dict) -> str:
        with self._lock:
            self._cola.append((self.config.topic_de(device_uid), json.dumps(mensaje, separators=(",", ":"))))
            self._vaciar()
            return "enviado" if not self._cola else f"en cola ({len(self._cola)} pendientes)"

    def _vaciar(self) -> None:
        with self._lock:
            if self._sin_senal or not self._conectado.is_set():
                return
            while self._cola:
                topic, payload = self._cola[0]
                info = self._cliente.publish(topic, payload, qos=1)
                # rc 4 (sin conexión) es una carrera con la caída: paho conserva el mensaje en su
                # cola y lo manda solo al reconectar, así que acá se da por entregado.
                if info.rc not in (0, MQTT_ERR_NO_CONN):
                    return
                self._cola.popleft()
                self._ultimo_envio = info

    def cerrar(self, vaciar: bool = True) -> None:
        if vaciar:
            self._sin_senal = False
            self._vaciar()
            if self._ultimo_envio is not None:
                try:
                    self._ultimo_envio.wait_for_publish(timeout=5)
                except (ValueError, RuntimeError):
                    pass
            time.sleep(0.1)
        self._cliente.loop_stop()
        self._cliente.disconnect()
