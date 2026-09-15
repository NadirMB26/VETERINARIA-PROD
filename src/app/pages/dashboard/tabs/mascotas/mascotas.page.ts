import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  LoadingController,
} from '@ionic/angular';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { ModalController } from '@ionic/angular';
import { MascotaService } from 'src/app/core/services/mascota.service';
import { Mascota } from 'src/app/core/models/mascota.model';
import { UserService } from 'src/app/core/services/user.service';
import { RegisterMascotaPage } from 'src/app/pages/register-mascota/register-mascota.page';
import { MigrarMascotaComponent } from 'src/app/shared/components/migrar-mascota/migrar-mascota.component';
import { MascotaDetalleComponent } from 'src/app/shared/components/mascota-detalle/mascota-detalle.component';
import { AuthService } from 'src/app/core/services/auth.service';
import { take } from 'rxjs/operators';
import { CitaService } from 'src/app/core/services/cita.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';

@Component({
  selector: 'app-mascotas',
  templateUrl: './mascotas.page.html',
  styleUrls: ['./mascotas.page.scss'],
  standalone: false,
})
export class MascotasPage implements OnInit, OnDestroy {

  mascotas: Mascota[] = [];
  mascotasFiltradas: Mascota[] = [];
  clientes: any[] = [];
  filtroBusqueda = '';
  filtroEspecie = 'todos';
  especiesDisponibles: string[] = [];
  cargando = true;
  rolActual = '';
  uidActual = '';
  puedeCrear = false;
  puedeEditar = false;
  puedeVer = false;
  nombresClientes: Record<string, string> = {};
  privilegios: any = {};
  /** Veterinario: solo mascotas que ha atendido (reemplaza al tab Historial). */
  mostrarSoloMisPacientes = false;
  private baseMascotas: Mascota[] = [];
  private misPacientesIds = new Set<string>();

  private destroy$ = new Subject<void>();

  constructor(
    private mascotaSvc: MascotaService,
    private userSvc: UserService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    public authService: AuthService,
    private citaSvc: CitaService,
    private util: UtilidadesService,
  ) {}

  async ngOnInit() {
    await this.inicializarSesion();
    this.cargarClientes();
    this.cargarMascotas();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async inicializarSesion() {
    const sesion = this.authService.resolverRolActual();
    if (!sesion) return;

    this.uidActual = sesion.uid;
    this.rolActual = sesion.rol;

    // Veterinario: índice de mascotas que ha atendido (filtro "Mis pacientes").
    if (this.rolActual === 'veterinario') {
      this.citaSvc.getTodas()
        .pipe(takeUntil(this.destroy$))
        .subscribe(citas => {
          this.misPacientesIds = new Set(
            citas.filter(c => c.idVeterinario === this.uidActual).map(c => c.idMascota)
          );
          this.aplicarFiltroMisPacientes();
        });
    }

    this.authService.privilegios$
      .pipe(takeUntil(this.destroy$))
      .subscribe(p => {
        this.privilegios = p ?? {};
        const esAdmin = this.rolActual === 'administrador';
        const esRecepcionista = this.rolActual === 'recepcionista';

        this.puedeCrear = esAdmin
          || (esRecepcionista && this.privilegios['crearMascotas'] === true);
        this.puedeEditar = esAdmin
          || (esRecepcionista && this.privilegios['editarMascotas'] === true);
        this.puedeVer = esAdmin
          || (esRecepcionista && this.privilegios['verMascotas'] === true)
          // Corrección: el veterinario ve mascotas y su historial clínico
          // (antes solo lo hacía desde el tab Historial, eliminado en F3).
          || (this.rolActual === 'veterinario' && this.privilegios['verHistorialMascota'] === true);
      });
  }

  private cargarClientes() {
    this.userSvc.getTodosLosUsuarios()
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.clientes = users;
        const mapa: Record<string, string> = {};
        for (const c of users) {
          const nombre = c.Nombre ?? c.nombre ?? '';
          const apellido = c.Apellido ?? c.apellido ?? '';
          mapa[c.idCliente ?? c.uid] = `${nombre} ${apellido}`.trim();
        }
        this.nombresClientes = mapa;
      });
  }

  getNombreCliente(idCliente: string): string {
    return this.nombresClientes[idCliente] || '—';
  }

  private cargarMascotas() {
    this.cargando = true;

    const obs$ = this.rolActual === 'cliente'
      ? this.mascotaSvc.getMascotasPorCliente(this.uidActual)
      : this.mascotaSvc.getTodas();

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (mascotas) => {
        this.baseMascotas = mascotas;
        this.aplicarFiltroMisPacientes();
      },
      error: () => {
        this.util.showToast('Error al cargar las mascotas', 'danger');
        this.cargando = false;
      },
    });
  }

  /** Recalcula la vista según el filtro "Mis pacientes" (veterinario). */
  private aplicarFiltroMisPacientes() {
    const soloMisPacientes = this.rolActual === 'veterinario' && this.mostrarSoloMisPacientes;
    this.mascotas = soloMisPacientes
      ? this.baseMascotas.filter(m => this.misPacientesIds.has(m.idMascota))
      : this.baseMascotas;
    this.especiesDisponibles = this.util.actualizarEspecies(this.mascotas);
    this.filtrar();
    this.cargando = false;
  }

  toggleMisPacientes() {
    this.mostrarSoloMisPacientes = !this.mostrarSoloMisPacientes;
    this.aplicarFiltroMisPacientes();
  }

  filtrar() {
    this.mascotasFiltradas = this.util.filtrarMascotas(
      this.mascotas, this.filtroBusqueda, this.filtroEspecie,
      (id) => this.getNombreCliente(id)
    );
  }

  setFiltroEspecie(especie: string) {
    this.filtroEspecie = especie;
    this.filtrar();
  }

  getIconoEspecie(especie: string): string {
    return this.util.getIconoEspecie(especie);
  }

  calcularEdad(fechaNacimiento: string): number {
    return this.util.calcularEdad(fechaNacimiento);
  }

  trackById(_: number, mascota: Mascota): string {
    return mascota.idMascota;
  }

  async nuevaMascota() {
    const modal = await this.modalCtrl.create({
      component: RegisterMascotaPage,
      componentProps: { modo: 'crear' },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.guardado) {
      this.util.showToast('Mascota registrada exitosamente', 'success');
    }
  }

  async editarMascota(mascota: Mascota) {
    const modal = await this.modalCtrl.create({
      component: RegisterMascotaPage,
      componentProps: {
        modo: 'editar',
        mascotaId: mascota.idMascota,
        clienteId: mascota.idCliente,
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
    });
    await modal.present();
    const { data } = await modal.onWillDismiss();
    if (data?.guardado) {
      this.util.showToast('Mascota actualizada', 'success');
    }
  }

  async cambiarEstado(mascota: Mascota) {
    const nuevoEstado: 'activo' | 'inactivo' =
      mascota.estado === 'activo' ? 'inactivo' : 'activo';
    const accion = nuevoEstado === 'inactivo' ? 'Desactivar' : 'Activar';

    const alert = await this.alertCtrl.create({
      header: `${accion} mascota`,
      message: `¿Deseas ${accion.toLowerCase()} a <strong>${mascota.nombre}</strong>?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: accion,
          handler: async () => {
            try {
              await this.mascotaSvc.cambiarEstado(mascota.idCliente, mascota.idMascota, nuevoEstado);
              this.util.showToast(
                `${mascota.nombre} ${nuevoEstado === 'activo' ? 'activada' : 'desactivada'}`,
                'success'
              );
            } catch {
              this.util.showToast('No se pudo cambiar el estado', 'danger');
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async eliminarMascota(mascota: Mascota) {
    const citas = await this.citaSvc.getCitasPorMascota(mascota.idMascota)
      .pipe(take(1))
      .toPromise();

    if (citas && citas.length > 0) {
      await this.util.showToast(
        `${mascota.nombre} tiene citas registradas y no puede eliminarse`,
        'warning'
      );
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Eliminar mascota',
      message: `Esta acción es <strong>irreversible</strong>. ¿Eliminar a <strong>${mascota.nombre}</strong>?`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          cssClass: 'danger',
          handler: async () => {
            const loading = await this.loadingCtrl.create({ message: 'Eliminando...' });
            await loading.present();
            try {
              await this.mascotaSvc.eliminarMascota(mascota.idCliente, mascota.idMascota);
              this.util.showToast(`${mascota.nombre} eliminada`, 'success');
            } catch {
              this.util.showToast('Error al eliminar', 'danger');
            } finally {
              await loading.dismiss();
            }
          },
        },
      ],
    });
    await alert.present();
  }

  async abrirMigracion() {
    const opciones = this.mascotas
      .filter(m => m.estado === 'activo')
      .map(m => ({
        type: 'radio' as const,
        label: `${m.nombre} — ${this.getNombreCliente(m.idCliente)}`,
        value: m.idMascota,
      }));

    const alert = await this.alertCtrl.create({
      header: 'Selecciona la mascota a migrar',
      inputs: opciones,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Continuar',
          handler: (idMascota: string) => {
            const mascota = this.mascotas.find(m => m.idMascota === idMascota);
            if (mascota) this.abrirMigracionDirecta(mascota);
          },
        },
      ],
    });
    await alert.present();
  }

  async abrirMigracionDirecta(mascota: Mascota) {
    const modal = await this.modalCtrl.create({
      component: MigrarMascotaComponent,
      componentProps: {
        mascota,
        nombrePropietarioActual: this.getNombreCliente(mascota.idCliente),
      },
      breakpoints: [0, 0.85, 1],
      initialBreakpoint: 0.85,
    });

    await modal.present();
  }

  async verDetalleMascota(mascota: Mascota) {
    const modal = await this.modalCtrl.create({
      component: MascotaDetalleComponent,
      componentProps: { mascota },
      cssClass: 'modal-mascota-detalle',
      breakpoints: [0, 0.92, 1],
      initialBreakpoint: 0.92,
    });
    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data?.editar) {
      this.editarMascota(data.editar);
    }
    if (data?.agendar) {
      this.router.navigate(['/layout/citas']);
    }
  }
}
