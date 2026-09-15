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

import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';

import { ConfigApiService } from './config-api.service';
import { AuthService } from '@/app-modules/core/auth/auth.service';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Force Logout (supervisor page 23). A single username field → confirmation → POST
 * `user/forceLogout`. The old app had NO logged-in-user list (free-text entry only); a
 * non-"success" response is a silent no-op, kept faithful.
 */
@Component({
  selector: 'app-force-logout',
  imports: [ReactiveFormsModule, TranslatePipe, ZardButtonComponent, ZardInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex max-w-md flex-col gap-4">
      <h2 class="text-base font-semibold">{{ 'forceLogout' | t }}</h2>
      <p class="text-sm text-muted-foreground">
        Enter the username of the user to be logged out of all sessions.
      </p>
      <form class="flex flex-col gap-3" [formGroup]="form">
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'userName' | t }} <span class="text-destructive">*</span></span>
          <input z-input formControlName="userName" [placeholder]="'username' | t" />
          @if (form.controls.userName.touched && form.controls.userName.errors?.['required']) {
            <span class="text-destructive">{{ 'userNameRequired' | t }}</span>
          }
        </label>
        <div>
          <button z-button type="button" [zDisabled]="form.invalid || busy()" (click)="kickout()">
            {{ 'kickout' | t }}
          </button>
        </div>
      </form>
    </div>
  `,
})
export class ForceLogoutComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ConfigApiService);
  private readonly notify = inject(NotificationService);
  private readonly lang = inject(LanguageStore);
  private readonly sessionStore = inject(SessionStore);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly busy = signal(false);
  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  protected readonly form = this.fb.group({
    // Required only — old had no length rule (a 2-char username like "co" is valid).
    userName: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  protected kickout(): void {
    const serviceId = this.serviceId();
    const userName = this.form.controls.userName.value;
    if (serviceId == null || this.form.invalid) {
      return;
    }
    this.notify.confirm(`${this.lang.t('doYouReallyWantToKickout')} ${userName}?`).subscribe((ok) => {
      if (!ok) {
        return;
      }
      this.busy.set(true);
      this.api.forceLogout(userName, serviceId).subscribe({
        next: (res) => {
          this.busy.set(false);
          // Old app only reacts to a "success" response; anything else is a silent no-op.
          const response = (res?.data as { response?: string } | undefined)?.response ?? '';
          if (response.toLowerCase() === 'success') {
            this.notify.alert(this.lang.t('userLoggedOutSuccessfully'), 'success');
            this.form.reset({ userName: '' });
            // Kicking out ONESELF invalidates this session's token. The old app only
            // landed on login by luck (its agent-state poll 401'd seconds later); here
            // it is explicit — otherwise the next click fails with "session expired".
            const self = this.sessionStore.user()?.userName ?? '';
            if (self && self.toLowerCase() === userName.trim().toLowerCase()) {
              this.auth.removeToken();
              sessionStorage.clear();
              this.router.navigate(['']);
            }
          }
        },
        error: (err: { errorMessage?: string }) => {
          this.busy.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to log out user', 'error');
        },
      });
    });
  }
}
