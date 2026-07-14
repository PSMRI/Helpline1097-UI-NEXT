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
import { lucideBell } from '@ng-icons/lucide';

import { cardImports } from '@common-ui/ui/card';

import { NotificationApiService } from '@/app-modules/core/services/notification-api.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** Alert types shown (old `alerts-notifications`) with their unread counts. */
const ROWS = [
  { key: 'Alert', label: 'Alerts' },
  { key: 'Notification', label: 'Notifications' },
  { key: 'Location Message', label: 'Location Messages' },
] as const;

/**
 * Alerts / Notifications panel. Faithful to the old `alerts-notifications`: shows unread
 * counts per type from `getAlertsAndNotificationCount`. The click-through notification-list
 * dialog is deferred (a later increment).
 */
@Component({
  selector: 'app-alerts-panel',
  imports: [...cardImports, NgIcon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideBell })],
  template: `
    <z-card class="h-full shadow-sm transition-shadow hover:shadow-md">
      <z-card-header class="border-b pb-3">
        <z-card-title class="flex items-center gap-2 text-base font-semibold">
          <ng-icon name="lucideBell" class="text-lg text-primary" />
          Alerts &amp; Notifications
        </z-card-title>
      </z-card-header>
      <z-card-content class="flex flex-col gap-1 pt-4">
        @for (row of rows; track row.key) {
          @let c = countFor(row.key);
          <div class="flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
            <span class="text-sm">{{ row.label }}</span>
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
        }
      </z-card-content>
    </z-card>
  `,
})
export class AlertsPanelComponent implements OnInit {
  private readonly notificationApi = inject(NotificationApiService);
  private readonly sessionStore = inject(SessionStore);

  protected readonly rows = ROWS;
  protected readonly counts = signal<Record<string, number>>({});

  /** Runtime-safe count lookup (a missing key is `undefined` → 0). */
  protected countFor(key: string): number {
    return this.counts()[key] ?? 0;
  }

  ngOnInit(): void {
    const userId = Number(this.sessionStore.userId());
    const roleId = this.sessionStore.currentRoleId();
    const serviceId = this.sessionStore.currentServiceId();
    if (!userId || roleId == null || serviceId == null) {
      return;
    }

    this.notificationApi.getAlertsAndNotificationCount(userId, roleId, serviceId).subscribe({
      next: (res) => {
        const map: Record<string, number> = {};
        for (const item of res?.data?.userNotificationTypeList ?? []) {
          if (item.notificationType) {
            map[item.notificationType] = item.notificationTypeUnreadCount ?? 0;
          }
        }
        this.counts.set(map);
      },
      error: () => {
        /* leave counts at 0 */
      },
    });
  }
}
