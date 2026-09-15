import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { VentasPage } from './ventas.page';
import { VentasPageRoutingModule } from './ventas-routing.module';
import { SharedModule } from 'src/app/shared/shared.module';
import { ClienteActualPanelComponent } from './components/cliente-actual-panel/cliente-actual-panel.component';
import { VentasSidebarComponent } from './components/ventas-sidebar/ventas-sidebar.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    VentasPageRoutingModule
  ],
  declarations: [VentasPage, ClienteActualPanelComponent, VentasSidebarComponent]
})
export class VentasPageModule {}
