import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { BannersPage } from './banners.page';
import { BannersPageRoutingModule } from './banners-routing.module';
import { SharedModule } from 'src/app/shared/shared.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    BannersPageRoutingModule
  ],
  declarations: [BannersPage]
})
export class BannersPageModule {}
