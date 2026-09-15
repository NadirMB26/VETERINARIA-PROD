import { NgModule, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Routes } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { LayoutPage } from './layout.page';
import { SharedModule } from 'src/app/shared/shared.module';
import { rolGuard } from 'src/app/core/guards/rol.guard';

const routes: Routes = [
  {
    path: '',
    component: LayoutPage,
    children: [
      {
        path: 'dashboard',
        canActivate: [rolGuard(['administrador', 'recepcionista'])],
        loadChildren: () => import('./tabs/home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'cliente-home',
        canActivate: [rolGuard(['cliente'])],
        loadChildren: () => import('./tabs/cliente-home/cliente-home.module').then(m => m.ClienteHomePageModule)
      },
      {
        path: 'veterinario-home',
        canActivate: [rolGuard(['veterinario'])],
        loadChildren: () => import('./tabs/home-veterinario/home-veterinario.module').then(m => m.HomeVeterinarioPageModule)
      },
      {
        path: 'groomer-home',
        canActivate: [rolGuard(['groomer'])],
        loadChildren: () => import('./tabs/groomer-home/groomer-home.module').then(m => m.GroomerHomePageModule)
      },
      {
        path: 'usuarios',
        canActivate: [rolGuard(['administrador', 'recepcionista'])],
        loadChildren: () => import('./tabs/usuarios/usuarios.module').then(m => m.UsuariosPageModule)
      },
      {
        path: 'mascotas',
        canActivate: [rolGuard(['administrador', 'recepcionista', 'veterinario'])],
        loadChildren: () => import('./tabs/mascotas/mascotas.module').then(m => m.MascotasPageModule)
      },
      {
        path: 'citas',
        canActivate: [rolGuard(['administrador', 'recepcionista', 'veterinario'])],
        loadChildren: () => import('./tabs/citas/citas.module').then(m => m.CitasPageModule)
      },
      {
        // Fase 3: el expediente vive en Mascotas → Detalle Mascota.
        // Las URLs antiguas de Historial Clínico redirigen a la lista de mascotas.
        path: 'historial',
        redirectTo: 'mascotas',
        pathMatch: 'full'
      },
      {
        path: 'configuracion',
        canActivate: [rolGuard(['administrador', 'recepcionista', 'veterinario', 'groomer', 'cliente'])],
        loadChildren: () => import('./tabs/configuracion/configuracion.module').then(m => m.ConfiguracionPageModule)
      },
      {
        path: 'configuracion-app',
        canActivate: [rolGuard(['administrador'])],
        loadChildren: () => import('./tabs/configuracion-app/configuracion-app.module').then(m => m.ConfiguracionAppPageModule)
      },
      {
        path: 'ventas',
        canActivate: [rolGuard(['administrador', 'recepcionista'])],
        loadChildren: () => import('./tabs/ventas/ventas.module').then(m => m.VentasPageModule)
      },
      {
        path: 'productos',
        data: { tipo: 'producto' },
        canActivate: [rolGuard(['administrador', 'recepcionista'])],
        loadChildren: () => import('./tabs/catalogos/catalogo.module').then(m => m.CatalogoPageModule)
      },
      {
        path: 'servicios',
        data: { tipo: 'servicio' },
        canActivate: [rolGuard(['administrador', 'recepcionista'])],
        loadChildren: () => import('./tabs/catalogos/catalogo.module').then(m => m.CatalogoPageModule)
      },
      {
        path: 'banners',
        canActivate: [rolGuard(['administrador'])],
        loadChildren: () => import('./tabs/banners/banners.module').then(m => m.BannersPageModule)
      },
      {
        path: 'historial-ventas',
        canActivate: [rolGuard(['administrador', 'recepcionista'])],
        loadChildren: () => import('./tabs/historial-ventas/historial-ventas.module').then(m => m.HistorialVentasPageModule)
      },
      {
        path: 'cobranza',
        canActivate: [rolGuard(['administrador', 'recepcionista'])],
        loadChildren: () => import('./tabs/cobranza/cobranza.module').then(m => m.CobranzaPageModule)
      },
      {
        path: 'mis-compras',
        canActivate: [rolGuard(['cliente'])],
        loadChildren: () => import('./tabs/mis-compras/mis-compras.module').then(m => m.MisComprasPageModule)
      },
      {
        path: 'reportes',
        canActivate: [rolGuard(['administrador'])],
        loadChildren: () => import('./tabs/reportes/reportes.module').then(m => m.ReportesPageModule)
      },
      {
        path: 'editar/:uid/:rol',
        canActivate: [rolGuard(['administrador', 'recepcionista'])],
        loadChildren: () => import('src/app/pages/register/register.module').then(m => m.RegisterPageModule)
      },
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' }
    ]
  }
];

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    SharedModule,
    RouterModule.forChild(routes)
  ],
  declarations: [LayoutPage],
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class LayoutPageModule {}
