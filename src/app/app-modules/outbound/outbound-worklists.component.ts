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

import { ChangeDetectionStrategy, Component, DestroyRef, inject } from '@angular/core';

import { ZardTabComponent, ZardTabGroupComponent } from '@common-ui/ui/tabs';

import { EverwellWorklistTabComponent } from './everwell-worklist-tab.component';
import { GenericWorklistComponent } from './generic-worklist.component';
import { GrievanceWorklistComponent } from './grievance-worklist.component';
import { CtiCallEventsService } from '@/app-modules/core/services/cti-call-events.service';

/**
 * Outbound worklists hub (old `OutboundCallWorklistsComponent`) — three tabs: the generic
 * 1097 follow-up worklist, the Everwell worklist and the grievance worklist. The CO lands
 * here from the dashboard's "Outbound Worklist" link after switching to the OUTBOUND
 * campaign.
 *
 * Hosts the CZentrix call-event listener: after a dial, CZentrix posts the
 * `Accept|phone|session|OUTBOUND` event while the agent is still on this page, and the
 * listener opens the call screen. (The old app relied on the dashboard's LEAKED listener
 * for this — see CtiCallEventsService.)
 */
@Component({
  selector: 'app-outbound-worklists',
  imports: [
    ZardTabGroupComponent,
    ZardTabComponent,
    GenericWorklistComponent,
    EverwellWorklistTabComponent,
    GrievanceWorklistComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-full flex-col p-4 md:p-6">
      <z-tab-group>
        <z-tab label="Outbound Worklist">
          <app-generic-worklist />
        </z-tab>
        <z-tab label="Everwell Outbound Worklist">
          <app-everwell-worklist-tab />
        </z-tab>
        <z-tab label="Grievance Outbound Worklist">
          <app-grievance-worklist />
        </z-tab>
      </z-tab-group>
    </div>
  `,
})
export class OutboundWorklistsComponent {
  private readonly ctiEvents = inject(CtiCallEventsService);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.ctiEvents.attach(this.destroyRef);
  }
}
