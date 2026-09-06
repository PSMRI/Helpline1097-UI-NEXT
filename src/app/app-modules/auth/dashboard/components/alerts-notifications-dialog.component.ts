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

import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideCheck, lucideRefreshCw, lucideTrash2 } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { Z_MODAL_DATA, ZardDialogRef } from '@common-ui/ui/dialog';

import {
  NotificationApiService,
  UserNotification,
} from '@/app-modules/core/services/notification-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

export interface AlertsNotificationsDialogData {
  msgType: string;
  messages: UserNotification[];
  notificationTypeID: number;
  onClosed: () => void;
}

const ROWS_PER_PAGE = 3;

/**
 * Notification-list dialog (old `AlertsNotificationsDialogComponent`): the rows of one
 * notification type with per-row read/unread toggle + delete, and Read All / Unread All.
 * Every mutation re-fetches the list (old `reInitialize`), filtering `'future'` rows.
 */
@Component({
  selector: 'app-alerts-notifications-dialog',
  imports: [NgIcon, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideCheck, lucideRefreshCw, lucideTrash2 })],
  template: `
    <div class="flex min-h-[300px] flex-col gap-3 text-sm">
      @for (row of pagedRows(); track row.userNotificationMapID) {
        <div class="flex items-start gap-2 border-b border-border pb-3 last:border-b-0">
          <div class="min-w-0 flex-1" [class.font-semibold]="row.notificationState === 'unread'">
            <h4>{{ row.notification?.notification }}</h4>
            <p class="text-muted-foreground" [class.font-semibold]="row.notificationState === 'unread'">
              {{ row.notification?.notificationDesc }}
            </p>
          </div>
          <button
            type="button"
            class="p-1 text-muted-foreground hover:text-destructive"
            title="Delete"
            (click)="deleteNotification(row.userNotificationMapID!)"
          >
            <ng-icon name="lucideTrash2" class="text-base" />
          </button>
          @if (row.notificationState === 'unread') {
            <button
              type="button"
              class="p-1 text-muted-foreground hover:text-primary"
              title="Read"
              (click)="setSingle('read', row.userNotificationMapID!)"
            >
              <ng-icon name="lucideCheck" class="text-base" />
            </button>
          } @else if (row.notificationState === 'read') {
            <button
              type="button"
              class="p-1 text-muted-foreground hover:text-primary"
              title="Unread"
              (click)="setSingle('unread', row.userNotificationMapID!)"
            >
              <ng-icon name="lucideRefreshCw" class="text-base" />
            </button>
          }
        </div>
      } @empty {
        <p class="py-6 text-center text-muted-foreground">
          No {{ heading }} messages found
        </p>
      }

      @if (pageCount() > 1) {
        <div class="flex items-center justify-end gap-2 text-xs">
          <span class="text-muted-foreground">Page {{ pageIndex() + 1 }} of {{ pageCount() }}</span>
          <button z-button zSize="sm" zType="outline" type="button" [zDisabled]="pageIndex() === 0" (click)="prevPage()">
            Prev
          </button>
          <button
            z-button
            zSize="sm"
            zType="outline"
            type="button"
            [zDisabled]="pageIndex() >= pageCount() - 1"
            (click)="nextPage()"
          >
            Next
          </button>
        </div>
      }

      <div class="mt-2 flex justify-end gap-2">
        <button z-button zSize="sm" type="button" (click)="setAll('read')">Read All</button>
        <button z-button zSize="sm" zType="outline" type="button" (click)="setAll('unread')">Unread All</button>
        <button z-button zSize="sm" zType="outline" type="button" (click)="dialogRef.close()">Close</button>
      </div>
    </div>
  `,
})
export class AlertsNotificationsDialogComponent implements OnDestroy {
  private readonly data = inject<AlertsNotificationsDialogData>(Z_MODAL_DATA);
  private readonly notificationApi = inject(NotificationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  protected readonly dialogRef = inject(ZardDialogRef);

  protected readonly heading = this.data.msgType.toLowerCase();
  protected readonly messages = signal<UserNotification[]>(this.data.messages);

  protected readonly pageIndex = signal(0);
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.messages().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.messages().slice(start, start + ROWS_PER_PAGE);
  });

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }
  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  private allIds(): number[] {
    return this.messages()
      .map((m) => m.userNotificationMapID)
      .filter((id): id is number => id != null);
  }

  protected setAll(status: 'read' | 'unread'): void {
    this.notificationApi.changeNotificationStatus(status, this.allIds()).subscribe({
      next: (res) => {
        if (res?.data?.status === 'success') this.reInitialize();
      },
    });
  }

  protected setSingle(status: 'read' | 'unread', id: number): void {
    this.notificationApi.changeNotificationStatus(status, [id]).subscribe({
      next: (res) => {
        if (res?.data?.status === 'success') this.reInitialize();
      },
    });
  }

  protected deleteNotification(id: number): void {
    this.notify.confirm('Are you sure you want to delete?', '').subscribe((ok) => {
      if (!ok) return;
      this.notificationApi.markDeleteNotification([id]).subscribe({
        next: (res) => {
          if (res?.data?.status === 'success') this.reInitialize();
        },
      });
    });
  }

  /** Old `reInitialize` — refetch this type's rows, dropping `'future'` ones. */
  private reInitialize(): void {
    const serviceId = this.sessionStore.currentServiceId();
    const roleId = this.sessionStore.currentRoleId();
    if (serviceId == null || roleId == null) return;
    this.notificationApi
      .getAlertsAndNotificationDetail(
        Number(this.sessionStore.userId()),
        roleId,
        this.data.notificationTypeID,
        serviceId,
      )
      .subscribe({
        next: (res) => {
          const rows = (res?.data ?? []).filter((m) => m.notificationState !== 'future');
          this.messages.set(rows);
          this.pageIndex.update((i) => Math.min(i, this.pageCount() - 1));
        },
      });
  }

  ngOnDestroy(): void {
    this.data.onClosed();
  }
}
