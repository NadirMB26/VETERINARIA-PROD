import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { RegisterMascotaPage } from './register-mascota.page';

const routes: Routes = [
  {
    path: '',
    component: RegisterMascotaPage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class RegisterMascotaPageRoutingModule {}
