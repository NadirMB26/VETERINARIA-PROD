import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { RegisterMascotaPageRoutingModule } from './register-mascota-routing.module';

import { RegisterMascotaPage } from './register-mascota.page';

@NgModule({
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    IonicModule,
    RegisterMascotaPageRoutingModule
  ],
  declarations: [RegisterMascotaPage],
  exports: [RegisterMascotaPage], 
})
export class RegisterMascotaPageModule {}
