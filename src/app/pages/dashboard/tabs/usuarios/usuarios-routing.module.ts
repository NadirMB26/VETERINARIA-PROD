import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { UsuariosPage } from './usuarios.page';

const routes: Routes = [
  {
    path: '',
    component: UsuariosPage
  },
  {
    path: 'crear',                         // ✅ /layout/usuarios/crear
    loadChildren: () => import('src/app/pages/register/register.module')
      .then(m => m.RegisterPageModule)     // reutiliza la página que ya tienes
  },
    {
    path: 'editar/:uid/:rol',              // ✅ agregar esto
    loadChildren: () => import('src/app/pages/register/register.module')
      .then(m => m.RegisterPageModule)
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class UsuariosPageRoutingModule {}