interface Cliente {
  idCliente: string;
  Nombre: string;
  Apellido: string;
  Correo: string;
  estado: string;
}

import { Component, Input, OnInit, inject } from '@angular/core';
import { ModalController, LoadingController } from '@ionic/angular';
import { Firestore, collection, collectionData } from '@angular/fire/firestore';
import { MascotaService } from 'src/app/core/services/mascota.service';
import { RegistroClinicoService } from 'src/app/core/services/registro-clinico.service';
import { Mascota } from 'src/app/core/models/mascota.model';
import { map } from 'rxjs';
import { UtilidadesService } from 'src/app/core/services/utilidades.service';

@Component({
  selector: 'app-migrar-mascota',
  templateUrl: './migrar-mascota.component.html',
  standalone: false,
  styleUrls: ['./migrar-mascota.component.scss']
})
export class MigrarMascotaComponent implements OnInit {

  @Input() mascota!: Mascota;

  @Input() nombrePropietarioActual = '';

  private firestore = inject(Firestore);
  private mascotaSvc = inject(MascotaService);
  private registroSvc = inject(RegistroClinicoService);
  private modalCtrl = inject(ModalController);
  private loadingCtrl = inject(LoadingController);
  private util = inject(UtilidadesService);

  clientes: Cliente[] = [];

  clientesFiltrados: Cliente[] = [];

  clienteSeleccionado: Cliente | null = null;

  terminoBusqueda = '';

  async ngOnInit() {
    collectionData(
      collection(this.firestore, 'clientes'),
      { idField: 'idCliente' }
    ).pipe(
      map((lista: any[]) =>
        lista.filter(c =>
          c.estado === 'activo' &&
          c.idCliente !== this.mascota.idCliente
        )
      )
    ).subscribe(clientes => {
      this.clientes = clientes;
      this.clientesFiltrados = clientes;
    });
  }

  filtrar(evento: Event) {
    const q = (evento.target as HTMLInputElement).value.toLowerCase();
    this.terminoBusqueda = q;
    this.clientesFiltrados = this.clientes.filter(c =>
      `${c.Nombre} ${c.Apellido}`.toLowerCase().includes(q) ||
      c.Correo.toLowerCase().includes(q)
    );
  }

  seleccionar(cliente: Cliente) {
    this.clienteSeleccionado =
      this.clienteSeleccionado?.idCliente === cliente.idCliente ? null : cliente;
  }

  iniciales(cliente: Cliente): string {
    return `${cliente.Nombre[0]}${cliente.Apellido[0]}`.toUpperCase();
  }

  async migrar() {
    if (!this.clienteSeleccionado) return;

    const loading = await this.loadingCtrl.create({ message: 'Migrando mascota...' });
    await loading.present();

    try {
      const datosMigrados: Mascota = {
        ...this.mascota,
        idCliente: this.clienteSeleccionado.idCliente,
        idClienteAnterior: this.mascota.idCliente,
        fechaMigracion: new Date().toISOString(),
      };

      await this.mascotaSvc.registrarMascota(datosMigrados);

      // El historial (registros clínicos, citas y diagnósticos) sigue a la
      // mascota, no al dueño: se traslada al nuevo propietario.
      await this.registroSvc.trasladarHistorial(
        this.mascota.idMascota,
        this.clienteSeleccionado.idCliente
      );

      await this.mascotaSvc.eliminarMascota(
        this.mascota.idCliente,
        this.mascota.idMascota
      );

      await loading.dismiss();
      await this.util.showToast(`${this.mascota.nombre} migrada correctamente`, 'success');
      await this.modalCtrl.dismiss({ migrado: true });

    } catch (error) {
      await loading.dismiss();
      await this.util.showToast('Error al migrar la mascota', 'danger');
      console.error('Error en migración:', error);
    }
  }

  cerrar() {
    this.modalCtrl.dismiss({ migrado: false });
  }
}
