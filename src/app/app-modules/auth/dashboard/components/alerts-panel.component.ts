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

import { ZardDialogService } from '@common-ui/ui/dialog';

import {
  AlertsNotificationsDialogComponent,
  AlertsNotificationsDialogData,
} from './alerts-notifications-dialog.component';
import {
  NotificationApiService,
  NotificationType,
} from '@/app-modules/core/services/notification-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** Rows in old panel order; `key` = count/config type, `msgType` = old dialog msg_type. */
const ROWS = [
  { key: 'Alert', msgType: 'Alert', label: 'Alerts' },
  { key: 'Location Message', msgType: 'Office', label: 'Office Bulletin' },
  { key: 'Notification', msgType: 'Notification', label: 'Notifications' },
] as const;

/**
 * Alerts / Notifications panel (old `alerts-notifications`): unread counts per type from
 * `getAlertsAndNotificationCount`; clicking a row opens the notification-list dialog for
 * that type, refreshing the counts when it closes.
 */
@Component({
  selector: 'app-alerts-panel',
  imports: [...cardImports, NgIcon, TranslatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideBell })],
  template: `
    <z-card class="h-full shadow-sm transition-shadow hover:shadow-md">
      <z-card-header class="border-b pb-3">
        <z-card-title class="flex items-center gap-2 text-base font-semibold">
          <ng-icon name="lucideBell" class="text-lg text-primary" />
          {{ 'alertsAndNotifications' | t }}
        </z-card-title>
      </z-card-header>
      <z-card-content class="flex flex-col gap-1 pt-4">
        @for (row of rows; track row.key) {
          @let c = countFor(row.key);
          <div
            class="flex cursor-pointer items-center justify-between rounded-md px-2 py-2 hover:bg-accent"
            (click)="openNotificationsDialog(row)"
          >
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
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(ZardDialogService);
  private readonly sessionStore = inject(SessionStore);

  protected readonly rows = ROWS;
  protected readonly counts = signal<Record<string, number>>({});

  /** Type-configs per notificationType (old alertConfig/notificationConfig/othersConfig). */
  private readonly typeConfigs = signal<Record<string, NotificationType[]>>({});

  /** Runtime-safe count lookup (a missing key is `undefined` → 0). */
  protected countFor(key: string): number {
    return this.counts()[key] ?? 0;
  }

  ngOnInit(): void {
    const serviceId = this.sessionStore.currentServiceId();
    if (serviceId == null) {
      return;
    }
    this.getCount();
    this.notificationApi.getNotificationTypes(serviceId).subscribe({
      next: (res) => {
        const map: Record<string, NotificationType[]> = {};
        for (const t of res?.data ?? []) {
          if (t.notificationType) {
            (map[t.notificationType] ??= []).push(t);
          }
        }
        this.typeConfigs.set(map);
      },
      error: () => {
        /* leave configs empty; rows just won't open */
      },
    });
  }

  /** Old openNotificationsDialog — fetch this type's rows, open the dialog (or alert if none). */
  protected openNotificationsDialog(row: (typeof ROWS)[number]): void {
    const userId = Number(this.sessionStore.userId());
    const roleId = this.sessionStore.currentRoleId();
    const serviceId = this.sessionStore.currentServiceId();
    const typeId = this.typeConfigs()[row.key]?.[0]?.notificationTypeID;
    if (!userId || roleId == null || serviceId == null || typeId == null) {
      // old code threw on a missing type config; the dialog just never opened
      return;
    }
    this.notificationApi
      .getAlertsAndNotificationDetail(userId, roleId, typeId, serviceId)
      .subscribe({
        error: () => {
          /* old console-logged only */
        },
        next: (res) => {
          const messages = (res?.data ?? []).filter((m) => m.notificationState !== 'future');
          if (messages.length === 0) {
            this.notify.alert(`No ${row.msgType.toLowerCase()} messages found`);
            return;
          }
          this.dialog.create({
            zTitle: `${row.msgType.toLowerCase()} Messages`,
            zContent: AlertsNotificationsDialogComponent,
            zData: {
              msgType: row.msgType,
              messages,
              notificationTypeID: typeId,
              onClosed: () => this.getCount(),
            } satisfies AlertsNotificationsDialogData,
            zWidth: '600px',
            zOkText: null,
            zCancelText: null,
            zHideFooter: true,
            // Deviation from old disableClose:false — a backdrop click otherwise falls
            // through the nested delete-confirm and closes this dialog under it.
            zMaskClosable: false,
          });
        },
      });
  }

  private getCount(): void {
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
