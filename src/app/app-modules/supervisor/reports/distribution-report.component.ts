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
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import {
  clampReportEnd,
  maxReportDay,
  ReportsApiService,
  reportDatesValidator,
  saveBlob,
} from './reports-api.service';
import { dayBoundary, localDate } from '../allocation/allocation-api.service';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { DistrictRow, RegistrationData } from '@/app-modules/core/models';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

export type DistributionReportKind = 'age' | 'gender' | 'language' | 'sexualOrientation';

interface DimensionOption {
  display: string;
  value: unknown;
}

interface ReportConfig {
  title: string;
  /** Old i18n keys: page heading, dimension label, dimension placeholder, downloaded alert. */
  titleKey: string;
  dimensionLabel: string;
  dimensionKey: string;
  placeholderKey: string;
  downloadedKey: string;
  path: string;
  fileName: string;
  options: (data: RegistrationData) => DimensionOption[];
  dimension: (value: unknown) => Record<string, unknown>;
}

/** Old hardcoded age buckets (min/max sent to the backend; 'All' → nulls). */
const AGE_GROUPS: DimensionOption[] = [
  { display: 'Below 15', value: { minAge: 0, maxAge: 15 } },
  { display: '15 to 24', value: { minAge: 15, maxAge: 24 } },
  { display: '25 to 39', value: { minAge: 25, maxAge: 39 } },
  { display: '40 to 59', value: { minAge: 40, maxAge: 59 } },
  { display: 'Above 59', value: { minAge: 59, maxAge: 150 } },
  { display: 'All', value: 'All' },
];

const REPORTS: Record<DistributionReportKind, ReportConfig> = {
  age: {
    title: 'Caller Age Report',
    titleKey: 'callerAgeReport',
    dimensionLabel: 'Age Group',
    dimensionKey: 'ageGroup',
    placeholderKey: 'selectAgeGroup',
    downloadedKey: 'callerAgeReportDownloaded',
    path: 'crmReports/getAllByAgeGroup',
    fileName: 'Caller_Age_Group_Report',
    options: () => AGE_GROUPS,
    dimension: (value) => {
      const group = value as { minAge?: number; maxAge?: number } | 'All';
      const all = group === 'All';
      return {
        maxAge: all ? null : (group as { maxAge?: number }).maxAge,
        minAge: all ? null : (group as { minAge?: number }).minAge,
        callerAgeGroup: all
          ? 'All'
          : `${(group as { minAge?: number }).minAge} to ${(group as { maxAge?: number }).maxAge}`,
      };
    },
  },
  gender: {
    title: 'Gender Distribution Report',
    titleKey: 'genderDistributionReport',
    dimensionLabel: 'Gender',
    dimensionKey: 'gender',
    placeholderKey: 'gender',
    downloadedKey: 'genderDistributionReportDownloaded',
    path: 'crmReports/getAllByGender',
    fileName: 'Gender_Distribution_Report',
    options: (d) => [
      ...(d.m_genders ?? []).map((g) => ({ display: g.genderName ?? '', value: g.genderName })),
      { display: 'All', value: 'All' },
    ],
    dimension: (value) => ({ gender: value === 'All' ? null : value }),
  },
  language: {
    title: 'Language Distribution Report',
    titleKey: 'languageDistributionReport',
    dimensionLabel: 'Language',
    dimensionKey: 'language',
    placeholderKey: 'language',
    downloadedKey: 'languageDistributionReportDownloaded',
    path: 'crmReports/getCountsByPreferredLanguage',
    fileName: 'Language_Distribution_Report',
    options: (d) => [
      ...(d.m_language ?? []).map((l) => ({ display: l.languageName ?? '', value: l.languageName })),
      { display: 'All', value: 'All' },
    ],
    dimension: (value) => ({ beneficiaryPreferredLanguage: value === 'All' ? null : value }),
  },
  sexualOrientation: {
    title: 'Sexual Orientation Report',
    titleKey: 'sexualOrientationReport',
    dimensionLabel: 'Sexual Orientation',
    dimensionKey: 'sexualOrientation',
    placeholderKey: 'sexuality',
    downloadedKey: 'sexualOrientationReportDownloaded',
    path: 'crmReports/getAllBySexualOrientation',
    fileName: 'Sexual_Orientation_Report',
    options: (d) => [
      ...(d.sexualOrientations ?? []).map((s) => ({
        display: s.sexualOrientation ?? '',
        value: s.sexualOrientation,
      })),
      { display: 'All', value: 'All' },
    ],
    dimension: (value) => ({ beneficiarySexualOrientation: value === 'All' ? null : value }),
  },
};

/**
 * The four distribution reports (supervisor cases 15–18; old app had four near-identical
 * components). Server-side XLSX blob; reports run up to YESTERDAY with a ≤31-day span.
 */
@Component({
  selector: 'app-distribution-report',
  imports: [
    ReactiveFormsModule,
    ZardButtonComponent,
    ZardInputDirective,
    TranslatePipe,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <h2 class="text-base font-semibold">{{ config().titleKey | t }}</h2>
      <form class="flex flex-wrap items-end gap-3" [formGroup]="form">
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'startDate' | t }} <span class="text-destructive">*</span></span>
          <input z-input formControlName="startDate" type="date" [max]="maxDay" (change)="onStartDateChange()" />
        </label>
        <label class="flex flex-col gap-1.5 text-sm">
          <span>{{ 'endDate' | t }} <span class="text-destructive">*</span></span>
          <input
            z-input
            formControlName="endDate"
            type="date"
            [min]="form.controls.startDate.value"
            [max]="maxEndDay()"
          />
        </label>
        <label class="flex min-w-44 flex-col gap-1.5 text-sm">
          <span>{{ 'state' | t }}</span>
          <z-select formControlName="state" [zPlaceholder]="'selectState' | t" (zValueChange)="onStateChange($event)">
            @for (s of states(); track s.stateID) {
              <z-select-item [zValue]="s.stateName + ''">{{ s.stateName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex min-w-44 flex-col gap-1.5 text-sm">
          <span>{{ 'district' | t }}</span>
          <z-select formControlName="district" [zPlaceholder]="'selectDistrict' | t">
            @for (d of districts(); track d.districtID) {
              <z-select-item [zValue]="d.districtName + ''">{{ d.districtName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex min-w-44 flex-col gap-1.5 text-sm">
          <span>{{ config().dimensionKey | t }} <span class="text-destructive">*</span></span>
          <z-select formControlName="dimension" [zPlaceholder]="config().placeholderKey | t">
            @for (o of options(); track o.display) {
              <z-select-item [zValue]="o.display">{{ o.display }}</z-select-item>
            }
          </z-select>
        </label>
        <button z-button type="button" [zDisabled]="form.invalid" [zLoading]="downloading()" (click)="download()">
          {{ 'downloadReport' | t }}
        </button>
      </form>
    </div>
  `,
})
export class DistributionReportComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ReportsApiService);
  private readonly beneficiaryApi = inject(BeneficiaryApiService);
  private readonly locationApi = inject(LocationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly lang = inject(LanguageStore);

  readonly kind = input.required<DistributionReportKind>();

  protected readonly config = computed(() => REPORTS[this.kind()]);
  protected readonly states = signal<NonNullable<RegistrationData['states']>>([]);
  protected readonly districts = signal<DistrictRow[]>([]);
  protected readonly options = signal<DimensionOption[]>([]);
  protected readonly downloading = signal(false);

  protected readonly maxDay = maxReportDay();
  protected readonly maxEndDay = signal(this.maxDay);

  protected readonly form = this.fb.group(
    {
      startDate: this.fb.control<string | null>(null, Validators.required),
      endDate: this.fb.control<string | null>(null, Validators.required),
      state: this.fb.control<string | null>(null),
      district: this.fb.control<string | null>(null),
      dimension: this.fb.control<string | null>(null, Validators.required),
    },
    { validators: reportDatesValidator(this.maxDay, () => this.maxEndDay()) },
  );

  ngOnInit(): void {
    // Old caller-age-report hardcoded its buckets in ngOnInit, independent of any API call.
    if (this.kind() === 'age') {
      this.options.set(AGE_GROUPS);
    }
    const serviceId = this.sessionStore.currentServiceId();
    if (serviceId == null) {
      return;
    }
    this.beneficiaryApi.getRegistrationData(serviceId).subscribe({
      next: (res) => {
        if (res?.data) {
          this.states.set(res.data.states ?? []);
          this.options.set(this.config().options(res.data));
        }
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load filters', 'error'),
    });
  }

  protected onStartDateChange(): void {
    const start = this.form.controls.startDate.value;
    if (!start) {
      return;
    }
    const end = clampReportEnd(start);
    this.maxEndDay.set(end);
    this.form.patchValue({ endDate: end });
  }

  // Takes the emitted value: z-select fires zValueChange BEFORE its CVA writes the form
  // control, so reading the control here would see the previous selection.
  protected onStateChange(value: string | string[]): void {
    this.districts.set([]);
    this.form.patchValue({ district: null });
    const state = this.states().find((s) => s.stateName === (value as string));
    if (state?.stateID == null) {
      return;
    }
    this.locationApi.getDistricts(state.stateID).subscribe({
      next: (res) => this.districts.set(res?.data ?? []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load districts', 'error'),
    });
  }

  protected download(): void {
    const v = this.form.getRawValue();
    if (!v.startDate || !v.endDate) {
      return;
    }
    const option = this.options().find((o) => o.display === v.dimension);
    const config = this.config();
    const body: Record<string, unknown> = {
      startTimestamp: dayBoundary(localDate(v.startDate), 'start'),
      endTimestamp: dayBoundary(localDate(v.endDate), 'end'),
      providerServiceMapID: this.sessionStore.currentServiceId(),
      ...config.dimension(option?.value),
      state: v.state ?? undefined,
      district: v.district || undefined,
      fileName: config.fileName,
    };
    this.downloading.set(true);
    this.api.downloadReport(config.path, body).subscribe({
      next: (blob) => {
        this.downloading.set(false);
        if (blob) {
          saveBlob(blob, `${config.fileName}.xlsx`);
          this.notify.alert(this.lang.t(config.downloadedKey), 'success');
        } else {
          this.notify.alert(this.lang.t('noDataFound'), 'info');
        }
      },
      error: (err: { status?: number }) => {
        this.downloading.set(false);
        if (err?.status === 500) {
          this.notify.alert(this.lang.t('noDataFound'), 'info');
        } else {
          this.notify.alert(this.lang.t('errorWhileFetchingReport'), 'error');
        }
      },
    });
  }
}
