import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AuthService } from '../../../../core/services/auth.service';
import { MascotaService } from '../../../../core/services/mascota.service';
import { Mascota } from '../../../../core/models/mascota.model';
import { CitaService } from '../../../../core/services/cita.service';
import { Cita } from '../../../../core/models/cita.model';
import { UserService } from '../../../../core/services/user.service';
import { UtilidadesService } from '../../../../core/services/utilidades.service';

@Component({
  selector: 'app-cliente-home',
  templateUrl: './cliente-home.page.html',
  styleUrls: ['./cliente-home.page.scss'],
  standalone: false
})
export class ClienteHomePage implements OnInit {

  private authService = inject(AuthService);
  private mascotaService = inject(MascotaService);
  private citaService = inject(CitaService);
  private userService = inject(UserService);
  private router = inject(Router);
  private util = inject(UtilidadesService);

  nombreCliente = '';
  uid = '';
  mascotas$: Observable<Mascota[]> | null = null;
  ultimasCitas$: Observable<Cita[]> | null = null;
  mascotaSeleccionada: Mascota | null = null;

  ngOnInit(): void {
    this.uid = this.authService.getUidActual() ?? '';

    this.userService.getDocumentOnce('clientes', this.uid).then((data) => {
      if (data) this.nombreCliente = data['Nombre'] ?? '';
    });

    this.mascotas$ = this.mascotaService.getMascotasPorCliente(this.uid);

    this.ultimasCitas$ = this.citaService.getPorCliente(this.uid).pipe(
      map((citas) =>
        citas
          .sort((a, b) => b.fechaRegistro.localeCompare(a.fechaRegistro))
          .slice(0, 3)
      )
    );
  }

  agregarMascota(): void {
    this.router.navigate(['/layout/mascotas/register-mascota']);
  }

  calcularEdad(fechaNacimiento: string): string {
    return this.util.calcularEdadTexto(fechaNacimiento);
  }

  emojiEspecie(especie: string): string {
    return this.util.getEmojiEspecie(especie);
  }

  badgeClass(estado: Cita['estado']): string {
    return this.util.getBadgeClassEstado(estado);
  }

  estadoTexto(estado: Cita['estado']): string {
    return this.util.textoEstado(estado);
  }

  formatearFecha(iso: string): string {
    return this.util.formatearFecha(iso);
  }

  verDetalleMascota(mascota: Mascota) {
    this.mascotaSeleccionada = mascota;
  }
}
