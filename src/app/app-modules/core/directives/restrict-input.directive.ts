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
 * Input hardening — faithful port of the old keypress-denylist directive suite
 * (`userName`/`answer`/`myMobileNumber`/`myName`/`textAreaValidator`/…): blocks a keypress
 * whose character matches the supplied pattern.
 *
 * Clipboard behavior mirrors the two old variants:
 *  - default: paste/copy/cut are blocked entirely (most old directives);
 *  - `allowScannedPaste`: paste is allowed but rejected whole if ANY pasted character
 *    matches the denylist; copy/cut allowed (the old "WithCopyPaste" variants).
 *
 * Usage: `<input [appRestrictInput]="MOBILE_NUMBER_BLOCK" />`
 *        `<textarea [appRestrictInput]="SMS_TEMPLATE_PASTE_BLOCK" [allowScannedPaste]="true">`
 */
@Directive({
  selector: '[appRestrictInput]',
  host: {
    '(keypress)': 'onKeypress($event)',
    '(paste)': 'onPaste($event)',
    '(copy)': 'onClipboard($event)',
    '(cut)': 'onClipboard($event)',
  },
})
export class RestrictInputDirective {
  /** The set of characters to reject on keypress. */
  readonly pattern = input.required<RegExp>({ alias: 'appRestrictInput' });
  /** Old "WithCopyPaste" mode: scan pasted text instead of blocking the paste outright. */
  readonly allowScannedPaste = input<boolean>(false);

  onKeypress(event: KeyboardEvent): void {
    if (event.key && event.key.length === 1 && this.pattern().test(event.key)) {
      event.preventDefault();
    }
  }

  onPaste(event: ClipboardEvent): void {
    if (!this.allowScannedPaste()) {
      event.preventDefault();
      return;
    }
    const text = event.clipboardData?.getData('text') ?? '';
    // Old scan: reject the WHOLE paste when any character matches the denylist.
    for (const ch of text) {
      if (this.pattern().test(ch)) {
        event.preventDefault();
        return;
      }
    }
  }

  onClipboard(event: Event): void {
    if (!this.allowScannedPaste()) {
      event.preventDefault();
    }
  }
}
