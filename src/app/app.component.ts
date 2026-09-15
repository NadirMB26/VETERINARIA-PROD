import { Component, OnInit } from '@angular/core';
import { ConfiguracionAppService } from './core/services/configuracion-app.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {

  constructor(private configSvc: ConfiguracionAppService) {}

  async ngOnInit() {
    await this.configSvc.inicializarSiNoExiste();
    this.configSvc.getConfiguracion().subscribe(cfg => {
      if (cfg) {
        this.configSvc.aplicarConfiguracion(cfg);
      }
    });
  }
}
