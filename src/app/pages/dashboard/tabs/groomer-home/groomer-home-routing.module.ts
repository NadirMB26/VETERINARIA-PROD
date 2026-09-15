import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';

import { GroomerHomePage } from './groomer-home.page';

const routes: Routes = [
  {
    path: '',
    component: GroomerHomePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class GroomerHomePageRoutingModule {}
