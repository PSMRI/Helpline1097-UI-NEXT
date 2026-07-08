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

import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHeadset } from '@ng-icons/lucide';
import { interval, Subscription } from 'rxjs';

import { AgentStateData, CtiService } from '@/app-modules/core/services/cti.service';
import { ApiResponse } from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * "My ID" panel (old `dashboard-user-id`, CO only) — shows `My ID: {agentID} {status}` from
 * `cti/getAgentState`, and carries two old-app behaviours:
 *  - only-outbound retry: while the role is outbound-only and the auto-switch hasn't landed,
 *    poll the agent state every 5s (old cadence) until FREE, then `switchToOutbound`.
 *  - call recovery: if the agent state comes back INCALL/CLOSURE with a session id we don't
 *    have, persist the call flags and route to the inner page (old `routeToInnerPage`).
 */
@Component({
  selector: 'app-agent-id',
  imports: [NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideHeadset })],
  template: `
    <div class="flex items-center gap-2 text-sm">
      <ng-icon name="lucideHeadset" class="text-lg text-primary" />
      <span class="font-medium">My ID:</span>
      <span>{{ agentId() ?? '—' }}</span>
      @if (status()) {
        <span class="text-muted-foreground">{{ status() }}</span>
      }
    </div>
  `,
})
export class AgentIdComponent implements OnInit {
  private readonly cti = inject(CtiService);
  private readonly router = inject(Router);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly agentId = this.sessionStore.agentId;
  protected readonly status = signal('');

  private timerSubscription?: Subscription;

  constructor() {
    // Old app started the 5s retry poll in ngOnInit when `onlyOutbound && !onceOutbound`;
    // the flags are set by the campaign toggle (a sibling), so react to them instead.
    effect(() => {
      const shouldPoll =
        this.callStore.outboundRetryPending() && !this.callStore.outboundSwitchDone();
      if (shouldPoll && !this.timerSubscription) {
        this.timerSubscription = interval(5 * 1000).subscribe(() => this.getAgentStatus());
      }
    });
    this.destroyRef.onDestroy(() => this.stopTimer());
  }

  ngOnInit(): void {
    this.getAgentStatus();
  }

  private getAgentStatus(): void {
    this.cti.getAgentStatus().subscribe({
      next: (res) => this.handleAgentState(res),
      error: () => {
        // Old app: agent not logged into CZentrix — status stays empty.
      },
    });
  }

  /** Faithful port of the old `dashboardUserId.getAgentStatus` response handler. */
  private handleAgentState(res: ApiResponse<AgentStateData> | null): void {
    const stateName = res?.data?.stateObj?.stateName;
    if (!stateName) {
      return;
    }
    const state = stateName.toUpperCase();

    // Only-outbound retry: once the agent is FREE, land the pending OUTBOUND switch.
    if (state === 'FREE' && this.callStore.onlyOutboundAvailable()) {
      if (this.callStore.isOutBoundSelected()) {
        this.stopTimer();
      } else {
        this.cti.switchToOutbound().subscribe({
          next: () => {
            this.callStore.setCurrentCampaign('OUTBOUND');
            this.callStore.isOutBoundSelected.set(true);
            this.callStore.outboundSwitchDone.set(true);
            this.callStore.outboundRetryPending.set(false);
            this.stopTimer();
          },
          error: () => this.callStore.setCurrentCampaign('OUTBOUND'),
        });
      }
    }
    if (state === 'FREE' && !this.callStore.onlyOutboundAvailable()) {
      this.stopTimer();
    }

    // Call recovery — the agent is already on a call the app doesn't know about.
    if (state === 'INCALL' || state === 'CLOSURE') {
      const knownSessionId = this.callStore.sessionId();
      if (!knownSessionId || knownSessionId !== res?.data?.session_id) {
        this.routeToInnerPage(res?.data);
      }
    }

    const stateType = res?.data?.stateObj?.stateType;
    this.status.set(stateType ? `${stateName} (${stateType})` : stateName);
  }

  /** Old `routeToInnerPage`: persist the live call's flags and open the call screen. */
  private routeToInnerPage(data?: AgentStateData): void {
    const sessionId = data?.session_id;
    if (!sessionId) {
      return;
    }
    this.callStore.setOnCall(true);
    this.callStore.setCli(data?.cust_ph_no ?? '');
    this.callStore.setSessionId(sessionId);
    this.router.navigate(['/MultiRoleScreenComponent/RedirectToInnerpageComponent']);
  }

  private stopTimer(): void {
    this.timerSubscription?.unsubscribe();
    this.timerSubscription = undefined;
  }
}
