import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('authGuard', () => {
  const route: any = {};
  const state: any = { url: '/layout' };

  function run(estaLogueado: boolean) {
    const navigate = jasmine.createSpy('navigate');
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { estaLogueado: () => estaLogueado } },
        { provide: Router, useValue: { navigate } },
      ],
    });
    const result = TestBed.runInInjectionContext(() => authGuard(route, state));
    return { result, navigate };
  }

  it('permite el paso si hay sesión activa', () => {
    const { result } = run(true);
    expect(result).toBeTrue();
  });

  it('redirige al login cuando no hay sesión', () => {
    const { result, navigate } = run(false);
    expect(result).toBeFalse();
    expect(navigate).toHaveBeenCalledWith(['/login']);
  });
});
