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

import { DestroyRef, inject, Injectable } from '@angular/core';
import { Router } from '@angular/router';

import { NotificationService } from './notification.service';
import { CALL_SCREEN_ROUTE, CallStore } from '../state/call.store';

/**
 * The CZentrix `window.postMessage` call-event listener
 * (`"{Action}|{phone}|{sessionId}|{INBOUND|OUTBOUND}"` → validate → open the call screen).
 *
 * Extracted from the dashboard and attached ONCE at the shell (MultiRoleScreenComponent),
 * so it is active on every post-login page. The OLD app only wired this on the dashboard —
 * but via a raw `addEventListener("message", this.listener.bind(this))` that was NEVER
 * removed (the bound reference is lost), so the listener silently leaked and stayed alive
 * on every page visited after the first dashboard load. That leak is the only reason the
 * old outbound-worklist dial ever reached the call screen. Shell-level hosting reproduces
 * that effective coverage deliberately, cleaned up with the shell — same user-visible
 * behaviour, no leak (declared old-bug non-replication; zero backend impact). The call
 * screen keeps its own mid-call listener, exactly as the old app ran both concurrently.
 */
@Injectable({ providedIn: 'root' })
export class CtiCallEventsService {
  private readonly callStore = inject(CallStore);
  private readonly router = inject(Router);
  private readonly notify = inject(NotificationService);

  /** Attach the window listener for the lifetime of the host component. */
  attach(destroyRef: DestroyRef): void {
    const listener = (event: Event) => this.onCtiMessage(event);
    window.addEventListener('message', listener, false);
    destroyRef.onDestroy(() => window.removeEventListener('message', listener, false));
  }

  /**
   * Old `listener(event)`: parse the pipe-delimited CTI event (from `event.data`, or
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
