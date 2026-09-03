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

import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { Z_MODAL_DATA, ZardDialogRef } from '@common-ui/ui/dialog';

import { CoServicesApiService } from '@/app-modules/core/services/co-services-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** One prior call (services/getBeneficiaryCallsHistory row — backend casing verbatim). */
interface CallHistoryRow {
  benCallID?: number | string;
  createdDate?: number | string;
  informationServices?: string;
  counsellingServices?: string;
  referralServices?: string;
  feedbackServices?: string;
  callTypeObj?: { callGroupType?: string; callType?: string };
  remarks?: string;
  [key: string]: unknown;
}

/** Handed over by the registration slide. */
export interface BeneficiaryHistoryData {
  beneficiaryRegID: number | string;
  /** Old `afterClosed()` — the registration links the beneficiary once this runs. */
  onClosed: () => void;
}

const ROWS_PER_PAGE = 5;

/**
 * Beneficiary call-history dialog (old `BeneficiaryHistoryComponent`). Opens on EVERY
 * search-row select (not the edit path) BEFORE the beneficiary is linked to the call; the
 * link + wizard advance happen only after it closes. Old quirks kept:
 *  - the just-started call is stripped CLIENT-side (loose `!=` against the current
 *    benCallID — the server returns it too);
 *  - Call Time renders through the fake-UTC shift (`millisToUTCDate`): the timestamp's UTC
 *    components are re-read as local before formatting, blank when absent.
 */
@Component({
  selector: 'app-beneficiary-history-dialog',
  imports: [DatePipe, ZardButtonComponent],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 text-sm">
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">Beneficiary Call Id</th>
              <th class="px-3 py-2">Call Time</th>
              <th class="px-3 py-2">Information</th>
              <th class="px-3 py-2">Counselling</th>
              <th class="px-3 py-2">Referral</th>
              <th class="px-3 py-2">Feedback</th>
              <th class="px-3 py-2">Call Type</th>
              <th class="px-3 py-2">Call Subtype</th>
              <th class="px-3 py-2">Remarks</th>
            </tr>
          </thead>
          <tbody>
            @for (service of pagedRows(); track $index) {
              <tr class="border-t border-border align-top">
                <td class="px-3 py-2">{{ service.benCallID }}</td>
                <td class="px-3 py-2">
                  {{ callTime(service.createdDate) | date: 'dd/MM/yyyy hh:mm a' }}
                </td>
                <td class="px-3 py-2">{{ service.informationServices }}</td>
                <td class="px-3 py-2">{{ service.counsellingServices }}</td>
                <td class="px-3 py-2">{{ service.referralServices }}</td>
                <td class="px-3 py-2">{{ service.feedbackServices }}</td>
                <td class="px-3 py-2">{{ service.callTypeObj?.callGroupType }}</td>
                <td class="px-3 py-2">{{ service.callTypeObj?.callType }}</td>
                <td class="px-3 py-2">{{ service.remarks }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="9" class="px-3 py-6 text-center text-muted-foreground">
                  No records found
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>

      <div class="flex items-center justify-between gap-3">
        <span class="text-muted-foreground">Total no. of records: {{ rows().length }}</span>
        <div class="flex items-center gap-3">
          @if (rows().length) {
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
          }
          <button z-button type="button" (click)="close()">OK</button>
        </div>
      </div>
    </div>
  `,
})
export class BeneficiaryHistoryDialogComponent implements OnInit, OnDestroy {
  private readonly api = inject(CoServicesApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);
  private readonly dialogRef = inject(ZardDialogRef);
  protected readonly data = inject<BeneficiaryHistoryData>(Z_MODAL_DATA);

  protected readonly rows = signal<CallHistoryRow[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.rows().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.rows().slice(start, start + ROWS_PER_PAGE);
  });

  ngOnInit(): void {
    // Old dialog read current_service.providerServiceMapID (the 4th of the 4 old call sites).
    const calledServiceID = this.sessionStore.currentProviderServiceMapId();
    if (calledServiceID == null) {
      return;
    }
    const currentCallID = this.callStore.benCallID();
    this.api.getBeneficiaryCallsHistory(this.data.beneficiaryRegID, calledServiceID).subscribe({
      next: (res) => {
        const list = Array.isArray(res?.data) ? (res.data as CallHistoryRow[]) : [];
        // Old `getFilteredCallHistory`: strip the in-progress call, loose comparison.
        // eslint-disable-next-line eqeqeq
        this.rows.set(list.filter((row) => row.benCallID != currentCallID));
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load call history', 'error'),
    });
  }

  ngOnDestroy(): void {
    // Old `afterClosed()` — link + advance regardless of how the dialog closed.
    this.data.onClosed();
  }

  /** Old `millisToUTCDate` — UTC components re-read as local (fake-UTC shift), null-safe. */
  protected callTime(value: number | string | undefined): Date | null {
    if (value == null || value === '') {
      return null;
    }
    const d = new Date(value as number);
    if (isNaN(d.getTime())) {
      return null;
    }
    return new Date(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      d.getUTCHours(),
      d.getUTCMinutes(),
      d.getUTCSeconds(),
    );
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }

  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  protected close(): void {
    this.dialogRef.close();
  }
}
