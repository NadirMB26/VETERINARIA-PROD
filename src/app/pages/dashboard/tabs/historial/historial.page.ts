import { Component, OnInit, OnDestroy } from '@angular/core';
import { MascotaService } from 'src/app/core/services/mascota.service';
import { Mascota } from 'src/app/core/models/mascota.model';
import { UserService } from 'src/app/core/services/user.service';
import { CitaService } from 'src/app/core/services/cita.service';
import { Router } from '@angular/router';
import {
  AlertController,
  LoadingController,
  ModalController,
} from '@ionic/angular';
import { Subject, takeUntil } from 'rxjs';
import { AuthService } from 'src/app/core/services/auth.service';
import { MascotaDetalleComponent } from 'src/app/shared/components/mascota-detalle/mascota-detalle.component';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';

@Component({
  selector: 'app-historial',
  templateUrl: './historial.page.html',
  styleUrls: ['./historial.page.scss'],
  standalone: false
})
export class HistorialPage implements OnInit, OnDestroy {

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

  private destroy$ = new Subject<void>();

  constructor(
    private mascotaSvc: MascotaService,
    private userSvc: UserService,
    private citaSvc: CitaService,
    private router: Router,
    private alertCtrl: AlertController,
    private loadingCtrl: LoadingController,
    private modalCtrl: ModalController,
    public authService: AuthService,
    private util: UtilidadesService,
  ) {}

  async ngOnInit() {
    await this.inicializarSesion();
    this.cargarClientes();
    this.cargarMascotas();

    this.authService.privilegios$.pipe(takeUntil(this.destroy$)).subscribe(p => {
      this.puedeCrear = this.rolActual === 'administrador'
        || (this.rolActual === 'recepcionista' && p['crearMascotas'] === true);
      this.puedeEditar = this.rolActual === 'administrador'
        || (this.rolActual === 'recepcionista' && p['editarMascotas'] === true);
    });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private async inicializarSesion() {
    const resultado = this.authService.resolverRolActual();
    if (!resultado) return;

    this.uidActual = resultado.uid;
    this.rolActual = resultado.rol;
  }

  private cargarClientes() {
    this.userSvc.getTodosLosUsuarios()
      .pipe(takeUntil(this.destroy$))
      .subscribe(users => {
        this.clientes = users;
      });
  }

  getNombreCliente(idCliente: string): string {
    const c = this.clientes.find(x => x.idCliente === idCliente);
    if (!c) return '—';

    const nombre = c.Nombre ?? c.nombre ?? '';
    const apellido = c.Apellido ?? c.apellido ?? '';
    return `${nombre} ${apellido}`.trim() || '—';
  }

  private cargarMascotas() {
    this.cargando = true;

    const obs$ = this.rolActual === 'cliente'
      ? this.mascotaSvc.getMascotasPorCliente(this.uidActual)
      : this.mascotaSvc.getTodas();

    obs$.pipe(takeUntil(this.destroy$)).subscribe({
      next: (mascotas) => {
        if (this.rolActual === 'veterinario') {
          this.citaSvc.getTodas().pipe(takeUntil(this.destroy$)).subscribe({
            next: (citas) => {
              const citasDelVet = citas.filter(c => c.idVeterinario === this.uidActual);
              const idMascotasAtendidas = new Set(citasDelVet.map(c => c.idMascota));
              this.mascotas = mascotas.filter(m => idMascotasAtendidas.has(m.idMascota));
              this.procesarRenderizadoLista();
            },
            error: () => {
              this.util.showToast('Error al procesar el filtro de veterinario', 'danger');
              this.cargando = false;
            }
          });
        } else {
          this.mascotas = mascotas;
          this.procesarRenderizadoLista();
        }
      },
      error: () => {
        this.util.showToast('Error al cargar las mascotas', 'danger');
        this.cargando = false;
      },
    });
  }

  private procesarRenderizadoLista() {
    this.especiesDisponibles = this.util.actualizarEspecies(this.mascotas);
    this.filtrar();
    this.cargando = false;
  }

  filtrar() {
    this.mascotasFiltradas = this.util.filtrarMascotas(
      this.mascotas,
      this.filtroBusqueda,
      this.filtroEspecie,
      (id) => this.getNombreCliente(id)
    );
  }

  setFiltroEspecie(especie: string) {
    this.filtroEspecie = especie;
    this.filtrar();
  }

  getIconoEspecie(especie: string): string { return this.util.getIconoEspecie(especie); }

  calcularEdad(fechaNacimiento: string): number { return this.util.calcularEdad(fechaNacimiento); }

  trackById(_: number, mascota: Mascota): string {
    return mascota.idMascota;
  }

  async verDetalleMascota(mascota: Mascota) {
    const rol = this.authService.getRolActual();

    const puedeVer =
      rol === 'administrador' ||
      rol === 'recepcionista' ||
      this.authService.tienePrivilegio('verHistorialMascota');

    if (!puedeVer) {
      await this.util.showToast('No tienes permiso para ver el historial', 'warning');
      return;
    }

    const modal = await this.modalCtrl.create({
      component: MascotaDetalleComponent,
      componentProps: {
        mascota,
        modoExpediente: true,
      },
      cssClass: 'modal-mascota-detalle',
      breakpoints: [0, 0.92, 1],
      initialBreakpoint: 0.92,
    });

    await modal.present();
  }
}
