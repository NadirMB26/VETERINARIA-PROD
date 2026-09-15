import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { DashboardKpiCardComponent } from './dashboard-kpi-card/dashboard-kpi-card.component';
import { DashboardChartCardComponent } from './dashboard-chart-card/dashboard-chart-card.component';
import { DashboardCalendarComponent } from './dashboard-calendar/dashboard-calendar.component';

@NgModule({
  declarations: [
    DashboardKpiCardComponent,
    DashboardChartCardComponent,
    DashboardCalendarComponent,
  ],
  imports: [CommonModule, IonicModule],
  exports: [
    DashboardKpiCardComponent,
    DashboardChartCardComponent,
    DashboardCalendarComponent,
  ]
})
export class DashboardWidgetsModule {}
