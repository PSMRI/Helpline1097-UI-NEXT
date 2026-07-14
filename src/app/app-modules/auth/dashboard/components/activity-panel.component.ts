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

import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideGraduationCap } from '@ng-icons/lucide';
import { switchMap } from 'rxjs/operators';

import { cardImports } from '@common-ui/ui/card';

import { NotificationApiService } from '@/app-modules/core/services/notification-api.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

const KM_TYPE = 'KM';

/**
 * "Activity for this week" panel. Faithful to the old `activity-this-week`: shows the
 * count of Training Resources (KM docs) for the current role/service. The training-doc
 * dialog and the outbound-worklist link are deferred to later phases.
 */
@Component({
  selector: 'app-activity-panel',
  imports: [...cardImports, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideGraduationCap })],
  template: `
    <z-card class="h-full shadow-sm transition-shadow hover:shadow-md">
      <z-card-header class="border-b pb-3">
        <z-card-title class="flex items-center gap-2 text-base font-semibold">
          <ng-icon name="lucideGraduationCap" class="text-lg text-primary" />
          Activity for this week
        </z-card-title>
      </z-card-header>
      <z-card-content class="pt-4">
        @let c = trainingCount();
        <div class="flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
          <span class="text-sm">Training Resources</span>
          <span
            class="inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-medium"
            [class.bg-primary]="c > 0"
            [class.text-primary-foreground]="c > 0"
            [class.bg-muted]="c === 0"
            [class.text-muted-foreground]="c === 0"
          >
            {{ c }}
          </span>
        </div>
      </z-card-content>
    </z-card>
  `,
})
export class ActivityPanelComponent implements OnInit {
  private readonly notificationApi = inject(NotificationApiService);
  private readonly sessionStore = inject(SessionStore);

  protected readonly trainingCount = signal(0);

  ngOnInit(): void {
    const serviceId = this.sessionStore.currentServiceId();
    const roleId = this.sessionStore.currentRoleId();
    if (serviceId == null || roleId == null) {
      return;
    }

    this.notificationApi
      .getNotificationTypes(serviceId)
      .pipe(
        switchMap((res) => {
          const km = (res?.data ?? []).find((t) => t.notificationType === KM_TYPE);
          if (!km?.notificationTypeID) {
            throw new Error('No KM type configured');
          }
          return this.notificationApi.getKMs(
            serviceId,
            km.notificationTypeID,
            roleId,
            new Date(),
            new Date(),
          );
        }),
      )
      .subscribe({
        next: (res) => {
          this.trainingCount.set((res?.data ?? []).length);
        },
        error: () => {
          /* leave count at 0 */
        },
      });
  }
}
