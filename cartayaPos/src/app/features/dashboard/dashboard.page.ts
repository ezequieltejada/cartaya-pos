import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
    IonButton,
    IonCard,
    IonCardContent,
    IonCardHeader,
    IonCardTitle,
    IonContent,
    IonHeader,
    IonIcon,
    IonTitle,
    IonToolbar,
} from '@ionic/angular/standalone';
import { AuthService } from '../../core/services/auth.service';
import { PosService } from '../../core/services/pos.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonButton,
    IonIcon,
  ],
  templateUrl: './dashboard.page.html',
  styleUrls: ['./dashboard.page.scss'],
})
export class DashboardPage implements OnInit {
  private authService = inject(AuthService);
  private posService = inject(PosService);
  private router = inject(Router);

  ngOnInit(): void {
    // Verify we have both user and PoS selected
    if (!this.currentUser || !this.selectedPos) {
      this.router.navigate(['/auth/login']);
    }
  }

  async onLogout(): Promise<void> {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/auth/login']);
      },
    });
  }

  navigateToProducts(): void {
    this.router.navigate(['/products']);
  }

  get currentUser() {
    return this.authService.getCurrentUser();
  }

  get selectedPos() {
    return this.posService.getSelectedPos();
  }

  get isLoading(): boolean {
    return this.authService.isLoading();
  }
}
