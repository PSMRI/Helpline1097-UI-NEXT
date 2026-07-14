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
import { Router } from '@angular/router';

import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CALL_SCREEN_ROUTE, CallStore } from '@/app-modules/core/state/call.store';
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
  private readonly callStore = inject(CallStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly isSupervisor = computed(() => this.sessionStore.currentRole() === 'Supervisor');

  constructor() {
    // The CZentrix iframe announces calls via window.postMessage — old dashboard `listener`.
    const listener = (event: Event) => this.onCtiMessage(event);
    window.addEventListener('message', listener, false);
    this.destroyRef.onDestroy(() => window.removeEventListener('message', listener, false));
  }

  /**
   * Old `listener(event)`: parse the pipe-delimited CTI event
   * `"{Action}|{phone}|{sessionId}|{INBOUND|OUTBOUND}"` (from `event.data`, or
   * `event.detail.data` for CustomEvents). Handle it when it carries a session id we don't
   * already have, or is an explicit Accept.
   */
  private onCtiMessage(event: Event): void {
    const raw =
      (event as MessageEvent).data ?? (event as CustomEvent<{ data?: unknown }>).detail?.data;
    if (typeof raw !== 'string') {
      // Browsers/devtools post non-CZentrix objects on window too; only pipe strings matter.
      return;
    }
    const parts = raw.split('|');
    const sessionId = parts[2];
    if (sessionId === undefined || sessionId === 'undefined' || sessionId === null || sessionId === '') {
      return;
    }
    // Single dispatch (review fix): the old app's two independent `if` blocks invoked
    // handleEvent twice for an Accept with a new session id — harmless only by accident
    // (idempotent store writes, same-URL navigation). Same trigger conditions, one call.
    const known = this.callStore.sessionId();
    const isNewSession = !known || known !== sessionId;
    const isAccept = parts[0]?.toLowerCase() === 'accept';
    if (isNewSession || isAccept) {
      this.handleCtiEvent(parts);
    }
  }

  /** Old `handleEvent()`: validate, persist the call flags, open the call screen. */
  private handleCtiEvent(parts: string[]): void {
    if (parts.length <= 2) {
      return;
    }
    const mobileNumber = (parts[1] ?? '').replace(/\D/g, '');
    const checkNumber = /^\d+$/;
    const sessionVar = /^\d{10}\.\d{10}$/;
    // Review fix (deviation from the old app, declared on PR #6): the pattern is anchored —
    // the old `^(INBOUND)|(OUTBOUND)$` accepted e.g. "INBOUNDxyz". Real events carry bare
    // tokens (the old innerpage compared `=== 'OUTBOUND'` exactly); verified at the
    // live-call milestone together with the deferred origin check.
    const checkCallType = /^(INBOUND|OUTBOUND)$/i;

    if (checkNumber.test(mobileNumber) && sessionVar.test(parts[2]) && checkCallType.test(parts[3])) {
      // Review fix: isOnCall is set only for a VALID call (startCall sets it) — the old app
      // set it before validating, stranding the agent behind the mid-call guards when a
      // malformed event arrived (flag set, no call, no navigation, logout blocked).
      this.callStore.startCall(parts[1], parts[2], parts[3]);
      this.router.navigate([CALL_SCREEN_ROUTE]);
    } else {
      this.notify.alert('Invalid call. Please check.', 'error');
    }
  }
}
