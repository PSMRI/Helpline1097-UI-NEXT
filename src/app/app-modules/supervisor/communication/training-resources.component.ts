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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { RestrictInputDirective } from '@/app-modules/core/directives/restrict-input.directive';
import { TEXTAREA_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { CommunicationApiService, ProviderRole } from './communication-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** A KM/training row (getSupervisorNotification). */
interface TrainingRow {
  notificationID: number;
  notificationTypeID: number;
  roleID?: number;
  role?: { RoleName?: string };
  notification?: string;
  notificationDesc?: string;
  validFrom?: string;
  validTill?: string;
  kmFilePath?: string;
  kmFileManager?: { fileName?: string };
  deleted?: boolean;
  [key: string]: unknown;
}

/** A file staged for upload — the nested `kmFileManager` payload (minus dates/ids added at post). */
interface PendingFile {
  fileName: string;
  fileExtension: string;
  fileContent: string;
}

const ALLOWED_EXT = ['msg', 'pdf', 'png', 'jpeg', 'jpg', 'doc', 'docx', 'xlsx', 'xls', 'csv', 'txt'];
const MAX_BYTES = 5 * 1024 * 1024;
const ROWS_PER_PAGE = 3;

/** Coerce a z-select value to an array (see alerts-notifications for the CVA caveat). */
function asArray(value: string | string[]): string[] {
  return Array.isArray(value) ? value : value ? [value] : [];
}

/** Local Date at start-of-day (00:00:00). */
function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Local Date at end-of-day (23:59:59) a given number of years from now. */
function endOfDayPlusYears(years: number): Date {
  const c = new Date();
  c.setFullYear(c.getFullYear() + years);
  c.setHours(23, 59, 59, 0);
  return c;
}

/**
 * Training Resources / Knowledge Management (supervisor case 21). Audience = roles (multi).
 * The list auto-loads a fixed 7-day window on init. An optional file rides inside the
 * `createNotification`/`updateNotification` body as a nested `kmFileManager` (there is no
 * separate upload endpoint). `validFrom` = today 00:00, `validTill` = today + 20 years 23:59:59
 * (the old app ignored any form dates and did NOT tz-shift these).
 */
@Component({
  selector: 'app-training-resources',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, RestrictInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './training-resources.component.html',
})
export class TrainingResourcesComponent implements OnInit {
  protected readonly textAreaBlock = TEXTAREA_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CommunicationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private notificationTypeID: number | null = null;

  protected readonly mode = signal<'list' | 'form'>('list');
  protected readonly editing = signal<TrainingRow | null>(null);
  protected readonly roles = signal<ProviderRole[]>([]);
  protected readonly rows = signal<TrainingRow[]>([]);
  /** The full role multi-selection (the reactive control alone is unreliable in multi-mode). */
  protected readonly rolesSelected = signal<string[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly saving = signal(false);
  protected readonly pendingFile = signal<PendingFile | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly reading = signal(false);

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.rows().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.rows().slice(start, start + ROWS_PER_PAGE);
  });

  protected readonly form = this.fb.group({
    // Role selection is tracked via `rolesSelected` (multi-mode CVA is unreliable); the
    // control remains only to drive the disabled state in edit mode.
    roles: this.fb.control<string[]>([], { nonNullable: true }),
    subject: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(5), Validators.maxLength(200)],
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
    this.api.getNotificationTypes(serviceId).subscribe({
      next: (res) => {
        const match = (res?.data ?? []).find(
          (t) => (t.notificationType ?? '').toLowerCase() === 'km',
        );
        this.notificationTypeID = match?.notificationTypeID ?? null;
        this.loadRoles(serviceId);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load notification type', 'error'),
    });
  }

  private loadRoles(serviceId: number): void {
    this.api.getRoles(serviceId).subscribe({
      next: (res) => {
        const all = Array.isArray(res?.data) ? res.data : [];
        this.roles.set(all.filter((r) => (r.featureName?.length ?? 0) !== 0));
        this.loadList();
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load roles', 'error'),
    });
  }

  /** Fixed 7-day window (today → today+7), the old KM screen's auto-list. */
  private loadList(): void {
    const serviceId = this.serviceId();
    if (serviceId == null || this.notificationTypeID == null) {
      return;
    }
    const start = startOfDay(new Date());
    const end = new Date();
    end.setDate(end.getDate() + 7);
    end.setHours(23, 59, 59, 0);
    this.api
      .getSupervisorNotification({
        providerServiceMapID: serviceId,
        notificationTypeID: this.notificationTypeID,
        roleIDs: this.roles().map((r) => r.roleID),
        validStartDate: start.toISOString(),
        validEndDate: end.toISOString(),
      })
      .subscribe({
        next: (res) => {
          this.rows.set(Array.isArray(res?.data) ? (res.data as TrainingRow[]) : []);
          this.pageIndex.set(0);
        },
        error: (err: { errorMessage?: string }) =>
          this.notify.alert(err?.errorMessage ?? 'Failed to load resources', 'error'),
      });
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }
  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  // ---- file handling -------------------------------------------------------
  protected onFileSelected(event: Event): void {
    this.fileError.set(null);
    this.pendingFile.set(null);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const parts = file.name.split('.');
    // Old app accepted single-dot filenames only (split length must be exactly 2).
    if (parts.length !== 2) {
      this.fileError.set('Invalid file name — a single "." is allowed');
      input.value = '';
      return;
    }
    const ext = parts[1].toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      this.fileError.set(`Unsupported file type. Allowed: ${ALLOWED_EXT.join(', ')}`);
      input.value = '';
      return;
    }
    if (file.size > MAX_BYTES) {
      this.fileError.set('File exceeds the 5 MB limit');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? '');
      this.pendingFile.set({
        fileName: file.name,
        fileExtension: '.' + parts[1],
        fileContent: dataUrl.split(',')[1] ?? '',
      });
      this.reading.set(false);
    };
    reader.onerror = () => {
      this.reading.set(false);
      this.fileError.set('Could not read the file');
    };
    // Guard the async read: Save stays disabled until the base64 content is ready, else a
    // quick submit would post the record with no file attached.
    this.reading.set(true);
    reader.readAsDataURL(file);
  }

  // ---- create / edit -------------------------------------------------------
  protected onRolesChange(value: string | string[]): void {
    this.rolesSelected.set(asArray(value));
  }

  protected startCreate(): void {
    this.editing.set(null);
    this.pendingFile.set(null);
    this.fileError.set(null);
    this.rolesSelected.set([]);
    this.form.reset({ roles: [], subject: '', message: '' });
    this.form.controls.roles.enable();
    this.mode.set('form');
  }

  protected startEdit(row: TrainingRow): void {
    this.editing.set(row);
    this.pendingFile.set(null);
    this.fileError.set(null);
    this.rolesSelected.set(row.roleID != null ? [String(row.roleID)] : []);
    this.form.reset({
      roles: row.roleID != null ? [String(row.roleID)] : [],
      subject: row.notification ?? '',
      message: row.notificationDesc ?? '',
    });
    this.form.controls.roles.disable();
    this.mode.set('form');
  }

  protected cancelForm(): void {
    this.mode.set('list');
  }

  private buildFileManager(validFrom: string, validUpto: string): Record<string, unknown> | undefined {
    const file = this.pendingFile();
    const serviceId = this.serviceId();
    if (!file || serviceId == null) {
      return undefined;
    }
    return {
      fileName: file.fileName,
      fileExtension: file.fileExtension,
      providerServiceMapID: serviceId,
      userID: this.sessionStore.userId(),
      validFrom,
      validUpto, // NOTE: the file manager keys the far date as `validUpto`, not `validTill`.
      fileContent: file.fileContent,
      createdBy: this.sessionStore.user()?.userName,
    };
  }

  protected save(): void {
    const editing = this.editing();
    if (this.form.invalid || (!editing && this.rolesSelected().length === 0)) {
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
    const validFrom = startOfDay(new Date()).toISOString();
    const validTill = endOfDayPlusYears(20).toISOString();
    const km = this.buildFileManager(validFrom, validTill);
    const base: Record<string, unknown> = {
      providerServiceMapID: serviceId,
      notificationTypeID: this.notificationTypeID,
      createdBy: this.sessionStore.user()?.userName,
      notification: v.subject.trim() || null,
      notificationDesc: v.message.trim() || null,
      validFrom,
      validTill,
      kmFileManager: km,
    };
    const requestArray = this.rolesSelected().map((r) => ({ ...base, roleID: Number(r) }));
    this.saving.set(true);
    this.api.createNotification(requestArray).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert('Training resource created successfully', 'success');
        this.mode.set('list');
        this.loadList();
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to create', 'error');
      },
    });
  }

  private update(row: TrainingRow): void {
    const serviceId = this.serviceId();
    const v = this.form.getRawValue();
    if (serviceId == null) {
      return;
    }
    // A re-upload reuses the row's own validity window (file manager keys it as validUpto).
    const km = this.buildFileManager(row.validFrom ?? '', row.validTill ?? '');
    const body: Record<string, unknown> = {
      providerServiceMapID: serviceId,
      notificationTypeID: row.notificationTypeID,
      notificationID: row.notificationID,
      roleID: row.roleID,
      notification: v.subject.trim() || null,
      notificationDesc: v.message.trim() || null,
      validFrom: row.validFrom,
      validTill: row.validTill,
      deleted: row.deleted,
      modifiedBy: this.sessionStore.user()?.userName,
    };
    if (km) {
      body['kmFileManager'] = km;
    }
    this.saving.set(true);
    this.api.updateNotification(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert('Updated successfully', 'success');
        this.mode.set('list');
        this.loadList();
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to update', 'error');
      },
    });
  }

  /** Activate/deactivate toggles `deleted` and re-posts the row via updateNotification. */
  protected toggleActive(row: TrainingRow): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    const next = !row.deleted;
    this.notify
      .confirm(next ? 'Deactivate this resource?' : 'Activate this resource?')
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        this.api
          .updateNotification({
            providerServiceMapID: serviceId,
            notificationTypeID: row.notificationTypeID,
            notificationID: row.notificationID,
            roleID: row.roleID,
            notification: row.notification,
            notificationDesc: row.notificationDesc,
            validFrom: row.validFrom,
            validTill: row.validTill,
            deleted: next,
            modifiedBy: this.sessionStore.user()?.userName,
          })
          .subscribe({
            next: () => {
              this.notify.alert('Updated successfully', 'success');
              this.loadList();
            },
            error: (err: { errorMessage?: string }) =>
              this.notify.alert(err?.errorMessage ?? 'Failed to update', 'error'),
          });
      });
  }
}
