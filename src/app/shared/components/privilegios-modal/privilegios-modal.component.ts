import { Component, Input, OnInit } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { PrivilegiosService } from 'src/app/core/services/privilegios.service';
import { getPrivilegiosDefault, Privilegios } from 'src/app/core/models/privilegios.model';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';

@Component({
  selector: 'app-privilegios-modal',
  templateUrl: './privilegios-modal.component.html',
  styleUrls: ['./privilegios-modal.component.scss'],
  standalone: false
})
export class PrivilegiosModalComponent implements OnInit {

  @Input() usuario: any;

  privilegios: any = {};

  guardando: boolean = false;

  cargando: boolean = true;

  get iniciales(): string {
    return `${(this.usuario?.Nombre ?? '')?.[0] ?? ''}${(this.usuario?.Apellido ?? '')?.[0] ?? ''}`.toUpperCase();
  }

  privilegiosRecep = [
    { key: 'crearUsuarios', label: 'Crear usuarios' },
    { key: 'editarUsuarios', label: 'Editar usuarios' },
    { key: 'verUsuarios', label: 'Ver usuarios' },
    { key: 'crearMascotas', label: 'Crear mascotas' },
    { key: 'editarMascotas', label: 'Editar mascotas' },
    { key: 'verMascotas', label: 'Ver mascotas' },
    { key: 'crearCitas', label: 'Crear citas' },
    { key: 'cancelarCitas', label: 'Cancelar citas' },
    { key: 'reprogramarCitas', label: 'Reprogramar citas' },
    { key: 'verCitas', label: 'Ver citas' },
    { key: 'crearVentas', label: 'Crear ventas y cobranza' },
    { key: 'verVentas', label: 'Ver ventas e historial' },
  ];

  privilegiosVet = [
    { key: 'verCitasAsignadas', label: 'Ver citas asignadas' },
    { key: 'diagnosticarCitas', label: 'Diagnosticar citas' },
    { key: 'verHistorialMascota', label: 'Ver historial de mascota' },
  ];

  constructor(
    private modalCtrl: ModalController,
    private privilegiosService: PrivilegiosService,
    private util: UtilidadesService
  ) {}

  async ngOnInit() {
    try {
      const p = await this.privilegiosService.getPrivilegiosOnce(this.usuario.uid);
      this.privilegios = {
        ...getPrivilegiosDefault(this.usuario.rol, this.usuario.uid),
        ...(p ?? {}),
      };
    } catch {
      this.util.showToast('No se pudieron cargar los privilegios', 'danger');
    } finally {
      this.cargando = false;
    }
  }

  async guardar() {
    this.guardando = true;
    try {
      const completos: Privilegios = {
        ...getPrivilegiosDefault(this.usuario.rol, this.usuario.uid),
        ...this.privilegios,
      } as Privilegios;
      await this.privilegiosService.setPrivilegios(this.usuario.uid, completos);
      this.cerrar();
    } catch {
      this.util.showToast('No se pudieron guardar los privilegios', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  cerrar() {
    this.modalCtrl.dismiss();
  }
}
