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
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { DatePipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardDialogService } from '@common-ui/ui/dialog';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { RestrictInputDirective } from '@/app-modules/core/directives/restrict-input.directive';
import { MOBILE_NUMBER_BLOCK, SEARCH_ID_BLOCK, TEXTAREA_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { CoServicesApiService } from '@/app-modules/core/services/co-services-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { DistrictRow, RegistrationData, SubServiceType, TalukRow } from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { numOrNull } from '@/app-modules/core/utils/select-value';
import { FeedbackStatusDialogComponent } from './feedback-status-dialog.component';

/** A feedback history row (old `getFeedbacksList` response shape). */
interface FeedbackRow {
  requestID?: number | string;
  feedback?: string;
  severity?: { severityTypeName?: string };
  feedbackType?: { feedbackTypeName?: string };
  createdBy?: string;
  feedbackStatus?: { feedbackStatus?: string };
  createdDate?: number | string;
  consolidatedRequests?: unknown[];
}

type SearchType = 'FeedbackID' | 'MobileNumber';

/**
 * Feedback service tab (old `co-feedback-services`, the largest tab). List-first, faithful to
 * the old flow: opens on the beneficiary's feedback history (`getFeedbacksList` by regID +
 * serviceID) with a dual-mode search (Feedback ID / Mobile Number, both hitting the same
 * endpoint), a row-click status modal, and a "Create Feedback" button that reveals the form.
 * The form captures location + institution + designation + type + severity + date +
 * description + consent and submits via `co/saveBenFeedback`; a successful save reloads the
 * list.
 */
@Component({
  selector: 'app-co-feedback',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    ZardButtonComponent,
    ZardInputDirective,
    RestrictInputDirective,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (mode() === 'list') {
      <!-- Search + history list -->
      <div class="flex flex-col gap-4">
        <div class="flex flex-wrap items-end gap-3">
          <div class="flex flex-col gap-1.5 text-sm">
            <span class="font-medium">Search by</span>
            <div class="flex items-center gap-4">
              <label class="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="searchType"
                  value="FeedbackID"
                  [checked]="searchType() === 'FeedbackID'"
                  (change)="onSearchTypeChange('FeedbackID')"
                />
                <span>Feedback ID</span>
              </label>
              <label class="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="searchType"
                  value="MobileNumber"
                  [checked]="searchType() === 'MobileNumber'"
                  (change)="onSearchTypeChange('MobileNumber')"
                />
                <span>Mobile Number</span>
              </label>
            </div>
          </div>
          <div class="flex flex-col gap-1.5">
            <input
              z-input
              [formControl]="searchTerm"
              [maxlength]="searchType() === 'MobileNumber' ? 10 : 30"
              [placeholder]="searchType() === 'MobileNumber' ? 'Mobile number' : 'Feedback ID'"
              class="w-56"
              [appRestrictInput]="searchType() === 'MobileNumber' ? mobileNumberBlock : searchIdBlock"
            />
          </div>
          <button z-button type="button" [zDisabled]="!searchValid() || loadingHistory()" (click)="runSearch()">
            Search
          </button>
          <button z-button zType="outline" type="button" [zDisabled]="!searchTerm.value" (click)="clearSearch()">
            Clear
          </button>
          <button z-button type="button" class="ml-auto" (click)="showForm()">Create Feedback</button>
        </div>

        <div class="overflow-x-auto rounded-md border border-border">
          <table class="w-full text-sm">
            <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
              <tr>
                <th class="px-3 py-2">S.No</th>
                <th class="px-3 py-2">Feedback ID</th>
                <th class="px-3 py-2">Description</th>
                <th class="px-3 py-2">Severity</th>
                <th class="px-3 py-2">Feedback Type</th>
                <th class="px-3 py-2">Agent</th>
                <th class="px-3 py-2">Status</th>
                <th class="px-3 py-2">Created Date</th>
              </tr>
            </thead>
            <tbody>
              @for (f of pagedHistory(); track $index) {
                <tr class="cursor-pointer border-t border-border hover:bg-accent/50" (click)="openStatus(f)">
                  <td class="px-3 py-2">{{ pageIndex() * pageSize + $index + 1 }}</td>
                  <td class="px-3 py-2">{{ f.requestID }}</td>
                  <td class="max-w-xs truncate px-3 py-2">{{ f.feedback }}</td>
                  <td class="px-3 py-2">{{ f.severity?.severityTypeName }}</td>
                  <td class="px-3 py-2">{{ f.feedbackType?.feedbackTypeName }}</td>
                  <td class="px-3 py-2">{{ f.createdBy }}</td>
                  <td class="px-3 py-2">{{ f.feedbackStatus?.feedbackStatus }}</td>
                  <td class="px-3 py-2">{{ f.createdDate | date: 'dd/MM/yyyy hh:mm a' : '+0530' }}</td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="8" class="px-3 py-6 text-center text-muted-foreground">
                    @if (loadingHistory()) {
                      Loading…
                    } @else {
                      No feedback records found.
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        @if (filtered().length > pageSize) {
          <div class="flex items-center justify-end gap-3 text-sm">
            <span class="text-muted-foreground">
              Page {{ pageIndex() + 1 }} of {{ pageCount() }} ({{ filtered().length }} records)
            </span>
            <button z-button zType="outline" zSize="sm" type="button" [zDisabled]="pageIndex() === 0" (click)="prevPage()">
              Previous
            </button>
            <button
              z-button
              zType="outline"
              zSize="sm"
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
      <!-- Create-feedback form -->
      <form [formGroup]="form" (ngSubmit)="submit()" class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label class="flex flex-col gap-1.5 text-sm">
          <span>State <span class="text-destructive">*</span></span>
          <z-select formControlName="state" zPlaceholder="Select state" (zValueChange)="onStateChange($event)">
            @for (s of states(); track s.stateID) {
              <z-select-item [zValue]="s.stateID + ''">{{ s.stateName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>District <span class="text-destructive">*</span></span>
          <z-select formControlName="district" zPlaceholder="Select district" (zValueChange)="onDistrictChange($event)">
            @for (d of districts(); track d.districtID) {
              <z-select-item [zValue]="d.districtID + ''">{{ d.districtName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Taluk</span>
          <z-select formControlName="taluk" zPlaceholder="Select taluk">
            @for (t of taluks(); track t.blockID) {
              <z-select-item [zValue]="t.blockID + ''">{{ t.blockName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Institution Name</span>
          <z-select formControlName="institution" zPlaceholder="Select institution" (zValueChange)="onInstitutionChange($event)">
            @for (i of institutes(); track i.institutionTypeID) {
              <z-select-item [zValue]="i.institutionTypeID + ''">{{ i.institutionType }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Designation <span class="text-destructive">*</span></span>
          <z-select formControlName="designation" zPlaceholder="Select designation">
            @for (d of designations(); track d.designationID) {
              <z-select-item [zValue]="d.designationID + ''">{{ d.designationName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Feedback Type <span class="text-destructive">*</span></span>
          <z-select formControlName="feedbackType" zPlaceholder="Select type">
            @for (t of feedbackTypes(); track t.feedbackTypeID) {
              <z-select-item [zValue]="t.feedbackTypeID + ''">{{ t.feedbackTypeName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Severity <span class="text-destructive">*</span></span>
          <z-select formControlName="severity" zPlaceholder="Select severity">
            @for (s of severities(); track s.severityID) {
              <z-select-item [zValue]="s.severityID + ''">{{ s.severityTypeName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>Date of Incident</span>
          <input z-input formControlName="serviceAvailDate" type="date" class="w-full cursor-pointer" [min]="minDate" [max]="today()" />
        </label>
        <label class="flex flex-col gap-1.5 text-sm sm:col-span-2 lg:col-span-3">
          <span>Description <span class="text-destructive">*</span></span>
          <textarea
            z-input
            formControlName="feedback"
            maxlength="5000"
            rows="3"
            placeholder="Describe the feedback / complaint"
            [appRestrictInput]="textAreaBlock"
          ></textarea>
        </label>
        <label class="flex items-center gap-2 text-sm">
          <input type="checkbox" formControlName="beneficiaryConsent" />
          <span>Beneficiary consent</span>
        </label>
        <div class="flex items-end justify-end gap-3 sm:col-span-2 lg:col-span-3">
          <button z-button zType="outline" type="button" (click)="showTable()">Back</button>
          <button z-button type="submit" [zDisabled]="form.invalid" [zLoading]="saving()">
            Submit Feedback
          </button>
        </div>
      </form>
    }
  `,
})
export class CoFeedbackComponent implements OnInit {
  protected readonly mobileNumberBlock = MOBILE_NUMBER_BLOCK;
  protected readonly searchIdBlock = SEARCH_ID_BLOCK;
  protected readonly textAreaBlock = TEXTAREA_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CoServicesApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly notify = inject(NotificationService);
  private readonly dialog = inject(ZardDialogService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  /** Shared masters fetched ONCE by the co-services host. */
  readonly serviceTypes = input<SubServiceType[]>([]);
  readonly states = input<RegistrationData['states']>([]);
  readonly serviceProvided = output<void>();

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private readonly subServiceId = computed(
    () =>
      this.serviceTypes().find((t) => t.subServiceName?.toUpperCase().includes('FEED'))
        ?.subServiceID ?? null,
  );

  /** 'list' = history+search (default landing, old showTableCondition); 'form' = create. */
  protected readonly mode = signal<'list' | 'form'>('list');

  // History + dual-mode search (old showBeneficiaryFeedbackList / filterFeedbackList).
  protected readonly history = signal<FeedbackRow[]>([]);
  protected readonly filtered = signal<FeedbackRow[]>([]);
  protected readonly loadingHistory = signal(false);
  protected readonly searchType = signal<SearchType>('FeedbackID');
  protected readonly searchTerm = this.fb.control('', { nonNullable: true });
  // FormControl.value is not signal-reactive; mirror it so searchValid recomputes as you type.
  private readonly searchTermValue = toSignal(this.searchTerm.valueChanges, { initialValue: '' });

  // Client-side pagination for the history list (old md2Data rowsPerPage).
  protected readonly pageSize = 5;
  protected readonly pageIndex = signal(0);
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.filtered().length / this.pageSize)),
  );
  protected readonly pagedHistory = computed(() =>
    this.filtered().slice(this.pageIndex() * this.pageSize, (this.pageIndex() + 1) * this.pageSize),
  );

  protected readonly districts = signal<DistrictRow[]>([]);
  protected readonly taluks = signal<TalukRow[]>([]);
  protected readonly institutes = signal<{ institutionTypeID?: number; institutionType?: string }[]>([]);
  /** Captured on institution select — the old app posted the institution NAME alongside its id. */
  private instituteName: string | null = null;
  protected readonly designations = signal<{ designationID?: number; designationName?: string }[]>([]);
  protected readonly feedbackTypes = signal<{ feedbackTypeID?: number; feedbackTypeName?: string }[]>([]);
  protected readonly severities = signal<{ severityID?: number; severityTypeName?: string }[]>([]);
  protected readonly saving = signal(false);

  /** Old search validity: Feedback ID 1–30 chars; Mobile Number exactly 10 digits. */
  protected readonly searchValid = computed(() => {
    const term = this.searchTermValue().trim();
    return this.searchType() === 'MobileNumber'
      ? /^\d{10}$/.test(term)
      : term.length >= 1 && term.length <= 30;
  });

  /** Date-of-incident bounds (old app: min = 2014-12-01 fallback, max = today). */
  protected readonly today = computed(() => this.toDateInput(new Date()));
  protected readonly minDate = '2014-12-01';

  protected readonly form = this.fb.group({
    state: this.fb.control<string | null>(null, Validators.required),
    district: this.fb.control<string | null>(null, Validators.required),
    taluk: this.fb.control<string | null>(null),
    institution: this.fb.control<string | null>(null),
    designation: this.fb.control<string | null>(null, Validators.required),
    feedbackType: this.fb.control<string | null>(null, Validators.required),
    severity: this.fb.control<string | null>(null, Validators.required),
    serviceAvailDate: this.fb.control<string | null>(null),
    feedback: this.fb.control('', { nonNullable: true, validators: Validators.required }),
    beneficiaryConsent: this.fb.control(false, { nonNullable: true }),
  });

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.loadHistory();
    // states + sub-service id come from the host's shared fetch (inputs above).
    this.api.getDesignations().subscribe({
      next: (res) => this.designations.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.designations.set([]),
    });
    this.api.getFeedbackTypes(serviceId).subscribe({
      next: (res) => this.feedbackTypes.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.feedbackTypes.set([]),
    });
    this.api.getFeedbackSeverities(serviceId).subscribe({
      next: (res) => this.severities.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.severities.set([]),
    });
    // Old app sent `{}` (commented-out providerServiceMapID) to institute/getInstituteTypes.
    this.locationApi.getInstituteTypes().subscribe({
      next: (res) => this.institutes.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.institutes.set([]),
    });
  }

  /** Old showBeneficiaryFeedbackList — history by beneficiary + service. */
  private loadHistory(): void {
    const beneficiaryRegID = this.callStore.beneficiaryRegId();
    const serviceId = this.serviceId();
    if (beneficiaryRegID == null || serviceId == null) {
      return;
    }
    this.loadingHistory.set(true);
    this.api.getFeedbacksList({ beneficiaryRegID, serviceID: serviceId }).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? (res.data as FeedbackRow[]) : [];
        this.history.set(rows);
        this.filtered.set(rows);
        this.pageIndex.set(0);
        this.loadingHistory.set(false);
      },
      error: () => {
        this.history.set([]);
        this.filtered.set([]);
        this.loadingHistory.set(false);
      },
    });
  }

  protected showForm(): void {
    this.mode.set('form');
    this.form.reset({ beneficiaryConsent: false });
    this.instituteName = null;
  }

  protected showTable(): void {
    this.mode.set('list');
    this.clearSearch();
  }

  protected onSearchTypeChange(type: SearchType): void {
    this.searchType.set(type);
    this.searchTerm.setValue('');
    this.filtered.set(this.history());
    this.pageIndex.set(0);
  }

  /** Old filterFeedbackList — empty term restores the full list, else search the endpoint. */
  protected runSearch(): void {
    const term = this.searchTerm.value.trim();
    if (!term) {
      this.filtered.set(this.history());
      this.pageIndex.set(0);
      return;
    }
    this.loadingHistory.set(true);
    this.api
      .getFeedbacksList({
        phoneNum: this.searchType() === 'MobileNumber' ? term : null,
        requestID: this.searchType() === 'FeedbackID' ? term : null,
        is1097: true,
      })
      .subscribe({
        next: (res) => {
          this.filtered.set(Array.isArray(res?.data) ? (res.data as FeedbackRow[]) : []);
          this.pageIndex.set(0);
          this.loadingHistory.set(false);
        },
        error: (err: { errorMessage?: string }) => {
          this.filtered.set([]);
          this.loadingHistory.set(false);
          this.notify.alert(err?.errorMessage ?? 'Search failed', 'error');
        },
      });
  }

  protected clearSearch(): void {
    this.searchTerm.setValue('');
    this.searchType.set('FeedbackID');
    this.filtered.set(this.history());
    this.pageIndex.set(0);
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }

  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  /** Old modalData — open the request/response status detail dialog for a row. */
  protected openStatus(row: FeedbackRow): void {
    this.dialog.create({
      zTitle: 'Feedback Response & Request',
      zContent: FeedbackStatusDialogComponent,
      zData: row,
      zWidth: '80%',
      zOkText: 'Close',
      zCancelText: null,
    });
  }

  // Takes the emitted value: z-select fires zValueChange BEFORE its CVA writes the form
  // control, so reading the control here would see the previous selection.
  protected onStateChange(value: string | string[]): void {
    this.districts.set([]);
    this.taluks.set([]);
    this.form.patchValue({ district: null, taluk: null });
    const state = value as string;
    if (!state) {
      return;
    }
    this.locationApi.getDistricts(state).subscribe({
      next: (res) => this.districts.set(res?.data ?? []),
      error: () => this.districts.set([]),
    });
  }

  private toDateInput(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  protected onInstitutionChange(value: string | string[]): void {
    const id = value as string;
    const match = this.institutes().find((i) => String(i.institutionTypeID) === id);
    this.instituteName = match?.institutionType ?? null;
  }

  protected onDistrictChange(value: string | string[]): void {
    this.taluks.set([]);
    this.form.patchValue({ taluk: null });
    const district = value as string;
    if (!district) {
      return;
    }
    this.locationApi.getTaluks(district).subscribe({
      next: (res) => this.taluks.set(res?.data ?? []),
      error: () => this.taluks.set([]),
    });
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const serviceId = this.serviceId();
    this.saving.set(true);
    // Old app: full UTC-midnight ISO of the picked date, and the key is OMITTED when no date.
    const serviceAvailDate = v.serviceAvailDate
      ? `${v.serviceAvailDate}T00:00:00.000Z`
      : undefined;
    this.api
      .saveBenFeedback({
        instituteTypeID: numOrNull(v.institution),
        instituteName: this.instituteName,
        stateID: numOrNull(v.state),
        districtID: numOrNull(v.district),
        blockID: numOrNull(v.taluk),
        designationID: numOrNull(v.designation),
        feedbackTypeID: numOrNull(v.feedbackType),
        severityID: numOrNull(v.severity),
        feedback: v.feedback.trim() || null,
        beneficiaryRegID: this.callStore.beneficiaryRegId(),
        serviceAvailDate,
        serviceID: serviceId,
        subServiceID: this.subServiceId(),
        userID: this.sessionStore.userId(),
        createdBy: this.sessionStore.user()?.userName,
        benCallID: this.callStore.benCallID(),
        '1097ServiceID': serviceId,
        beneficiaryConsent: v.beneficiaryConsent,
      })
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          const requestID = (res?.data as { requestID?: string } | null)?.requestID;
          this.notify.alert(
            `Feedback submitted${requestID ? ` (ID ${requestID})` : ''}`,
            'success',
          );
          this.form.reset({ beneficiaryConsent: false });
          this.instituteName = null;
          // Old app: reload the history list and return to the list view.
          this.loadHistory();
          this.mode.set('list');
          this.serviceProvided.emit();
        },
        error: (err: { errorMessage?: string }) => {
          this.saving.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to submit feedback', 'error');
        },
      });
  }
}
