import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AuthService } from '../services/auth.service';

/**
 * @description
 * Protege /register-mascota: requiere sesión y un rol válido.
 * La página valida internamente que un cliente solo opere sus propias mascotas.
 */
export const registroMascotaGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);

  if (!auth.estaLogueado()) {
    router.navigate(['/login'], { replaceUrl: true });
    return false;
  }

  const rol = auth.getRolActual();
  if (['administrador', 'recepcionista', 'veterinario', 'cliente'].includes(rol ?? '')) {
    return true;
  }

  router.navigate(['/login'], { replaceUrl: true });
  return false;
};
