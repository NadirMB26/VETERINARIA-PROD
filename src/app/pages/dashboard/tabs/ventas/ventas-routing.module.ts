import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { VentasPage } from './ventas.page';

const routes: Routes = [{ path: '', component: VentasPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class VentasPageRoutingModule {}
