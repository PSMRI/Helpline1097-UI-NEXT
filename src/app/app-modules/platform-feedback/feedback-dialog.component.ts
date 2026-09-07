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

import { ChangeDetectionStrategy, Component, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs/operators';

import {
  CategoryDto,
  FeedbackApiService,
  ServiceLine,
  SubmitFeedbackRequest,
} from './feedback-api.service';
import { PLAIN_KEYS, SessionStorageService } from '@/app-modules/core/services/session-storage.service';

const STAR_LABELS = ['Terrible', 'Bad', 'Okay', 'Good', 'Great'];

/**
 * Platform-feedback card (old `app-feedback-dialog`). Star rating + category + comment +
 * anonymity consent, posted to the un-authenticated platform-feedback API.
 *
 * Old semantics kept:
 *  - "logged in" means a `userID` exists in sessionStorage — but NOTHING in either app has
 *    ever written that key, so the identified path (title, consent box, userId in the
 *    payload) is faithfully-ported dead code: the page always behaves anonymously;
 *  - `isAnonymous` defaults to true in every case; `userId` is attached only when the box
 *    is unchecked AND a stored id exists (parsed to a number when numeric);
 *  - rating min 1 (star click only), category required, comment max 2000;
 *  - with an empty category list the old code threw reading `[0].slug`, leaving the
 *    dropdown hidden and the (required) category empty — submit stays disabled forever;
 *    reproduced without the throw;
 *  - success resets to rating 0 / first category / anonymous, and shows the thank-you line.
 *
 * The old template's i18n bindings used a NESTED `platform_feedback` key group with `||`
 * English fallbacks; the fallbacks are what an anonymous visitor saw (no language loaded on
 * a public page) and are used verbatim here — the i18n follow-up wires the keys.
 */
@Component({
  selector: 'app-feedback-dialog',
  imports: [ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="w-full max-w-md rounded-2xl border border-border bg-background p-6 shadow-lg">
      <h2 class="text-lg font-semibold">
        {{ isLoggedIn ? 'We value your feedback' : 'You have logged out of the session' }}
      </h2>
      <p class="mt-1 text-sm text-muted-foreground">
        We’d love to hear about your experience (optional)
      </p>

      <!-- Stars with labels -->
      <div class="my-4 grid grid-cols-5 gap-2" role="radiogroup" aria-label="Rate your experience">
        @for (s of stars; track s) {
          <button
            type="button"
            class="grid justify-items-center gap-1.5"
            role="radio"
            [attr.aria-checked]="s === form.controls.rating.value"
            [attr.aria-label]="starLabels[s - 1]"
            (click)="setRating(s)"
          >
            <span
              class="text-4xl leading-none"
              [class.text-primary]="s <= (ratingValue() ?? 0)"
              [class.text-muted]="s > (ratingValue() ?? 0)"
              >★</span
            >
            <span class="text-xs text-primary">{{ starLabels[s - 1] }}</span>
          </button>
        }
      </div>

      <hr class="my-3 border-border" />

      @if (showCategory()) {
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Category</span>
          <select
            class="rounded-md border border-border bg-background px-3 py-2"
            [formControl]="form.controls.categorySlug"
            aria-label="Select a category"
          >
            <option value="" disabled>Select a category</option>
            @for (c of categories(); track c.slug) {
              <option [value]="c.slug">{{ c.label }}</option>
            }
          </select>
        </label>
      }

      <label class="mt-3 flex flex-col gap-1 text-sm">
        <textarea
          class="min-h-20 rounded-md border border-border bg-background px-3 py-2"
          placeholder="How we can make it better…"
          maxlength="2000"
          spellcheck="false"
          aria-label="Tell us more (optional)"
          [formControl]="form.controls.comment"
        ></textarea>
        <span class="self-end text-xs text-muted-foreground">
          {{ form.controls.comment.value?.length ?? 0 }} / 2000
        </span>
      </label>

      <div class="mt-2 text-sm">
        @if (isLoggedIn) {
          <label class="flex items-start gap-2">
            <input
              type="checkbox"
              class="mt-0.5"
              [checked]="form.controls.isAnonymous.value"
              (change)="toggleAnonymous($event)"
              aria-label="Submit anonymously"
            />
            <span>Submit anonymously (if unchecked, we will store your user id for follow-up)</span>
          </label>
        } @else {
          <div class="text-muted-foreground">
            You are not logged in, this feedback will be submitted anonymously.
          </div>
        }
      </div>

      <div class="mt-4 flex items-center justify-end gap-3">
        <button
          type="button"
          class="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted"
          (click)="login()"
        >
          close
        </button>
        <button
          type="button"
          class="rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground disabled:opacity-50"
          [disabled]="submitting() || form.invalid"
          (click)="submit()"
        >
          Okay
        </button>
      </div>

      @if (error()) {
        <div class="mt-3 text-sm text-destructive">{{ error() }}</div>
      }
      @if (successId()) {
        <div class="mt-3 text-sm text-green-700">Thank you, your feedback is valuable to us!</div>
      }
    </div>
  `,
})
export class FeedbackDialogComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(FeedbackApiService);
  private readonly storage = inject(SessionStorageService);
  private readonly router = inject(Router);

  readonly serviceLine = input<ServiceLine>('TM');
  readonly defaultCategorySlug = input<string | undefined>(undefined);

  protected readonly stars = [1, 2, 3, 4, 5];
  protected readonly starLabels = STAR_LABELS;
  protected readonly categories = signal<CategoryDto[]>([]);
  protected readonly showCategory = signal(true);
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | undefined>(undefined);
  protected readonly successId = signal<string | undefined>(undefined);
  /** Star highlight state (zoneless: control.value alone won't repaint on setValue). */
  protected readonly ratingValue = signal<number>(0);

  protected isLoggedIn = false;
  private storedUserId?: string;

  protected readonly form = this.fb.group({
    rating: this.fb.control<number>(0, { nonNullable: true, validators: [Validators.min(1), Validators.max(5)] }),
    categorySlug: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    comment: this.fb.control<string>('', { nonNullable: true, validators: [Validators.maxLength(2000)] }),
    isAnonymous: this.fb.control<boolean>(true, { nonNullable: true }),
  });

  ngOnInit(): void {
    try {
      this.storedUserId = this.storage.getPlain(PLAIN_KEYS.userId) || undefined;
      this.isLoggedIn = !!this.storedUserId;
    } catch {
      this.isLoggedIn = false;
      this.storedUserId = undefined;
    }
    // Old set isAnonymous to true on BOTH branches — the default stands.

    this.api.listCategories(this.serviceLine()).subscribe({
      next: (list) => {
        // Old filter `(c.active || true)` kept everything — reproduced by not filtering.
        const categories = list ?? [];
        this.categories.set(categories);
        this.showCategory.set(categories.length > 0);
        // Old read `[0].slug` unguarded (threw on empty, leaving category '' + required).
        const def = categories.length > 0 ? categories[0].slug || this.defaultCategorySlug() || '' : '';
        if (def) {
          this.form.controls.categorySlug.setValue(def);
        }
      },
      error: () => this.error.set('Could not load categories.'),
    });
  }

  protected setRating(n: number): void {
    this.form.controls.rating.setValue(n);
    this.ratingValue.set(n);
  }

  protected toggleAnonymous(event: Event): void {
    this.form.controls.isAnonymous.setValue((event.target as HTMLInputElement).checked);
  }

  /** Old Close button — back to the login page. */
  protected login(): void {
    this.router.navigate(['/']);
  }

  protected submit(): void {
    this.error.set(undefined);
    this.successId.set(undefined);
    if (this.form.invalid) {
      this.error.set('Pick a rating and a category.');
      return;
    }
    const v = this.form.getRawValue();
    const payload: SubmitFeedbackRequest = {
      rating: v.rating,
      categorySlug: v.categorySlug,
      comment: v.comment || undefined,
      isAnonymous: v.isAnonymous,
      serviceLine: this.serviceLine(),
    };
    if (!payload.isAnonymous && this.isLoggedIn && this.storedUserId) {
      const parsed = parseInt(this.storedUserId, 10);
      payload.userId = Number.isNaN(parsed) ? this.storedUserId : parsed;
    }
    this.submitting.set(true);
    this.api
      .submitFeedback(payload)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (res) => {
          this.successId.set(res?.id || 'submitted');
          this.form.reset({
            rating: 0,
            categorySlug: this.categories()[0]?.slug || '',
            comment: '',
            isAnonymous: true,
          });
          this.ratingValue.set(0);
        },
        error: (e: { status?: number; error?: { error?: string } }) => {
          // Old intent (the raw-Http version crashed past the 429 branch): 429 → rate-limit
          // text, a body `error` field → that text, else the generic line.
          if (e?.status === 429) {
            this.error.set('Too many attempts. Try later.');
          } else if (e?.error?.error) {
            this.error.set(e.error.error);
          } else {
            this.error.set('Submission failed.');
          }
        },
      });
  }
}
