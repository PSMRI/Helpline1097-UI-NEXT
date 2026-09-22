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

import { CALL_SCREEN_ROUTE, CallStore } from '../state/call.store';

/**
 * CZentrix `window.postMessage` call-event listener (`Action|phone|sessionId|INBOUND/OUTBOUND`
 * → validate → open the call screen). Attached once at the shell: the old app's dashboard
 * listener leaked (never-removable bound reference) and was therefore effectively alive on
 * every page — that leak was the only reason outbound-worklist dials reached the call
 * screen. Shell-level hosting keeps that coverage without the leak.
 */
@Injectable({ providedIn: 'root' })
export class CtiCallEventsService {
  private readonly callStore = inject(CallStore);
  private readonly router = inject(Router);

  /** Attach the window listener for the lifetime of the host component. */
  attach(destroyRef: DestroyRef): void {
    const listener = (event: Event) => this.onCtiMessage(event);
    window.addEventListener('message', listener, false);
    destroyRef.onDestroy(() => window.removeEventListener('message', listener, false));
  }

  private onCtiMessage(event: Event): void {
    const raw =
      (event as MessageEvent).data ?? (event as CustomEvent<{ data?: unknown }>).detail?.data;
    if (typeof raw !== 'string') {
      return;
    }
    const parts = raw.split('|');
    if (parts.length < 3 || parts[0]?.trim().toLowerCase() !== 'accept') {
      return;
    }
    const sessionVar = /^\d+(\.\d+)?$/;
    if (!sessionVar.test(parts[2])) {
      return;
    }
    const cli = parts[1] || '';
    const callCategory = /^(INBOUND|OUTBOUND)$/i.test(parts[3]) ? parts[3] : 'INBOUND';

    if (this.router.url.includes(CALL_SCREEN_ROUTE) && this.callStore.isOnCall()) {
      return;
    }

    this.callStore.startCall(cli, parts[2], callCategory);
    this.router.navigate([CALL_SCREEN_ROUTE]);
  }
}
