import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MascotasPageRoutingModule } from './mascotas-routing.module';
import { MascotasPage } from './mascotas.page';
import { SharedModule } from 'src/app/shared/shared.module';
import { RegisterMascotaPageModule } from 'src/app/pages/register-mascota/register-mascota.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MascotasPageRoutingModule,
    SharedModule,
    RegisterMascotaPageModule
  ],
  declarations: [MascotasPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class MascotasPageModule {}