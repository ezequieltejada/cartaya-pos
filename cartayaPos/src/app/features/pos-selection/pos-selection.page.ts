import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import {
    IonButton,
    IonContent,
    IonRadio,
    IonRadioGroup,
    IonSpinner,
} from '@ionic/angular/standalone';
import { TranslateModule } from '@ngx-translate/core';
import { Pos } from '../../core/models/pos.model';
import { AuthService } from '../../core/services/auth.service';
import { PosService } from '../../core/services/pos.service';

@Component({
  selector: 'app-pos-selection',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslateModule,
    IonContent,
    IonRadio,
    IonRadioGroup,
    IonButton,
    IonSpinner,
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
      this.router.navigate(['/auth/login'], { replaceUrl: true });
      return;
    }

    // Fetch available PoS locations for the current tenant
    // The tenant ID is automatically retrieved from TenantService
    this.posService.fetchAvailablePos().subscribe({
      next: () => {
        void this.applyInitialSelection();
      },
      error: () => {
        // Error is handled in the service
      },
    });
  }

  private async applyInitialSelection(): Promise<void> {
    const posList = this.availablePos;
    if (posList.length === 0) {
      return;
    }

    await this.posService.restoreSelectedPos();
    const savedPos = this.posService.getSelectedPos();

    if (savedPos && posList.some((pos) => pos.id === savedPos.id)) {
      this.selectedPosId = savedPos.id;
    } else {
      this.selectedPosId = posList[0].id;
    }
  }

  async onContinue(): Promise<void> {
    if (!this.selectedPosId) {
      return;
    }

    const posList = this.availablePos;
    const selected = posList.find((pos) => pos.id === this.selectedPosId);

    if (selected) {
      await this.posService.selectPos(selected);
      this.router.navigate(['/products'], { replaceUrl: true });
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
