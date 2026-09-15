import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { CobranzaPage } from './cobranza.page';

const routes: Routes = [{ path: '', component: CobranzaPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class CobranzaPageRoutingModule {}
