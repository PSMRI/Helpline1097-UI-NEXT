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
  OnInit,
  signal,
} from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePhoneOutgoing } from '@ng-icons/lucide';

import { ZardInputDirective } from '@common-ui/ui/input';

import { OutboundDialService } from './outbound-dial.service';
import { formatWorklistDateTime } from './worklist-date';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { OutboundApiService } from '@/app-modules/core/services/outbound-api.service';
import { ENCRYPTED_KEYS } from '@/app-modules/core/services/session-storage.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** PascalCase fields are the backend's names, kept verbatim. */
interface EverwellRow {
  eapiId?: number | string;
  beneficiaryID?: number | string;
  beneficiaryRegId?: number | string;
  FirstName?: string;
  LastName?: string;
  State?: string;
  District?: string;
  comments?: unknown;
  lastCall?: number | string;
  callCounter?: number;
  PrimaryNumber?: string;
  [key: string]: unknown;
}

/** Everwell outbound worklist tab (old `everwell-outbound-worklist`) — dial hands off via
 * `outboundEverwellData` + `isEverwellCall`; the in-call adherence slide is Phase 8. */
@Component({
  selector: 'app-everwell-worklist-tab',
  imports: [NgIcon, ReactiveFormsModule, ZardInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucidePhoneOutgoing })],
  template: `
    <div class="flex flex-col gap-3 py-3">
      @if (rows().length) {
        <input
          z-input
          type="text"
          class="w-64"
          placeholder="Search"
          [formControl]="search"
          (input)="filter()"
        />
      }
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">Beneficiary ID</th>
              <th class="px-3 py-2">Name</th>
              <th class="px-3 py-2">State</th>
              <th class="px-3 py-2">District</th>
              <th class="px-3 py-2">Comments</th>
              <th class="px-3 py-2">Last Call</th>
              <th class="px-3 py-2">Call Count</th>
              <th class="px-3 py-2">Call</th>
            </tr>
          </thead>
          <tbody>
            @for (row of filtered(); track $index) {
              <tr class="border-t border-border">
                <td class="px-3 py-2">{{ row.beneficiaryID }}</td>
                <td class="px-3 py-2">{{ row.FirstName }} {{ row.LastName }}</td>
                <td class="px-3 py-2">{{ row.State }}</td>
                <td class="px-3 py-2">{{ row.District }}</td>
                <td class="px-3 py-2">{{ comments(row) }}</td>
                <td class="px-3 py-2">{{ lastCall(row) }}</td>
                <td class="px-3 py-2">{{ row.callCounter }}</td>
                <td class="px-3 py-2">
                  <button
                    type="button"
                    class="text-primary hover:text-primary/80"
                    title="Call Beneficiary"
                    aria-label="Call Beneficiary"
                    (click)="dial(row)"
                  >
                    <ng-icon name="lucidePhoneOutgoing" size="18" aria-hidden="true" />
                  </button>
                </td>
              </tr>
            } @empty {
              <tr>
                <td colspan="8" class="px-3 py-6 text-center text-muted-foreground">
                  No Records Found
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      <p class="text-xs text-muted-foreground">Total Count: {{ filtered().length }}</p>
    </div>
  `,
})
export class EverwellWorklistTabComponent implements OnInit {
  private readonly outboundApi = inject(OutboundApiService);
  private readonly dialService = inject(OutboundDialService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  protected readonly rows = signal<EverwellRow[]>([]);
  protected readonly filtered = signal<EverwellRow[]>([]);
  protected readonly search = new FormControl('', { nonNullable: true });

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  ngOnInit(): void {
    const serviceId = this.serviceId();
    const userId = this.sessionStore.userId();
    if (serviceId == null || userId == null) {
      return;
    }
    this.outboundApi.getEverwellOutboundWorklist(serviceId, userId).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? (res.data as EverwellRow[]) : [];
        this.rows.set(rows);
        this.filtered.set(rows);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load the worklist', 'error'),
    });
  }

  protected comments(row: EverwellRow): string {
    const value = row.comments;
    if (value == null || value === 'NaN' || (typeof value === 'number' && isNaN(value))) {
      return 'N/A';
    }
    return String(value);
  }

  protected lastCall(row: EverwellRow): string {
    return (row.callCounter ?? 0) > 0 && row.lastCall != null
      ? formatWorklistDateTime(row.lastCall)
      : 'N/A';
  }

  protected filter(): void {
    const term = this.search.value.trim().toLowerCase();
    if (!term) {
      this.filtered.set(this.rows());
      return;
    }
    this.filtered.set(
      this.rows().filter((row) =>
        [row.FirstName, row.PrimaryNumber, row.beneficiaryID].some((v) =>
          String(v ?? '').toLowerCase().includes(term),
        ),
      ),
    );
  }

  protected dial(row: EverwellRow): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.callStore.everwellCallNotConnected.set(null);
    this.callStore.checkEverwellResponse.set(false);
    this.callStore.feedbackData.set([]);
    this.callStore.updatedFeedbackList.set([]);
    this.callStore.outboundBenRegID.set(row.beneficiaryRegId ?? null);
    this.callStore.outboundEverwellData.set(row as Record<string, unknown>);

    this.outboundApi.checkIfAlreadyCalled(row.eapiId ?? '', serviceId).subscribe({
      next: (res) => {
        // Old guard read isCompleted off the TOP-LEVEL envelope and acted only when the
        // flag was present: true → alert, false → dial, absent → nothing.
        const isCompleted = (res as { isCompleted?: boolean } | null)?.isCompleted;
        if (isCompleted == null) {
          return;
        }
        if (isCompleted === true) {
          this.notify.alert('Call is already completed by agent', 'info');
          return;
        }
        this.dialService.dial(row.PrimaryNumber ?? '', ENCRYPTED_KEYS.isEverwellCall);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Something went wrong', 'error'),
    });
  }
}
