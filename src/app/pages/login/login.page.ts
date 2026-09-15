import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { UserService } from 'src/app/core/services/user.service';
import { ConfiguracionAppService } from 'src/app/core/services/configuracion-app.service';
import { ConfiguracionApp } from 'src/app/core/models/configuracion-app.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage implements OnInit, OnDestroy {

  email:        string  = '';
  password:     string  = '';
  error:        string  = '';
  cargando:     boolean = false;
  showPassword: boolean = false;

  configuracion: ConfiguracionApp | null = null;

  private configSub?: Subscription;

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private configSvc: ConfiguracionAppService,
    private router:      Router
  ) {}

  // ── Al cargar la página: verificar si hay usuarios en la BD ───────────────
  async ngOnInit() {
    // `config$` ya maneja errores: el login siempre carga aunque falle la lectura.
    this.configSub = this.configSvc.config$.subscribe(cfg => {
      this.configuracion = cfg ?? null;
    });
    await this.verificarPrimerUso();
  }

  ngOnDestroy() {
    this.configSub?.unsubscribe();
  }

  private async verificarPrimerUso() {
    try {
      // Busca si hay al menos un administrador en Firestore
      const hayAdmins = await this.userService.existeAlgunUsuario();

      if (!hayAdmins) {
        // Base de datos vacía → redirige a registro del primer admin
        this.router.navigate(['/register'], {
          queryParams: { primerAdmin: true },
          replaceUrl: true
        });
      }
    } catch (err) {
      console.error('Error verificando primer uso:', err);
    }
  }

  // ── Login ─────────────────────────────────────────────────────────────────
  async login() {
    if (!this.email || !this.password) {
      this.error = 'Por favor completa todos los campos';
      return;
    }

    try {
      this.error    = '';
      this.cargando = true;
      await this.authService.login(this.email, this.password);
    } catch (err: any) {
      this.error = err?.code
        ? this.mensajeError(err.code)
        : (err?.message || 'Correo o contraseña incorrectos');
      console.error(err);
    } finally {
      this.cargando = false;
    }
  }

  // ── Mensajes de error legibles ────────────────────────────────────────────
  private mensajeError(code: string): string {
    const errores: Record<string, string> = {
      'auth/user-not-found':    'No existe una cuenta con ese correo',
      'auth/wrong-password':    'Contraseña incorrecta',
      'auth/invalid-email':     'El correo no es válido',
      'auth/too-many-requests': 'Demasiados intentos. Espera un momento',
      'auth/user-disabled':     'Esta cuenta ha sido deshabilitada',
      'permission-denied':      'No se pudo verificar tu perfil. Contacta al administrador',
    };
    return errores[code] ?? 'Correo o contraseña incorrectos';
  }
}