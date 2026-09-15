import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { User } from '@angular/fire/auth';
import { AuthService } from 'src/app/core/services/auth.service';
import { UserService } from 'src/app/core/services/user.service';
import { NavigationService, ItemNavegacion } from 'src/app/core/services/navigation.service';
import { Router } from '@angular/router';
import { Observable, Subject, Subscription } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-layout',
  templateUrl: './layout.page.html',
  styleUrls: ['./layout.page.scss'],
  standalone: false
})
export class LayoutPage implements OnInit, OnDestroy {

  private router = inject(Router);
  private destroy$ = new Subject<void>();
  private perfilSub?: Subscription;

  rol: string = '';
  uid: string = '';
  nombreUsuario: string = '';
  fotoUrl: string = '';
  menuItems: ItemNavegacion[] = [];

  constructor(
    private authService: AuthService,
    private userService: UserService,
    private navigationSvc: NavigationService
  ) {}

  irAConfiguracion() {
    this.router.navigate(['/layout/configuracion']);
  }

  ngOnInit() {
    // La sesión se carga/limpia de forma reactiva: al cerrar sesión o al
    // ingresar con otro usuario (sin recargar) el perfil y el menú se refrescan.
    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe(u => this.cargarSesion(u));

    // El menú se recalcula ante cambios de privilegios con el rol vigente.
    this.authService.privilegios$
      .pipe(takeUntil(this.destroy$))
      .subscribe(privilegios => {
        this.menuItems = this.navigationSvc.construirMenu(this.rol, privilegios);
      });
  }

  /** Carga la identidad del usuario autenticado o limpia el estado al salir. */
  private cargarSesion(usuario: User | null) {
    this.perfilSub?.unsubscribe();
    this.perfilSub = undefined;

    if (!usuario) {
      this.rol = '';
      this.uid = '';
      this.nombreUsuario = '';
      this.fotoUrl = '';
      this.menuItems = [];
      return;
    }

    const rol = this.authService.getRolActual() ?? '';
    this.uid = usuario.uid;
    this.rol = rol;
    if (!rol) return;

    // Reconstrucción inmediata del menú con los privilegios ya cargados.
    this.menuItems = this.navigationSvc.construirMenu(rol, this.authService.privilegios$.value);

    // Perfil reactivo: la foto/nombre se actualizan en vivo (ej. al subir foto en Configuración).
    const coleccion = this.userService.getColeccionPorRol(rol);
    this.perfilSub = (this.userService.getDocument(coleccion, this.uid) as Observable<any>)
      .pipe(takeUntil(this.destroy$))
      .subscribe(userData => {
        this.nombreUsuario = userData
          ? `${userData.Nombre ?? ''} ${userData.Apellido ?? ''}`.trim()
          : this.uid;
        this.fotoUrl = userData?.fotoUrl ?? '';
      });
  }

  ngOnDestroy() {
    this.perfilSub?.unsubscribe();
    this.destroy$.next();
    this.destroy$.complete();
  }

  logout() {
    this.authService.logout();
  }
}
