import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController, LoadingController } from '@ionic/angular';
import { RegistroClinicoService } from 'src/app/core/services/registro-clinico.service';
import { DiagnosticoService } from 'src/app/core/services/diagnostico.service';
import { RegistroClinico, CATEGORIAS_CLINICAS } from 'src/app/core/models/registro-clinico.model';
import { categoriaCitaPorTipo } from 'src/app/core/models/catalogo-citas.model';
import { Cita } from 'src/app/core/models/cita.model';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-diagnostico-modal',
  templateUrl: './diagnostico-modal.component.html',
  styleUrls: ['./diagnostico-modal.component.scss'],
  standalone: false,
})
export class DiagnosticoModalComponent implements OnInit {

  @Input() cita!: Cita;

  @Input() nombreVeterinario: string = '';

  /** Lectura forzada: administrador/recepcionista (o cita finalizada sin registro). */
  @Input() soloLectura: boolean = false;

  private registroSvc = inject(RegistroClinicoService);
  private diagnosticoSvc = inject(DiagnosticoService);
  private modalCtrl = inject(ModalController);
  private loadingCtrl = inject(LoadingController);
  private util = inject(UtilidadesService);
  private auth = inject(AuthService);

  anamnesis = '';

  examenFisico = '';

  diagnostico = '';

  tratamiento = '';

  medicamentos = '';

  observaciones = '';

  motivo = '';

  cargando = true;

  guardando = false;

  /** True cuando la cita ya tiene un registro clínico (corrección con motivo). */
  esEdicion = false;

  /** True cuando el contenido es legado (previo a migración) visible en modo lectura. */
  soloLegado = false;

  /** Registro actual (si existe) sobre el que se aplica la corrección. */
  registroActual: RegistroClinico | null = null;

  get categoriaLabel(): string {
    const c = this.cita.categoria ?? categoriaCitaPorTipo(this.cita.tipo) ?? 'DIAGNOSTICO';
    return CATEGORIAS_CLINICAS[c as keyof typeof CATEGORIAS_CLINICAS]?.label ?? c;
  }

  get categoriaColor(): string {
    const c = this.cita.categoria ?? categoriaCitaPorTipo(this.cita.tipo) ?? 'DIAGNOSTICO';
    return CATEGORIAS_CLINICAS[c as keyof typeof CATEGORIAS_CLINICAS]?.color ?? 'medium';
  }

  /** En edición de un registro existente el motivo es obligatorio. */
  get motivoRequerido(): boolean {
    return this.esEdicion && !this.soloLectura;
  }

  get formularioValido(): boolean {
    if (this.soloLectura) return false;
    if (this.esEdicion) return !!this.motivo.trim();
    return !!(
      this.anamnesis.trim() && this.diagnostico.trim() && this.tratamiento.trim()
    );
  }

  async ngOnInit() {
    const registro = await this.registroSvc.getPorCitaOnce(this.cita.idCita);

    if (registro) {
      this.esEdicion = true;
      this.registroActual = registro;
      this.anamnesis = registro.anamnesis ?? '';
      this.examenFisico = registro.examenFisico ?? '';
      this.diagnostico = registro.diagnostico ?? '';
      this.tratamiento = registro.tratamiento ?? '';
      this.medicamentos = registro.medicamentos ?? '';
      this.observaciones = registro.observaciones ?? '';
    } else {
      // Sin registro aún: si hay diagnóstico legado se precarga como contenido.
      const legado = await this.diagnosticoSvc.getOnce(this.cita.idCita);
      if (legado) {
        this.soloLegado = true;
        this.anamnesis = legado.sintomas ?? '';
        this.diagnostico = legado.diagnostico ?? '';
        this.tratamiento = legado.tratamiento ?? '';
        this.medicamentos = legado.medicamentos ?? '';
        this.observaciones = legado.observaciones ?? '';
        // Una cita ya finalizada no permite crear registros nuevos: solo lectura
        // del contenido legado hasta que la migración lo convierta.
        if (this.cita.estado === 'finalizada') {
          this.soloLectura = true;
        }
      } else if (this.cita.estado === 'finalizada') {
        // Cita finalizada sin ningún contenido clínico: solo lectura.
        this.soloLectura = true;
      }
    }

    this.cargando = false;
  }

  async guardar() {
    if (!this.formularioValido || this.soloLectura || this.guardando) return;

    const loading = await this.loadingCtrl.create({
      message: this.esEdicion ? 'Guardando corrección...' : 'Guardando registro clínico...',
    });
    await loading.present();
    this.guardando = true;

    try {
      const contenido = {
        anamnesis: this.anamnesis.trim(),
        examenFisico: this.examenFisico.trim(),
        diagnostico: this.diagnostico.trim(),
        tratamiento: this.tratamiento.trim(),
        medicamentos: this.medicamentos.trim(),
        observaciones: this.observaciones.trim(),
      };

      if (this.esEdicion && this.registroActual) {
        await this.registroSvc.corregir(
          this.registroActual.idRegistro,
          contenido,
          this.motivo.trim(),
          {
            uid: this.auth.getUidActual() ?? '',
            nombre: this.nombreVeterinario,
          }
        );
      } else {
        await this.registroSvc.crear({
          idCita: this.cita.idCita,
          idMascota: this.cita.idMascota,
          idCliente: this.cita.idCliente,
          categoria: this.cita.categoria
            ?? categoriaCitaPorTipo(this.cita.tipo)
            ?? 'DIAGNOSTICO',
          ...contenido,
          idVeterinario: this.cita.idVeterinario,
          nombreVeterinario: this.nombreVeterinario,
          fechaRegistro: new Date().toISOString(),
        });
      }

      await loading.dismiss();
      await this.util.showToast(
        this.esEdicion ? 'Corrección guardada y auditada' : 'Registro clínico guardado correctamente',
        'success'
      );
      await this.modalCtrl.dismiss({ guardado: true });

    } catch (err) {
      await loading.dismiss();
      console.error(err);
      await this.util.showToast(
        err instanceof Error ? err.message : 'Error al guardar el registro clínico',
        'danger'
      );
    } finally {
      this.guardando = false;
    }
  }

  cerrar() {
    this.modalCtrl.dismiss({ guardado: false });
  }
}
