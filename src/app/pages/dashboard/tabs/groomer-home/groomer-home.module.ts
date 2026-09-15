import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { GroomerHomePageRoutingModule } from './groomer-home-routing.module';
import { GroomerHomePage } from './groomer-home.page';
import { SharedModule } from '../../../../shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonicModule,
    GroomerHomePageRoutingModule,
    SharedModule,
  ],
  declarations: [GroomerHomePage]
})
export class GroomerHomePageModule {}
