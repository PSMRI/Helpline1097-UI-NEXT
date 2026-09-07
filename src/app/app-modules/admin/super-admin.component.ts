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

import { ChangeDetectionStrategy, Component, signal } from '@angular/core';

import { AdminServiceMasterComponent } from './admin-service-master.component';
import { AdminServiceProviderComponent } from './admin-service-provider.component';
import { AdminUserComponent } from './admin-user.component';

/** The three reachable wizard tabs (old `changeService('1'|'2'|'3')`). */
const TABS = [
  { id: '1', label: 'Provider On Board' },
  { id: '2', label: 'Admin Creation' },
  { id: '3', label: 'State Services Mapping' },
];

/**
 * Super-admin console host (old `super-admin`, routed at `superAdmin`). A three-step wizard
 * over the Service Provider, Admin User and Service Master masters.
 *
 * Faithful to the old app, deliberately (approved):
 *  - the route carries NO guard and there is NO menu entry or button anywhere, so this screen
 *    is reachable only by navigating to the URL directly. The old app's only navigation to it
 *    was dead code (its `roleName === 'ADMIN'` branch could never be true, and it targeted a
 *    named router outlet that does not exist).
 *  - the old `show4`/`show5`/`show6` branches are dropped: no step ever emitted those values
 *    and no template consumed them.
 *
 * Unlike the old markup, the step chrome here reflects the selected tab — the old classes were
 * static, so steps 2 and 3 always looked disabled while still being clickable.
 */
@Component({
  selector: 'app-super-admin',
  imports: [AdminServiceProviderComponent, AdminUserComponent, AdminServiceMasterComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-full flex-col gap-4 p-3 md:p-4">
      <nav class="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background px-3 py-2" aria-label="Admin steps">
        @for (tab of tabs; track tab.id) {
          <button
            type="button"
            class="rounded-md px-3 py-1.5 text-sm"
            [class.bg-primary]="activeTab() === tab.id"
            [class.text-primary-foreground]="activeTab() === tab.id"
            [class.text-muted-foreground]="activeTab() !== tab.id"
            (click)="changeService(tab.id)"
          >
            {{ tab.label }}
          </button>
        }
      </nav>

      <div class="flex-1 rounded-lg border border-border bg-background p-3">
        @switch (activeTab()) {
          @case ('1') {
            <app-admin-service-provider />
          }
          @case ('2') {
            <app-admin-user />
          }
          @case ('3') {
            <app-admin-service-master />
          }
        }
      </div>
    </div>
  `,
})
export class SuperAdminComponent {
  protected readonly tabs = TABS;
  /** Old `show1 = true` — tab 1 is the landing tab. */
  protected readonly activeTab = signal('1');

  /** Old `changeService(val)`. */
  protected changeService(id: string): void {
    this.activeTab.set(id);
  }
}
