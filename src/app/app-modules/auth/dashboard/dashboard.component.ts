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

import { SessionStore } from '@/app-modules/core/state/session.store';

import { ActivityPanelComponent } from './components/activity-panel.component';
import { AgentIdComponent } from './components/agent-id.component';
import { AlertsPanelComponent } from './components/alerts-panel.component';
import { CallStatisticsComponent } from './components/call-statistics.component';
import { DashboardSidebarComponent } from './components/dashboard-sidebar.component';
import { ReportsPanelComponent } from './components/reports-panel.component';
import { RatingPanelComponent } from './components/rating-panel.component';

/**
 * Role-aware dashboard (old `dashboardContentClass`). Composes the panels; Supervisor hides
 * the agent-id + campaign toggle and sees blanked call stats.
 *
 * Phase 4c increment: agent-id, call-statistics (layout), reports, rating.
 * TODO next: alerts + activity panels (4c-4), left-nav (4c-5); campaign toggle + live
 * call-stats/agent-status via CTI (4d).
 */
@Component({
  selector: 'app-dashboard',
  imports: [
    ActivityPanelComponent,
    AgentIdComponent,
    AlertsPanelComponent,
    CallStatisticsComponent,
    DashboardSidebarComponent,
    ReportsPanelComponent,
    RatingPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-6xl flex-col gap-4 p-4">
      <div class="flex items-start justify-between gap-3">
        <app-dashboard-sidebar />
        @if (!isSupervisor()) {
          <app-agent-id />
        }
        <!-- Inbound/Outbound campaign toggle → Phase 4d (CTI) -->
      </div>

      <app-call-statistics [blank]="isSupervisor()" />

      <div class="grid gap-4 lg:grid-cols-2">
        <app-alerts-panel />
        <app-reports-panel />
        <app-activity-panel />
        <app-rating-panel />
      </div>
    </div>
  `,
})
export class DashboardComponent {
  private readonly sessionStore = inject(SessionStore);
  protected readonly isSupervisor = computed(() => this.sessionStore.currentRole() === 'Supervisor');
}
