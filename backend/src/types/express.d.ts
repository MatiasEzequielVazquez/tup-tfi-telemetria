export type Rol = 'admin' | 'mantenimiento';

export interface UsuarioSesion {
  email: string;
  nombre: string | null;
  rol: Rol;
}

declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioSesion;
    }
  }
}