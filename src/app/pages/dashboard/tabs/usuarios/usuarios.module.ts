import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { UsuariosPageRoutingModule } from './usuarios-routing.module';

import { UsuariosPage } from './usuarios.page';
import { SharedModule } from 'src/app/shared/shared.module';
import { RegisterPageModule } from 'src/app/pages/register/register.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    UsuariosPageRoutingModule,
    SharedModule,
    RegisterPageModule
  ],
  declarations: [UsuariosPage]
})
export class UsuariosPageModule {}
