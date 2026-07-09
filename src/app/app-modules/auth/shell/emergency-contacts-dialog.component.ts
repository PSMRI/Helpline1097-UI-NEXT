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
import { switchMap } from 'rxjs/operators';

import {
  EmergencyContact,
  NotificationApiService,
} from '@/app-modules/core/services/notification-api.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

const EMERGENCY_CONTACT_TYPE = 'Emergency Contact';

/**
 * Emergency-contacts dialog. Faithful to the old `EmergencyContactsViewModalComponent`:
 * resolves the "Emergency Contact" notification type for the current service, then lists the
 * contacts. Opened via ZardDialogService with `zContent: EmergencyContactsDialogComponent`.
 */
@Component({
  selector: 'app-emergency-contacts-dialog',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (loading()) {
      <p class="py-6 text-center text-sm text-muted-foreground">Loading…</p>
    } @else if (error()) {
      <p class="py-6 text-center text-sm text-destructive">{{ error() }}</p>
    } @else if (contacts().length === 0) {
      <p class="py-6 text-center text-sm text-muted-foreground">No emergency contacts found.</p>
    } @else {
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b text-left text-muted-foreground">
            <th class="py-1.5 pr-4 font-medium">Name</th>
            <th class="py-1.5 pr-4 font-medium">Designation</th>
            <th class="py-1.5 pr-4 font-medium">Location</th>
            <th class="py-1.5 font-medium">Contact No.</th>
          </tr>
        </thead>
        <tbody>
          @for (c of contacts(); track $index) {
            <tr class="border-b last:border-0">
              <td class="py-1.5 pr-4">{{ c.emergContactName }}</td>
              <td class="py-1.5 pr-4">{{ c.designation }}</td>
              <td class="py-1.5 pr-4">{{ c.location }}</td>
              <td class="py-1.5">{{ c.emergContactNo }}</td>
            </tr>
          }
        </tbody>
      </table>
    }
  `,
})
export class EmergencyContactsDialogComponent implements OnInit {
  private readonly notificationApi = inject(NotificationApiService);
  private readonly sessionStore = inject(SessionStore);

  protected readonly loading = signal(true);
  protected readonly error = signal('');
  protected readonly contacts = signal<EmergencyContact[]>([]);

  ngOnInit(): void {
    const serviceId = this.sessionStore.currentServiceId();
    if (serviceId == null) {
      this.loading.set(false);
      this.error.set('No service selected.');
      return;
    }

    this.notificationApi
      .getNotificationTypes(serviceId)
      .pipe(
        switchMap((res) => {
          const type = (res?.data ?? []).find((t) => t.notificationType === EMERGENCY_CONTACT_TYPE);
          if (!type?.notificationTypeID) {
            throw new Error('Emergency contacts are not configured for this service.');
          }
          return this.notificationApi.getEmergencyContacts(serviceId, type.notificationTypeID);
        }),
      )
      .subscribe({
        next: (res) => {
          this.contacts.set(res?.data ?? []);
          this.loading.set(false);
        },
        error: (err: { message?: string; errorMessage?: string }) => {
          this.error.set(err?.message ?? err?.errorMessage ?? 'Failed to load emergency contacts.');
          this.loading.set(false);
        },
      });
  }
}
