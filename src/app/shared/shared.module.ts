import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { IonicModule } from '@ionic/angular';
import { TabBarComponent } from './components/tab-bar/tab-bar.component';
import { SideMenuComponent } from './components/side-menu/side-menu.component';
import { DashboardHeaderComponent } from './components/dashboard-header/dashboard-header.component';
import { PrivilegiosModalComponent } from './components/privilegios-modal/privilegios-modal.component';
import { FormsModule, ReactiveFormsModule } from '@angular/forms'; 
import { ClienteSelectorComponent } from './components/cliente-selector/cliente-selector.component';
import { MigrarMascotaComponent } from './components/migrar-mascota/migrar-mascota.component';
import { ReasignarVeterinarioComponent } from './components/reasignar-veterinario/reasignar-veterinario.component';
import { CalendarGridComponent } from './components/calendar-grid/calendar-grid.component';
import { MascotaDetalleComponent } from './components/mascota-detalle/mascota-detalle.component';
import { DiagnosticoModalComponent } from './components/diagnostico-modal/diagnostico-modal.component';
import { CitasSlotPopoverComponent } from './components/citas-slot-popover/citas-slot-popover.component';
import { HorarioVeterinarioComponent } from './components/horario-veterinario/horario-veterinario.component';
import { ProductoModalComponent } from './components/producto-modal/producto-modal.component';
import { AbonoModalComponent } from './components/abono-modal/abono-modal.component';
import { AjusteSaldoModalComponent } from './components/ajuste-saldo-modal/ajuste-saldo-modal.component';
import { VentaDetalleModalComponent } from './components/venta-detalle-modal/venta-detalle-modal.component';
import { NotificacionesPanelComponent } from './components/notificaciones-panel/notificaciones-panel.component';
import { HeroBannerComponent } from './components/hero-banner/hero-banner.component';
import { CountdownComponent } from './components/countdown/countdown.component';
import { BannerFormModalComponent } from './components/banner-form-modal/banner-form-modal.component';
import { ProductCardComponent } from './components/product-card/product-card.component';
import { ColorWheelPickerComponent } from './components/color-wheel-picker/color-wheel-picker.component';
import { FontPickerComponent } from './components/font-picker/font-picker.component';
import { ServicioEsteticaModalComponent } from './components/servicio-estetica-modal/servicio-estetica-modal.component';
import { DetalleRegistroModalComponent } from './components/detalle-registro-modal/detalle-registro-modal.component';
import { ConfirmacionVentaModalComponent } from './components/confirmacion-venta-modal/confirmacion-venta-modal.component';
import { AlertaEscaladoComponent } from './components/alerta-escalado/alerta-escalado.component';
import { HistoricoEsteticaMiniComponent } from './components/historico-estetica-mini/historico-estetica-mini.component';

@NgModule({
  declarations: [TabBarComponent, SideMenuComponent, DashboardHeaderComponent, PrivilegiosModalComponent, 
    ClienteSelectorComponent, MigrarMascotaComponent, ReasignarVeterinarioComponent, 
    CalendarGridComponent, MascotaDetalleComponent, DiagnosticoModalComponent, CitasSlotPopoverComponent, HorarioVeterinarioComponent, ProductoModalComponent, AbonoModalComponent, AjusteSaldoModalComponent, VentaDetalleModalComponent, NotificacionesPanelComponent, HeroBannerComponent, CountdownComponent, BannerFormModalComponent,     ProductCardComponent, ColorWheelPickerComponent, FontPickerComponent, ServicioEsteticaModalComponent, DetalleRegistroModalComponent, ConfirmacionVentaModalComponent, AlertaEscaladoComponent, HistoricoEsteticaMiniComponent],

  imports: [CommonModule, IonicModule, RouterModule, FormsModule, ReactiveFormsModule], 

  exports: [TabBarComponent, SideMenuComponent, DashboardHeaderComponent, PrivilegiosModalComponent, 
    ClienteSelectorComponent, ReactiveFormsModule, FormsModule, MigrarMascotaComponent, ReasignarVeterinarioComponent,
     CalendarGridComponent, MascotaDetalleComponent, DiagnosticoModalComponent, CitasSlotPopoverComponent, HorarioVeterinarioComponent, ProductoModalComponent, AbonoModalComponent, AjusteSaldoModalComponent, VentaDetalleModalComponent, NotificacionesPanelComponent, HeroBannerComponent, CountdownComponent, BannerFormModalComponent, ProductCardComponent, ColorWheelPickerComponent, FontPickerComponent, ServicioEsteticaModalComponent, DetalleRegistroModalComponent, ConfirmacionVentaModalComponent, AlertaEscaladoComponent, HistoricoEsteticaMiniComponent]  
})
export class SharedModule {}

