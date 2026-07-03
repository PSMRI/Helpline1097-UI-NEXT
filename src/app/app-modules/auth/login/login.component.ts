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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideLock, lucideUser } from '@ng-icons/lucide';
import { finalize } from 'rxjs/operators';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { cardImports } from '@common-ui/ui/card';
import { ZardInputDirective } from '@common-ui/ui/input';

import { Privilege, SERVICE_1097 } from '@/app-modules/core/models';
import { AuthEventsService } from '@/app-modules/core/auth/auth-events.service';
import { ConfigService } from '@/app-modules/core/services/config.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import {
  ENCRYPTED_KEYS,
  PLAIN_KEYS,
  SessionStorageService,
} from '@/app-modules/core/services/session-storage.service';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { encryptPassword } from '@/app-modules/core/utils/password-crypto';

import { CaptchaComponent } from '../captcha/captcha.component';
import { RestrictInputDirective } from '../directives/restrict-input.directive';
import { AuthenticateResponse } from '../models/auth.models';
import { AuthApiService } from '../services/auth-api.service';
import { USERNAME_BLOCK_PATTERN } from '../utils/auth-validators';

/**
 * Login screen — faithful port of the old `loginContentClass`:
 *  - encrypts the password, calls `userAuthenticate`
 *  - on success: `Active` → role selection shell; `New` → set-security-questions
 *  - concurrent-session 5002: the response interceptor confirms + fires
 *    `AuthEventsService.logoutFromOtherDevice$`, which re-authenticates with doLogout=true
 *  - optional Cloudflare Turnstile captcha gating
 */
@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    ZardButtonComponent,
    ZardInputDirective,
    RestrictInputDirective,
    CaptchaComponent,
    ...cardImports,
  ],
  templateUrl: './login.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideUser, lucideLock, lucideEye })],
})
export class LoginComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly storage = inject(SessionStorageService);
  private readonly sessionStore = inject(SessionStore);
  private readonly authEvents = inject(AuthEventsService);
  private readonly config = inject(ConfigService);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly enableCaptcha = this.config.enableCaptcha;
  protected readonly usernameBlockPattern = USERNAME_BLOCK_PATTERN;

  private readonly captcha = viewChild<CaptchaComponent>('captchaCmp');

  protected readonly loginResult = signal('');
  protected readonly showPassword = signal(false);
  protected readonly captchaToken = signal('');

  protected readonly form = this.fb.nonNullable.group({
    userID: ['', Validators.required],
    password: ['', Validators.required],
  });

  private readonly formStatus = toSignal(this.form.statusChanges, {
    initialValue: this.form.status,
  });

  protected readonly loginDisabled = computed(() => {
    const invalid = this.formStatus() !== 'VALID';
    return this.enableCaptcha ? !this.captchaToken() || invalid : invalid;
  });

  /** Encrypted password kept for the concurrent-session re-authentication. */
  private encryptedPassword = '';

  ngOnInit(): void {
    // Concurrent-session: interceptor confirms the 5002 dialog, then fires this event.
    this.authEvents.logoutFromOtherDevice$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loginUser());

    // Validate an existing token on load; only 'Active' auto-navigates (matches old app —
    // the 'New' branch was commented out there).
    if (this.storage.getPlain(PLAIN_KEYS.authToken)) {
      this.authApi.getLoginResponse().subscribe({
        next: (res) => {
          const data = res?.data;
          if (data?.previlegeObj && data.isAuthenticated === true && data.Status === 'Active') {
            this.hydrateSession(data);
            this.router.navigate(['/MultiRoleScreenComponent'], { skipLocationChange: true });
          }
        },
        error: () => {
          /* stay on login (old app swallowed this error) */
        },
      });
    }
  }

  protected login(): void {
    if (this.form.invalid) {
      return;
    }
    this.encryptedPassword = encryptPassword(this.form.controls.password.value);
    this.authApi
      .authenticateUser(
        this.form.controls.userID.value,
        this.encryptedPassword,
        false,
        this.enableCaptcha ? this.captchaToken() : undefined,
      )
      .subscribe({
        next: (res) => this.handleAuthResponse(res?.data),
        error: (err) => this.handleError(err),
      });
  }

  protected onCaptchaResolved(token: string): void {
    this.captchaToken.set(token);
    this.loginResult.set('');
  }

  protected revealPassword(reveal: boolean): void {
    this.showPassword.set(reveal);
  }

  /** Force-logout the previous session, then re-authenticate (doLogout=true). */
  private loginUser(): void {
    this.authApi.logOutFromConcurrentSession(this.form.controls.userID.value).subscribe({
      next: (res) => {
        if (res?.data?.response) {
          this.authApi
            .authenticateUser(
              this.form.controls.userID.value,
              this.encryptedPassword,
              true,
              this.enableCaptcha ? this.captchaToken() : undefined,
            )
            .pipe(finalize(() => this.resetCaptcha()))
            .subscribe({
              next: (r) => this.handleAuthResponse(r?.data),
              error: (err) => this.handleError(err),
            });
        } else {
          this.notify.alert(res?.errorMessage ?? 'Logout failed', 'error');
          this.resetCaptcha();
        }
      },
      error: (err) => this.handleError(err),
    });
  }

  private handleAuthResponse(data?: AuthenticateResponse): void {
    if (!data || !data.previlegeObj) {
      return;
    }
    this.hydrateSession(data);
    // Clear stale call flags (faithful to old app).
    this.storage.removeItem(ENCRYPTED_KEYS.isOnCall);
    this.storage.removeItem(ENCRYPTED_KEYS.isEverwellCall);
    this.storage.removeItem(ENCRYPTED_KEYS.isGrievanceCall);

    if (data.isAuthenticated === true && data.Status === 'Active') {
      if (this.sessionStore.currentServiceId() == null) {
        this.notify.alert('ServiceID not found. Some things may not work', 'warning');
      }
      this.storage.setPlain(PLAIN_KEYS.authToken, data.key ?? '');
      this.router.navigate(['/MultiRoleScreenComponent'], { skipLocationChange: true });
    } else if (data.isAuthenticated === true && data.Status === 'New') {
      this.storage.setPlain(PLAIN_KEYS.authToken, data.key ?? '');
      this.router.navigate(['/setQuestions']);
    }
  }

  /** Populate SessionStore from an authenticate/login response (full user + 1097-filtered privileges). */
  private hydrateSession(data: AuthenticateResponse): void {
    const filtered: Privilege[] = (data.previlegeObj ?? []).filter(
      (privilege) => privilege.serviceName === SERVICE_1097,
    );
    this.sessionStore.setUser(data);
    this.sessionStore.privileges.set(filtered);

    const serviceId =
      data.previlegeObj?.[0]?.roles?.[0]?.serviceRoleScreenMappings?.[0]?.providerServiceMapping
        ?.m_ServiceMaster?.serviceID ?? null;
    this.sessionStore.currentServiceId.set(serviceId);

    let agentId: number | string | undefined;
    filtered.forEach((privilege) => (agentId = privilege.agentID));
    this.sessionStore.agentId.set(agentId != null ? Number(agentId) : null);

    this.sessionStore.loginIp.set(data.loginIPAddress ?? null);
  }

  private handleError(err: unknown): void {
    const e = err as { statusCode?: number; status?: number; errorMessage?: string };
    const status = e?.statusCode ?? e?.status;
    const message = e?.errorMessage;
    if (status === 5002 || message === 'captcha validation failed') {
      this.loginResult.set(message ?? '');
    } else if (status) {
      this.loginResult.set(message ?? '');
    } else {
      this.loginResult.set('Server seems to busy please try after some time');
    }
    this.resetCaptcha();
  }

  private resetCaptcha(): void {
    if (this.enableCaptcha) {
      this.captcha()?.reset();
      this.captchaToken.set('');
    }
  }
}
