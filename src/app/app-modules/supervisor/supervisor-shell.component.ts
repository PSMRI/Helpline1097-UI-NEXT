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

import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { SafeResourceUrl } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { menuImports } from '@common-ui/ui/menu';

import { CallAllocationComponent } from './allocation/call-allocation.component';
import { CallReallocationComponent } from './allocation/call-reallocation.component';
import { AlertsNotificationsComponent } from './communication/alerts-notifications.component';
import { EmergencyContactsComponent } from './communication/emergency-contacts.component';
import { LocationMessagesComponent } from './communication/location-messages.component';
import { TrainingResourcesComponent } from './communication/training-resources.component';
import { BlacklistNumberComponent } from './config/blacklist-number.component';
import { ForceLogoutComponent } from './config/force-logout.component';
import { KnowledgeManagementComponent } from './config/knowledge-management.component';
import { CallTypeReportComponent } from './reports/call-type-report.component';
import { DistributionReportComponent } from './reports/distribution-report.component';
import { TelephonyIframeComponent } from './telephony-iframe.component';
import { ConfigService } from '@/app-modules/core/services/config.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** One numbered supervisor page (labels = old English i18n values, verbatim). */
interface SupervisorPage {
  label: string;
  /** Which migration slice builds the screen; pages built in 7b have no placeholder. */
  arrives?: string;
}

/**
 * The old numbered page map (`Activity_Number` ngSwitch cases). Single source of truth for
 * menu labels AND placeholder text. Page numbers 4/6/8 are reserved but have NO menu item —
 * exactly like the old app (reachable only via `show()`, they land on the placeholder);
 * cases 11/25 never existed.
 */
const PAGES: Record<string, SupervisorPage> = {
  '1': { label: 'Feedback Tracking', arrives: 'Phase 7h' },
  '2': { label: 'Agent Status' },
  '3': { label: 'Blacklist a Number' },
  '4': { label: 'Dial Beneficiary', arrives: 'a later phase (menu-less in the old app)' },
  '5': { label: 'Call Auditing', arrives: 'Phase 7g' },
  '6': { label: 'Supervisor Notifications', arrives: 'a later phase (menu-less in the old app)' },
  '7': { label: 'Telephony Reports' },
  '8': { label: 'Supervisor Configurations', arrives: 'a later phase (menu-less in the old app)' },
  '9': { label: 'Call Type Report' },
  '10': { label: 'Knowledge Management' },
  '12': { label: 'Outbound Call List' },
  '13': { label: 'Outbound Call Re-Allocation' },
  '14': { label: 'Campaign Status' },
  '15': { label: 'Caller Age Report' },
  '16': { label: 'Sexual Orientation Report' },
  '17': { label: 'Language Distribution Report' },
  '18': { label: 'Gender Distribution Report' },
  '19': { label: 'Alerts and Notifications' },
  '20': { label: 'Location Messages' },
  '21': { label: 'Training Resource' },
  '22': { label: 'Emergency Contacts' },
  '23': { label: 'Force Logout' },
  '24': { label: 'SMS Templates', arrives: 'Phase 7g' },
  '26': { label: 'Everwell Call Allocation' },
  '27': { label: 'Everwell Call Re-Allocation' },
  '28': { label: 'Everwell Guidelines Upload', arrives: 'Phase 8' },
  '29': { label: 'Grievance Outbound Call Allocation' },
  '30': { label: 'Grievance Outbound Call Re-Allocation' },
};

/** A dropdown entry: a page item, a labeled group heading (old submenu), or a divider. */
interface MenuEntry {
  kind: 'item' | 'group' | 'divider';
  /** Page number for `kind: 'item'` (label comes from PAGES). */
  page?: string;
  /** Heading text for `kind: 'group'`. */
  label?: string;
}

// Menu contents in the old navbar order; item labels come from PAGES (one source of truth).
const ACTIVITIES_MENU: MenuEntry[] = [
  { kind: 'item', page: '2' },
  { kind: 'item', page: '3' },
  { kind: 'item', page: '29' },
  { kind: 'item', page: '30' },
  { kind: 'item', page: '12' },
  { kind: 'item', page: '13' },
  { kind: 'item', page: '5' },
  { kind: 'item', page: '26' },
  { kind: 'item', page: '27' },
  { kind: 'item', page: '28' },
  { kind: 'item', page: '1' },
  { kind: 'item', page: '14' },
  { kind: 'group', label: 'Communication' }, // old Communication submenu
  { kind: 'item', page: '19' },
  { kind: 'item', page: '20' },
  { kind: 'item', page: '21' },
  { kind: 'item', page: '22' },
  { kind: 'divider' },
  { kind: 'item', page: '23' },
];

const REPORTS_MENU: MenuEntry[] = [
  { kind: 'item', page: '7' },
  { kind: 'group', label: 'Call Reports' }, // old Call Reports submenu
  { kind: 'item', page: '9' },
  { kind: 'item', page: '15' },
  { kind: 'item', page: '16' },
  { kind: 'item', page: '17' },
  { kind: 'item', page: '18' },
];

const CONFIGURATIONS_MENU: MenuEntry[] = [
  { kind: 'item', page: '10' },
  { kind: 'item', page: '24' },
];

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
 * Screens land phase-wise (see PAGES); until built, a page shows the placeholder naming
 * its slice.
 */
@Component({
  selector: 'app-supervisor-shell',
  imports: [
    NgTemplateOutlet,
    RouterLink,
    ZardButtonComponent,
    TelephonyIframeComponent,
    CallAllocationComponent,
    CallReallocationComponent,
    AlertsNotificationsComponent,
    EmergencyContactsComponent,
    LocationMessagesComponent,
    TrainingResourcesComponent,
    BlacklistNumberComponent,
    ForceLogoutComponent,
    KnowledgeManagementComponent,
    CallTypeReportComponent,
    DistributionReportComponent,
    ...menuImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './supervisor-shell.component.html',
})
export class SupervisorShellComponent {
  private readonly config = inject(ConfigService);
  private readonly sessionStore = inject(SessionStore);

  protected readonly pages = PAGES;
  protected readonly activitiesMenu = ACTIVITIES_MENU;
  protected readonly reportsMenu = REPORTS_MENU;
  protected readonly configurationsMenu = CONFIGURATIONS_MENU;

  /** Old `Activity_Number` — the active page. Default 3 = Blacklist (old landing). */
  protected readonly activityNumber = signal('3');

  /**
   * Old hidden SSO iframe: `remote_login.php?username={uname}&key={loginKey}`. The old
   * login's `getLoginKey` call was commented out, so `loginKey` was ALWAYS undefined and
   * the URL literally carried `key=undefined` — kept byte-faithful (the CZentrix session
   * behaviour is whatever the old app got).
   */
  protected readonly ssoUrl: SafeResourceUrl = this.config.trustedTelephonyUrl(
    `remote_login.php?username=${this.sessionStore.user()?.userName ?? ''}&key=undefined`,
  );

  /** Old `show(value)`. */
  protected show(page: string): void {
    this.activityNumber.set(page);
  }
}
