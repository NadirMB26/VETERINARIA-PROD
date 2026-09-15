import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { ConfiguracionAppPage } from './configuracion-app.page';

const routes: Routes = [{ path: '', component: ConfiguracionAppPage }];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class ConfiguracionAppPageRoutingModule {}
