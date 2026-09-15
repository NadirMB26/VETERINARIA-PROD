import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MisComprasPage } from './mis-compras.page';

const routes: Routes = [{ path: '', component: MisComprasPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class MisComprasPageRoutingModule {}
