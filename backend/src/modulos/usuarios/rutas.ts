import { Router } from 'express';
import type { Dependencias } from '../../app.js';
import { soloAdmin } from '../../auth/middleware.js';
import { conflicto, noEncontrado, validacion } from '../../http/errores.js';
import { ENUMS, REGEX_EMAIL, exigirCampos, exigirEnum, textoOpcional, type Body } from '../../http/validacion.js';
import type { Rol } from '../../types/express.js';

// M1 — Sesión y usuarios (RF01, RF17, RN11).

interface Usuario {
  email: string;
  nombre: string | null;
  rol: Rol;
  created_at: Date;
}

export function rutasUsuarios({ sql }: Dependencias) {
  const r = Router();

  r.get('/me', (req, res) => {
    const { email, nombre, rol } = req.usuario!;
    res.json({ email, nombre, rol });
  });

  r.get('/usuarios', soloAdmin, async (_req, res) => {
    const data = await sql<Usuario[]>`
      select email, nombre, rol, created_at from usuarios order by created_at, email`;
    res.json({ data });
  });

  // Alta (RF17). Para iniciar sesión, el usuario además tiene que existir en Supabase Auth
  // (se lo invita desde el panel de Supabase); acá se le asigna el rol.
  r.post('/usuarios', soloAdmin, async (req, res) => {
    const b = req.body as Body;
    exigirCampos(b, ['email', 'rol']);
    if (typeof b.email !== 'string' || !REGEX_EMAIL.test(b.email) || b.email.length > 100) {
      throw validacion('Email inválido.');
    }
    exigirEnum('rol', b.rol, ENUMS.rol);

    // "on conflict do nothing" + returning: si ya existe no devuelve fila -> 409.
    // Es atómico: dos altas simultáneas del mismo email no pueden pasar las dos.
    const [u] = await sql<Usuario[]>`
      insert into usuarios (email, nombre, rol, created_at)
      values (${b.email.trim().toLowerCase()}, ${textoOpcional('nombre', b.nombre, 100)}, ${b.rol}, ${new Date()})
      on conflict (email) do nothing
      returning email, nombre, rol, created_at`;
    if (!u) throw conflicto('Ya existe un usuario con ese email.');
    res.status(201).json(u);
  });

  r.patch('/usuarios/:email', soloAdmin, async (req, res) => {
    const b = req.body as Body;
    const [actual] = await sql<Usuario[]>`
      select email, nombre, rol, created_at from usuarios where lower(email) = ${req.params.email.toLowerCase()}`;
    if (!actual) throw noEncontrado('No existe el usuario.');

    let rol = actual.rol;
    if (b.rol !== undefined) {
      exigirEnum('rol', b.rol, ENUMS.rol);
      rol = b.rol;
    }
    const nombre = b.nombre !== undefined ? textoOpcional('nombre', b.nombre, 100) : actual.nombre;

    // No dejar el sistema sin administradores: nadie más podría dar de alta usuarios.
    if (actual.rol === 'admin' && rol !== 'admin') {
      const [c] = await sql<{ n: number }[]>`select count(*)::int as n from usuarios where rol = 'admin'`;
      if ((c?.n ?? 0) <= 1) throw conflicto('No se puede quitar el rol admin al único administrador.');
    }

    const [u] = await sql<Usuario[]>`
      update usuarios set rol = ${rol}, nombre = ${nombre} where email = ${actual.email}
      returning email, nombre, rol, created_at`;
    res.json(u);
  });

  return r;
}