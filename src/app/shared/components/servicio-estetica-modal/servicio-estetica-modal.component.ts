import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController, LoadingController, AlertController } from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { Cita } from 'src/app/core/models/cita.model';
import { Mascota } from 'src/app/core/models/mascota.model';
import { Venta, saldoVenta } from 'src/app/core/models/venta.model';
import { CitasEsteticaService, labelTipoServicio } from 'src/app/core/services/citas-estetica.service';
import { CitaVentaService } from 'src/app/core/services/cita-venta.service';
import { MascotaService } from 'src/app/core/services/mascota.service';
import { ProductoService } from 'src/app/core/services/producto.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';

interface PasoChecklist {
  label: string;
  done: boolean;
}

@Component({
  selector: 'app-servicio-estetica-modal',
  templateUrl: './servicio-estetica-modal.component.html',
  styleUrls: ['./servicio-estetica-modal.component.scss'],
  standalone: false,
})
export class ServicioEsteticaModalComponent implements OnInit {

  @Input() cita!: Cita;

  @Input() nombreGroomer: string = '';

  /** Si false (lectura desde el expediente) el observador no puede atender. */
  @Input() habilitarAcciones = true;

  notasServicio = '';

  /** Estado local para reflejar iniciar/finalizar sin recargar el padre. */
  estadoActual: Cita['estado'] = 'pendiente';

  mascota: Mascota | null = null;
  venta: Venta | null = null;
  checklist: PasoChecklist[] = [];

  hallazgos = {
    piel: '',
    parasitos: false,
    nudos: false,
    comportamiento: '',
    nota: '',
  };

  guardando = false;

  private esteticaSvc = inject(CitasEsteticaService);
  private citaVentaSvc = inject(CitaVentaService);
  private mascotaSvc = inject(MascotaService);
  private productoSvc = inject(ProductoService);
  private modalCtrl = inject(ModalController);
  private loadingCtrl = inject(LoadingController);
  private alertCtrl = inject(AlertController);
  private util = inject(UtilidadesService);

  ngOnInit() {
    this.estadoActual = this.cita.estado;
    this.notasServicio = this.cita.notasServicio ?? '';
    if (this.cita.hallazgosGroomer) {
      this.hallazgos = { ...this.hallazgos, ...this.cita.hallazgosGroomer };
    }
    this.cargarMascota();
    this.cargarVenta();
    this.cargarChecklist();
  }

  get atendida(): boolean {
    return this.estadoActual === 'finalizada';
  }

  get enProceso(): boolean {
    return this.estadoActual === 'en_proceso';
  }

  get labelServicio(): string {
    return labelTipoServicio(this.cita.tipoServicio ?? '');
  }

  get items(): { nombre: string; cantidad: number; subtotal: number }[] {
    return (this.cita.itemsServicio ?? []).map(i => ({
      nombre: i.nombre,
      cantidad: i.cantidad,
      subtotal: i.subtotal,
    }));
  }

  get totalServicios(): number {
    return (this.cita.itemsServicio ?? []).reduce((acc, i) => acc + i.subtotal, 0);
  }

  get saldoPendiente(): number {
    return this.venta ? saldoVenta(this.venta) : 0;
  }

  get estadoVenta(): string {
    if (!this.venta) return '';
    const map: Record<string, string> = {
      pagado: 'Pagada',
      pendiente: 'Pendiente de cobro',
      anulada: 'Anulada',
    };
    return map[this.venta.estadoPago] ?? this.venta.estadoPago;
  }

  get colorVenta(): string {
    if (!this.venta) return 'medium';
    if (this.venta.estadoPago === 'pagado') return 'success';
    if (this.venta.estadoPago === 'anulada') return 'medium';
    return 'warning';
  }

  get puedeIniciar(): boolean {
    return this.habilitarAcciones && !this.atendida && this.estadoActual === 'pendiente' && !this.guardando;
  }

  get puedeGuardar(): boolean {
    return this.habilitarAcciones && !this.atendida && this.estadoActual !== 'cancelada' && !this.guardando;
  }

  private async cargarMascota() {
    if (!this.cita?.idMascota) return;
    try {
      this.mascota = await this.mascotaSvc.getMascotaOnce(this.cita.idCliente, this.cita.idMascota);
    } catch {
      this.mascota = null;
    }
  }

  private async cargarVenta() {
    if (!this.cita?.idCita) return;
    try {
      this.venta = await this.citaVentaSvc.getVentaPorCitaOnce(this.cita.idCita);
    } catch {
      this.venta = null;
    }
  }

  /** Checklist "qué incluye" a partir del catálogo de los servicios agendados. */
  private async cargarChecklist() {
    const ids = (this.cita.itemsServicio ?? []).map(i => i.idProducto);
    if (!ids.length) return;

    try {
      const productos = await firstValueFrom(this.productoSvc.getTodos());
      const incluidos: string[] = [];
      for (const p of productos.filter(p => ids.includes(p.idProducto))) {
        for (const paso of p.incluye ?? []) {
          if (!incluidos.includes(paso)) incluidos.push(paso);
        }
      }
      const yaMarcados = new Set(this.cita.checklistServicio ?? []);
      this.checklist = incluidos.map(label => ({ label, done: yaMarcados.has(label) }));
    } catch {
      this.checklist = [];
    }
  }

  togglePaso(paso: PasoChecklist) {
    if (!this.puedeGuardar) return;
    paso.done = !paso.done;
  }

  /** Marca el inicio del servicio (pendiente → en proceso). */
  async iniciarServicio() {
    if (!this.puedeIniciar) return;
    try {
      await this.esteticaSvc.iniciarServicio(this.cita.idCita);
      this.estadoActual = 'en_proceso';
      await this.util.showToast('Servicio iniciado', 'success');
    } catch (err) {
      console.error(err);
      await this.util.showToast('Error al iniciar el servicio', 'danger');
    }
  }

  /** Marca el servicio como atendido (no crea RegistroClínico). */
  async guardarServicio() {
    if (!this.puedeGuardar) return;

    const loading = await this.loadingCtrl.create({ message: 'Guardando servicio...' });
    await loading.present();
    this.guardando = true;
    try {
      await this.esteticaSvc.guardarServicio(
        this.cita.idCita,
        this.notasServicio,
        this.checklist.filter(p => p.done).map(p => p.label),
        this.hallazgosLimpios(),
      );
      await loading.dismiss();
      await this.util.showToast('Servicio finalizado correctamente', 'success');
      await this.modalCtrl.dismiss({ guardado: true });
    } catch (err) {
      await loading.dismiss();
      console.error(err);
      await this.util.showToast('Error al guardar el servicio', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  /** Escala a veterinario: crea cita médica vinculada y finaliza la estética. */
  async escalar() {
    if (!this.puedeGuardar) return;

    const alert = await this.alertCtrl.create({
      header: 'Escalar a veterinario',
      subHeader: this.cita.nombreMascota,
      message: `Se creará una cita médica con las notas y hallazgos registrados.`,
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Consulta normal',
          handler: () => { void this.ejecutarEscalado(false); },
        },
        {
          text: 'Urgente',
          cssClass: 'alert-peligro',
          handler: () => { void this.ejecutarEscalado(true); },
        },
      ],
    });
    await alert.present();
  }

  private async ejecutarEscalado(urgente: boolean) {
    const loading = await this.loadingCtrl.create({ message: 'Creando cita médica...' });
    await loading.present();
    this.guardando = true;
    try {
      await this.esteticaSvc.escalarAVeterinario(this.cita, this.notasServicio, urgente, {
        checklist: this.checklist.filter(p => p.done).map(p => p.label),
        hallazgos: this.hallazgosLimpios(),
      });
      await loading.dismiss();
      await this.util.showToast('Cita médica creada y servicio finalizado', 'success');
      await this.modalCtrl.dismiss({ guardado: true });
    } catch (err) {
      await loading.dismiss();
      console.error(err);
      await this.util.showToast('Error al escalar la cita', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  /** Devuelve hallazgos sin campos vacíos para no guardar undefined. */
  private hallazgosLimpios(): Cita['hallazgosGroomer'] {
    const h = this.hallazgos;
    const limpio: Cita['hallazgosGroomer'] = {};
    if (h.piel.trim()) limpio.piel = h.piel.trim();
    if (h.parasitos) limpio.parasitos = true;
    if (h.nudos) limpio.nudos = true;
    if (h.comportamiento.trim()) limpio.comportamiento = h.comportamiento.trim();
    if (h.nota.trim()) limpio.nota = h.nota.trim();
    return limpio;
  }

  cerrar() {
    this.modalCtrl.dismiss({ guardado: false });
  }
}
