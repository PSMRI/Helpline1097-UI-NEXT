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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { RestrictInputDirective } from '@/app-modules/core/directives/restrict-input.directive';
import { TEXTAREA_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { localDate } from '../allocation/allocation-api.service';
import { CommunicationApiService, OfficeRow, tzShift } from './communication-api.service';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** A location-message row (getSupervisorNotification). */
interface LocationRow {
  notificationID: number;
  notificationTypeID: number;
  notificationType?: { notificationType?: string };
  workingLocation?: { locationName?: string };
  notification?: string;
  notificationDesc?: string;
  validFrom?: string;
  validTill?: string;
  deleted?: boolean;
  [key: string]: unknown;
}

/**
 * `yyyy-MM-dd` from a stored timestamp's UTC wall-clock — the list renders these with
 * `date: … : 'UTC'` and the old edit form used `transformDatetoUTC`, so local getters would
 * prefill (and re-post) a day shifted by the timezone offset.
 */
function utcDay(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Local Date for a `yyyy-MM-dd` at start (00:00:00) or end (23:59:59) of day. */
function boundary(dateStr: string, edge: 'start' | 'end'): Date {
  const d = localDate(dateStr);
  if (edge === 'end') {
    d.setHours(23, 59, 59, 0);
  }
  return d;
}

const ROWS_PER_PAGE = 3;

/** Coerce a z-select value to an array (see alerts-notifications for the CVA caveat). */
function asArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

/**
 * Location Messages (supervisor case 21 in the old menu / case 20 here). Audience = offices
 * from `m/location/getAlllocationNew`. Search posts `workingLocationIDs` (plural — every
 * office); create posts an ARRAY with one `workingLocationID` (singular) per selected office.
 *
 * NOTE: create/search shift dates by the UTC offset (`tzShift`) but update does NOT — a faithful
 * asymmetry carried over from the old NotificationService, not a bug to "fix".
 */
@Component({
  selector: 'app-location-messages',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    ZardButtonComponent,
    ZardInputDirective,
    RestrictInputDirective,
    ...ZardSelectImports,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './location-messages.component.html',
})
export class LocationMessagesComponent implements OnInit {
  protected readonly textAreaBlock = TEXTAREA_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CommunicationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly lang = inject(LanguageStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private notificationTypeID: number | null = null;

  protected readonly mode = signal<'list' | 'form'>('list');
  protected readonly editing = signal<LocationRow | null>(null);
  protected readonly offices = signal<OfficeRow[]>([]);
  protected readonly rows = signal<LocationRow[]>([]);
  /** The full office multi-selection (the reactive control alone is unreliable in multi-mode). */
  protected readonly officesSelected = signal<string[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.rows().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.rows().slice(start, start + ROWS_PER_PAGE);
  });

  protected readonly searchForm = this.fb.group({
    startDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    endDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly form = this.fb.group({
    // Office selection is tracked via `officesSelected` (multi-mode CVA is unreliable); the
    // control remains only to drive the disabled state in edit mode.
    offices: this.fb.control<string[]>([], { nonNullable: true }),
    startDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    endDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    subject: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(100)],
    }),
    message: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(300)],
    }),
  });

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getServiceProviderID(serviceId).subscribe({ next: () => {}, error: () => {} });
    this.api.getAllLocationNew(serviceId).subscribe({
      next: (res) => this.offices.set(Array.isArray(res?.data) ? res.data : []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load offices', 'error'),
    });
    this.api.getNotificationTypes(serviceId).subscribe({
      next: (res) => {
        const match = (res?.data ?? []).find(
          (t) => (t.notificationType ?? '').toLowerCase() === 'location message',
        );
        this.notificationTypeID = match?.notificationTypeID ?? null;
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load notification type', 'error'),
    });
  }

  private get allOfficeIDs(): number[] {
    return this.offices().map((o) => o.pSAddMapID);
  }

  // ---- search / list -------------------------------------------------------
  protected search(): void {
    const serviceId = this.serviceId();
    const v = this.searchForm.getRawValue();
    if (serviceId == null || this.notificationTypeID == null || this.searchForm.invalid) {
      return;
    }
    this.searching.set(true);
    this.api
      .getSupervisorNotification({
        providerServiceMapID: serviceId,
        notificationTypeID: this.notificationTypeID,
        workingLocationIDs: this.allOfficeIDs,
        validStartDate: tzShift(boundary(v.startDate, 'start')),
        validEndDate: tzShift(boundary(v.endDate, 'end')),
      })
      .subscribe({
        next: (res) => {
          this.searching.set(false);
          this.rows.set(Array.isArray(res?.data) ? (res.data as LocationRow[]) : []);
          this.pageIndex.set(0);
        },
        error: (err: { errorMessage?: string }) => {
          this.searching.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to load messages', 'error');
        },
      });
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }
  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  // ---- create / edit -------------------------------------------------------
  protected startCreate(): void {
    this.editing.set(null);
    this.officesSelected.set([]);
    this.form.reset({ offices: [], startDate: '', endDate: '', subject: '', message: '' });
    this.form.controls.offices.enable();
    this.mode.set('form');
  }

  protected onOfficesChange(value: string | string[]): void {
    this.officesSelected.set(asArray(value));
  }

  protected startEdit(row: LocationRow): void {
    this.editing.set(row);
    this.officesSelected.set([]);
    const from = row.validFrom ? new Date(row.validFrom) : new Date();
    const till = row.validTill ? new Date(row.validTill) : new Date();
    this.form.reset({
      offices: [],
      startDate: utcDay(from),
      endDate: utcDay(till),
      subject: row.notification ?? '',
      message: row.notificationDesc ?? '',
    });
    // Office is display-only on an existing message; update never re-sends it.
    this.form.controls.offices.disable();
    this.mode.set('form');
  }

  protected cancelForm(): void {
    this.mode.set('list');
  }

  /**
   * Old edit bound the start-date change to `resetEndDate()` — a method that never existed,
   * so the old app threw on every start-date edit. Implemented here as the intended no-op
   * repair: clear an end date that is now before the start. (Flagged as an old-app bug.)
   */
  protected resetEndDate(): void {
    const start = this.form.controls.startDate.value;
    const end = this.form.controls.endDate.value;
    if (start && end && end < start) {
      this.form.controls.endDate.setValue('');
    }
  }

  protected save(): void {
    const editing = this.editing();
    if (this.form.invalid || (!editing && this.officesSelected().length === 0)) {
      this.form.markAllAsTouched();
      return;
    }
    if (editing) {
      this.update(editing);
    } else {
      this.create();
    }
  }

  private create(): void {
    const serviceId = this.serviceId();
    const v = this.form.getRawValue();
    if (serviceId == null || this.notificationTypeID == null) {
      return;
    }
    const base: Record<string, unknown> = {
      providerServiceMapID: serviceId,
      notificationTypeID: this.notificationTypeID,
      createdBy: this.sessionStore.user()?.userName,
      notification: v.subject.trim() || null,
      notificationDesc: v.message.trim() || null,
      validFrom: tzShift(boundary(v.startDate, 'start')),
      validTill: tzShift(boundary(v.endDate, 'end')),
    };
    const requestArray = this.officesSelected().map((o) => ({
      ...base,
      workingLocationID: Number(o),
    }));
    this.saving.set(true);
    this.api.createNotification(requestArray).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert(this.lang.t('locationMessageCreatedSuccessfully'), 'success');
        this.mode.set('list');
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? this.lang.t('failedToCreate'), 'error');
      },
    });
  }

  private update(row: LocationRow): void {
    const serviceId = this.serviceId();
    const v = this.form.getRawValue();
    if (serviceId == null) {
      return;
    }
    const start = boundary(v.startDate, 'start');
    const end = boundary(v.endDate, 'end');
    if (end <= start) {
      this.notify.alert(this.lang.t('validTillShouldBeAFutureDateThanValidFrom'), 'info');
      return;
    }
    this.saving.set(true);
    this.api
      .updateNotification({
        providerServiceMapID: serviceId,
        notificationTypeID: row.notificationTypeID,
        notificationID: row.notificationID,
        notification: v.subject.trim() || null,
        notificationDesc: v.message.trim() || null,
        // Update deliberately does NOT tz-shift (asymmetry preserved from the old app).
        validFrom: start.toISOString(),
        validTill: end.toISOString(),
        deleted: row.deleted,
        modifiedBy: this.sessionStore.user()?.userName,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify.alert(this.lang.t('editedSuccessfully'), 'success');
          this.mode.set('list');
          this.search();
        },
        error: (err: { errorMessage?: string }) => {
          this.saving.set(false);
          this.notify.alert(err?.errorMessage ?? this.lang.t('failedToUpdate'), 'error');
        },
      });
  }
}
