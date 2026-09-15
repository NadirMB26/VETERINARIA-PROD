import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { rolGuard } from './rol.guard';
import { AuthService } from '../services/auth.service';

describe('rolGuard', () => {
  const route: any = {};
  const state: any = { url: '/layout' };

  function run(rol: string | null, permitidos: string[]) {
    const navigate = jasmine.createSpy('navigate');
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { getRolActual: () => rol } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    const result = TestBed.runInInjectionContext(() => rolGuard(permitidos)(route, state));
    return { result, navigate };
  }

  it('permite el rol incluido en la lista', () => {
    const { result } = run('veterinario', ['administrador', 'veterinario']);
    expect(result).toBeTrue();
  });

  it('redirige al login si no hay rol', () => {
    const { result, navigate } = run(null, ['administrador']);
    expect(result).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/login'], { replaceUrl: true });
  });

  it('redirige al home del rol cuando no está permitido', () => {
    const { result, navigate } = run('groomer', ['administrador']);
    expect(result).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/layout/groomer-home'], { replaceUrl: true });
  });

  it('manda a dashboard a los roles de staff no listados', () => {
    const { result, navigate } = run('recepcionista', ['administrador']);
    expect(result).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/layout/dashboard'], { replaceUrl: true });
  });
});
