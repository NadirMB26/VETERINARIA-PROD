import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const rolGuard = (rolesPermitidos: string[]): CanActivateFn => {
  return () => {
    const authService = inject(AuthService);
    const router      = inject(Router);

    const rol = authService.getRolActual();

    if (!rol) {
      router.navigate(['/login'], { replaceUrl: true });
      return false;
    }

    if (rolesPermitidos.includes(rol)) {
      return true;
    }

    switch (rol) {
      case 'cliente':
        router.navigate(['/layout/cliente-home'], { replaceUrl: true });
        break;
      case 'veterinario':
        router.navigate(['/layout/veterinario-home'], { replaceUrl: true });
        break;
      case 'groomer':
        router.navigate(['/layout/groomer-home'], { replaceUrl: true });
        break;
      default:
        router.navigate(['/layout/dashboard'], { replaceUrl: true });
        break;
    }

    return false;
  };
};
