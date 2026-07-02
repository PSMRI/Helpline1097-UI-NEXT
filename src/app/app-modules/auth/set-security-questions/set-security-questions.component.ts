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

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideLock } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { cardImports } from '@common-ui/ui/card';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { AuthService } from '@/app-modules/core/auth/auth.service';
import { CtiService } from '@/app-modules/core/services/cti.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { encryptPassword } from '@/app-modules/core/utils/password-crypto';

import { RestrictInputDirective } from '../directives/restrict-input.directive';
import { SaveSecurityQuestion, SecurityQuestionMaster } from '../models/auth.models';
import { AuthApiService } from '../services/auth-api.service';
import { ANSWER_BLOCK_PATTERN, PASSWORD_PATTERN } from '../utils/auth-validators';

/**
 * Set-security-questions — faithful port of the old `SetSecurityQuestionsComponent`
 * (first-login onboarding, reached when login returns Status === 'New'):
 *  - stage 1: pick 3 DISTINCT questions + answers (dropdowns filter out already-picked
 *    questions, guaranteeing uniqueness)
 *  - stage 2: set a password (same policy as set-password)
 *  - submit → `saveUserSecurityQuesAns` → `setForgetPassword` → CTI userLogout → clear
 *    token → back to login.
 *
 * The questions are shown all-at-once (look-and-feel improvement); the collected records
 * and the API sequence are identical to the old app.
 */
@Component({
  selector: 'app-set-security-questions',
  imports: [
    ReactiveFormsModule,
    NgIcon,
    ZardButtonComponent,
    ZardInputDirective,
    RestrictInputDirective,
    ...ZardSelectImports,
    ...cardImports,
  ],
  templateUrl: './set-security-questions.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideLock, lucideEye })],
})
export class SetSecurityQuestionsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly cti = inject(CtiService);
  private readonly auth = inject(AuthService);
  private readonly sessionStore = inject(SessionStore);
  private readonly notify = inject(NotificationService);

  protected readonly answerBlockPattern = ANSWER_BLOCK_PATTERN;

  protected readonly stage = signal<'questions' | 'password'>('questions');
  protected readonly questions = signal<SecurityQuestionMaster[]>([]);
  protected readonly showPassword = signal(false);

  protected readonly questionsForm = this.fb.nonNullable.group({
    question1: ['', Validators.required],
    answer1: ['', Validators.required],
    question2: ['', Validators.required],
    answer2: ['', Validators.required],
    question3: ['', Validators.required],
    answer3: ['', Validators.required],
  });

  protected readonly passwordForm = this.fb.nonNullable.group({
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

  private readonly formValue = toSignal(this.questionsForm.valueChanges, {
    initialValue: this.questionsForm.getRawValue(),
  });
  private readonly questionsStatus = toSignal(this.questionsForm.statusChanges, {
    initialValue: this.questionsForm.status,
  });
  private readonly passwordStatus = toSignal(this.passwordForm.statusChanges, {
    initialValue: this.passwordForm.status,
  });

  protected readonly questionsValid = computed(() => this.questionsStatus() === 'VALID');
  protected readonly passwordValid = computed(() => this.passwordStatus() === 'VALID');

  /** Each dropdown excludes questions already chosen in the other two (enforces 3 distinct). */
  protected readonly options1 = computed(() => this.available(['question2', 'question3']));
  protected readonly options2 = computed(() => this.available(['question1', 'question3']));
  protected readonly options3 = computed(() => this.available(['question1', 'question2']));

  private available(exclude: ('question1' | 'question2' | 'question3')[]): SecurityQuestionMaster[] {
    const taken = exclude.map((key) => this.formValue()[key]).filter(Boolean);
    return this.questions().filter((q) => !taken.includes(String(q.QuestionID)));
  }

  ngOnInit(): void {
    this.authApi.getSecurityQuestionList().subscribe({
      next: (res) => this.questions.set(res?.data ?? []),
      error: () => this.questions.set([]),
    });
  }

  protected goToPassword(): void {
    if (this.questionsForm.valid) {
      this.stage.set('password');
    }
  }

  protected updatePassword(): void {
    if (this.passwordForm.invalid) {
      return;
    }
    const { newpwd, confirmpwd } = this.passwordForm.getRawValue();
    if (newpwd !== confirmpwd) {
      this.notify.alert("Password doesn't match", 'error');
      return;
    }

    const records = this.buildRecords();
    const encrypted = encryptPassword(newpwd);
    const userName = this.sessionStore.user()?.userName ?? '';

    this.authApi.saveUserSecurityQuesAns(records).subscribe({
      next: (res) => {
        if (res?.statusCode === 200 && res.data?.transactionId) {
          this.setForgetPassword(userName, encrypted, res.data.transactionId);
        } else {
          this.notify.alert(res?.errorMessage ?? 'Failed to save security questions', 'error');
        }
      },
      error: (err: { errorMessage?: string }) => {
        this.notify.alert(err?.errorMessage ?? 'Failed to save security questions', 'error');
      },
    });
  }

  private setForgetPassword(userName: string, password: string, transactionId: string): void {
    this.authApi.setForgetPassword(userName, password, transactionId).subscribe({
      next: () => {
        this.notify.alert('Password changed successfully', 'success');
        // Old app logs out of CTI, clears the token, then returns to login.
        this.cti.userLogout().subscribe({
          next: () => this.finishLogout(),
          error: () => this.finishLogout(),
        });
      },
      error: (err: { errorMessage?: string }) => {
        this.notify.alert(err?.errorMessage ?? 'Failed to set password', 'error');
      },
    });
  }

  private finishLogout(): void {
    this.auth.removeToken();
    this.sessionStore.reset();
    this.router.navigate(['']);
  }

  /** Build the 3 Q&A records for `saveUserSecurityQuesAns` (faithful to the old dataArray). */
  private buildRecords(): SaveSecurityQuestion[] {
    const v = this.questionsForm.getRawValue();
    const uid = this.sessionStore.user()?.userID ?? this.sessionStore.userId() ?? '';
    const createdBy = this.sessionStore.user()?.userName ?? '';
    const pairs: [string, string][] = [
      [v.question1, v.answer1],
      [v.question2, v.answer2],
      [v.question3, v.answer3],
    ];
    return pairs.map(([questionId, answer]) => ({
      userID: uid,
      questionID: Number(questionId),
      answers: answer ? answer.trim() : null,
      mobileNumber: '1234567890',
      createdBy,
    }));
  }

  protected revealPassword(reveal: boolean): void {
    this.showPassword.set(reveal);
  }
}
