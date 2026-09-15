import { Component, OnInit, inject } from '@angular/core';
import { ConfiguracionAppService } from './core/services/configuracion-app.service';
import { AuthService } from './core/services/auth.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {

  private configSvc = inject(ConfiguracionAppService);
  private authService = inject(AuthService);

  async ngOnInit() {
    // Aplica la configuración en vivo (incluido el login) y la re-aplica al
    // iniciar sesión, aunque la primera lectura ocurra sin autenticación.
    this.configSvc.iniciar();

    // El documento de configuración solo lo puede crear un administrador.
    if (this.authService.getRolActual() === 'administrador') {
      await this.configSvc.inicializarSiNoExiste();
    }
  }
}
