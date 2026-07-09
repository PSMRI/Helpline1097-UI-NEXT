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
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideClock, lucideMapPin, lucidePhoneCall, lucideUser } from '@ng-icons/lucide';

import { CallApiService } from '@/app-modules/core/services/call-api.service';
import { CtiService } from '@/app-modules/core/services/cti.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import {
  ENCRYPTED_KEYS,
  SessionStorageService,
} from '@/app-modules/core/services/session-storage.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { CallTypeGroup } from '@/app-modules/core/models';

import { CallWizardComponent } from '../wizard/call-wizard.component';

/**
 * Inner page — the call-handling screen's chrome (old `InnerpageComponent`): caller info
 * strip (CLI, category, IVRS zone, agent state, call duration, day totals), the CTI
 * message listener, and the call-type ID extraction that the closure flow depends on.
 *
 * Phase 5 slices: 5b = this chrome; 5c = the CO wizard shell (old `1097-co` carousel);
 * 5d = the closeCall engine + wrap-up timer. The wizard slides (registration / services /
 * updates / closure forms) are Phase 6. Old app note: the innerpage mounted its own copy of
 * the CZentrix iframe — our shell-level bar persists here, so one iframe serves both.
 */
@Component({
  selector: 'app-innerpage',
  imports: [NgIcon, CallWizardComponent],
  templateUrl: './innerpage.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucidePhoneCall, lucideMapPin, lucideClock, lucideUser })],
})
export class InnerpageComponent implements OnInit {
  private readonly cti = inject(CtiService);
  private readonly callApi = inject(CallApiService);
  private readonly notify = inject(NotificationService);
  private readonly storage = inject(SessionStorageService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly callerNumber = this.callStore.cli;
  protected readonly callCategory = this.callStore.callCategory;
  protected readonly isCO = computed(() => this.sessionStore.currentRole() === 'CO');

  protected readonly zoneName = signal('');
  protected readonly callStatus = signal('');
  protected readonly totalCalls = signal<string | number | null>(null);
  protected readonly totalTime = signal<string | number | null>(null);

  /** Wrap-up countdown seconds (display); the timer itself is wired in slice 5d. */
  protected readonly ticks = signal(0);
  protected readonly wrapupTime = signal(false);

  // Call-duration ticker (old built "Xm Ys " from a setInterval; we clear ours on destroy —
  // the old app leaked the interval, display-only hardening).
  private readonly elapsedSeconds = signal(0);
  protected readonly callDuration = computed(() => {
    const total = this.elapsedSeconds();
    return `${Math.floor(total / 60)}m ${total % 60}s`;
  });

  // Call-type IDs extracted from call/getCallTypesV1 (old innerpage fields).
  protected readonly transferCallID = signal<string | null>(null);
  protected readonly wrapupCallID = signal<string | null>(null);
  protected readonly disconnectCallID = signal<string | null>(null);

  /** Old `custdisconnectCallID` — session id from the CustDisconnect CTI event. */
  protected readonly custDisconnectCallID = signal<string | null>(null);
  /** Old `transferInProgress` — set by the closure flow's transfer path (Phase 6). */
  protected readonly transferInProgress = signal(false);

  protected readonly isEverwell = signal<string | null>(null);
  protected readonly isGrievance = signal<string | null>(null);

  constructor() {
    // Old innerpage attached its own window "message" listener (removed on destroy).
    const listener = (event: Event) => this.onCtiMessage(event);
    window.addEventListener('message', listener, false);
    this.destroyRef.onDestroy(() => window.removeEventListener('message', listener, false));

    const durationInterval = setInterval(() => {
      this.elapsedSeconds.set(this.elapsedSeconds() + 1);
    }, 1000);
    this.destroyRef.onDestroy(() => clearInterval(durationInterval));
  }

  ngOnInit(): void {
    // Faithful init order (old innerpage ngOnInit): call types → zone → agent state → totals.
    this.getCallTypes();
    this.getIvrsPathDetails();
    this.getAgentStatus();
    this.getAgentCallDetails();
    this.isEverwell.set(this.storage.getItem(ENCRYPTED_KEYS.isEverwellCall));
    this.isGrievance.set(this.storage.getItem(ENCRYPTED_KEYS.isGrievanceCall));
  }

  /**
   * Old `getCallTypes`: extract the transfer / wrapup / disconnect call-type IDs from the
   * groups. The mixed-case startsWith matching is verbatim from the old app ("transfer" and
   * "valid" compared lowercase, "Wrapup" compared case-sensitively).
   */
  private getCallTypes(): void {
    const serviceId = this.sessionStore.currentServiceId();
    if (serviceId == null) {
      return;
    }
    this.callApi.getCallTypes(serviceId, this.callStore.currentCampaign()).subscribe({
      next: (res) => this.extractCallTypeIds(res?.data ?? []),
      error: (err: { errorMessage?: string }) => {
        this.notify.alert(err?.errorMessage ?? 'Failed to get call types', 'error');
      },
    });
  }

  private extractCallTypeIds(groups: CallTypeGroup[]): void {
    for (const group of groups) {
      const groupType = group.callGroupType ?? '';
      if (groupType.toLowerCase().startsWith('transfer')) {
        for (const callType of group.callTypes ?? []) {
          if (callType.callTypeDesc?.toLowerCase().startsWith('transfer')) {
            this.transferCallID.set(callType.callTypeID != null ? String(callType.callTypeID) : null);
          }
        }
      }
      if (groupType.startsWith('Wrapup')) {
        for (const callType of group.callTypes ?? []) {
          if (callType.callType?.startsWith('Wrapup')) {
            this.wrapupCallID.set(callType.callTypeID != null ? String(callType.callTypeID) : null);
          }
        }
      }
      if (groupType.toLowerCase().startsWith('valid')) {
        for (const callType of group.callTypes ?? []) {
          if (callType.callTypeDesc?.toLowerCase().startsWith('valid')) {
            this.disconnectCallID.set(
              callType.callTypeID != null ? String(callType.callTypeID) : null,
            );
          }
        }
      }
    }
    if (!this.disconnectCallID()) {
      this.notify.alert('Failed to get call types', 'error');
    }
    // Old fallback: transfer falls back to the disconnect (valid) id.
    if (!this.transferCallID()) {
      this.transferCallID.set(this.disconnectCallID());
    }
  }

  /** Old `getIVRSPathDetails` — the caller's IVRS zone. */
  private getIvrsPathDetails(): void {
    this.cti.getIvrsPathDetails().subscribe({
      next: (res) => this.zoneName.set(res?.data?.zoneName ?? ''),
      error: () => {
        // Old app only logged this.
      },
    });
  }

  /** Old innerpage `getAgentStatus`: display state; "closure" arms the wrap-up display. */
  private getAgentStatus(): void {
    this.cti.getAgentStatus().subscribe({
      next: (res) => {
        const stateName = res?.data?.stateObj?.stateName;
        if (!stateName) {
          return;
        }
        const stateType = res?.data?.stateObj?.stateType;
        this.callStatus.set(stateType ? `${stateName} (${stateType})` : stateName);
        if (stateName.toLowerCase().trim() === 'closure') {
          this.wrapupTime.set(true);
        }
      },
      error: () => {
        // Old app only logged this.
      },
    });
  }

  /** Old `getAgentCallDetails` — the agent's day totals shown in the header strip. */
  private getAgentCallDetails(): void {
    this.cti.getCallDetails().subscribe({
      next: (res) => {
        this.totalCalls.set(res?.data?.total_calls ?? null);
        this.totalTime.set(res?.data?.total_call_duration ?? null);
      },
      error: () => {
        // Old app only logged this.
      },
    });
  }

  /**
   * Old innerpage `listener`/`handleEvent`: `Accept` resets the wrap-up countdown;
   * `CustDisconnect|{sessionId}` records the disconnect and refreshes the agent state
   * (wrap-up timer + slide-to-closure arrive in slices 5c/5d); a 4th OUTBOUND field flips
   * the outbound flag.
   */
  private onCtiMessage(event: Event): void {
    const raw =
      (event as MessageEvent).data ?? (event as CustomEvent<{ data?: unknown }>).detail?.data;
    if (typeof raw !== 'string') {
      return;
    }
    const parts = raw.split('|');
    const action = parts[0]?.trim().toLowerCase();
    const sessionVar = /^\d{10}\.\d{10}$/;

    if (action === 'accept') {
      this.ticks.set(0);
      // TODO(5d): unsubscribe the wrap-up timer (old `unsubscribeWrapupTime`).
    } else if (
      parts[0] === 'CustDisconnect' &&
      !this.transferInProgress() &&
      (sessionVar.test(parts[1]) || parts[1] === '')
    ) {
      this.custDisconnectCallID.set(parts[1]);
      this.getAgentStatus();
      // Old `disconnectCall()` UI jump: the wizard reacts to this signal (slide to Closure,
      // lock nav) — the old app did it via jQuery + the custDisconnect subject.
      this.callStore.custDisconnected.set(true);
      // TODO(5d): start the wrap-up countdown (old `startCallWraupup`).
    } else if (parts.length > 3 && parts[3] === 'OUTBOUND') {
      this.callStore.isOutbound.set(true);
    }
  }
}
