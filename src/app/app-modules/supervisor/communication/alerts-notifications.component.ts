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

import { localDate } from '../allocation/allocation-api.service';
import {
  CommunicationApiService,
  NotificationType,
  OfficeRow,
  ProviderRole,
  tzShift,
} from './communication-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** A supervisor-notification row as returned by getSupervisorNotification. */
interface NotificationRow {
  notificationID: number;
  notificationTypeID: number;
  notificationType?: { notificationType?: string };
  role?: { RoleName?: string };
  roleID?: number;
  workingLocation?: { locationName?: string };
  notification?: string;
  notificationDesc?: string;
  validFrom?: string;
  validTill?: string;
  deleted?: boolean;
  [key: string]: unknown;
}

/** `yyyy-MM-dd` string for a Date's local day (native date-input value). */
function inputDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Local Date at a given time-of-day for a `yyyy-MM-dd` (+ optional `HH:mm`) pair. */
function dateAt(dateStr: string, time: string | null, fallback: [number, number, number]): Date {
  const d = localDate(dateStr);
  if (time) {
    const [h, m] = time.split(':').map(Number);
    d.setHours(h, m, 0, 0);
  } else {
    d.setHours(fallback[0], fallback[1], fallback[2], 0);
  }
  return d;
}

const ROWS_PER_PAGE = 3;

/** Coerce a z-select value to an array. In multiple mode ZardSelect's CVA writes the
 * last-toggled scalar to the form control (not the full selection), so the reliable source
 * of the whole multi-selection is the `zValueChange` output, captured into a signal. */
function asArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

/**
 * Alerts & Notifications (supervisor case 19). List-first: a type/date search over
 * `getSupervisorNotification`, plus a create/edit form that posts an ARRAY to
 * `createNotification` (one element per selected office) and a single OBJECT to
 * `updateNotification`. Audience = a role (+ its offices); the old app kept the two
 * notification types (Alert / Notification) in one screen, keyed by `notificationTypeID`
 * (18 = Alert, 19 = Notification — used only to pick the success toast).
 */
@Component({
  selector: 'app-alerts-notifications',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    ZardButtonComponent,
    ZardInputDirective,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './alerts-notifications.component.html',
})
export class AlertsNotificationsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CommunicationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  protected readonly mode = signal<'list' | 'form'>('list');
  protected readonly editing = signal<NotificationRow | null>(null);

  protected readonly types = signal<NotificationType[]>([]);
  protected readonly roles = signal<ProviderRole[]>([]);
  protected readonly offices = signal<OfficeRow[]>([]);
  protected readonly rows = signal<NotificationRow[]>([]);
  /** The full office multi-selection (see `asArray` — the form control alone is unreliable). */
  protected readonly officesSelected = signal<string[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);

  protected readonly today = inputDay(new Date());

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.rows().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.rows().slice(start, start + ROWS_PER_PAGE);
  });

  protected readonly searchForm = this.fb.group({
    notificationType: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    startDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    endDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  protected readonly form = this.fb.group({
    notificationType: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    role: this.fb.control<string>('', { nonNullable: true }),
    offices: this.fb.control<string[]>([], { nonNullable: true }),
    startDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    startTime: this.fb.control<string>('', { nonNullable: true }),
    endDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    endTime: this.fb.control<string>('', { nonNullable: true }),
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
    // Old init fired getServiceProviderID (result unused downstream) alongside the lookups.
    this.api.getServiceProviderID(serviceId).subscribe({ next: () => {}, error: () => {} });
    this.api.getNotificationTypes(serviceId).subscribe({
      next: (res) => {
        const all = Array.isArray(res?.data) ? res.data : [];
        this.types.set(
          all.filter((t) => ['alert', 'notification'].includes((t.notificationType ?? '').toLowerCase())),
        );
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load notification types', 'error'),
    });
    this.api.getRoles(serviceId).subscribe({
      next: (res) => {
        const all = Array.isArray(res?.data) ? res.data : [];
        this.roles.set(all.filter((r) => (r.featureName?.length ?? 0) !== 0));
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load roles', 'error'),
    });
  }

  // ---- search / list -------------------------------------------------------
  protected search(): void {
    const serviceId = this.serviceId();
    const v = this.searchForm.getRawValue();
    if (serviceId == null || this.searchForm.invalid) {
      return;
    }
    this.searching.set(true);
    this.api
      .getSupervisorNotification({
        providerServiceMapID: serviceId,
        notificationTypeID: Number(v.notificationType),
        roleIDs: this.roles().map((r) => r.roleID),
        validStartDate: tzShift(dateAt(v.startDate, null, [0, 0, 0])),
        validEndDate: tzShift(dateAt(v.endDate, null, [23, 59, 59])),
      })
      .subscribe({
        next: (res) => {
          this.searching.set(false);
          // Old success guard tested the envelope object (always truthy) → always list data.
          this.rows.set(Array.isArray(res?.data) ? (res.data as NotificationRow[]) : []);
          this.pageIndex.set(0);
        },
        error: (err: { errorMessage?: string }) => {
          this.searching.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to load notifications', 'error');
        },
      });
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }
  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  // ---- create / edit form --------------------------------------------------
  protected startCreate(): void {
    this.editing.set(null);
    this.offices.set([]);
    this.officesSelected.set([]);
    this.form.reset({ notificationType: '', role: '', offices: [], startDate: '', startTime: '', endDate: '', endTime: '', subject: '', message: '' });
    this.form.controls.notificationType.enable();
    this.form.controls.role.enable();
    this.mode.set('form');
  }

  protected onOfficesChange(value: string | string[]): void {
    this.officesSelected.set(asArray(value));
  }

  protected startEdit(row: NotificationRow): void {
    this.editing.set(row);
    const from = row.validFrom ? new Date(row.validFrom) : new Date();
    const till = row.validTill ? new Date(row.validTill) : new Date();
    const hhmm = (d: Date) =>
      `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    this.form.reset({
      notificationType: String(row.notificationTypeID),
      role: row.roleID != null ? String(row.roleID) : '',
      offices: [],
      startDate: inputDay(from),
      startTime: hhmm(from),
      endDate: inputDay(till),
      endTime: hhmm(till),
      subject: row.notification ?? '',
      message: row.notificationDesc ?? '',
    });
    // Type/role/office are fixed on the existing record — update posts the row's own roleID.
    this.form.controls.notificationType.disable();
    this.form.controls.role.disable();
    this.mode.set('form');
  }

  protected cancelForm(): void {
    this.mode.set('list');
  }

  /** On role change, (re)load that role's offices; "All" clears/disables the office picker. */
  protected onRoleChange(value: string | string[]): void {
    const serviceId = this.serviceId();
    const roleId = value ? Number(value) : undefined;
    this.form.controls.offices.setValue([]);
    this.officesSelected.set([]);
    this.offices.set([]);
    if (serviceId == null || roleId === undefined) {
      return;
    }
    this.api.getLocationsByProviderID(serviceId, roleId).subscribe({
      next: (res) => this.offices.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.offices.set([]),
    });
  }

  /** Same-day start-time ≥ end-time is invalid (old `invalidTimeFlag`, day-granularity). A
   * plain method (not a computed) so it re-evaluates on every event-driven CD as the user
   * types — a computed over `form.getRawValue()` captures no signals and would freeze. */
  protected timeInvalid(): boolean {
    const v = this.form.getRawValue();
    if (!v.startDate || !v.endDate || v.startDate !== v.endDate || !v.startTime || !v.endTime) {
      return false;
    }
    return v.startTime >= v.endTime;
  }

  protected save(): void {
    if (this.form.invalid || this.timeInvalid()) {
      this.form.markAllAsTouched();
      return;
    }
    const editing = this.editing();
    if (editing) {
      this.update(editing);
    } else {
      this.create();
    }
  }

  private create(): void {
    const serviceId = this.serviceId();
    const v = this.form.getRawValue();
    if (serviceId == null) {
      return;
    }
    const roleId = v.role ? Number(v.role) : undefined;
    const base: Record<string, unknown> = {
      providerServiceMapID: serviceId,
      notificationTypeID: Number(v.notificationType),
      createdBy: this.sessionStore.user()?.userName,
      notification: v.subject.trim() || null,
      notificationDesc: v.message.trim() || null,
      validFrom: tzShift(dateAt(v.startDate, v.startTime || null, [0, 0, 0])),
      // Blank End Time falls back to end-of-day (old app set 23:59:59), NOT midnight —
      // a midnight fallback would create an already-expired validity window.
      validTill: tzShift(dateAt(v.endDate, v.endTime || null, [23, 59, 59])),
    };
    if (roleId !== undefined) {
      base['roleID'] = roleId;
    }
    const selectedOffices = this.officesSelected();
    const requestArray: Record<string, unknown>[] =
      selectedOffices.length > 0
        ? selectedOffices.map((o) => ({ ...base, workingLocationID: Number(o) }))
        : [{ ...base }];
    this.saving.set(true);
    this.api.createNotification(requestArray).subscribe({
      next: (res) => {
        this.saving.set(false);
        const createdId = Array.isArray(res?.data) ? (res.data[0] as NotificationRow)?.notificationTypeID : undefined;
        this.notify.alert(
          createdId === 18
            ? 'Alert created successfully'
            : createdId === 19
              ? 'Notification created successfully'
              : 'Created successfully',
          'success',
        );
        this.mode.set('list');
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to create', 'error');
      },
    });
  }

  private update(row: NotificationRow): void {
    const serviceId = this.serviceId();
    const v = this.form.getRawValue();
    if (serviceId == null) {
      return;
    }
    const start = dateAt(v.startDate, v.startTime || null, [0, 0, 0]);
    // Same end-of-day fallback as create() — old `editAlertNotification` set 23:59:59 when
    // End Time was blank, and the start/end comparison below is driven off that value.
    const end = dateAt(v.endDate, v.endTime || null, [23, 59, 59]);
    if (end <= start) {
      this.notify.alert('End date must be after start date', 'info');
      return;
    }
    this.saving.set(true);
    this.api
      .updateNotification({
        providerServiceMapID: serviceId,
        notificationTypeID: row.notificationTypeID,
        notificationID: row.notificationID,
        roleID: row.roleID,
        notification: v.subject.trim() || null,
        notificationDesc: v.message.trim() || null,
        validFrom: tzShift(start),
        validTill: tzShift(end),
        deleted: row.deleted,
        modifiedBy: this.sessionStore.user()?.userName,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify.alert('Updated successfully', 'success');
          this.mode.set('list');
          this.search();
        },
        error: (err: { errorMessage?: string }) => {
          this.saving.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to update', 'error');
        },
      });
  }
}
