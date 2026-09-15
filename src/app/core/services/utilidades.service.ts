import { Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable({ providedIn: 'root' })
export class UtilidadesService {

  private toastCtrl = inject(ToastController);

  // ── Toast ────────────────────────────────────────────────────────────────
  async showToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success'
  ): Promise<void> {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
      buttons: [{ icon: 'close-outline', role: 'cancel' }],
    });
    await toast.present();
  }

  // ── Horas ────────────────────────────────────────────────────────────────
  toMinutos(hora: string): number {
    const [h, m] = hora.split(':').map(Number);
    return h * 60 + m;
  }

  sumarMinutos(hora: string, mins: number): string {
    const total = this.toMinutos(hora) + mins;
    return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
  }

  formatHora12(hora: string): string {
    if (!hora) return '';
    const [h, m] = hora.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0
      ? `${h12} ${ampm}`
      : `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
  }

  formatHora12Compact(hora: string): string {
    if (!hora) return '';
    const [h, m] = hora.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return m === 0 ? `${h12}${ampm}` : `${h12}:${String(m).padStart(2, '0')}${ampm}`;
  }

  // ── Mascotas ─────────────────────────────────────────────────────────────
  calcularEdad(fechaNacimiento: string): number {
    if (!fechaNacimiento) return 0;
    const hoy = new Date();
    const nac = new Date(fechaNacimiento);
    let edad = hoy.getFullYear() - nac.getFullYear();
    const m = hoy.getMonth() - nac.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nac.getDate())) edad--;
    return edad;
  }

  calcularEdadTexto(fechaNacimiento: string): string {
    const edad = this.calcularEdad(fechaNacimiento);
    if (edad <= 0) return 'Menos de 1 año';
    return edad === 1 ? '1 año' : `${edad} años`;
  }

  getIconoEspecie(especie: string): string {
    const iconos: Record<string, string> = {
      perro: 'paw-outline',
      gato: 'fish-outline',
      ave: 'bug-outline',
      reptil: 'leaf-outline',
      otro: 'ellipse-outline',
    };
    return iconos[especie?.toLowerCase()] ?? 'paw-outline';
  }

  getEmojiEspecie(especie: string): string {
    const map: Record<string, string> = {
      perro: '🐕', gato: '🐱', ave: '🦜', reptil: '🦎', otro: '🐾',
    };
    return map[especie?.toLowerCase()] ?? '🐾';
  }

  // ── Badges / Estados ─────────────────────────────────────────────────────
  getBadgeColorRol(rol: string): string {
    const map: Record<string, string> = {
      administrador: 'success',
      veterinario: 'primary',
      recepcionista: 'warning',
      groomer: 'tertiary',
      cliente: 'medium',
    };
    return map[rol] || 'medium';
  }

  getBadgeColorEstado(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'warning',
      en_proceso: 'primary',
      finalizada: 'medium',
      cancelada: 'danger',
      no_asistio: 'dark',
    };
    return map[estado] ?? 'medium';
  }

  textoEstado(estado: string): string {
    const map: Record<string, string> = {
      pendiente: 'Pendiente',
      confirmada: 'Confirmada',
      en_proceso: 'En proceso',
      finalizada: 'Finalizada',
      cancelada: 'Cancelada',
      no_asistio: 'No asistió',
    };
    return map[estado] ?? estado;
  }

  getClaseTipo(tipo: string): string {
    const map: Record<string, string> = {
      'Consulta general': 'cita-consulta',
      'Vacunación': 'cita-vacuna',
      'Cirugía': 'cita-cirugia',
      'Urgencia': 'cita-urgencia',
      'Control': 'cita-control',
      'Otro': 'cita-control',
    };
    return map[tipo] ?? 'cita-control';
  }

  getBadgeClassEstado(estado: string): string {
    return `badge badge--${estado}`;
  }

  // ── Filtrado de mascotas ──────────────────────────────────────────────────
  filtrarMascotas(
    mascotas: any[],
    texto: string,
    filtroEspecie: string,
    getNombreCliente: (id: string) => string
  ): any[] {
    const busqueda = texto.toLowerCase().trim();
    return mascotas.filter(m => {
      const nombreCliente = getNombreCliente(m.idCliente).toLowerCase();
      const coincideTexto = !busqueda
        || m.nombre?.toLowerCase().includes(busqueda)
        || m.raza?.toLowerCase().includes(busqueda)
        || m.especie?.toLowerCase().includes(busqueda)
        || m.color?.toLowerCase().includes(busqueda)
        || nombreCliente.includes(busqueda);
      const coincideEspecie = filtroEspecie === 'todos'
        || m.especie?.toLowerCase() === filtroEspecie;
      return coincideTexto && coincideEspecie;
    });
  }

  actualizarEspecies(lista: any[]): string[] {
    const set = new Set(lista.map(m => m.especie?.toLowerCase()).filter(Boolean));
    return Array.from(set).sort();
  }

  // ── Formateo de fechas ───────────────────────────────────────────────────
  formatearFecha(iso: string): string {
    if (!iso) return '';
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  }
}
