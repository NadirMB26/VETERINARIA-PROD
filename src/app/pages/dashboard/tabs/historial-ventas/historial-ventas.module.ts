import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { SharedModule } from 'src/app/shared/shared.module';
import { HistorialVentasPage } from './historial-ventas.page';
import { HistorialVentasPageRoutingModule } from './historial-ventas-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    HistorialVentasPageRoutingModule
  ],
  declarations: [HistorialVentasPage]
})
export class HistorialVentasPageModule {}
