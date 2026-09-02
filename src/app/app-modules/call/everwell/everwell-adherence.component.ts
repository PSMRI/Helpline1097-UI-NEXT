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
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardDialogService } from '@common-ui/ui/dialog';

import { EverwellApiService, EverwellFamilyRow, EverwellFeedbackRow } from './everwell-api.service';
import { SupportActionData, SupportActionDialogComponent } from './support-action-dialog.component';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CallApiService } from '@/app-modules/core/services/call-api.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { buildStartCallRequest, captureStartCallResponse } from '../start-call.helpers';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const ROWS_PER_PAGE = 4;

interface CalendarMonth {
  name: string;
  days: number;
}

/**
 * Everwell in-call adherence slide (old `everwell-worklist`, NOT the outbound worklist tab).
 * Two views:
 *  - family table: everyone on the dialed number (self first), click a row to open their
 *    adherence calendar;
 *  - calendar: the current + two previous months as day chips, dose feedback color-coded,
 *    with only the LAST 15 DAYS clickable — a click opens the support-action dialog.
 *
 * The old component also declared a `showEditForm` view ("Save Patient Feedback"), but
 * nothing ever set it true — dead UI, not ported.
 *
 * On init it opens the outbound call record via `call/startCall` (gated on benCallID being
 * unset, like the grievance slide — the old carousel kept this component alive so its
 * ungated init call still fired only once per call).
 */
@Component({
  selector: 'app-everwell-adherence',
  imports: [ZardButtonComponent],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (view() === 'table') {
      <div class="flex flex-col gap-3">
        <h4 class="text-base font-semibold">Everwell Worklist</h4>
        <div class="overflow-x-auto rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-3 py-2">Beneficiary ID</th>
                <th class="px-3 py-2">Beneficiary Name</th>
                <th class="px-3 py-2">Gender</th>
                <th class="px-3 py-2">State</th>
                <th class="px-3 py-2">Comments</th>
                <th class="px-3 py-2">Last Call</th>
                <th class="px-3 py-2">Call Count</th>
                <th class="px-3 py-2">Relationship</th>
              </tr>
            </thead>
            <tbody>
              @for (ben of pagedRows(); track $index) {
                <tr class="cursor-pointer border-t border-border hover:bg-muted/30" (click)="selectMember(ben)">
                  <td class="px-3 py-2">{{ ben.beneficiaryID }}</td>
                  <td class="px-3 py-2">{{ ben.FirstName }} {{ ben.LastName }}</td>
                  <td class="px-3 py-2">{{ ben.Gender }}</td>
                  <td class="px-3 py-2">{{ ben.State }}</td>
                  <td class="px-3 py-2">{{ comments(ben) }}</td>
                  <td class="px-3 py-2">{{ lastCall(ben) }}</td>
                  <td class="px-3 py-2">{{ ben.callCounter }}</td>
                  <!-- Old: row 0 of the (self-first) list is Self, everyone else Others. -->
                  <td class="px-3 py-2">{{ rows().indexOf(ben) === 0 ? 'Self' : 'Others' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="px-3 py-6 text-center text-muted-foreground">No records found</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        @if (rows().length) {
          <div class="flex items-center justify-end gap-3 text-sm">
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
      </div>
    } @else {
      <div class="flex flex-col gap-3 text-sm">
        <div class="flex items-center justify-between gap-3">
          <span>
            <strong>Everwell missed doses count:</strong>
            {{ selected()?.NoInfoDoseCount ?? 0 }}
          </span>
          <button z-button zType="outline" type="button" (click)="backToTable()">Back</button>
        </div>
        <div>
          <strong>Everwell missed doses dates:</strong>
          @if (dosesDates().length > 0) {
            @for (d of dosesDates(); track $index) {
              <span class="pr-2">{{ formatDoseDate(d) }}</span>
            }
          } @else {
            <span>N/A</span>
          }
        </div>

        @for (m of months; track m.name) {
          <div>
            <span class="font-bold" [class.text-green-600]="m.name === currentMonthName">{{ m.name }}</span>
            <div class="mt-1 flex flex-wrap gap-1.5">
              @for (day of dayRange(m.days); track day) {
                <button
                  type="button"
                  class="h-8 w-9 rounded-full border border-border text-xs"
                  [class]="chipClass(day, m.name)"
                  [class.cursor-pointer]="inLastFifteen(m.name, day)"
                  (click)="onChipClick(m.name, day)"
                >
                  {{ day < 10 ? '0' + day : day }}
                </button>
              }
            </div>
          </div>
        }

        <ul class="flex flex-col gap-1.5">
          <li class="flex items-center gap-2">
            <span class="inline-block h-4 w-4 rounded" style="background-color: #66ff66"></span>
            Dose taken but not reported by technology
          </li>
          <li class="flex items-center gap-2">
            <span class="inline-block h-4 w-4 rounded" style="background-color: red"></span>
            Dose not taken
          </li>
          <li class="flex items-center gap-2">
            <span class="inline-block h-4 w-4 rounded" style="background-color: #ff6600"></span>
            Other Subcategories
          </li>
          <li class="flex items-center gap-2">
            <span class="inline-block h-4 w-4 rounded" style="background-color: #80ccff"></span>
            No previous feedback
          </li>
        </ul>
      </div>
    }
  `,
})
export class EverwellAdherenceComponent implements OnInit {
  private readonly api = inject(EverwellApiService);
  private readonly callApi = inject(CallApiService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(ZardDialogService);
  private readonly datePipe = inject(DatePipe);
  private readonly callStore = inject(CallStore);
  private readonly sessionStore = inject(SessionStore);

  protected readonly view = signal<'table' | 'calendar'>('table');
  protected readonly rows = signal<EverwellFamilyRow[]>([]);
  protected readonly selected = signal<EverwellFamilyRow | null>(null);
  protected readonly dosesDates = signal<Date[]>([]);
  protected readonly pageIndex = signal(0);

  private feedbackDetails: EverwellFeedbackRow[] = [];
  private srcPath: string | null = null;
  private fileName: string | null = null;

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.rows().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.rows().slice(start, start + ROWS_PER_PAGE);
  });

  protected readonly currentMonthName = MONTH_NAMES[new Date().getMonth()];

  /**
   * Old `getcurrentmonth()`: the Jan..Dec month list FILTERED to {current, -1, -2} (year-
   * wrapped), so the display order is calendar order, not chronological — e.g. in January
   * the panels read January, November, December. Kept verbatim.
   */
  protected readonly months: CalendarMonth[] = (() => {
    const year = new Date().getFullYear();
    const monthIdx = new Date().getMonth();
    const wrap = (n: number) => ((n % 12) + 12) % 12;
    const keep = new Set([
      MONTH_NAMES[monthIdx],
      MONTH_NAMES[wrap(monthIdx - 1)],
      MONTH_NAMES[wrap(monthIdx - 2)],
    ]);
    return MONTH_NAMES.map((name, i) => ({
      name,
      days: new Date(year, i + 1, 0).getDate(),
    })).filter((m) => keep.has(m.name));
  })();

  /** Old `ar` — the last 15 days as "D MonthName" strings (index 0 = yesterday). */
  private readonly lastFifteen: string[] = (() => {
    const out: string[] = [];
    for (let i = 1; i <= 15; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      out.push(`${d.getDate()} ${MONTH_NAMES[d.getMonth()]}`);
    }
    return out;
  })();

  ngOnInit(): void {
    this.startOutboundCall();
    this.loadFamily();
  }

  /** Old `startOutBoundCall` — open the call record once (`benCallID` gate, cf. grievance). */
  private startOutboundCall(): void {
    const data = this.callStore.outboundEverwellData();
    if (!data || this.callStore.benCallID() != null) {
      return;
    }
    const request = buildStartCallRequest(this.sessionStore, this.callStore, {
      // Old everwell start used the dialed caller number (CLI), not the row's PrimaryNumber.
      phoneNo: this.callStore.cli(),
      beneficiaryRegID: (data['beneficiaryRegId'] as number | string | undefined) ?? null,
    });
    this.callApi.startCall(request).subscribe({
      next: (res) => captureStartCallResponse(res, this.callStore),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to start call', 'error'),
    });
  }

  /** Old `listBenDetails` — family members on the number, dialed member moved to the top. */
  private loadFamily(): void {
    const data = this.callStore.outboundEverwellData() ?? {};
    this.api
      .familyOnPhoneNumber(
        data['providerServiceMapId'] as number | undefined,
        data['PrimaryNumber'] as string | undefined,
      )
      .subscribe({
        next: (res) => {
          const list = Array.isArray(res?.data) ? [...res.data] : [];
          const selfIdx = list.findIndex((row) => row.eapiId === data['eapiId']);
          if (selfIdx > 0) {
            const [self] = list.splice(selfIdx, 1);
            list.unshift(self);
          }
          this.rows.set(list);
        },
        error: (err: { errorMessage?: string }) =>
          this.notify.alert(err?.errorMessage ?? 'Failed to load beneficiaries', 'error'),
      });
  }

  // ---- table helpers (old template ternaries) -------------------------------
  protected comments(row: EverwellFamilyRow): string {
    const value = row.comments;
    return value !== 'NaN' && value !== undefined && value !== null ? String(value) : 'N/A';
  }

  protected lastCall(row: EverwellFamilyRow): string {
    const value = row.lastCall;
    return (row.callCounter ?? 0) > 0
      ? value !== 'NaN' && value !== undefined && value !== null
        ? String(value)
        : 'N/A'
      : 'N/A';
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }

  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  // ---- selection (old `editMode`) ------------------------------------------
  protected selectMember(ben: EverwellFamilyRow): void {
    // Old reset: the clicked member BECOMES the outbound everwell context.
    this.callStore.outboundEverwellData.set(ben as Record<string, unknown>);
    this.callStore.everwellSelectedBen.set(ben as Record<string, unknown>);
    this.selected.set(ben);
    this.fetchGuidelines(ben);
    this.fetchFeedback(ben);

    // Old `noInfoDosesDates` parse: 'MM/DD/YYYY||...' re-joined as DD/MM/YYYY before
    // `new Date()`, which yields Invalid Date for days > 12 (old bug, display-only).
    // Kept verbatim; `formatDoseDate` renders invalid entries blank because Angular 20's
    // DatePipe throws where the old pipe soldiered on.
    const raw = ben.noInfoDosesDates;
    const dates: Date[] = [];
    if (raw != null) {
      for (const token of String(raw).split('||')) {
        const [month, day, year] = token.split('/');
        dates.push(new Date(`${day}/${month}/${year}`));
      }
      dates.reverse();
    }
    this.dosesDates.set(dates);
    this.view.set('calendar');
  }

  protected backToTable(): void {
    this.view.set('table');
  }

  protected formatDoseDate(d: Date): string {
    return isNaN(d.getTime()) ? '' : (this.datePipe.transform(d, 'd MMM') ?? '');
  }

  /** Old `getEverwellGuidelines` — the PDF for the member's adherence band (data.data nest). */
  private fetchGuidelines(ben: EverwellFamilyRow): void {
    this.srcPath = null;
    this.fileName = null;
    this.api.fetchGuidelines(ben.AdherencePercentage, ben.providerServiceMapId).subscribe({
      next: (res) => {
        const list = (res?.data as { data?: { fileContent?: string; fileName?: string }[] })?.data;
        if (Array.isArray(list) && list.length > 0) {
          this.srcPath = list[0].fileContent ?? null;
          this.fileName = list[0].fileName ?? null;
        }
      },
      error: () =>
        this.notify.alert('Error in Fetching Everwell Guideline Data', 'error'),
    });
  }

  /** Old `getFeedBackDetails` — prior support actions (drives chip colors + dialog prefill). */
  private fetchFeedback(ben: EverwellFamilyRow): void {
    this.api.getFeedbackDetails(ben.Id).subscribe({
      next: (res) => {
        this.feedbackDetails =
          ((res?.data as { feedbackDetails?: EverwellFeedbackRow[] })?.feedbackDetails ?? []);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load feedback details', 'error'),
    });
  }

  // ---- calendar (old chip helpers) -----------------------------------------
  protected dayRange(days: number): number[] {
    return Array.from({ length: days }, (_, i) => i + 1);
  }

  protected inLastFifteen(monthName: string, day: number): boolean {
    return this.lastFifteen.includes(`${day} ${monthName}`);
  }

  /**
   * Old `checkColorCode`: only last-15-day chips get a color; every prior feedback whose
   * `dateOfAction` DAY-OF-MONTH matches overwrites the result (month ignored — old quirk).
   */
  protected chipClass(day: number, monthName: string): string {
    if (!this.inLastFifteen(monthName, day)) {
      return '';
    }
    let result: string | null = null;
    for (const entry of this.feedbackDetails) {
      const d = new Date(entry.dateOfAction ?? '');
      if (d.getDate() === day) {
        if (entry.subCategory === 'Dose not taken') {
          result = 'bg-red-500 text-white';
        } else if (entry.subCategory === 'Dose taken but not reported by technology') {
          result = 'bg-[#66ff66]';
        } else {
          result = 'bg-[#ff6600] text-white';
        }
      }
    }
    return result ?? 'bg-[#80ccff]';
  }

  /** Old chip `(click)` — only last-15-day chips open the support dialog. */
  protected onChipClick(monthName: string, day: number): void {
    const idx = this.lastFifteen.indexOf(`${day} ${monthName}`);
    if (idx < 0) {
      return;
    }
    // Old `callsupportdialog`: previousDay = today - (index + 1), as 'MM/dd/yyyy'.
    const d = new Date();
    d.setDate(d.getDate() - (idx + 1));
    const previousDay = this.datePipe.transform(d, 'MM/dd/yyyy') ?? '';
    const ben = this.selected();
    if (!ben) {
      return;
    }
    const data: SupportActionData = {
      srcPath: this.srcPath,
      fileName: this.fileName,
      previousDay,
      benData: ben,
      previousFeedback: this.feedbackDetails,
      onClosed: () => this.afterDialogClosed(ben),
    };
    this.dialog.create({
      zTitle: 'Feedback',
      zContent: SupportActionDialogComponent,
      zData: data,
      zWidth: '700px',
      zMaskClosable: false,
      zHideFooter: true,
    });
  }

  /**
   * Old `afterClosed`: refresh the feedback list, then rebuild `everwellFeedbackCallData`
   * as the family rows whose Id appears in this call's saved feedback (deduped by eapiId) —
   * closure posts one completion entry per member in that list.
   */
  private afterDialogClosed(ben: EverwellFamilyRow): void {
    this.fetchFeedback(ben);
    const feedback = this.callStore.feedbackData();
    if (feedback.length > 0) {
      const touched: EverwellFamilyRow[] = [];
      for (const saved of feedback) {
        for (const row of this.rows()) {
          if (row.Id === saved['Id'] && !touched.some((t) => t.eapiId === row.eapiId)) {
            touched.push(row);
          }
        }
      }
      if (touched.length > 0) {
        this.callStore.everwellFeedbackCallData.set(touched as Record<string, unknown>[]);
      }
    }
  }
}
