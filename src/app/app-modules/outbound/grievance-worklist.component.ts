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
import { lucideEye, lucidePhoneOutgoing } from '@ng-icons/lucide';

import { ZardInputDirective } from '@common-ui/ui/input';

import { formatWorklistDateTime } from './worklist-date';
import { CtiService } from '@/app-modules/core/services/cti.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { OutboundApiService } from '@/app-modules/core/services/outbound-api.service';
import {
  ENCRYPTED_KEYS,
  SessionStorageService,
} from '@/app-modules/core/services/session-storage.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** A grievance worklist row — `severety` misspelling and `beneficiaryRegId` casing are the
 * backend's field names, kept verbatim. */
interface GrievanceRow {
  complaintID?: number | string;
  subjectOfComplaint?: string;
  complaint?: string;
  state?: string;
  severety?: string;
  lastCall?: number | string;
  callCounter?: number;
  primaryNumber?: string;
  beneficiaryRegId?: number | string;
  [key: string]: unknown;
}

/**
 * Grievance outbound worklist tab (old `grievance-outbound-worklist`): the complaints
 * allocated to this agent. View opens the complaint text; the dial hands the row off to
 * the grievance-resolution slide (Phase 6f) via `outboundGrievanceData` + the
 * `isGrievanceCall` flag.
 */
@Component({
  selector: 'app-grievance-worklist',
  imports: [NgIcon, ReactiveFormsModule, ZardInputDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucideEye, lucidePhoneOutgoing })],
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
              <th class="px-3 py-2">Complaint ID</th>
              <th class="px-3 py-2">Subject of Complaint</th>
              <th class="px-3 py-2">State</th>
              <th class="px-3 py-2">Severity</th>
              <th class="px-3 py-2">Last Call</th>
              <th class="px-3 py-2">Call Count</th>
              <th class="px-3 py-2">View</th>
              <th class="px-3 py-2">Call</th>
            </tr>
          </thead>
          <tbody>
            @for (row of filtered(); track $index) {
              <tr class="border-t border-border">
                <td class="px-3 py-2">{{ row.complaintID }}</td>
                <td class="px-3 py-2">{{ row.subjectOfComplaint || 'N/A' }}</td>
                <td class="px-3 py-2">{{ row.state }}</td>
                <td class="px-3 py-2">{{ row.severety }}</td>
                <td class="px-3 py-2">{{ lastCall(row) }}</td>
                <td class="px-3 py-2">{{ row.callCounter }}</td>
                <td class="px-3 py-2">
                  <button
                    type="button"
                    class="text-muted-foreground hover:text-foreground"
                    title="View complaint"
                    aria-label="View complaint"
                    (click)="viewComplaint(row)"
                  >
                    <ng-icon name="lucideEye" size="18" aria-hidden="true" />
                  </button>
                </td>
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
export class GrievanceWorklistComponent implements OnInit {
  private readonly outboundApi = inject(OutboundApiService);
  private readonly cti = inject(CtiService);
  private readonly notify = inject(NotificationService);
  private readonly storage = inject(SessionStorageService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  protected readonly rows = signal<GrievanceRow[]>([]);
  protected readonly filtered = signal<GrievanceRow[]>([]);
  protected readonly search = new FormControl('', { nonNullable: true });

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  ngOnInit(): void {
    const serviceId = this.serviceId();
    const userId = this.sessionStore.userId();
    if (serviceId == null || userId == null) {
      return;
    }
    this.outboundApi.getGrievanceOutboundWorklist(serviceId, userId).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? (res.data as GrievanceRow[]) : [];
        this.rows.set(rows);
        this.filtered.set(rows);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load the worklist', 'error'),
    });
  }

  protected lastCall(row: GrievanceRow): string {
    // Old cell: date shown only when callCounter > 0 AND lastCall present, else 'N/A'.
    return (row.callCounter ?? 0) > 0 && row.lastCall != null
      ? formatWorklistDateTime(row.lastCall)
      : 'N/A';
  }

  /** Old `filterComponentList` — substring match over exactly these four keys. */
  protected filter(): void {
    const term = this.search.value.trim().toLowerCase();
    if (!term) {
      this.filtered.set(this.rows());
      return;
    }
    this.filtered.set(
      this.rows().filter((row) =>
        [row.complaintID, row.subjectOfComplaint, row.severety, row.state].some((v) =>
          String(v ?? '').toLowerCase().includes(term),
        ),
      ),
    );
  }

  /** Old `viewComplaintDesc` — description dialog, or an info alert when there is none. */
  protected viewComplaint(row: GrievanceRow): void {
    if (row.complaint == null || row.complaint === '') {
      this.notify.alert('No complaint description found', 'info');
      return;
    }
    this.notify.info(row.complaint, `Complaint ${row.complaintID ?? ''}`);
  }

  /** Old `listBenDetailsOnPhoneNo` — stash the row, dial, set the grievance call flags. */
  protected dial(row: GrievanceRow): void {
    // Old quirk kept: the worklist stores `beneficiaryRegId` (lowercase d); downstream
    // readers use `beneficiaryRegID` off the full row.
    this.callStore.outboundBenRegID.set(row.beneficiaryRegId ?? null);
    this.callStore.outboundGrievanceData.set(row as Record<string, unknown>);
    this.cti.dialBeneficiary(row.primaryNumber ?? '').subscribe({
      next: (res) => {
        if (((res as { status?: string })?.status ?? '').toLowerCase() === 'fail') {
          this.notify.alert('Something went wrong in calling', 'error');
          return;
        }
        this.callStore.cli.set(row.primaryNumber ?? null);
        this.callStore.setOnCall(true);
        this.storage.setItem(ENCRYPTED_KEYS.isGrievanceCall, 'yes');
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Something went wrong in calling', 'error'),
    });
  }
}
