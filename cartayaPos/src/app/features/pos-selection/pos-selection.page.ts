import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
    IonButton,
    IonContent,
    IonHeader,
    IonItem,
    IonLabel,
    IonList,
    IonRadio,
    IonRadioGroup,
    IonSpinner,
    IonText,
    IonTitle,
    IonToolbar,
} from '@ionic/angular/standalone';
import { Pos } from '../../core/models/pos.model';
import { AuthService } from '../../core/services/auth.service';
import { PosService } from '../../core/services/pos.service';

@Component({
  selector: 'app-pos-selection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    IonContent,
    IonHeader,
    IonTitle,
    IonToolbar,
    IonList,
    IonItem,
    IonLabel,
    IonRadio,
    IonRadioGroup,
    IonButton,
    IonSpinner,
    IonText,
  ],
  templateUrl: './pos-selection.page.html',
  styleUrls: ['./pos-selection.page.scss'],
})
export class PosSelectionPage implements OnInit {
  private authService = inject(AuthService);
  private posService = inject(PosService);
  private router = inject(Router);

  selectedPosId: string | undefined;

  ngOnInit(): void {
    this.loadAvailablePos();
  }

  private loadAvailablePos(): void {
    const currentUser = this.authService.getCurrentUser();
    if (!currentUser) {
      this.router.navigate(['/auth/login']);
      return;
    }

    // Fetch available PoS locations for the current tenant
    // The tenant ID is automatically retrieved from TenantService
    this.posService.fetchAvailablePos().subscribe({
      next: () => {
        // Available PoS are updated in the signal
      },
      error: () => {
        // Error is handled in the service
      },
    });
  }

  async onContinue(): Promise<void> {
    if (!this.selectedPosId) {
      return;
    }

    const posList = this.availablePos;
    const selected = posList.find((pos) => pos.id === this.selectedPosId);

    if (selected) {
      await this.posService.selectPos(selected);
      this.router.navigate(['/dashboard']);
    }
  }

  get availablePos(): Pos[] {
    return this.posService.availablePos();
  }

  get isLoading(): boolean {
    return this.posService.isLoading();
  }

  get hasNoPosAvailable(): boolean {
    return !this.isLoading && this.availablePos.length === 0;
  }
}
