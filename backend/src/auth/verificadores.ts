import type { Sql } from '../db.js';

export type Verificador = (token: string) => Promise<string | null>;

/** Supabase no responde: es un problema de infraestructura (503), no un token inválido (401). */
export class AuthNoDisponible extends Error {}

/**
 * Producción: valida el token contra Supabase Auth (GET /auth/v1/user).
 * Funciona con cualquier tipo de clave de firma y el backend no maneja secretos.
 * Cada token válido se cachea unos segundos para no consultar a Supabase en cada request.
 */
export function verificadorSupabase(opts: { supabaseUrl: string; supabaseAnonKey: string; cacheSegundos: number }): Verificador {
  const cache = new Map<string, { email: string; vence: number }>();

  return async (token) => {
    const hit = cache.get(token);
    if (hit && hit.vence > Date.now()) return hit.email;

    let res: Response;
    try {
      res = await fetch(`${opts.supabaseUrl}/auth/v1/user`, {
        headers: { apikey: opts.supabaseAnonKey, Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(8000),
      });
    } catch (e) {
      throw new AuthNoDisponible(`No se pudo contactar a Supabase Auth: ${(e as Error).message}`);
    }
    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new AuthNoDisponible(`Supabase Auth respondió HTTP ${res.status}`);

    const user = (await res.json()) as { email?: string };
    const email = user.email?.toLowerCase() ?? null;
    if (email && opts.cacheSegundos > 0) {
      if (cache.size > 1000) cache.clear();
      cache.set(token, { email, vence: Date.now() + opts.cacheSegundos * 1000 });
    }
    return email;
  };
}

/**
 * SOLO DESARROLLO (AUTH_MODE=dev). Compatible con el mock y con la sesión simulada del
 * frontend: el token es el rol ("admin" | "mantenimiento") o el email de un usuario.
 */
export function verificadorDev(sql: Sql): Verificador {
  return async (token) => {
    if (token === 'admin' || token === 'mantenimiento') {
      const [u] = await sql<{ email: string }[]>`
        select email from usuarios where rol = ${token} and activo order by created_at, email limit 1`;
      return u?.email ?? null;
    }
    return token.includes('@') ? token.toLowerCase() : null;
  };
}