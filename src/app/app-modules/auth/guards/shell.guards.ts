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

import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { of } from 'rxjs';
import { catchError, map } from 'rxjs/operators';

import { AuthService } from '@/app-modules/core/auth/auth.service';
import { Privilege, Role, SERVICE_1097 } from '@/app-modules/core/models';
import {
  ENCRYPTED_KEYS,
  SessionStorageService,
} from '@/app-modules/core/services/session-storage.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

import { AuthApiService } from '../services/auth-api.service';

/**
 * Re-hydrate the in-memory session after a full page reload. `authToken` survives in
 * sessionStorage, but `SessionStore` (user, privileges, …) is in-memory and resets on
 * reload — so a refresh of a protected route would otherwise render an empty shell.
 *
 * When a token is present but the store is empty, re-fetch the user + privileges via the
 * existing `getLoginResponse` (same call `LoginComponent` makes at startup — read-only, no
 * contract change) and repopulate the store before children activate. The selected role is
 * then restored from its persisted keys, validated against the FRESH privilege list (never
 * trusted blindly) — without this a mid-call refresh stranded the agent, since the call
 * screen blocks navigation away and needs the role/service to render. No extra API calls.
 */
export const sessionHydrationGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const store = inject(SessionStore);
  const storage = inject(SessionStorageService);
  const authApi = inject(AuthApiService);

  // Not logged in (child authGuard handles) or already hydrated → proceed.
  if (!auth.isLoggedIn() || store.user()) {
    return true;
  }

  return authApi.getLoginResponse().pipe(
    map((res) => {
      const data = res?.data;
      if (data?.previlegeObj) {
        store.setUser(data);
        const privileges = data.previlegeObj.filter(
          (p: Privilege) => p.serviceName === SERVICE_1097,
        );
        store.privileges.set(privileges);
        restoreSelectedRole(store, storage, privileges);
      }
      return true;
    }),
    // On error the response interceptor already handles 401/5002; let navigation proceed
    // (the roleSelectedGuard / empty privileges will route the user appropriately).
    catchError(() => of(true)),
  );
};

/**
 * Restore the persisted role selection, rebuilding the same store slice `selectRole` sets —
 * but only when the persisted RoleID exists in the freshly fetched privileges.
 */
function restoreSelectedRole(
  store: SessionStore,
  storage: SessionStorageService,
  privileges: Privilege[],
): void {
  const roleName = storage.getItem(ENCRYPTED_KEYS.currentRole) as Role | null;
  const roleIdRaw = storage.getItem(ENCRYPTED_KEYS.currentRoleId);
  if (!roleName || !roleIdRaw) {
    return;
  }
  const roleId = Number(roleIdRaw);
  for (const service of privileges) {
    const role = (service.roles ?? []).find((r) => r.RoleID === roleId);
    if (role && service.serviceName === SERVICE_1097) {
      store.currentRole.set(roleName);
      store.currentRoleId.set(roleId);
      store.currentServiceName.set(service.serviceName ?? null);
      store.currentServiceId.set(service.serviceID ?? null);
      const agentId = role.agentID ?? store.agentId();
      store.agentId.set(agentId != null ? Number(agentId) : null);
      return;
    }
  }
}

/**
 * Dashboard requires a selected role. Role selection is in-memory only (faithful to the old
 * app), so after a reload it's gone — redirect to role selection instead of showing an empty
 * dashboard. Pure client-side navigation (no backend).
 */
export const roleSelectedGuard: CanActivateFn = () => {
  const store = inject(SessionStore);
  const router = inject(Router);
  return store.currentRole() ? true : router.createUrlTree(['/MultiRoleScreenComponent']);
};
