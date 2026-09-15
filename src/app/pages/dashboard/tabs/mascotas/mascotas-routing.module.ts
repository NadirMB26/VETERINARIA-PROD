import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { MascotasPage } from './mascotas.page';

const routes: Routes = [
  {
    path: '',
    component: MascotasPage
  },
  {
    path: 'register-mascota',              // ✅ misma ruta para crear y editar
    loadChildren: () => import('src/app/pages/register-mascota/register-mascota.module')
      .then(m => m.RegisterMascotaPageModule)
  }
];
@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class MascotasPageRoutingModule {}