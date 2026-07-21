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
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { menuImports } from '@common-ui/ui/menu';

import { TelephonyIframeComponent } from './telephony-iframe.component';
import { ConfigService } from '@/app-modules/core/services/config.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Supervisor activity console (old `app-1097-supervisor`, ~30 numbered `ngSwitchCase`
 * pages behind three navbar dropdowns). The page number is a STRING signal throughout —
 * the old app mixed `show("2")` strings with numeric case literals and relied on the old
 * NgSwitch's loose equality; modern `@switch` is strict, so one type is used consistently.
 * Default landing = "3" (Blacklist a Number), faithful to the old `Activity_Number = 3`.
 *
 * The old Communication / Call Reports submenus render as labeled groups inside the
 * flat z-menu dropdowns (same items, same actions — approved look-and-feel change).
 *
 * Screens land phase-wise: iframes here (7b); allocation 7d; reports 7e; communication 7f;
 * activity/config tools 7g; grievance tracking 7h; everwell guidelines Phase 8. The three
 * menu-less old cases (4/6/8) keep their switch cases (faithful — reachable only
 * programmatically, exactly like the old app; a future menu entry can surface them).
 */
@Component({
  selector: 'app-supervisor-shell',
  imports: [RouterLink, ZardButtonComponent, TelephonyIframeComponent, ...menuImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supervisor-shell.component.html',
})
export class SupervisorShellComponent {
  private readonly config = inject(ConfigService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly sessionStore = inject(SessionStore);

  /** Old `Activity_Number` — the active page. Default 3 = Blacklist (old landing). */
  protected readonly activityNumber = signal('3');

  /**
   * Old hidden SSO iframe: `remote_login.php?username={uname}&key={loginKey}`. The old
   * login's `getLoginKey` call was commented out, so `loginKey` was ALWAYS undefined and
   * the URL literally carried `key=undefined` — kept byte-faithful (the CZentrix session
   * behaviour is whatever the old app got).
   */
  protected readonly ssoUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    `${this.config.telephonyServerURL}remote_login.php?username=${
      this.sessionStore.user()?.userName ?? ''
    }&key=undefined`,
  );

  /** Old `show(value)`. */
  protected show(page: string): void {
    this.activityNumber.set(page);
  }

  /** Placeholder metadata for the not-yet-built pages (label = old English i18n value). */
  protected readonly pages: Record<string, { label: string; arrives: string }> = {
    '1': { label: 'Feedback Tracking', arrives: 'Phase 7h' },
    '3': { label: 'Blacklist a Number', arrives: 'Phase 7g' },
    '4': { label: 'Dial Beneficiary', arrives: 'a later phase (menu-less in the old app)' },
    '5': { label: 'Call Auditing', arrives: 'Phase 7g' },
    '6': { label: 'Supervisor Notifications', arrives: 'a later phase (menu-less in the old app)' },
    '8': { label: 'Supervisor Configurations', arrives: 'a later phase (menu-less in the old app)' },
    '9': { label: 'Call Type Report', arrives: 'Phase 7e' },
    '10': { label: 'Knowledge Management', arrives: 'Phase 7g' },
    '12': { label: 'Outbound Call List', arrives: 'Phase 7d' },
    '13': { label: 'Outbound Call Re-Allocation', arrives: 'Phase 7d' },
    '15': { label: 'Caller Age Report', arrives: 'Phase 7e' },
    '16': { label: 'Sexual Orientation Report', arrives: 'Phase 7e' },
    '17': { label: 'Language Distribution Report', arrives: 'Phase 7e' },
    '18': { label: 'Gender Distribution Report', arrives: 'Phase 7e' },
    '19': { label: 'Alerts and Notifications', arrives: 'Phase 7f' },
    '20': { label: 'Location Messages', arrives: 'Phase 7f' },
    '21': { label: 'Training Resource', arrives: 'Phase 7f' },
    '22': { label: 'Emergency Contacts', arrives: 'Phase 7f' },
    '23': { label: 'Force Logout', arrives: 'Phase 7g' },
    '24': { label: 'SMS Templates', arrives: 'Phase 7g' },
    '26': { label: 'Everwell Call Allocation', arrives: 'Phase 7d' },
    '27': { label: 'Everwell Call Re-Allocation', arrives: 'Phase 7d' },
    '28': { label: 'Everwell Guidelines Upload', arrives: 'Phase 8' },
    '29': { label: 'Grievance Outbound Call Allocation', arrives: 'Phase 7d' },
    '30': { label: 'Grievance Outbound Call Re-Allocation', arrives: 'Phase 7d' },
  };
}
