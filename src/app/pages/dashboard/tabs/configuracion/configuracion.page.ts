import { Component, OnInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, ModalController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { UserService } from 'src/app/core/services/user.service';
import { PerfilUsuario, cedulaValida, soloDigitos } from 'src/app/core/models/usuario.model';
import { ESPECIALIDADES_VETERINARIO, normalizarEspecialidades } from 'src/app/core/models/especialidades.model';
import { AuthService } from 'src/app/core/services/auth.service';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';

@Component({
  selector: 'app-configuracion',
  templateUrl: './configuracion.page.html',
  styleUrls: ['./configuracion.page.scss'],
  standalone: false,
})
export class ConfiguracionPage implements OnInit, OnDestroy {

  cargando = signal(true);
  guardandoPerfil = signal(false);
  guardandoPass = signal(false);
  mostrarPass = signal(false);
  subiendoFoto = signal(false);
  perfilNoEncontrado = signal(false);

  perfil: PerfilUsuario | null = null;
  editNombre = '';
  editApellido = '';
  editTelefono = '';
  editCedula = '';
  editEspecialidad = '';
  editEspecialidades: string[] = [];
  passActual = '';
  passNueva = '';
  passConfirmar = '';

  readonly especialidadesCatalogo = ESPECIALIDADES_VETERINARIO;

  private perfilSub?: Subscription;

  constructor(
    private userSvc: UserService,
    private authSvc: AuthService,
    private util: UtilidadesService,
    private modalCtrl: ModalController,
  ) {}

  async ngOnInit() {
    this.cargando.set(true);
    this.perfilSub = this.userSvc.getPerfilActual().subscribe(p => {
      this.perfil = p;
      this.perfilNoEncontrado.set(!p);
      this.editNombre = p?.Nombre ?? '';
      this.editApellido = p?.Apellido ?? '';
      this.editTelefono = p?.Telefono ?? '';
      this.editCedula = p?.Cedula ?? '';
      this.editEspecialidades = p?.rol === 'veterinario' ? normalizarEspecialidades(p) : [];
      this.editEspecialidad = this.editEspecialidades.join(', ');
      this.cargando.set(false);
    });
  }

  ngOnDestroy(): void {
    this.perfilSub?.unsubscribe();
  }

  get iniciales(): string {
    return `${this.perfil?.Nombre?.[0] ?? ''}${this.perfil?.Apellido?.[0] ?? ''}`.toUpperCase();
  }

  get rolLabel(): string {
    const map: Record<string, string> = {
      administrador: 'Administrador',
      recepcionista: 'Recepcionista',
      veterinario: 'Veterinario',
      groomer: 'Groomer',
      cliente: 'Cliente',
    };
    return map[this.perfil?.rol ?? ''] ?? '';
  }

  get datosModificados(): boolean {
    const espAhora = [...this.editEspecialidades].sort().join('|');
    const espAntes = (this.perfil?.rol === 'veterinario'
      ? normalizarEspecialidades(this.perfil)
      : []).slice().sort().join('|');

    return this.editNombre !== this.perfil?.Nombre ||
      this.editApellido !== this.perfil?.Apellido ||
      this.editTelefono !== this.perfil?.Telefono ||
      this.editCedula !== (this.perfil?.Cedula ?? '') ||
      espAhora !== espAntes;
  }

  /** Marca/desmarca una especialidad del veterinario (selección múltiple). */
  toggleEspecialidad(especialidad: string) {
    const lista = [...this.editEspecialidades];
    const idx = lista.indexOf(especialidad);
    if (idx >= 0) lista.splice(idx, 1);
    else lista.push(especialidad);
    this.editEspecialidades = lista;
    this.editEspecialidad = lista.join(', ');
  }

  /** Filtra el documento: solo dígitos (sin letras/símbolos/negativos), máx 10. */
  onCedulaChange(valor: any) {
    this.editCedula = soloDigitos(valor).substring(0, 10);
  }

  get passValida(): boolean {
    return this.passActual.length >= 6 &&
      this.passNueva.length >= 6 &&
      this.passNueva !== this.passActual &&
      this.passNueva === this.passConfirmar;
  }

  get passNoCoinciden(): boolean {
    return this.passConfirmar.length > 0 && this.passNueva !== this.passConfirmar;
  }

  get passIgualActual(): boolean {
    return this.passNueva.length > 0 && this.passNueva === this.passActual;
  }

  async guardarPerfil() {
    if (!this.datosModificados) return;
    this.guardandoPerfil.set(true);
    try {
      const nombre = (this.editNombre ?? '').trim();
      const apellido = (this.editApellido ?? '').trim();
      if (!nombre || !apellido) {
        await this.util.showToast('Nombre y apellido son obligatorios', 'warning');
        return;
      }

      // Documento obligatorio y válido antes de guardar cualquier cambio.
      const cedula = (this.editCedula ?? '').trim();
      if (!cedula) {
        await this.util.showToast('Tu documento (cédula) es obligatorio', 'warning');
        return;
      }
      if (!cedulaValida(cedula)) {
        await this.util.showToast('La cédula debe tener entre 8 y 10 dígitos', 'warning');
        return;
      }
      if (this.perfil?.rol === 'veterinario' && this.editEspecialidades.length === 0) {
        await this.util.showToast('Selecciona al menos una especialidad', 'warning');
        return;
      }

      const uid = this.authSvc.getUidActual() ?? '';
      if (cedula !== (this.perfil?.Cedula ?? '').trim()) {
        const existe = await this.userSvc.existeCedula(cedula, uid);
        if (existe) {
          await this.util.showToast('Ya existe un usuario con esa cédula', 'warning');
          return;
        }
      }

      const cambios: Partial<PerfilUsuario> = {
        Nombre: nombre,
        Apellido: apellido,
        Telefono: (this.editTelefono ?? '').trim(),
        Cedula: cedula,
      };
      if (this.perfil?.rol === 'veterinario') {
        cambios.Especialidad = this.editEspecialidad;
        cambios.especialidades = [...this.editEspecialidades];
      }

      await this.userSvc.actualizarPerfilActual(cambios);
      await this.util.showToast('Perfil actualizado correctamente', 'success');
    } catch {
      await this.util.showToast('Error al guardar los cambios', 'danger');
    } finally {
      this.guardandoPerfil.set(false);
    }
  }

  async onFotoSeleccionada(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    const tiposValidos = ['image/png', 'image/jpeg', 'image/webp'];
    if (!tiposValidos.includes(file.type)) {
      await this.util.showToast('Solo se permiten imágenes PNG, JPG o WEBP', 'warning');
      return;
    }
    if (file.size > 600 * 1024) {
      await this.util.showToast('La imagen debe pesar menos de 600 KB', 'warning');
      return;
    }

    const uid = this.authSvc.getUidActual();
    if (!uid) return;

    this.subiendoFoto.set(true);
    try {
      const fotoUrl = await this.userSvc.subirImagen(uid, file);
      await this.userSvc.actualizarPerfilActual({ fotoUrl });
      await this.util.showToast('Foto de perfil actualizada', 'success');
    } catch {
      await this.util.showToast('Error al subir la foto', 'danger');
    } finally {
      this.subiendoFoto.set(false);
    }
  }

  async quitarFoto() {
    const uid = this.authSvc.getUidActual();
    if (!uid) return;

    try {
      await this.userSvc.eliminarImagen(uid);
      await this.userSvc.actualizarPerfilActual({ fotoUrl: '' });
      await this.util.showToast('Foto eliminada', 'success');
    } catch {
      await this.util.showToast('Error al quitar la foto', 'danger');
    }
  }

  async cambiarPassword() {
    if (!this.passValida) return;
    this.guardandoPass.set(true);
    try {
      await this.userSvc.cambiarPasswordActual(this.passActual, this.passNueva);
      this.passActual = this.passNueva = this.passConfirmar = '';
      await this.util.showToast('Contraseña actualizada', 'success');
    } catch (err: any) {
      const code = err?.code ?? '';
      const msg = (code === 'auth/wrong-password' || code === 'auth/invalid-credential')
        ? 'La contraseña actual es incorrecta'
        : code === 'auth/weak-password'
          ? 'La nueva contraseña es muy débil'
          : 'No se pudo actualizar la contraseña';
      await this.util.showToast(msg, 'danger');
    } finally {
      this.guardandoPass.set(false);
    }
  }

  cerrarSesion() {
    this.authSvc.logout();
  }
}
