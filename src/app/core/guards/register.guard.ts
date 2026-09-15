import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';
import { UserService } from '../services/user.service';

/**
 * @description
 * Protege la ruta pública /register.
 * - Con sesión: solo staff que puede crear usuarios (admin o recepcionista).
 * - Sin sesión: solo si la base de datos está vacía (primer administrador).
 */
export const registerGuard: CanActivateFn = async () => {
  const auth = inject(AuthService);
  const userSvc = inject(UserService);
  const router = inject(Router);

  if (auth.estaLogueado()) {
    const rol = auth.getRolActual();
    if (rol === 'administrador' || rol === 'recepcionista') return true;
    router.navigate(['/layout'], { replaceUrl: true });
    return false;
  }

  try {
    const hayUsuarios = await userSvc.existeAlgunUsuario();
    if (!hayUsuarios) return true;
  } catch {
    // si falla la consulta, se bloquea el acceso
  }

  router.navigate(['/login'], { replaceUrl: true });
  return false;
};
