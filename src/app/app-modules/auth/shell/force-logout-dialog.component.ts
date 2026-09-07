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

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardDialogRef } from '@common-ui/ui/dialog';
import { ZardInputDirective } from '@common-ui/ui/input';

import { NotificationService } from '@/app-modules/core/services/notification.service';
import { ForceLogoutService } from '@/app-modules/core/services/force-logout.service';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Force-logout dialog (CO-only). Faithful to the old `AgentForceLogoutComponent`: an admin
 * enters an agent's username + password and kicks them out via `user/userForceLogout`.
 * Opened via ZardDialogService with `zContent: ForceLogoutDialogComponent`; closes itself
 * on success via the injected ZardDialogRef.
 */
@Component({
  selector: 'app-force-logout-dialog',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="kickout()" autocomplete="off" class="flex flex-col gap-4">
      <div class="flex flex-col gap-1.5">
        <label for="fl-user" class="text-sm font-medium">
          {{ 'userName' | t }} <span class="text-destructive">*</span>
        </label>
        <input z-input id="fl-user" formControlName="userName" type="text" autocomplete="off" />
      </div>
      <div class="flex flex-col gap-1.5">
        <label for="fl-pass" class="text-sm font-medium">
          {{ 'password' | t }} <span class="text-destructive">*</span>
        </label>
        <input z-input id="fl-pass" formControlName="password" type="password" autocomplete="off" />
      </div>
      <button z-button type="submit" zFull [zDisabled]="form.invalid || submitting()">{{ 'kickout' | t }}</button>
    </form>
  `,
})
export class ForceLogoutDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly forceLogout = inject(ForceLogoutService);
  private readonly sessionStore = inject(SessionStore);
  private readonly notify = inject(NotificationService);
  private readonly lang = inject(LanguageStore);
  private readonly dialogRef = inject(ZardDialogRef);

  protected readonly submitting = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    userName: ['', [Validators.required, Validators.minLength(3)]],
    password: ['', Validators.required],
  });

  protected kickout(): void {
    if (this.form.invalid) {
      return;
    }
    this.submitting.set(true);
    const { userName, password } = this.form.getRawValue();
    this.forceLogout
      .agentForceLogout(userName, password, this.sessionStore.currentServiceId())
      .subscribe({
        next: () => {
          this.notify.alert(this.lang.t('userLoggedOutSuccessfully'), 'success');
          this.dialogRef.close();
        },
        error: (err: { errorMessage?: string }) => {
          this.submitting.set(false);
          this.notify.alert(err?.errorMessage ?? 'Force logout failed', 'error');
        },
      });
  }
}
