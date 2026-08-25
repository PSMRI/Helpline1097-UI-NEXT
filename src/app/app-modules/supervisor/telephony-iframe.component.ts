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

import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';

import { ConfigService } from '@/app-modules/core/services/config.service';

/**
 * CZentrix admin-UI embed — one parameterized component replacing the old app's three
 * identical iframe screens (`agent-status` → `adminui.php?agentStatus`,
 * `supervisor-campaign-status` → `?campaignStatus`, `supervisor-reports` → `?reportUI`).
 * Same URL construction; the page relies on the ambient telephony-server session
 * established by the supervisor shell's hidden SSO iframe (old behaviour — no auth params).
 */
@Component({
  selector: 'app-telephony-iframe',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Old iframes were 700px tall inside the scrollable page container -->
    <iframe
      [src]="url()"
      [title]="label()"
      class="h-[700px] w-full border-0"
    ></iframe>
  `,
})
export class TelephonyIframeComponent {
  private readonly config = inject(ConfigService);

  /** The `adminui.php` query flag (old: agentStatus | campaignStatus | reportUI). */
  readonly query = input.required<string>();
  /** Accessible iframe title. */
  readonly label = input<string>('CZentrix console');

  protected readonly url = computed<SafeResourceUrl>(() =>
    this.config.trustedTelephonyUrl(`adminui.php?${this.query()}`),
  );
}
