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

import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

/**
 * Password policy — ported verbatim from the old set-password / set-security-questions
 * components: 8–12 chars, ≥1 digit, ≥1 uppercase, ≥1 of !@#$%^&*, no other characters.
 */
export const PASSWORD_PATTERN = /^(?=.*[0-9])(?=.*[A-Z])(?=.*[!@#$%^&*])[a-zA-Z0-9!@#$%^&*]{8,12}$/;

/**
 * Characters blocked from the username field on keypress (old `userName.directive`).
 * The directive tests each typed character against this set and rejects a match.
 */
export const USERNAME_BLOCK_PATTERN = /[~!@#$%^&()_+\-=[\]{};"`'.,:\\|<>/? ]/;

/**
 * Characters blocked from security-answer fields on keypress (old `answer.directive`).
 */
export const ANSWER_BLOCK_PATTERN = /[~!@#%^&*_+=[\]{};"`'\\|<>?]/;

/**
 * Group validator: flags `passwordMismatch` when the two named controls differ.
 * Mirrors the old `newpwd === confirmpwd` check (which alerted "Password does not match").
 */
export function passwordsMatchValidator(passwordKey: string, confirmKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const password = group.get(passwordKey)?.value;
    const confirm = group.get(confirmKey)?.value;
    if (!confirm) {
      return null;
    }
    return password === confirm ? null : { passwordMismatch: true };
  };
}
