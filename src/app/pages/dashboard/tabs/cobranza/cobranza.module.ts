import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CobranzaPage } from './cobranza.page';
import { CobranzaPageRoutingModule } from './cobranza-routing.module';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    CobranzaPageRoutingModule
  ],
  declarations: [CobranzaPage]
})
export class CobranzaPageModule {}
