import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MisComprasPage } from './mis-compras.page';
import { MisComprasPageRoutingModule } from './mis-compras-routing.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MisComprasPageRoutingModule
  ],
  declarations: [MisComprasPage]
})
export class MisComprasPageModule {}
