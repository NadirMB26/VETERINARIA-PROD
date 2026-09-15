/**
 * @description
 * Detalle de mascota (modal) que funciona como EXPEDIENTE ÚNICO (Fase 3):
 *  - Pestañas derivadas del catálogo (Cronología, Consulta y control,
 *    Vacunación, Procedimientos, Emergencias, Estética).
 *  - Cada pestaña muestra listas paginadas de registros; la Cronología
 *    combina registros clínicos y servicios de estética en línea de tiempo.
 *  - El detalle completo abre el modal detalle-registro (ver/PDF/correo/editar).
 *  - Antecedentes médicos editables solo por veterinario (staff).
 */
import { Component, Input, OnInit, OnDestroy, inject } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { map } from 'rxjs/operators';
import { CitaService } from 'src/app/core/services/cita.service';
import { Cita } from 'src/app/core/models/cita.model';
import { Mascota } from 'src/app/core/models/mascota.model';
import { ModalController, ToastController } from '@ionic/angular';
import { RegistroClinicoService } from 'src/app/core/services/registro-clinico.service';
import {
  RegistroClinico,
  CATEGORIAS_CLINICAS,
  CategoriaClinica,
} from 'src/app/core/models/registro-clinico.model';
import { infoTipoCita } from 'src/app/core/models/catalogo-citas.model';
import { MascotaService } from 'src/app/core/services/mascota.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { DetalleRegistroModalComponent } from '../detalle-registro-modal/detalle-registro-modal.component';
import { ServicioEsteticaModalComponent } from '../servicio-estetica-modal/servicio-estetica-modal.component';
import { labelTipoServicio } from 'src/app/core/services/citas-estetica.service';

/** Pestañas del expediente (Fase 3). */
export const PESTANAS_EXPEDIENTE: string[] = [
  'Cronología',
  'Consulta y control',
  'Vacunación',
  'Procedimientos',
  'Emergencias',
  'Estética',
];

/** Pestaña de respaldo cuando un registro no tiene cita vinculada. */
const PESTANA_POR_CATEGORIA: Record<CategoriaClinica, string> = {
  DIAGNOSTICO: 'Consulta y control',
  PREVENTIVO: 'Vacunación',
  CURATIVO: 'Consulta y control',
  QUIRURGICO: 'Procedimientos',
  EMERGENCIA: 'Emergencias',
  ESTETICA: 'Estética',
};

const PAGE_SIZE = 8;

@Component({
  selector: 'app-mascota-detalle',
  templateUrl: './mascota-detalle.component.html',
  styleUrls: ['./mascota-detalle.component.scss'],
  standalone: false
})
export class MascotaDetalleComponent implements OnInit, OnDestroy {

  /** Mascota a mostrar (setter para cargar el expediente automáticamente). */
  @Input() set mascota(m: Mascota | null) {
    this._mascota = m;
    if (m?.idMascota) this.cargarExpediente(m.idMascota);
  }
  get mascota() { return this._mascota; }
  private _mascota: Mascota | null = null;

  /** Modo expediente (desde el tab Historial): oculta CTA de editar/agendar. */
  @Input() modoExpediente = false;

  /** Pestaña inicial al abrir el expediente (deep-link desde agenda/cita). */
  @Input() set pestanaInicial(p: string) {
    this._pestanaInicial = p;
    this.aplicarPestanaInicial();
  }
  get pestanaInicial() { return this._pestanaInicial; }
  private _pestanaInicial = '';

  readonly pestanas = PESTANAS_EXPEDIENTE;

  pestanaActual = 'Cronología';

  citas: Cita[] = [];
  registros: RegistroClinico[] = [];

  private citasPorId: Record<string, Cita> = {};

  /** Página actual por pestaña. */
  private paginas: Record<string, number> = {};

  cargando = true;

  editandoAntecedentes = false;
  antecedentesForm: Record<string, string> = {
    alergias: '', cirugias: '', enfermedadesCr: '', esquemaVacunacion: '', dieta: '',
  };

  antecedentesLabels: Record<string, string> = {
    alergias: 'Alergias',
    cirugias: 'Cirugías',
    enfermedadesCr: 'Enfermedades crónicas',
    esquemaVacunacion: 'Esquema de vacunación',
    dieta: 'Dieta',
  };

  get antecedentesLista(): { key: string; label: string; value: string }[] {
    return Object.entries(this.antecedentesForm).map(([key, value]) => ({
      key,
      label: this.antecedentesLabels[key] ?? key,
      value: value ?? '',
    }));
  }

  rolActual = '';
  puedeEditarAntecedentes = false;

  private subs: Subscription[] = [];

  private citaService = inject(CitaService);
  private registroSvc = inject(RegistroClinicoService);
  private mascotaSvc = inject(MascotaService);
  private authService = inject(AuthService);
  private modalCtrl = inject(ModalController);
  private toastCtrl = inject(ToastController);

  ngOnInit(): void {
    this.rolActual = this.authService.getRolActual() ?? '';

    // Fase 1: antecedentes (resumen vivo) solo los edita el veterinario.
    const esVeterinario = this.rolActual === 'veterinario';
    this.puedeEditarAntecedentes = esVeterinario && this.authService.tienePrivilegio('diagnosticarCitas');
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }

  get verAntecedentes(): boolean {
    return this.rolActual !== 'cliente';
  }

  // ── Carga de datos ──────────────────────────────────────
  private cargarExpediente(idMascota: string) {
    this.cargando = true;

    const citas$ = this.citaService.getCitasPorMascota(idMascota).pipe(
      map(lista => [...lista].sort((a, b) =>
        b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio)
      ))
    );

    this.subs.push(
      citas$.subscribe(lista => {
        this.citas = lista;
        this.citasPorId = {};
        for (const c of lista) this.citasPorId[c.idCita] = c;
        if (this._mascota?.antecedentes) {
          this.antecedentesForm = { ...this.antecedentesForm, ...this._mascota.antecedentes };
        }
        this.cargando = false;
      })
    );

    this.subs.push(
      this.registroSvc.getPorMascota(idMascota).subscribe(registros => {
        this.registros = registros;
      })
    );
  }

  // ── Mapeo registro → pestaña ────────────────────────────
  private citaDeRegistro(r: RegistroClinico): Cita | null {
    return r.idCita ? (this.citasPorId[r.idCita] ?? null) : null;
  }

  pestañaDeRegistro(r: RegistroClinico): string {
    const cita = this.citaDeRegistro(r);
    if (cita) {
      const info = infoTipoCita(cita.tipo);
      if (info?.pestañaExpediente && info.pestañaExpediente !== 'Estética') {
        return info.pestañaExpediente;
      }
    }
    return PESTANA_POR_CATEGORIA[r.categoria] ?? 'Consulta y control';
  }

  // ── Filas por pestaña ───────────────────────────────────
  /** Servicios de estética finalizados (histórico operativo). */
  get serviciosEstetica(): Cita[] {
    return this.citas.filter(c => c.tipo === 'Estética' && c.estado === 'finalizada');
  }

  private registrosDePestana(pestana: string): RegistroClinico[] {
    if (pestana === 'Estética') return [];
    return this.registros.filter(r => this.pestañaDeRegistro(r) === pestana);
  }

  /** Entradas de la Cronología (registros + estética), ordenadas por fecha. */
  get cronologia(): { key: string; fecha: string }[] {
    const items: { key: string; fecha: string }[] = [];
    for (const r of this.registros) {
      const cita = this.citaDeRegistro(r);
      const fecha = cita?.fecha ?? (r.fechaRegistro?.slice(0, 10) ?? '');
      items.push({ key: `reg:${r.idRegistro}`, fecha });
    }
    for (const c of this.serviciosEstetica) {
      items.push({ key: `est:${c.idCita}`, fecha: c.fecha });
    }
    return items
      .filter(i => i.fecha)
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }

  esEntradaRegistro(key: string): boolean {
    return key.startsWith('reg:');
  }

  registroDeEntrada(key: string): RegistroClinico | null {
    return this.registros.find(r => `reg:${r.idRegistro}` === key) ?? null;
  }

  esteticaDeEntrada(key: string): Cita | null {
    const id = key.replace('est:', '');
    return this.serviciosEstetica.find(c => c.idCita === id) ?? null;
  }

  // ── Paginación ──────────────────────────────────────────
  filasPestana(pestana: string): (RegistroClinico | Cita)[] {
    if (pestana === 'Cronología') {
      const out: (RegistroClinico | Cita)[] = [];
      for (const e of this.cronologia) {
        if (e.key.startsWith('reg:')) {
          const r = this.registroDeEntrada(e.key);
          if (r) out.push(r);
        } else {
          const c = this.esteticaDeEntrada(e.key);
          if (c) out.push(c);
        }
      }
      return out;
    }
    if (pestana === 'Estética') return [...this.serviciosEstetica];
    return this.registrosDePestana(pestana);
  }

  totalPestana(pestana: string): number {
    return this.filasPestana(pestana).length;
  }

  private paginaDe(pestana: string): number {
    return this.paginas[pestana] ?? 1;
  }

  paginaActual(pestana: string): number {
    return this.paginaDe(pestana);
  }

  totalPaginas(pestana: string): number {
    return Math.max(1, Math.ceil(this.totalPestana(pestana) / PAGE_SIZE));
  }

  filasVisibles(pestana: string): (RegistroClinico | Cita)[] {
    const p = this.paginaDe(pestana);
    const inicio = (p - 1) * PAGE_SIZE;
    return this.filasPestana(pestana).slice(inicio, inicio + PAGE_SIZE);
  }

  seleccionarPestana(pestana: string) {
    this.pestanaActual = pestana;
    if (!this.paginas[pestana]) this.paginas[pestana] = 1;
  }

  /** Aplica la pestaña inicial solo si existe en el expediente. */
  private aplicarPestanaInicial() {
    if (this._pestanaInicial && this.pestanas.includes(this._pestanaInicial)) {
      this.pestanaActual = this._pestanaInicial;
    }
  }

  irPagina(pestana: string, delta: number) {
    const actual = this.paginaDe(pestana);
    const nueva = Math.min(this.totalPaginas(pestana), Math.max(1, actual + delta));
    this.paginas[pestana] = nueva;
  }

  // ── Acciones por fila ───────────────────────────────────
  esEstetica(fila: RegistroClinico | Cita): boolean {
    return !('idRegistro' in fila);
  }

  async abrirFila(fila: RegistroClinico | Cita) {
    if ('idRegistro' in fila) {
      await this.abrirDetalleRegistro(fila);
    } else {
      await this.abrirServicioEstetica(fila);
    }
  }

  private async abrirDetalleRegistro(r: RegistroClinico) {
    const m = this._mascota;
    const modal = await this.modalCtrl.create({
      component: DetalleRegistroModalComponent,
      componentProps: {
        registro: r,
        cita: this.citaDeRegistro(r),
        mascotaResumen: m
          ? { nombre: m.nombre, especie: m.especie, raza: m.raza, sexo: m.sexo }
          : null,
      },
      breakpoints: [0, 0.9, 1],
      initialBreakpoint: 0.9,
    });
    await modal.present();
  }

  private async abrirServicioEstetica(cita: Cita) {
    const modal = await this.modalCtrl.create({
      component: ServicioEsteticaModalComponent,
      componentProps: {
        cita,
        nombreGroomer: cita.nombreGroomer ?? '',
        // Solo el groomer puede atender/finalizar; el resto ve en lectura.
        habilitarAcciones: this.rolActual === 'groomer',
      },
      breakpoints: [0, 1],
      initialBreakpoint: 1,
      backdropDismiss: false,
    });
    await modal.present();
  }

  // ── Antecedentes ────────────────────────────────────────
  async guardarAntecedentes() {
    if (!this._mascota || !this.puedeEditarAntecedentes) return;
    try {
      await this.mascotaSvc.actualizarMascota(
        this._mascota.idCliente,
        this._mascota.idMascota,
        { antecedentes: this.antecedentesForm }
      );
      this.editandoAntecedentes = false;
      await this.showToast('Antecedentes actualizados', 'success');
    } catch {
      await this.showToast('Error al guardar antecedentes', 'danger');
    }
  }

  // ── Utilidades de UI ────────────────────────────────────
  labelCategoria(categoria: CategoriaClinica): string {
    return CATEGORIAS_CLINICAS[categoria]?.label ?? categoria;
  }

  colorCategoria(categoria: CategoriaClinica): string {
    return CATEGORIAS_CLINICAS[categoria]?.color ?? 'medium';
  }

  tipoDeRegistro(r: RegistroClinico): string {
    return this.citaDeRegistro(r)?.tipo ?? this.labelCategoria(r.categoria);
  }

  /** Devuelve el registro si la fila es clínica (para *ngIf con `as`). */
  filaRegistro(f: RegistroClinico | Cita): RegistroClinico | null {
    return 'idRegistro' in f ? (f as RegistroClinico) : null;
  }

  /** Devuelve la cita si la fila es estética (para *ngIf con `as`). */
  filaEstetica(f: RegistroClinico | Cita): Cita | null {
    return !('idRegistro' in f) ? (f as Cita) : null;
  }

  /** Fecha visible de un registro (fecha de la cita si existe). */
  fechaDeRegistro(r: RegistroClinico): string {
    return this.citaDeRegistro(r)?.fecha ?? (r.fechaRegistro?.slice(0, 10) ?? '');
  }

  labelServicioEstetica(tipo?: string): string {
    return labelTipoServicio(tipo ?? '');
  }

  textoEstado(estado: Cita['estado']): string {
    const map: Record<string, string> = {
      finalizada: 'Finalizada', pendiente: 'Pendiente', cancelada: 'Cancelada',
      no_asistio: 'No asistió', en_proceso: 'En proceso',
    };
    return map[estado] ?? estado;
  }

  onEditar() {
    if (this._mascota) this.modalCtrl.dismiss({ editar: this._mascota });
  }

  onAgendar() {
    if (this._mascota) this.modalCtrl.dismiss({ agendar: this._mascota });
  }

  emojiEspecie(especie: string): string {
    const map: Record<string, string> = {
      perro: '🐕', gato: '🐱', ave: '🦜', reptil: '🦎', otro: '🐾'
    };
    return map[especie?.toLowerCase()] ?? '🐾';
  }

  calcularEdad(fechaNacimiento: string): string {
    if (!fechaNacimiento) return '';
    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad <= 0 ? 'Menos de 1 año' : edad === 1 ? '1 año' : `${edad} años`;
  }

  /** Formatea una fecha tipo YYYY-MM-DD o ISO a formato local corto. */
  formatearDia(fecha: string): string {
    if (!fecha) return '';
    const base = fecha.length === 10 ? `${fecha}T12:00:00` : fecha;
    return new Date(base).toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }

  cerrar() {
    this.modalCtrl.dismiss();
  }

  private async showToast(message: string, color: 'success' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({ message, duration: 2500, color, position: 'bottom' });
    await toast.present();
  }
}
