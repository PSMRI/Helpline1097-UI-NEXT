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

import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePhone } from '@ng-icons/lucide';

import { cardImports } from '@common-ui/ui/card';

import { Privilege, RolePrivilege, Role } from '@/app-modules/core/models';
import {
  PLAIN_KEYS,
  SessionStorageService,
} from '@/app-modules/core/services/session-storage.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Role selection — minimal port of the old `ServiceRoleSelectionComponent`. Lists the
 * user's 1097 service privileges (already filtered at login) with their roles; picking a
 * role stores the apiman key + selected role/service in the session and routes to the
 * dashboard. (CTI notification-room wiring and the socket broadcast are deferred.)
 */
@Component({
  selector: 'app-role-selection',
  imports: [NgIcon, ...cardImports],
  templateUrl: './role-selection.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucidePhone })],
})
export class RoleSelectionComponent {
  private readonly router = inject(Router);
  private readonly storage = inject(SessionStorageService);
  private readonly sessionStore = inject(SessionStore);

  protected readonly privileges = this.sessionStore.privileges;

  protected selectRole(role: RolePrivilege, service: Privilege): void {
    this.storage.setPlain(PLAIN_KEYS.apimanKey, service.apimanClientKey ?? '');

    const screen = role.serviceRoleScreenMappings?.[0]?.screen?.screenName?.trim().toLowerCase();
    let roleName: Role | null = null;
    if (screen === 'registration_counselling') {
      roleName = 'CO';
    } else if (screen === 'supervising') {
      roleName = 'Supervisor';
    }

    // Faithful to the old guard: only 1097 CO/Supervisor roles proceed.
    if (service.serviceName === '1097' && roleName) {
      this.sessionStore.currentRole.set(roleName);
      this.sessionStore.currentServiceName.set(service.serviceName ?? null);
      this.sessionStore.currentServiceId.set(service.serviceID ?? null);
      const agentId = role.agentID ?? this.sessionStore.agentId();
      this.sessionStore.agentId.set(agentId != null ? Number(agentId) : null);
      this.router.navigate(['/MultiRoleScreenComponent/dashboard']);
    }
  }
}
