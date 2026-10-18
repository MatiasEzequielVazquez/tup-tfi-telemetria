import { Router } from 'express';
import type { Dependencias } from '../../app.js';

// M1 — Sesión y usuarios (RF01, RF17, RN11).
export function rutasUsuarios(_deps: Dependencias) {
  const r = Router();

  // El middleware autenticar ya cargó req.usuario antes de llegar acá.
  r.get('/me', (req, res) => {
    const { email, nombre, rol } = req.usuario!;
    res.json({ email, nombre, rol });
  });

  return r;
}