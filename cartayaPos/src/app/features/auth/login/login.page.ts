import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { IonButton, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonContent, IonInput, IonItem, IonLabel, IonSpinner, IonText, IonToggle, ToastController } from '@ionic/angular/standalone';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { AuthService } from '../../../core/services/auth.service';
import { apiErrorKey, parseApiError } from '../../../core/utils/api-error';

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
    IonItem,
    IonLabel,
    IonToggle,
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

  showPassword = false;

  /** Translation key of the login error currently shown inline (null = none) */
  readonly errorKey = signal<string | null>(null);

  ngOnInit(): void {
    this.initializeForm();
  }

  /**
   * Ionic keeps the previous page alive in the stack, so make sure the form
   * is always empty when the login page is shown again (e.g. after logout).
   */
  ionViewWillEnter(): void {
    this.resetForm();
  }

  private resetForm(): void {
    this.loginForm?.reset({ email: '', password: '' });
    this.showPassword = false;
    this.errorKey.set(null);
  }

  /**
   * Maps a login failure to a translation key:
   * - status 0 (network failure, CORS rejection) or offline → cannot reach server
   * - otherwise API_ERRORS.<code> from the API error code (INVALID_CREDENTIALS, ...),
   *   falling back to API_ERRORS.UNKNOWN_ERROR
   */
  static errorKeyFor(error: unknown, online: boolean): string {
    const status = error instanceof HttpErrorResponse ? error.status : undefined;
    if (status === 0 || !online) {
      return 'AUTH.ERRORS.SERVER_UNREACHABLE';
    }
    return apiErrorKey(parseApiError(error).code);
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
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

    this.errorKey.set(null);

    this.authService.login(email, password).subscribe({
      next: (): void => {
        this.resetForm();
        this.router.navigate(['/pos-selection'], { replaceUrl: true });
      },
      error: async (error: unknown): Promise<void> => {
        const messageKey = LoginPage.errorKeyFor(error, navigator.onLine);
        this.errorKey.set(messageKey);

        const toast = await this.toastController.create({
          message: this.translate.instant(messageKey),
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
