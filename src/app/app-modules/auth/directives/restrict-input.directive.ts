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

import { Directive, input } from '@angular/core';

/**
 * Input hardening for username/security-answer fields. Faithful port of the old
 * `userName` / `answer` attribute directives: blocks a keypress whose character matches
 * the supplied pattern, and disables paste/copy/cut entirely.
 *
 * Usage: `<input [appRestrictInput]="USERNAME_BLOCK_PATTERN" />`
 */
@Directive({
  selector: '[appRestrictInput]',
  host: {
    '(keypress)': 'onKeypress($event)',
    '(paste)': 'block($event)',
    '(copy)': 'block($event)',
    '(cut)': 'block($event)',
  },
})
export class RestrictInputDirective {
  /** The set of characters to reject on keypress. */
  readonly pattern = input.required<RegExp>({ alias: 'appRestrictInput' });

  onKeypress(event: KeyboardEvent): void {
    if (event.key && event.key.length === 1 && this.pattern().test(event.key)) {
      event.preventDefault();
    }
  }

  block(event: Event): void {
    event.preventDefault();
  }
}
