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

import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { Router } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePhoneOutgoing } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@common-ui/ui/button';

import { OutboundDialService } from './outbound-dial.service';
import { formatWorklistDate } from './worklist-date';
import { WorklistTable } from './worklist-table';
import { CallApiService } from '@/app-modules/core/services/call-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

interface OutboundRow {
  outboundCallReqID?: number | string;
  prefferedDateTime?: number | string;
  requestedFor?: string;
  requestedService?: { subServiceName?: string };
  beneficiary?: {
    beneficiaryID?: number | string;
    beneficiaryRegID?: number | string;
    firstName?: string;
    lastName?: string;
    benPhoneMaps?: { phoneNo?: string }[];
  };
  [key: string]: unknown;
}

/** Generic outbound worklist tab (old `outbond-worklist`) — the agent's assigned
 * follow-up calls; dial rings via CZentrix and the shell CTI listener opens the screen.
 * Table reproduces the old md2DataTable: 4/page, sortable columns, serial number. */
@Component({
  selector: 'app-generic-worklist',
  imports: [NgIcon, ZardButtonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  viewProviders: [provideIcons({ lucidePhoneOutgoing })],
  template: `
    <div class="flex flex-col gap-3 py-3">
      <div class="flex items-center justify-between">
        <h2 class="text-base font-semibold">Outbound Worklist</h2>
        <button z-button zType="outline" type="button" (click)="backToDashboard()">
          Back to Dashboard
        </button>
      </div>
      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">S.No</th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('id')">
                Beneficiary ID {{ table.sortIndicator('id') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('name')">
                Beneficiary Name {{ table.sortIndicator('name') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('date')">
                Requested Date {{ table.sortIndicator('date') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('service')">
                Requested Service {{ table.sortIndicator('service') }}
              </th>
              <th class="cursor-pointer px-3 py-2" (click)="table.toggleSort('remarks')">
                Remarks {{ table.sortIndicator('remarks') }}
              </th>
              <th class="px-3 py-2">Call</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.paged(); track $index) {
              <tr class="border-t border-border">
                <td class="px-3 py-2">{{ table.serial($index) }}</td>
                <td class="px-3 py-2">{{ row.beneficiary?.beneficiaryID }}</td>
                <td class="px-3 py-2">
                  {{ row.beneficiary?.firstName }} {{ row.beneficiary?.lastName }}
                </td>
                <td class="px-3 py-2">{{ requestedDate(row) }}</td>
                <td class="px-3 py-2">{{ row.requestedService?.subServiceName }}</td>
                <td class="px-3 py-2">{{ row.requestedFor }}</td>
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
                <td colspan="7" class="px-3 py-6 text-center text-muted-foreground">
                  No Records Found
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
      @if (rows().length) {
        <div class="flex items-center justify-between gap-3 text-sm">
          <span class="text-muted-foreground">Total Count: {{ table.sorted().length }}</span>
          <div class="flex items-center gap-3">
            <span class="text-muted-foreground">Page {{ table.pageIndex() + 1 }} of {{ table.pageCount() }}</span>
            <button z-button zSize="sm" zType="outline" type="button" [zDisabled]="table.pageIndex() === 0" (click)="table.prev()">
              Prev
            </button>
            <button
              z-button
              zSize="sm"
              zType="outline"
              type="button"
              [zDisabled]="table.pageIndex() >= table.pageCount() - 1"
              (click)="table.next()"
            >
              Next
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class GenericWorklistComponent implements OnInit {
  private readonly callApi = inject(CallApiService);
  private readonly dialService = inject(OutboundDialService);
  private readonly notify = inject(NotificationService);
  private readonly router = inject(Router);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  protected readonly rows = signal<OutboundRow[]>([]);
  protected readonly table = new WorklistTable<OutboundRow>(4);
  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  constructor() {
    this.table.setAccessors({
      id: (r) => r.beneficiary?.beneficiaryID,
      name: (r) => `${r.beneficiary?.firstName ?? ''} ${r.beneficiary?.lastName ?? ''}`.trim(),
      date: (r) => (r.prefferedDateTime != null ? Number(r.prefferedDateTime) : null),
      service: (r) => r.requestedService?.subServiceName,
      remarks: (r) => r.requestedFor,
    });
  }

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.callApi.getAgentOutboundWorklist(serviceId, this.sessionStore.userId()).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? (res.data as OutboundRow[]) : [];
        this.rows.set(rows);
        this.table.setRows(rows);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load the worklist', 'error'),
    });
  }

  protected requestedDate(row: OutboundRow): string {
    return row.prefferedDateTime != null ? formatWorklistDate(row.prefferedDateTime) : '';
  }

  protected dial(row: OutboundRow): void {
    // Old quirk: outboundBenRegID stores the 12-digit beneficiaryID, not the regID.
    this.callStore.outboundBenRegID.set(row.beneficiary?.beneficiaryID ?? null);
    this.callStore.outboundData.set(row as Record<string, unknown>);
    this.dialService.dial(row.beneficiary?.benPhoneMaps?.[0]?.phoneNo ?? '');
  }

  protected backToDashboard(): void {
    this.router.navigate(['/MultiRoleScreenComponent/dashboard']);
  }
}
