import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { ClienteHomePageRoutingModule } from './cliente-home-routing.module';

import { ClienteHomePage } from './cliente-home.page';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    ClienteHomePageRoutingModule,
    SharedModule
  ],
  declarations: [ClienteHomePage]
})
export class ClienteHomePageModule {}
