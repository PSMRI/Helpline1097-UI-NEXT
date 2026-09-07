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

import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';

import { ZardInputDirective } from '@common-ui/ui/input';

/**
 * Alternate-number prompt shown before sending a referral SMS (old `CommonSmsDialogComponent`).
 *
 * The caller opens it with the dialog service's own footer and reads this instance in `zOnOk`:
 * unchecked → `alternateNumber()` is `undefined`, i.e. the old app's "send to the primary
 * number" branch; checked → a ten-digit number is required (`canSend()` false otherwise, which
 * the caller uses to keep the dialog open, reproducing the old disabled Send-SMS button).
 * Cancel sends nothing, matching the old `'close'` result.
 *
 * DELIBERATE DEVIATION from an old-app bug: the old dialog never cleared its number field, so
 * typing a number, unticking the box, then pressing Send still posted that number as
 * `alternateNo`. Unticking here clears it, so the CO's visible choice is what gets sent.
 */
@Component({
  selector: 'app-sms-alternate-number-dialog',
  imports: [ZardInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3">
      <label class="flex items-center gap-2 text-sm">
        <input type="checkbox" [checked]="useAlternate()" (change)="toggleAlternate($event)" />
        <span>Alternate Number</span>
      </label>

      @if (useAlternate()) {
        <label class="flex flex-col gap-1.5 text-sm">
          <input
            z-input
            type="text"
            inputmode="numeric"
            maxlength="10"
            autocomplete="off"
            placeholder="Mobile Number"
            [value]="mobileNumber()"
            (input)="onNumberInput($event)"
            (blur)="touched.set(true)"
          />
          @if (!validNumber() && touched()) {
            <span class="text-destructive">Enter ten digits mobile number</span>
          }
        </label>
      }
    </div>
  `,
})
export class SmsAlternateNumberDialogComponent {
  readonly useAlternate = signal(false);
  readonly mobileNumber = signal('');
  /** Drives the validation hint (old `phnNum.touched`). */
  readonly touched = signal(false);

  /** Old `mobileNum()` — valid only at exactly ten characters. */
  readonly validNumber = computed(() => this.mobileNumber().length === 10);
  /** Old Send-SMS button state: `[disabled]="altNum && !validNumber"`. */
  readonly canSend = computed(() => !this.useAlternate() || this.validNumber());

  /** The number to send as `alternateNo`, or `undefined` for the primary-number branch. */
  readonly alternateNumber = computed(() =>
    this.useAlternate() ? this.mobileNumber() : undefined,
  );

  protected toggleAlternate(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.useAlternate.set(checked);
    if (!checked) {
      this.mobileNumber.set('');
    }
  }

  protected onNumberInput(event: Event): void {
    this.mobileNumber.set((event.target as HTMLInputElement).value);
  }
}
