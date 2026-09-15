import { NgModule } from '@angular/core';
import { PreloadAllModules, RouterModule, Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { registerGuard } from './core/guards/register.guard';
import { registroMascotaGuard } from './core/guards/registro-mascota.guard';

const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  {
    path: 'login',
    loadChildren: () => import('./pages/login/login.module').then(m => m.LoginPageModule)
  },
  {
    path: 'register',
    canActivate: [registerGuard],
    loadChildren: () => import('./pages/register/register.module').then(m => m.RegisterPageModule)
  },
  {
    path: 'layout',
    canActivate: [authGuard],
    loadChildren: () => import('./pages/dashboard/layout.module').then(m => m.LayoutPageModule)
  },
  {
    path: 'register-mascota',
    canActivate: [registroMascotaGuard],
    loadChildren: () => import('./pages/register-mascota/register-mascota.module').then(m => m.RegisterMascotaPageModule)
  },
  { path: '**', redirectTo: 'login' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes, { preloadingStrategy: PreloadAllModules })],
  exports: [RouterModule]
})
export class AppRoutingModule {}
