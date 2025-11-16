import { CommonModule } from '@angular/common';
import { Component, inject, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonInput, IonSpinner, IonText, ToastController } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslateModule,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardContent,
    IonInput,
    IonButton,
    IonSpinner,
    IonText,
  ],
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
})
export class LoginPage implements OnInit {
  private authService = inject(AuthService);
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);
  private toastController = inject(ToastController);
  private translate = inject(TranslateService);

  loginForm!: FormGroup;

  ngOnInit(): void {
    this.initializeForm();
  }

  private initializeForm(): void {
    this.loginForm = this.formBuilder.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
    });
  }

  async onLogin(): Promise<void> {
    if (this.loginForm.invalid) {
      const message = this.translate.instant('AUTH.LOGIN.VALIDATION.FILL_ALL_FIELDS');
      const toast = await this.toastController.create({
        message,
        duration: 2000,
        position: 'bottom',
        color: 'warning',
      });
      await toast.present();
      return;
    }

    const { email, password } = this.loginForm.value;

    this.authService.login(email, password).subscribe({
      next: (): void => {
        this.router.navigate(['/pos-selection']);
      },
      error: async (error: unknown): Promise<void> => {
        let messageKey = 'AUTH.ERRORS.LOGIN_FAILED';
        if (error instanceof Object && 'status' in error && error.status === 401) {
          messageKey = 'AUTH.ERRORS.INVALID_CREDENTIALS';
        } else if (!navigator.onLine) {
          messageKey = 'AUTH.ERRORS.NO_INTERNET';
        }

        const message = this.translate.instant(messageKey);
        const toast = await this.toastController.create({
          message,
          duration: 3000,
          position: 'bottom',
          color: 'danger',
        });
        await toast.present();
      },
    });
  }

  get isLoading(): boolean {
    return this.authService.isLoading();
  }

  get email() {
    return this.loginForm.get('email');
  }

  get password() {
    return this.loginForm.get('password');
  }
}
