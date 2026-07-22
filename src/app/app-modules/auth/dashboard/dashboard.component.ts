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

import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject } from '@angular/core';

import { CtiCallEventsService } from '@/app-modules/core/services/cti-call-events.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

import { ActivityPanelComponent } from './components/activity-panel.component';
import { AgentIdComponent } from './components/agent-id.component';
import { AlertsPanelComponent } from './components/alerts-panel.component';
import { CallStatisticsComponent } from './components/call-statistics.component';
import { CampaignToggleComponent } from './components/campaign-toggle.component';
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
    CampaignToggleComponent,
    DashboardSidebarComponent,
    ReportsPanelComponent,
    RatingPanelComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative min-h-full">
      <!-- Always-visible left rail (reviewer-approved 104 design); absolute = non-pushing -->
      <app-dashboard-sidebar
        class="absolute inset-y-0 left-0 z-20"
        [showActivityArea]="isSupervisor()"
      />

      <div class="py-4 pl-16 pr-4 sm:pl-20 sm:pr-6 md:py-6">
        <div class="mx-auto flex w-full max-w-7xl flex-col gap-6">
          <div class="flex items-center justify-between gap-3">
            @if (!isSupervisor()) {
              <app-agent-id />
              <app-campaign-toggle />
            }
          </div>

          <app-call-statistics [blank]="isSupervisor()" />

          <div class="grid gap-6 md:grid-cols-2">
            <app-alerts-panel />
            <app-reports-panel />
            <app-activity-panel />
            <app-rating-panel />
          </div>
        </div>
      </div>
    </div>
  `,
})
export class DashboardComponent {
  private readonly sessionStore = inject(SessionStore);
  private readonly ctiEvents = inject(CtiCallEventsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSupervisor = computed(() => this.sessionStore.currentRole() === 'Supervisor');

  constructor() {
    // The CZentrix iframe announces calls via window.postMessage — old dashboard `listener`
    // (shared with the outbound worklist hub; see CtiCallEventsService).
    this.ctiEvents.attach(this.destroyRef);
  }
}
