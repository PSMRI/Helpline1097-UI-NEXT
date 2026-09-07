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

import { computed, inject, Injectable, signal } from '@angular/core';
import { Privilege, Role, User } from '../models';
import { PLAIN_KEYS, SessionStorageService } from '../services/session-storage.service';

/**
 * Authenticated-session state (signals): user, privileges, selected role/service.
 * Replaces the user/role slice of the old `dataService` god-object. Persisted keys
 * (`userID` plain) hydrate on construction; richer objects stay in memory (same
 * refresh-loss behavior as the old in-memory dataService).
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly storage = inject(SessionStorageService);

  readonly user = signal<User | null>(null);
  readonly privileges = signal<Privilege[]>([]);
  readonly currentRole = signal<Role | null>(null);
  readonly currentRoleId = signal<number | null>(null);
  readonly currentServiceId = signal<number | null>(null);
  /** Old current_service.providerServiceMapID — the CO history fetches post THIS field
   * (equal to serviceID on UAT, kept separate for field-source fidelity). */
  readonly currentProviderServiceMapId = signal<number | null>(null);
  readonly currentServiceName = signal<string | null>(null);
  readonly agentId = signal<number | null>(null);
  readonly loginIp = signal<string | null>(null);

  readonly userId = signal<string | null>(this.storage.getPlain(PLAIN_KEYS.userId));
  // Token presence is checked via AuthService.isLoggedIn() (reads fresh each call) — a
  // computed here would memoize against sessionStorage (non-reactive) and go stale.

  /**
   * Old `current_serviceID` — the SERVICE MASTER id, a different number space from
   * `currentServiceId` (which is the providerServiceMapID, e.g. 1722). A few endpoints key off
   * this one, notably `sms/getSMSTypes`, which returns nothing for a providerServiceMapID.
   */
  readonly serviceMasterId = computed(
    () =>
      this.privileges()?.[0]?.roles?.[0]?.serviceRoleScreenMappings?.[0]?.providerServiceMapping
        ?.m_ServiceMaster?.serviceID ?? null,
  );

  setUser(user: User): void {
    this.user.set(user);
    this.privileges.set(user.previlegeObj ?? []);
    if (user.userID != null) {
      this.userId.set(String(user.userID));
    }
  }

  reset(): void {
    this.user.set(null);
    this.privileges.set([]);
    this.currentRole.set(null);
    this.currentRoleId.set(null);
    this.currentServiceId.set(null);
    this.currentProviderServiceMapId.set(null);
    this.currentServiceName.set(null);
    this.agentId.set(null);
    this.loginIp.set(null);
    this.userId.set(null);
  }
}
