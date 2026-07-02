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

import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideEye, lucideKeyRound, lucideUser } from '@ng-icons/lucide';
import { Subscription } from 'rxjs';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { cardImports } from '@common-ui/ui/card';
import { ZardInputDirective } from '@common-ui/ui/input';

import { NotificationService } from '@/app-modules/core/services/notification.service';

import { RestrictInputDirective } from '../directives/restrict-input.directive';
import { SecurityQuestion, SecurityQuestionAnswer } from '../models/auth.models';
import { AuthApiService } from '../services/auth-api.service';
import { AuthFlowStore } from '../state/auth-flow.store';
import { ANSWER_BLOCK_PATTERN, USERNAME_BLOCK_PATTERN } from '../utils/auth-validators';

/**
 * Reset-password — faithful port of the old `ResetComponent`:
 *  - stage 1: enter username → `forgetPassword` fetches the security questions
 *    (no questions set → back to login with "Questions are not set for this user")
 *  - stage 2: answer ALL questions on one screen, then
 *    `validateSecurityQuestionAndAnswer` → on success store the transactionId and go to
 *    `/setPassword`; on failure re-fetch the questions and start over.
 *
 * Behaviour (the collected answers + the validate API) is identical to the old app; only
 * the presentation changed from one-question-at-a-time to all-at-once (a look-and-feel
 * improvement — there is no functional difference).
 */
@Component({
  selector: 'app-reset-password',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    NgIcon,
    ZardButtonComponent,
    ZardInputDirective,
    RestrictInputDirective,
    ...cardImports,
  ],
  templateUrl: './reset-password.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideUser, lucideKeyRound, lucideEye })],
})
export class ResetPasswordComponent {
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApiService);
  private readonly flow = inject(AuthFlowStore);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly usernameBlockPattern = USERNAME_BLOCK_PATTERN;
  protected readonly answerBlockPattern = ANSWER_BLOCK_PATTERN;

  protected readonly stage = signal<'username' | 'questions'>('username');
  protected readonly questions = signal<SecurityQuestion[]>([]);
  protected readonly showAnswers = signal(false);

  /** One required answer control per question; rebuilt whenever questions are (re)fetched. */
  protected readonly answers = signal<FormArray<FormControl<string>>>(
    new FormArray<FormControl<string>>([]),
  );
  /** Mirror of `answers().valid` for the (zoneless-safe) submit-button binding. */
  protected readonly answersValid = signal(false);
  private answersSub?: Subscription;

  protected readonly usernameCtrl = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  });

  constructor() {
    this.destroyRef.onDestroy(() => this.answersSub?.unsubscribe());
  }

  protected getQuestions(): void {
    const username = this.usernameCtrl.value;
    this.flow.setUsername(username);
    this.authApi.getSecurityQuestions(username).subscribe({
      next: (res) => {
        const qs = res?.data?.SecurityQuesAns;
        if (qs && qs.length > 0) {
          this.buildAnswers(qs.length);
          this.questions.set(qs);
          this.stage.set('questions');
        } else {
          this.router.navigate(['/']);
          this.notify.alert('Questions are not set for this user', 'error');
        }
      },
      error: () => {
        /* old app stored the error silently and stayed on the username step */
      },
    });
  }

  protected submitAnswers(): void {
    const arr = this.answers();
    if (arr.invalid) {
      return;
    }
    const collected: SecurityQuestionAnswer[] = this.questions().map((q, i) => ({
      questionId: q.questionId ?? 0,
      answer: arr.at(i).value,
    }));
    this.checking(collected);
  }

  /** Validate all answers; success mints a transactionId for set-password. */
  private checking(answers: SecurityQuestionAnswer[]): void {
    const username = this.flow.username() ?? '';
    this.authApi.validateSecurityQuestionAndAnswer(answers, username).subscribe({
      next: (res) => {
        if (res.statusCode === 200 && res.data?.transactionId) {
          this.flow.setTransactionId(res.data.transactionId);
          this.router.navigate(['/setPassword']);
        } else {
          this.restartQuestions(res.errorMessage);
        }
      },
      error: (err: { errorMessage?: string }) => this.restartQuestions(err?.errorMessage),
    });
  }

  private restartQuestions(message?: string): void {
    this.notify.alert(message ?? 'Validation failed', 'error');
    // Re-fetch the questions and stay on the questions step (old app re-ran getQuestions).
    this.getQuestions();
  }

  private buildAnswers(count: number): void {
    this.answersSub?.unsubscribe();
    const arr = new FormArray(
      Array.from(
        { length: count },
        () => new FormControl('', { nonNullable: true, validators: [Validators.required] }),
      ),
    );
    this.answersValid.set(arr.valid);
    this.answersSub = arr.statusChanges.subscribe(() => this.answersValid.set(arr.valid));
    this.answers.set(arr);
    this.showAnswers.set(false);
  }

  protected revealAnswers(reveal: boolean): void {
    this.showAnswers.set(reveal);
  }
}
