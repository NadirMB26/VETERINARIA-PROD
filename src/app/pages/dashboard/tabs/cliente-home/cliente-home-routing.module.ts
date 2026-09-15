import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { ClienteHomePage} from './cliente-home.page';

const routes: Routes = [
  {
    path: '',
    component: ClienteHomePage
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ClienteHomePageRoutingModule {}
