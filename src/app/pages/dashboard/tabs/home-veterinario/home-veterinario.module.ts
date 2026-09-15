// home-veterinario.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';

import { HomeVeterinarioPageRoutingModule } from './home-veterinario-routing.module';
import { HomeVeterinarioPage } from './home-veterinario.page';
import { SharedModule } from '../../../../shared/shared.module';   // ← para CalendarGridComponent, routerLink, async pipe y outputs personalizados

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    IonicModule,
    HomeVeterinarioPageRoutingModule,
    SharedModule,   // ← esto resuelve CalendarGrid, routerLink, async pipe y los outputs
  ],
  declarations: [HomeVeterinarioPage]
})
export class HomeVeterinarioPageModule {}