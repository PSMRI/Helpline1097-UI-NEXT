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

import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { cardImports } from '@common-ui/ui/card';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Placeholder dashboard. The real role-aware dashboard (call stats, campaign toggle,
 * panels, CTI bar, etc.) is a later phase; this just confirms the post-login landing and
 * the selected role/service for now.
 */
@Component({
  selector: 'app-dashboard',
  imports: [...cardImports],
  template: `
    <div class="flex min-h-[60vh] items-center justify-center p-4">
      <z-card class="w-full max-w-md text-center">
        <z-card-header class="justify-items-center">
          <z-card-title class="text-xl">Dashboard</z-card-title>
          <z-card-description>Coming in a later phase</z-card-description>
        </z-card-header>
        <z-card-content class="text-sm text-muted-foreground">
          <p>Signed in as <span class="font-medium text-foreground">{{ userName() }}</span></p>
          @if (role()) {
            <p>Role: <span class="font-medium text-foreground">{{ role() }}</span></p>
          }
        </z-card-content>
      </z-card>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardComponent {
  private readonly sessionStore = inject(SessionStore);
  protected readonly userName = computed(() => this.sessionStore.user()?.userName ?? '');
  protected readonly role = this.sessionStore.currentRole;
}
