import { Component, Input, OnInit } from '@angular/core';  // ← agrega Input
import { Router, ActivatedRoute } from '@angular/router';
import { ModalController, ToastController } from '@ionic/angular';  // ← agrega ModalController
import { Functions, httpsCallable } from '@angular/fire/functions';
import { UserService } from 'src/app/core/services/user.service';
import { AuthService } from 'src/app/core/services/auth.service';
import { cedulaValida } from 'src/app/core/models/usuario.model';
import {
  ESPECIALIDADES_VETERINARIO,
  normalizarEspecialidades,
} from 'src/app/core/models/especialidades.model';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false
})
export class RegisterPage implements OnInit {

  // ── Inputs desde el modal ──────────────────
  @Input() modoEdicionInput: boolean = false;
  @Input() uidEditarInput: string = '';
  @Input() rolInput: string = '';

  role: string = 'cliente';
  rolActual: string = '';
  registrando: boolean = false;
  guardando: boolean = false;
  mostrarPassword: boolean = false;
  cargando: boolean = false;

  modoEdicion: boolean = false;
  uidEditar: string = '';

  /** Nueva contraseña opcional (solo admin, modo edición) — se aplica vía Cloud Function. */
  nuevaPassword: string = '';

  user: any = {
    Nombre: '', Apellido: '', Telefono: '',
    Correo: '', Contrasena: '', Cedula: '',
    Especialidad: '', especialidades: [], estado: 'activo', idAdministrador: ''
  };

  readonly especialidadesCatalogo = ESPECIALIDADES_VETERINARIO;

  constructor(
    private userService: UserService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private toastCtrl: ToastController,
    private modalCtrl: ModalController,  // ← agrega esto
    private functions: Functions,
  ) {}

  async ngOnInit() {
    this.rolActual = this.authService.getRolActual() ?? '';
    this.user.idAdministrador = this.authService.getUidActual() ?? '';

    // ── Defensa en profundidad: solo staff autorizado ──
    if (this.rolActual && this.rolActual !== 'administrador' && this.rolActual !== 'recepcionista') {
      await this.mostrarToast('No tienes permiso para gestionar usuarios', 'danger');
      this.cerrarModal(false);
      return;
    }
    if (this.rolActual === 'recepcionista') {
      const p = this.authService.privilegios$.getValue() ?? {};
      if (!p['crearUsuarios'] && !p['editarUsuarios']) {
        await this.mostrarToast('No tienes permiso para gestionar usuarios', 'danger');
        this.cerrarModal(false);
        return;
      }
    }

    // ── Si viene como modal ──────────────────
    if (this.modoEdicionInput && this.uidEditarInput) {
      this.modoEdicion = true;
      this.uidEditar   = this.uidEditarInput;
      this.role        = this.rolInput;
      this.cargando    = true;

      const coleccion = this.userService.getColeccionPorRol(this.role);
      const datos     = await this.userService.getDocumentOnce(coleccion, this.uidEditar);
      if (datos) {
        this.user = { ...this.user, ...datos };
        // Normaliza la especialidad (texto libre viejo → selección múltiple).
        if (this.role === 'veterinario') {
          this.user.especialidades = normalizarEspecialidades(datos);
          this.user.Especialidad = this.user.especialidades.join(', ');
        }
      }

      this.cargando = false;
      return;
    }

    // ── Fallback: si se abre por ruta ────────
    const uid = this.route.snapshot.paramMap.get('uid');
    const rol = this.route.snapshot.paramMap.get('rol');

    if (uid && rol) {
      this.modoEdicion = true;
      this.uidEditar   = uid;
      this.role        = rol;
      this.cargando    = true;

      const coleccion = this.userService.getColeccionPorRol(rol);
      const datos     = await this.userService.getDocumentOnce(coleccion, uid);
      if (datos) {
        this.user = { ...this.user, ...datos };
        if (rol === 'veterinario') {
          this.user.especialidades = normalizarEspecialidades(datos);
          this.user.Especialidad = this.user.especialidades.join(', ');
        }
      }

      this.cargando = false;
    } else {
      if (this.rolActual === 'recepcionista') this.role = 'cliente';
    }
  }

  cerrarModal(guardado = false) {
    this.modalCtrl.dismiss({ guardado });
  }

  getRoleIcon(): string {
    const icons: any = {
      administrador: 'shield-checkmark-outline',
      recepcionista: 'headset-outline',
      veterinario:   'medkit-outline',
      groomer:       'cut-outline',
      cliente:       'person-add-outline'
    };
    return icons[this.role] || 'person-add-outline';
  }

  getRoleLabel(): string {
    const labels: any = {
      administrador: 'Administrador',
      recepcionista: 'Recepcionista',
      veterinario:   'Veterinario',
      groomer:       'Groomer',
      cliente:       'Cliente'
    };
    return labels[this.role] || 'Usuario';
  }

  /** Marca/desmarca una especialidad del veterinario (selección múltiple). */
  toggleEspecialidad(especialidad: string) {
    const lista: string[] = [...(this.user.especialidades ?? [])];
    const idx = lista.indexOf(especialidad);
    if (idx >= 0) lista.splice(idx, 1);
    else lista.push(especialidad);
    this.user.especialidades = lista;
    // Sincroniza el texto legado (mostrado en vistas antiguas).
    this.user.Especialidad = lista.join(', ');
  }

  async submit() {
    if (this.modoEdicion) {
      await this.guardarEdicion();
    } else {
      await this.register();
    }
  }

async guardarEdicion() {

  if (this.rolActual === 'recepcionista') {
    const p = this.authService.privilegios$.getValue() ?? {};
    if (p['editarUsuarios'] !== true) {
      await this.mostrarToast('No tienes permiso para editar usuarios', 'warning');
      return;
    }
  }

  // Defensa en profundidad: un administrador no edita la cuenta de otro.
  if (this.role === 'administrador' && this.uidEditar !== this.authService.getUidActual()) {
    await this.mostrarToast('No puedes editar la cuenta de otro administrador', 'warning');
    return;
  }

  this.guardando = true;

  try {

    const coleccion =
      this.userService.getColeccionPorRol(this.role);

    // Datos originales
    const datosOriginales =
      await this.userService.getDocumentOnce(
        coleccion,
        this.uidEditar
      );

    // ── Validaciones ──
    const telefonoValido = await this.validarTelefono();
    if (!telefonoValido) {
      this.guardando = false;
      return;
    }

    // El correo solo lo puede cambiar un administrador (Auth y Firestore deben
    // quedar sincronizados); para el resto se ignora cualquier edición.
    const puedeCambiarCorreo = this.rolActual === 'administrador';
    const correoCambio = puedeCambiarCorreo && (this.user.Correo ?? '') !== (datosOriginales?.Correo ?? '');
    if (correoCambio) {
      const correoValido = await this.validarCorreo();
      if (!correoValido) {
        this.guardando = false;
        return;
      }
    }

    // Documento (cédula): obligatoria para TODOS los roles, con formato válido
    // y única (excluyendo al propio usuario al editar).
    const cedula = (this.user.Cedula ?? '').trim();
    if (!cedula) {
      await this.mostrarToast('La cédula/documento es obligatorio', 'warning');
      this.guardando = false;
      return;
    }
    if (!cedulaValida(cedula)) {
      await this.mostrarToast('La cédula debe tener entre 8 y 10 dígitos', 'warning');
      this.guardando = false;
      return;
    }
    const cedulaExiste = await this.userService.existeCedula(cedula, this.uidEditar);
    if (cedulaExiste) {
      await this.mostrarToast('Ya existe un usuario registrado con esa cédula', 'warning');
      this.guardando = false;
      return;
    }

    // ── Cambios de perfil ──
    const cambios: any = {
      Nombre: this.user.Nombre,
      Apellido: this.user.Apellido,
      Telefono: this.user.Telefono,
      Cedula: cedula,
    };
    if (puedeCambiarCorreo) cambios['Correo'] = this.user.Correo;

    if (this.role === 'veterinario') {
      if (!this.user.especialidades?.length) {
        await this.mostrarToast('Selecciona al menos una especialidad', 'warning');
        this.guardando = false;
        return;
      }
      cambios['Especialidad'] = this.user.Especialidad;
      cambios['especialidades'] = [...this.user.especialidades];
    }

    // ✅ Verificar si hubo cambios
    const espAntes = this.role === 'veterinario'
      ? JSON.stringify([...normalizarEspecialidades(datosOriginales)].sort())
      : '';
    const espAhora = this.role === 'veterinario'
      ? JSON.stringify([...(this.user.especialidades ?? [])].sort())
      : '';
    const sinCambios =
      cambios.Nombre === datosOriginales?.Nombre &&
      cambios.Apellido === datosOriginales?.Apellido &&
      cambios.Telefono === datosOriginales?.Telefono &&
      (!puedeCambiarCorreo || cambios.Correo === datosOriginales?.Correo) &&
      cambios.Cedula === datosOriginales?.Cedula &&
      (
        this.role !== 'veterinario' ||
        (cambios.Especialidad === datosOriginales?.Especialidad && espAntes === espAhora)
      );

    if (sinCambios && !this.nuevaPassword) {
      await this.mostrarToast('No se realizaron cambios.', 'warning');
      this.guardando = false;
      return;
    }

    // ── Credenciales (solo admin): correo y/o contraseña vía Cloud Function ──
    let credencialesActualizadas = false;
    if (this.rolActual === 'administrador' && (correoCambio || this.nuevaPassword)) {
      const actualizarCredenciales = httpsCallable(this.functions, 'actualizarCredenciales');
      await actualizarCredenciales({
        uid: this.uidEditar,
        ...(correoCambio ? { email: this.user.Correo } : {}),
        ...(this.nuevaPassword ? { password: this.nuevaPassword } : {}),
      });
      credencialesActualizadas = true;
    }

    // ✅ Guardar perfil
    try {
      await this.userService.actualizarUsuario(
        coleccion,
        this.uidEditar,
        cambios
      );
    } catch (errPerfil) {
      if (credencialesActualizadas) {
        await this.mostrarToast(
          'Las credenciales se actualizaron, pero no se pudo guardar el perfil. Revisa los datos del usuario.',
          'danger'
        );
        return;
      }
      throw errPerfil;
    }

    this.nuevaPassword = '';

    await this.mostrarToast('Cambios guardados correctamente', 'success');

    this.cerrarModal(true);

  } catch (err: any) {

    await this.mostrarToast(
      this.mapearErrorCredenciales(err),
      'danger'
    );

  } finally {

    this.guardando = false;

  }
}

/** Traduce los errores de la Cloud Function / Auth a mensajes claros. */
private mapearErrorCredenciales(err: any): string {
  const code = err?.code ?? '';
  if (code === 'functions/already-exists') return 'Ese correo ya está en uso por otro usuario';
  if (code === 'functions/invalid-argument') {
    const msg = err?.message ?? '';
    return msg.includes('contraseña') ? msg : 'Datos de credenciales inválidos';
  }
  if (code === 'functions/permission-denied' || code === 'functions/unauthenticated') {
    return 'No tienes permiso para cambiar credenciales';
  }
  if (code === 'functions/internal' && err?.message?.includes('already')) {
    return 'Ese correo ya está en uso por otro usuario';
  }
  return err?.message || 'Error al guardar cambios';
}

  async register() {
    if (this.registrando) return;

    const primerAdmin = !this.authService.estaLogueado();

    if (this.rolActual === 'recepcionista') {
      const p = this.authService.privilegios$.getValue() ?? {};
      if (p['crearUsuarios'] !== true) {
        await this.mostrarToast('No tienes permiso para crear usuarios', 'warning');
        return;
      }
    }

    if (!this.user.Nombre || !this.user.Apellido || !this.user.Correo || !this.user.Contrasena) {
      await this.mostrarToast('Por favor completa todos los campos obligatorios.', 'warning');
      return;
    }

    // Documento (cédula): obligatorio para TODOS los roles (incl. clientes).
    const cedula = (this.user.Cedula ?? '').trim();
    if (!cedula) {
      await this.mostrarToast('La cédula/documento es obligatorio.', 'warning');
      return;
    }
    if (!cedulaValida(cedula)) {
      await this.mostrarToast('La cédula debe tener entre 8 y 10 dígitos.', 'warning');
      return;
    }
    // Especialidades: selección múltiple obligatoria para veterinarios.
    if (this.role === 'veterinario' && !this.user.especialidades?.length) {
      await this.mostrarToast('Selecciona al menos una especialidad.', 'warning');
      return;
    }

    this.registrando = true;
    try {
      const cedulaExiste = await this.userService.existeCedula(cedula);
      if (cedulaExiste) {
        await this.mostrarToast('Ya existe un usuario registrado con esa cédula.', 'warning');
        this.registrando = false;
        return;
      }
        // Validar teléfono
    const telefonoValido = await this.validarTelefono();

    if (!telefonoValido) {
      this.registrando = false;
      return;
    }

    const correoValido = await this.validarCorreo();

    if (!correoValido) {
      this.registrando = false;
      return;
    }
      switch (this.role) {
        case 'administrador': await this.userService.registerAdministrador(this.user); break;
        case 'cliente':       await this.userService.registerCliente(this.user);       break;
        case 'recepcionista': await this.userService.registerRecepcionista(this.user); break;
        case 'veterinario':   await this.userService.registerVeterinario(this.user);   break;
        case 'groomer':       await this.userService.registerGroomer(this.user);       break;
      }
      await this.mostrarToast(`${this.getRoleLabel()} registrado correctamente`, 'success');
      this.cerrarModal(true);

      // Bootstrap del primer administrador: deja la sesión iniciada y entra al sistema.
      if (primerAdmin) {
        await this.authService.login(this.user.Correo, this.user.Contrasena);
      }
        } catch (err: any) {

      if (err?.code === 'auth/email-already-in-use') {

        await this.mostrarToast(
          'Ese correo ya está registrado.',
          'warning'
        );

      } else {

        await this.mostrarToast(
          err?.message || 'Error al registrar usuario',
          'danger'
        );

      }

    } finally {
      this.registrando = false;
    }
  }

  private async mostrarToast(message: string, color: 'success' | 'danger' | 'warning' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
      icon: color === 'success' ? 'checkmark-circle-outline' :
            color === 'warning' ? 'alert-outline' : 'close-circle-outline'
    });
    await toast.present();
  }

async soloNumerosCedula(event: any) {

  let valor = event.target.value ?? '';

  // Detectar si escribió caracteres no numéricos
  const teniaInvalidos = /[^0-9]/g.test(valor);

  // Limpiar: solo dígitos (bloquea letras, símbolos y negativos)
  valor = valor.replace(/[^0-9]/g, '');

  // Máximo 10 dígitos
  valor = valor.substring(0, 10);

  this.user.Cedula = valor;

  // Mostrar aviso
  if (teniaInvalidos) {
    await this.mostrarToast(
      'El documento solo puede contener números.',
      'warning'
    );
  }
}

async soloNumerosTelefono(event: any) {

  let valor = event.target.value;

  // Detectar si escribió letras
  const teniaLetras = /[^0-9]/g.test(valor);

  // Limpiar caracteres no válidos
  valor = valor.replace(/[^0-9]/g, '');

  // Máximo 15 caracteres
  valor = valor.substring(0, 15);

  this.user.Telefono = valor;

  // Mostrar aviso
  if (teniaLetras) {
    await this.mostrarToast(
      'El teléfono solo puede contener números.',
      'warning'
    );
  }
}

private async validarTelefono(): Promise<boolean> {

  if (!this.user.Telefono) {
    return true;
  }

  if (!/^[0-9]+$/.test(this.user.Telefono)) {

    await this.mostrarToast(
      'El teléfono solo puede contener números.',
      'warning'
    );

    return false;
  }

  if (
    this.user.Telefono.length < 7 ||
    this.user.Telefono.length > 15
  ) {

    await this.mostrarToast(
      'El teléfono debe tener entre 7 y 15 números.',
      'warning'
    );

    return false;
  }

  return true;
}

async soloLetras(event: any, campo: 'Nombre' | 'Apellido') {

  let valor = event.target.value;

  // Detectar caracteres inválidos
  const teniaInvalidos = /[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g.test(valor);

  // Limpiar todo excepto letras y espacios
  valor = valor.replace(/[^a-zA-ZáéíóúÁÉÍÓÚñÑ\s]/g, '');

  // Evitar espacios dobles
  valor = valor.replace(/\s+/g, ' ');

  // Actualizar modelo
  this.user[campo] = valor;

  // Mostrar aviso
  if (teniaInvalidos) {
    await this.mostrarToast(
      `${campo} solo puede contener letras.`,
      'warning'
    );
  }
} 

private async validarCorreo(): Promise<boolean> {

  if (!this.correoValido(this.user.Correo)) {

    await this.mostrarToast(
      'El correo parece estar mal escrito o tiene un dominio no válido.',
      'warning'
    );

    return false;
  }

  return true;
}

private correoValido(correo: string): boolean {

  const regex =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return regex.test(correo.toLowerCase());
}

}