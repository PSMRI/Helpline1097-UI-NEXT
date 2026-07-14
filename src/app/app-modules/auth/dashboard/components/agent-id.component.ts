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
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideHeadset } from '@ng-icons/lucide';

import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * "My ID" panel — the agent's telephony id (old `dashboard-user-id`, CO only). The live
 * agent status text (FREE / INCALL / …) is CTI-driven and is wired in Phase 4d.
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
    </div>
  `,
})
export class AgentIdComponent {
  private readonly sessionStore = inject(SessionStore);
  protected readonly agentId = this.sessionStore.agentId;
}
