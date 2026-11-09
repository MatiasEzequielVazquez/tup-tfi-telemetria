"""Los mensajes del simulador tienen que pasar por el parser REAL del backend (parser.ts).

Se ejecuta con Node (>= 22.18 corre TypeScript sin compilar). Si Node no está, se saltea.
"""

import json
import random
import shutil
import subprocess
from datetime import datetime, timezone
from pathlib import Path

import pytest

from simulador import rutas
from simulador.fallas import ConfigFallas
from simulador.mensajes import construir_mensaje
from simulador.modelo import Camion

PARSER = Path(__file__).resolve().parents[2] / "backend" / "src" / "modulos" / "ingesta" / "parser.ts"

SCRIPT = """
import { readFileSync } from 'node:fs';
const { parsearMensaje } = await import(process.argv[1]);
const mensajes = JSON.parse(readFileSync(0, 'utf8'));
console.log(JSON.stringify(mensajes.map((m) => {
  const r = parsearMensaje(JSON.stringify(m));
  return { ignoradas: r.ignoradas, mediciones: r.mediciones.length, dtcs: r.dtcs.length };
})));
"""


def generar(protocolo):
    c = Camion(
        "esp32-TEST01", protocolo, rutas.elegir("mixta"), rng=random.Random(5),
        fallas=ConfigFallas(por_hora=3),
    )
    mensajes = []
    for _ in range(60):
        eventos = c.avanzar(1800)
        mensajes.append(construir_mensaje(c, datetime.now(timezone.utc), eventos))
    return mensajes


@pytest.mark.skipif(shutil.which("node") is None or not PARSER.exists(), reason="requiere Node y el backend del repo")
@pytest.mark.parametrize("protocolo", ["J1939", "J1979"])
def test_el_parser_del_backend_acepta_todo_sin_ignorar_nada(protocolo):
    mensajes = generar(protocolo)
    r = subprocess.run(
        ["node", "--input-type=module", "-e", SCRIPT, PARSER.as_uri()],
        input=json.dumps(mensajes), capture_output=True, text=True, timeout=60,
    )
    if "ERR_UNKNOWN_FILE_EXTENSION" in r.stderr or "Unknown file extension" in r.stderr:
        pytest.skip("esta versión de Node no ejecuta TypeScript directamente")
    assert r.returncode == 0, r.stderr
    resultados = json.loads(r.stdout)
    assert len(resultados) == 60
    assert all(x["ignoradas"] == [] for x in resultados)
    assert all(x["mediciones"] == (2 if protocolo == "J1939" else 1) for x in resultados)
    assert sum(x["dtcs"] for x in resultados) > 0  # el escenario sí generó fallas
