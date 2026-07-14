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

import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideArrowLeftRight, lucideLayoutDashboard } from '@ng-icons/lucide';

/**
 * Dashboard left navigation rail — always-visible slim icon bar, matching the
 * reviewer-approved Helpline104 design (light gray, full height, icon + tooltip):
 *  - Switch Role (all roles) → back to role selection
 *  - Activity Area (Supervisor only) → the supervisor console, a later phase (stub)
 * The old app's Activities/Reports/Configuration entries belong to the inner-page /
 * supervisor phases and are not shown on the dashboard (as in 104's approved screens).
 */
@Component({
  selector: 'app-dashboard-sidebar',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideArrowLeftRight, lucideLayoutDashboard })],
  template: `
    <nav
      class="flex h-full w-14 flex-col items-center gap-2 border-r border-border bg-slate-50 py-3 text-muted-foreground"
      aria-label="Dashboard navigation"
    >
      @if (showActivityArea()) {
        <button
          type="button"
          class="flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
          disabled
          title="Activity Area — available in a later phase"
          aria-label="Activity Area (available in a later phase)"
        >
          <ng-icon name="lucideLayoutDashboard" size="22" aria-hidden="true" />
        </button>
      }

      <button
        type="button"
        class="flex h-10 w-10 items-center justify-center rounded-md hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        title="Switch Role"
        aria-label="Switch Role"
        (click)="goToRoleSelection()"
      >
        <ng-icon name="lucideArrowLeftRight" size="22" aria-hidden="true" />
      </button>
    </nav>
  `,
})
export class DashboardSidebarComponent {
  private readonly router = inject(Router);

  /** Supervisor-only Activity Area entry (the supervisor console, a later phase). */
  readonly showActivityArea = input(false);

  protected goToRoleSelection(): void {
    this.router.navigate(['/MultiRoleScreenComponent']);
  }
}
