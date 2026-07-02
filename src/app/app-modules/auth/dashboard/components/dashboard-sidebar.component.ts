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
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideActivity,
  lucideFileText,
  lucideMenu,
  lucideRepeat,
  lucideSettings,
  lucideX,
} from '@ng-icons/lucide';

/**
 * Dashboard left-nav (old `dashboard-navigation`). A hamburger toggles a rail with:
 *  - Switch Role → back to role selection (functional)
 *  - Activities / Reports / Configuration → routed to the inner-page in the old app; that
 *    screen is Phase 5, so these are stubbed no-ops for now (per the agreed inner-page stub).
 */
@Component({
  selector: 'app-dashboard-sidebar',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [
    provideIcons({
      lucideMenu,
      lucideX,
      lucideActivity,
      lucideFileText,
      lucideSettings,
      lucideRepeat,
    }),
  ],
  template: `
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-md border border-input text-muted-foreground transition-colors hover:bg-accent"
      aria-label="Menu"
      (click)="toggle()"
    >
      <ng-icon [name]="open() ? 'lucideX' : 'lucideMenu'" class="text-xl" />
    </button>

    @if (open()) {
      <nav class="mt-2 w-52 rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
        @for (item of items; track item.label) {
          <button
            type="button"
            class="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors hover:bg-accent disabled:opacity-50"
            [disabled]="item.stub"
            [title]="item.stub ? 'Available in a later phase' : item.label"
            (click)="onItem(item)"
          >
            <ng-icon [name]="item.icon" class="text-base" />
            {{ item.label }}
          </button>
        }
      </nav>
    }
  `,
})
export class DashboardSidebarComponent {
  private readonly router = inject(Router);

  protected readonly open = signal(false);

  protected readonly items = [
    { label: 'Activities', icon: 'lucideActivity', stub: true },
    { label: 'Reports', icon: 'lucideFileText', stub: true },
    { label: 'Configuration', icon: 'lucideSettings', stub: true },
    { label: 'Switch Role', icon: 'lucideRepeat', stub: false },
  ];

  protected toggle(): void {
    this.open.update((v) => !v);
  }

  protected onItem(item: { label: string; stub: boolean }): void {
    if (item.stub) {
      return; // inner-page routing is Phase 5
    }
    if (item.label === 'Switch Role') {
      this.router.navigate(['/MultiRoleScreenComponent']);
    }
  }
}
