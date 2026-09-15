// citas.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { CitasPageRoutingModule } from './citas-routing.module';
import { CitaPage } from './citas.page'; // ← CitaPage, no CitasPage
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CitasPageRoutingModule,
    SharedModule
  ],
  declarations: [CitaPage] // ← CitaPage
})
export class CitasPageModule {}