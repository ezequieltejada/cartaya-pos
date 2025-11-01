import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'auth',
    children: [
      {
        path: 'login',
        loadComponent: () =>
          import('./features/auth/login/login.page').then((m) => m.LoginPage),
      },
    ],
  },
  {
    path: 'pos-selection',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/pos-selection/pos-selection.page').then(
        (m) => m.PosSelectionPage
      ),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard.page').then((m) => m.DashboardPage),
  },
  {
    path: 'home',
    loadComponent: () => import('./home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'printer-test',
    loadComponent: () =>
      import('./printer-test/printer-test.component').then(
        (m) => m.PrinterTestComponent
      ),
  },
  {
    path: '',
    redirectTo: 'dashboard',
    pathMatch: 'full',
  },
];
