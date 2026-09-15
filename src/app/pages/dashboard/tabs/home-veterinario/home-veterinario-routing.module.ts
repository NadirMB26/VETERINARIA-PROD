import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { HomeVeterinarioPage } from './home-veterinario.page';

const routes: Routes = [
  {
    path: '',
    component: HomeVeterinarioPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class HomeVeterinarioPageRoutingModule {}
