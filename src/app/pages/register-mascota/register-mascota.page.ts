import { Component, Input, OnInit } from '@angular/core';  // ← agrega Input
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ModalController, PopoverController, ToastController } from '@ionic/angular';  // ← agrega ModalController
import { Auth } from '@angular/fire/auth';
import { inject } from '@angular/core';

import { MascotaService } from 'src/app/core/services/mascota.service';
import { Mascota } from 'src/app/core/models/mascota.model';
import { UserService } from 'src/app/core/services/user.service';
import { AuthService } from 'src/app/core/services/auth.service';

@Component({
  selector: 'app-register-mascota',
  templateUrl: './register-mascota.page.html',
  styleUrls: ['./register-mascota.page.scss'],
  standalone: false,
})
export class RegisterMascotaPage implements OnInit {

  // ── Inputs desde el modal ──────────────────────────────
  @Input() modo: 'crear' | 'editar' = 'crear';
  @Input() mascotaId?: string;
  @Input() clienteId?: string;

  idClienteEdit = '';
  form!: FormGroup;
  formSubmitted = false;
  guardando     = false;
  modoEdicion   = false;
  idMascotaEdit = '';

  fotoPreview = '';
  archivoImagen?: File;
  imagenQuitada = false;

  razasDisponibles: string[] = [];
  cargandoRazas             = false;
  clienteSeleccionado: any   = null;

  readonly especies = ['perro', 'gato', 'ave', 'reptil', 'otro'];
  readonly hoySimple = new Date().toISOString().split('T')[0];
  private auth = inject(Auth);
  private authSvc = inject(AuthService);

  esCliente = false;

  modalFechaAbierto = false;
  private fechaTemporal: string = '';

  constructor(
    private fb:          FormBuilder,
    private route:       ActivatedRoute,
    private router:      Router,
    private mascotaSvc:  MascotaService,
    private userSvc:     UserService,
    private popoverCtrl: PopoverController,
    private toastCtrl:   ToastController,
    private modalCtrl:   ModalController,   // ← agrega esto
  ) {}

  async ngOnInit() {
    this.construirFormulario();

    const rol = this.authSvc.getRolActual();
    this.esCliente = rol === 'cliente';

    // ── Cliente: solo puede operar sus propias mascotas ──
    if (this.esCliente && this.modo === 'crear') {
      const uid = this.authSvc.getUidActual() ?? '';
      this.clienteSeleccionado = {
        uid,
        idCliente: uid,
        Nombre: 'Mi cuenta',
        Apellido: '',
        Correo: '',
      };
    }

    // ── Si viene como modal, usa los @Input directamente ──
    if (this.modo === 'editar' && this.mascotaId) {
      this.modoEdicion   = true;
      this.idMascotaEdit = this.mascotaId;
      this.idClienteEdit = this.clienteId ?? '';
      if (this.esCliente && this.idClienteEdit !== this.authSvc.getUidActual()) {
        this.mostrarToast('No tienes permiso para editar esta mascota', 'danger');
        this.cerrarModal(false);
        return;
      }
      await this.cargarMascota(this.mascotaId);
      return;
    }

    // ── Fallback: si se abre por ruta (queryParams) ────────
    this.route.queryParams.subscribe(async params => {
      if (params['modo'] === 'editar' && params['id']) {
        if (this.esCliente && params['idCliente'] !== this.authSvc.getUidActual()) {
          this.mostrarToast('No tienes permiso para editar esta mascota', 'danger');
          this.cerrarModal(false);
          return;
        }
        this.modoEdicion   = true;
        this.idMascotaEdit = params['id'];
        this.idClienteEdit = params['idCliente'];
        await this.cargarMascota(params['id']);
      } else {
        this.modoEdicion = false;
      }
    });
  }

  // ── Cierra el modal con resultado ─────────────────────────
  cerrarModal(guardado = false) {
    this.modalCtrl.dismiss({ guardado });
  }

  private construirFormulario() {
    this.form = this.fb.group({
      nombre:          ['', Validators.required],
      especie:         ['', Validators.required],
      raza:            ['', Validators.required],
      sexo:            ['macho', Validators.required],
      fechaNacimiento: ['', Validators.required],
      color:           [''],
      peso:            [null, [Validators.required, Validators.min(0)]],
    });
  }

  get fc() { return this.form.controls; }

  private async cargarMascota(id: string) {
    const mascota = await this.mascotaSvc.getMascotaOnce(this.idClienteEdit, id);
    if (!mascota) return;

    this.form.patchValue({
      nombre:          mascota.nombre,
      especie:         mascota.especie,
      raza:            mascota.raza,
      sexo:            mascota.sexo,
      fechaNacimiento: mascota.fechaNacimiento,
      color:           mascota.color,
      peso:            mascota.peso,
    });
    this.fotoPreview = mascota.fotoUrl ?? '';

    await this.cargarRazas(mascota.especie);

    const { firstValueFrom } = await import('rxjs');
    const clientes = await firstValueFrom(this.userSvc.getTodosLosUsuarios());
    this.clienteSeleccionado = clientes.find(
      c => c.idCliente === mascota.idCliente || c.uid === mascota.idCliente
    ) ?? null;
  }

  async onEspecieChange() {
    const especie = this.fc['especie'].value;
    this.fc['raza'].reset();
    this.razasDisponibles = [];
    if (!especie) return;
    await this.cargarRazas(especie);
  }

  private async cargarRazas(especie: string) {
    this.cargandoRazas = true;
    this.razasDisponibles = await this.mascotaSvc.getRazasPorEspecie(especie);
    this.cargandoRazas = false;
  }

  async abrirSelectorCliente(event: Event) {
    if (this.esCliente) return;

    const { ClienteSelectorComponent } = await import(
      'src/app/shared/components/cliente-selector/cliente-selector.component'
    );

    const popover = await this.popoverCtrl.create({
      component: ClienteSelectorComponent,
      event,
      translucent: true,
      cssClass: 'cliente-selector-popover',
    });

    await popover.present();

    const { data } = await popover.onWillDismiss();
    if (data?.cliente) {
      this.clienteSeleccionado = data.cliente;
    }
  }

  async guardar() {
    this.formSubmitted = true;

    const clienteRequerido = !this.modoEdicion && !this.clienteSeleccionado;
    if (this.form.invalid || clienteRequerido) return;

    this.guardando = true;

    const idCliente = this.modoEdicion
      ? this.idClienteEdit
      : (this.clienteSeleccionado.idCliente ?? this.clienteSeleccionado.uid);

    const datos: Omit<Mascota, 'idMascota'> = {
      idCliente,
      nombre:          this.fc['nombre'].value,
      especie:         this.fc['especie'].value,
      raza:            this.fc['raza'].value,
      sexo:            this.fc['sexo'].value,
      fechaNacimiento: this.fc['fechaNacimiento'].value,
      color:           this.fc['color'].value ?? '',
      peso:            this.fc['peso'].value,
      estado:          'activo',
      fechaRegistro:   new Date().toISOString(),
    };

    try {
      if (this.modoEdicion) {
        const cambios: Partial<Mascota> = { ...datos };
        if (this.archivoImagen) {
          const url = await this.mascotaSvc.subirImagen(this.idClienteEdit, this.idMascotaEdit, this.archivoImagen);
          cambios.fotoUrl = url;
        } else if (this.imagenQuitada) {
          cambios.fotoUrl = '';
          await this.mascotaSvc.eliminarImagen(this.idClienteEdit, this.idMascotaEdit);
        }
        await this.mascotaSvc.actualizarMascota(this.idClienteEdit, this.idMascotaEdit, cambios);
        this.mostrarToast('Mascota actualizada correctamente', 'success');
      } else {
        const idMascota = await this.mascotaSvc.registrarMascota(datos);
        if (this.archivoImagen) {
          const url = await this.mascotaSvc.subirImagen(idCliente, idMascota, this.archivoImagen);
          await this.mascotaSvc.actualizarMascota(idCliente, idMascota, { fotoUrl: url });
        }
        this.mostrarToast('Mascota registrada correctamente', 'success');
      }
      this.cerrarModal(true);   // ← reemplaza router.navigate
    } catch {
      this.mostrarToast('Error al guardar la mascota', 'danger');
    } finally {
      this.guardando = false;
    }
  }

  async onImagenSeleccionado(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;

    const permitidos = ['image/png', 'image/jpeg', 'image/webp'];
    if (!permitidos.includes(file.type)) {
      this.mostrarToast('Solo se permiten imágenes (PNG, JPG, WEBP)', 'danger');
      return;
    }
    if (file.size > 500 * 1024) {
      this.mostrarToast('La imagen no puede superar 500 KB', 'danger');
      return;
    }

    try {
      this.fotoPreview = await this.fileToBase64(file);
      this.archivoImagen = file;
      this.imagenQuitada = false;
    } catch {
      this.mostrarToast('No se pudo leer la imagen', 'danger');
    }
  }

  quitarImagen() {
    this.fotoPreview = '';
    this.archivoImagen = undefined;
    this.imagenQuitada = true;
  }

  private fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  private async mostrarToast(
    message: string,
    color: 'success' | 'danger' | 'warning' = 'success'
  ) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2500,
      color,
      position: 'bottom',
      buttons: [{ icon: 'close-outline', role: 'cancel' }],
    });
    await toast.present();
  }

  onFechaNativaChange(event: any) {
    const fecha = event.target.value ?? '';
    if (fecha) {
      this.fc['fechaNacimiento'].setValue(fecha);
      this.fc['fechaNacimiento'].markAsDirty();
      this.fc['fechaNacimiento'].markAsTouched();
    }
  }
}