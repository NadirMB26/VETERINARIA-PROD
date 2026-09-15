import { Component, OnDestroy, OnInit } from '@angular/core';
import { Platform } from '@ionic/angular';
import { AuthService } from 'src/app/core/services/auth.service';
import { NavigationService, ItemNavegacion } from 'src/app/core/services/navigation.service';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

@Component({
  selector: 'app-tab-bar',
  templateUrl: './tab-bar.component.html',
  styleUrls: ['./tab-bar.component.scss'],
  standalone: false
})
export class TabBarComponent implements OnInit, OnDestroy {

  tabs: ItemNavegacion[] = [];

  rol: string = '';

  esAndroid: boolean = false;

  private destroy$ = new Subject<void>();

  constructor(
    private authService: AuthService,
    private navigationSvc: NavigationService,
    private platform: Platform
  ) {}

  ngOnInit() {
    this.esAndroid = this.platform.is('android');

    if (!this.esAndroid) return;

    this.rol = this.authService.getRolActual() ?? '';

    this.authService.privilegios$
      .pipe(takeUntil(this.destroy$))
      .subscribe(privilegios => {
        this.tabs = this.navigationSvc.construirTabs(this.rol, privilegios);
      });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
