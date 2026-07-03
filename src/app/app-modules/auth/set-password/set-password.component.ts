/*
 * AMRIT – Accessible Medical Records via Integrated Technologies
 * Integrated EHR (Electronic Health Records) Solution
 *
 * Copyright (C) "Piramal Swasthya Management and Research Institute"
 *
 * This file is part of AMRIT.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see https://www.gnu.org/licenses/.
 */

import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideLock } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { cardImports } from '@common-ui/ui/card';
import { ZardInputDirective } from '@common-ui/ui/input';

import { NotificationService } from '@/app-modules/core/services/notification.service';
import { encryptPassword } from '@/app-modules/core/utils/password-crypto';

import { AuthApiService } from '../services/auth-api.service';
import { AuthFlowStore } from '../state/auth-flow.store';
import { PASSWORD_PATTERN } from '../utils/auth-validators';

/**
 * Set-password — faithful port of the old `SetPasswordComponent`. Reached after the
 * reset flow mints a transactionId. Validates the password policy, requires the two
 * fields to match (checked on submit), encrypts, then `setForgetPassword`:
 *  - 200 → "Password changed successfully" → login
 *  - otherwise → error toast → back to `/resetPassword`
 */
@Component({
  selector: 'app-set-password',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    ZardButtonComponent,
    ZardInputDirective,
    ...cardImports,
  ],
  templateUrl: './set-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideLock, lucideEye })],
})
export class SetPasswordComponent {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly flow = inject(AuthFlowStore);
  private readonly notify = inject(NotificationService);

  protected readonly showPassword = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    newpwd: [
      '',
      [
        Validators.required,
        Validators.pattern(PASSWORD_PATTERN),
        Validators.minLength(8),
        Validators.maxLength(12),
      ],
    ],
    confirmpwd: [
      '',
      [
        Validators.required,
        Validators.pattern(PASSWORD_PATTERN),
        Validators.minLength(8),
        Validators.maxLength(12),
      ],
    ],
  });

  protected updatePassword(): void {
    if (this.form.invalid) {
      return;
    }
    const { newpwd, confirmpwd } = this.form.getRawValue();
    if (newpwd !== confirmpwd) {
      this.notify.alert('Password does not match', 'error');
      return;
    }
    const username = this.flow.username() ?? '';
    const transactionId = this.flow.transactionId() ?? '';
    const encrypted = encryptPassword(newpwd);

    this.authApi.setForgetPassword(username, encrypted, transactionId).subscribe({
      next: (res) => {
        if (res?.statusCode === 200) {
          this.notify.alert('Password changed successfully', 'success');
          this.flow.reset();
          this.router.navigate(['']);
        } else {
          this.notify.alert(res?.errorMessage ?? 'Failed to set password', 'error');
          this.router.navigate(['/resetPassword']);
        }
      },
      error: (err: { errorMessage?: string }) => {
        this.notify.alert(err?.errorMessage ?? 'Failed to set password', 'error');
        this.router.navigate(['/resetPassword']);
      },
    });
  }

  protected revealPassword(reveal: boolean): void {
    this.showPassword.set(reveal);
  }
}
