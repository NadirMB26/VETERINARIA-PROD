import { Component, OnInit, inject } from '@angular/core';
import { AlertController, ModalController } from '@ionic/angular';
import { UserService } from 'src/app/core/services/user.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { Router } from '@angular/router';
import { PrivilegiosModalComponent } from 'src/app/shared/components/privilegios-modal/privilegios-modal.component';
import { RegisterPage } from 'src/app/pages/register/register.page';
import { Subscription } from 'rxjs';
import { Auth, sendPasswordResetEmail } from '@angular/fire/auth';
import { HorarioVeterinarioComponent } from 'src/app/shared/components/horario-veterinario/horario-veterinario.component';

@Component({
  selector: 'app-usuarios',
  templateUrl: './usuarios.page.html',
  styleUrls: ['./usuarios.page.scss'],
  standalone: false
})
export class UsuariosPage implements OnInit {

  usuarios: any[] = [];
  usuariosFiltrados: any[] = [];
  rolActual: string = '';
  filtroBusqueda: string = '';
  filtroRol: string = 'todos';
  filtroEstado: string = 'todos';
  filtroSinDocumento = false;
  cargando: boolean = true;
  supervisores: { [uid: string]: string } = {};
  privilegios: any = {};
  puedeCrearUsuarios = false;

  private privSub!: Subscription;
  private usuariosSub?: Subscription;
  private accesoRedirigido = false;
  private auth = inject(Auth);

  constructor(
    private userService: UserService,
    public authService: AuthService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private router: Router,
    private util: UtilidadesService
  ) {}

  ngOnInit() {
    this.rolActual = this.authService.getRolActual() ?? '';

    this.privSub = this.authService.privilegios$.subscribe(p => {
      this.privilegios = p;
      this.puedeCrearUsuarios = this.rolActual === 'administrador'
        || p?.['crearUsuarios'] === true;
      this.verificarAcceso();
      this.filtrar();
    });

    if (!this.accesoRedirigido) this.cargarUsuarios();
  }

  /**
   * Sin privilegio `verUsuarios` (y sin ser admin) no se accede a la gestión.
   * Espera a que los privilegios hayan cargado para no redirigir por error.
   */
  private verificarAcceso() {
    if (this.accesoRedirigido || this.rolActual === 'administrador') return;
    const p = this.privilegios ?? {};
    if (Object.keys(p).length === 0) return;
    if (p['verUsuarios'] === true) return;

    this.accesoRedirigido = true;
    this.util.showToast('No tienes permiso para ver usuarios', 'warning');
    this.router.navigate(['/layout/dashboard'], { replaceUrl: true });
  }

  filtrar() {
    let lista = [...this.usuarios];

    if (this.rolActual !== 'administrador' && !this.privilegios['verUsuarios']) {
      lista = lista.filter(u => u.rol === 'cliente');
    }

    if (this.filtroRol !== 'todos') {
      lista = lista.filter(u => u.rol === this.filtroRol);
    }

    if (this.filtroEstado !== 'todos') {
      lista = lista.filter(u => u.estado === this.filtroEstado);
    }

    if (this.filtroSinDocumento) {
      lista = lista.filter(u => !(u.Cedula ?? '').trim());
    }

    if (this.filtroBusqueda.trim()) {
      const busq = this.filtroBusqueda.toLowerCase();
      lista = lista.filter(u =>
        u.Nombre?.toLowerCase().includes(busq) ||
        u.Apellido?.toLowerCase().includes(busq) ||
        u.Correo?.toLowerCase().includes(busq) ||
        u.Cedula?.toLowerCase().includes(busq) ||
        u.Telefono?.toLowerCase().includes(busq)
      );
    }

    this.usuariosFiltrados = lista;
  }

  /** Fecha corta dd/mm/aaaa para la columna "Registrado". */
  formatearFechaRegistro(fechaIso?: string): string {
    if (!fechaIso) return '—';
    const d = new Date(fechaIso);
    if (isNaN(d.getTime())) return '—';
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  }

  /** Cantidad total de usuarios sin documento (para el filtro rápido). */
  get totalSinDocumento(): number {
    return this.usuarios.filter(u => !(u.Cedula ?? '').trim()).length;
  }

  ngOnDestroy() {
    this.privSub?.unsubscribe();
    this.usuariosSub?.unsubscribe();
  }

  async abrirHorarios(usuario: any) {
    const modal = await this.modalCtrl.create({
      component: HorarioVeterinarioComponent,
      componentProps: { uid: usuario.uid },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
  }

  cargarUsuarios() {
    this.usuariosSub = this.userService.getTodosLosUsuarios().subscribe(async usuarios => {
      this.usuarios = usuarios;
      await this.resolverSupervisores(usuarios);
      this.filtrar();
      this.cargando = false;
    });
  }

  private async resolverSupervisores(usuarios: any[]) {
    const uidsUnicos = new Set<string>();
    usuarios.forEach(u => { if (u.idAdministrador) uidsUnicos.add(u.idAdministrador); });

    const promesas = Array.from(uidsUnicos).map(async uid => {
      if (this.supervisores[uid]) return;
      try {
        const snap: any = await this.userService.getDocumentOnce('administradores', uid);
        this.supervisores[uid] = snap
          ? `${snap['Nombre'] ?? ''} ${snap['Apellido'] ?? ''}`.trim()
          : '—';
      } catch {
        this.supervisores[uid] = '—';
      }
    });

    await Promise.all(promesas);
  }

  getNombreSupervisor(uid: string): string {
    if (!uid) return '—';
    return this.supervisores[uid] || 'Cargando...';
  }

  inicialesDe(u: any): string {
    return `${(u?.Nombre ?? '')?.[0] ?? ''}${(u?.Apellido ?? '')?.[0] ?? ''}`.toUpperCase();
  }

  async cambiarEstado(usuario: any) {
    const nuevoEstado = usuario.estado === 'activo' ? 'inactivo' : 'activo';
    const accion = nuevoEstado === 'inactivo' ? 'pausar' : 'activar';

    // Protección: nunca dejar el sistema sin administradores activos.
    if (usuario.rol === 'administrador' && nuevoEstado === 'inactivo') {
      const adminsActivos = this.usuarios.filter(u => u.rol === 'administrador' && u.estado === 'activo');
      if (adminsActivos.length <= 1) {
        this.util.showToast('No puedes pausar al último administrador activo', 'warning');
        return;
      }
    }

    const alert = await this.alertCtrl.create({
      header: '¿Confirmar acción?',
      message: `¿Deseas ${accion} a ${usuario.Nombre} ${usuario.Apellido}?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: accion.charAt(0).toUpperCase() + accion.slice(1),
          handler: async () => {
            try {
              const coleccion = this.userService.getColeccionPorRol(usuario.rol);
              await this.userService.cambiarEstado(coleccion, usuario.uid, nuevoEstado);
              usuario.estado = nuevoEstado;
              this.util.showToast(
                `${usuario.Nombre} ${nuevoEstado === 'activo' ? 'activado' : 'pausado'} correctamente`,
                'success'
              );
            } catch {
              this.util.showToast('Error al cambiar el estado', 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async abrirPermisos(usuario: any) {
    const modal = await this.modalCtrl.create({
      component: PrivilegiosModalComponent,
      componentProps: { usuario },
      cssClass: 'permisos-modal'
    });
    await modal.present();
  }

  async nuevoUsuario() {
    const modal = await this.modalCtrl.create({
      component: RegisterPage,
      componentProps: { modoEdicionInput: false },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.guardado) {
      this.util.showToast('Usuario registrado exitosamente', 'success');
    }
  }

  async editarUsuario(usuario: any) {
    const modal = await this.modalCtrl.create({
      component: RegisterPage,
      componentProps: {
        modoEdicionInput: true,
        uidEditarInput: usuario.uid,
        rolInput: usuario.rol,
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.guardado) {
      this.util.showToast('Usuario actualizado correctamente', 'success');
    }
  }

  getBadgeColor(rol: string): string {
    return this.util.getBadgeColorRol(rol);
  }

  puedeEditarUsuario(usuario: any): boolean {
    if (usuario.uid === this.authService.getUidActual()) {
      return false;
    }

    if (this.rolActual === 'administrador') {
      return true;
    }

    if (!this.privilegios['editarUsuarios']) {
      return false;
    }

    if (this.rolActual === 'recepcionista' && usuario.rol !== 'cliente') {
      return false;
    }

    return true;
  }

  async validarEdicion(usuario: any) {
    if (!this.puedeEditarUsuario(usuario)) {
      this.util.showToast(
        'No tienes permisos para editar este usuario.',
        'warning'
      );
      return;
    }

    this.editarUsuario(usuario);
  }

  async resetearContrasena(usuario: any, event: Event) {
    event.stopPropagation();

    const alert = await this.alertCtrl.create({
      header: 'Enviar enlace de restablecimiento',
      message: `Se enviará un enlace a ${usuario.Correo} para que el usuario configure su nueva contraseña.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Enviar enlace',
          handler: async () => {
            try {
              await sendPasswordResetEmail(this.auth, usuario.Correo);
              this.util.showToast(`Enlace enviado a ${usuario.Correo}`, 'success');
            } catch (err: any) {
              const msg = err?.code === 'auth/user-not-found'
                ? 'No existe una cuenta con ese correo'
                : 'Error al enviar el enlace';
              this.util.showToast(msg, 'danger');
            }
          }
        }
      ]
    });

    await alert.present();
  }
}
