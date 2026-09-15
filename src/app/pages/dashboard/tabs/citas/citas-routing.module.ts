// citas-routing.module.ts
import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { CitaPage } from './citas.page'; // ← CitaPage

const routes: Routes = [
  { path: '', component: CitaPage } // ← CitaPage
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class CitasPageRoutingModule {}