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
    path: 'products',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/product-catalog/product-catalog.page').then(
        (m) => m.ProductCatalogPage
      ),
  },
  {
    path: 'products/:productId/modifiers',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/modifiers/modifiers.page').then(
        (m) => m.ModifiersPage
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/settings/settings.page').then(
        (m) => m.SettingsPage
      ),
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
    redirectTo: 'products',
    pathMatch: 'full',
  },
];
