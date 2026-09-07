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
import { tzShift } from '../config/config-api.service';
import {
  EmailStatus,
  FeedbackApiService,
  FeedbackStatus,
  FeedbackType,
} from './feedback-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

interface HistoryRow {
  feedbackRequestID?: number;
  feedbackSupSummary?: string;
  comments?: string;
  responseComments?: string;
  attachmentPath?: string;
  lastFeedbackStatus?: string;
  emailStatus?: { emailStatus?: string };
  createdBy?: string;
  createdDate?: number | string;
  responseUpdatedBy?: string;
  responseDate?: number | string;
  [key: string]: unknown;
}

interface FeedbackRow {
  feedbackID?: number;
  requestID?: string;
  createdBy?: string;
  createdDate?: number | string;
  districtID?: number;
  beneficiary?: { firstName?: string; lastName?: string };
  feedbackType?: { feedbackTypeName?: string };
  feedbackStatus?: { feedbackStatus?: string };
  feedbackStatusID?: number;
  emailStatus?: { emailStatus?: string };
  emailStatusID?: number;
  institutionName?: string;
  designationName?: string;
  severityTypeName?: string;
  // The populated detail fields are NESTED; the flat siblings above arrive empty.
  instituteType?: { institutionType?: string };
  designation?: { designationName?: string };
  severity?: { severityTypeName?: string };
  muser?: { firstName?: string; lastName?: string };
  feedback?: string;
  feedbackSupSummary?: string;
  feedbackRequests?: { feedbackRequestID?: number; feedbackSupSummary?: string }[];
  consolidatedRequests?: HistoryRow[];
  feedbackResponses?: HistoryRow[];
  attachmentPath?: string;
  [key: string]: unknown;
}

interface PendingFile {
  fileName: string;
  fileExtension: string;
  fileContent: string;
}

const ALLOWED_EXT = ['msg', 'pdf', 'doc', 'docx', 'txt'];
const ROWS_PER_PAGE = 5;

function beneficiaryName(row: FeedbackRow): string {
  return `${row.beneficiary?.firstName ?? ''} ${row.beneficiary?.lastName ?? ''}`.trim();
}

/** Detail-view field sources, per the old `requestFeedback(feedback)` form patch. */
function detailBeneficiaryName(row: FeedbackRow): string {
  return `${row.muser?.firstName ?? ''} ${row.muser?.lastName ?? ''}`.trim();
}
function detailInstitution(row: FeedbackRow): string {
  return row.instituteType?.institutionType ?? '';
}
function detailDesignation(row: FeedbackRow): string {
  return row.designation?.designationName ?? '';
}
function detailSeverity(row: FeedbackRow): string {
  return row.severity?.severityTypeName ?? '';
}
/** Last request's summary, else the beneficiary's original feedback text. */
function detailSummary(row: FeedbackRow): string {
  const reqs = row.feedbackRequests ?? [];
  return reqs[reqs.length - 1]?.feedbackSupSummary || row.feedback || '';
}
function detailDate(row: FeedbackRow): string {
  return new Date(row.createdDate as string).toLocaleDateString('en-in');
}

/**
 * Feedback Tracking (supervisor page 1, old `<supervisor-grievance>`). A date/type/id search
 * over `feedback/getFeedbacksList`, an edit flow that posts `feedback/requestFeedback` then
 * emails the authority, and an update flow that posts `feedback/updateResponse` (with an
 * optional attachment). All read-mostly — there is no reassign/resolve/delete.
 */
@Component({
  selector: 'app-feedback-tracking',
  imports: [
    ReactiveFormsModule,
    DatePipe,
    ZardButtonComponent,
    ZardInputDirective,
    RestrictInputDirective,
    ...ZardSelectImports,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './feedback-tracking.component.html',
})
export class FeedbackTrackingComponent implements OnInit {
  protected readonly textAreaBlock = TEXTAREA_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(FeedbackApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  protected readonly mode = signal<'view' | 'edit' | 'update' | 'email'>('view');
  protected readonly selected = signal<FeedbackRow | null>(null);
  protected readonly feedbackList = signal<FeedbackRow[]>([]);
  protected readonly feedbackTypes = signal<FeedbackType[]>([]);
  protected readonly feedbackStatuses = signal<FeedbackStatus[]>([]);
  protected readonly emailStatuses = signal<EmailStatus[]>([]);
  protected readonly history = signal<HistoryRow[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly searching = signal(false);
  protected readonly saving = signal(false);

  // Update-mode file
  protected readonly pendingFile = signal<PendingFile | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly reading = signal(false);

  // Email panel
  protected readonly autoEmails = signal<string[]>([]);
  protected readonly manualEmails = signal<string[]>([]);
  private emailFeedbackID: number | null = null;

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.feedbackList().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedList = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.feedbackList().slice(start, start + ROWS_PER_PAGE);
  });

  protected readonly searchForm = this.fb.group({
    startDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    endDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    feedbackTypeID: this.fb.control<string>('', { nonNullable: true }),
    requestID: this.fb.control<string>('', { nonNullable: true, validators: [Validators.maxLength(30)] }),
  });

  protected readonly detailForm = this.fb.group({
    comments: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(500)],
    }),
    feedbackStatusID: this.fb.control<string>('', { nonNullable: true }),
    emailStatusID: this.fb.control<string>('', { nonNullable: true }),
  });

  protected readonly manualEmailForm = this.fb.group({
    email: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.pattern(/^[0-9a-zA-Z_.]+@[a-zA-Z_]+?\.\b(org|com|COM|IN|in|co.in)\b$/)],
    }),
  });

  protected readonly today = this.inputDay(new Date());

  ngOnInit(): void {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    this.searchForm.patchValue({
      startDate: this.inputDay(start),
      endDate: this.inputDay(new Date()),
    });
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getFeedbackTypes(serviceId).subscribe({
      next: (res) => this.feedbackTypes.set(Array.isArray(res?.data) ? res.data : []),
      error: () => {},
    });
    this.api.getFeedbackStatuses().subscribe({
      next: (res) => this.feedbackStatuses.set(Array.isArray(res?.data) ? res.data : []),
      error: () => {},
    });
    this.api.getEmailStatuses().subscribe({
      next: (res) => this.emailStatuses.set(Array.isArray(res?.data) ? res.data : []),
      error: () => {},
    });
    this.search();
  }

  private inputDay(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Local Date at start (00:00:00) / end (23:59:59) of a yyyy-MM-dd, then the fake-UTC shift. */
  private boundary(dateStr: string, edge: 'start' | 'end'): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    const date = new Date(y, m - 1, d);
    date.setHours(edge === 'end' ? 23 : 0, edge === 'end' ? 59 : 0, edge === 'end' ? 59 : 0, 0);
    return tzShift(date);
  }

  // ---- search / list -------------------------------------------------------
  protected search(): void {
    const serviceId = this.serviceId();
    const v = this.searchForm.getRawValue();
    if (serviceId == null || this.searchForm.invalid) {
      return;
    }
    const body: Record<string, unknown> = { serviceID: serviceId, is1097: true };
    if (v.requestID) {
      body['requestID'] = v.requestID;
    }
    if (v.startDate) {
      body['startDate'] = this.boundary(v.startDate, 'start');
    }
    if (v.endDate) {
      body['endDate'] = this.boundary(v.endDate, 'end');
    }
    if (v.feedbackTypeID) {
      body['feedbackTypeID'] = v.feedbackTypeID;
    }
    this.searching.set(true);
    this.api.getFeedbacksList(body).subscribe({
      next: (res) => {
        this.searching.set(false);
        this.feedbackList.set(Array.isArray(res?.data) ? (res.data as FeedbackRow[]) : []);
        this.pageIndex.set(0);
      },
      error: (err: { status?: number }) => {
        this.searching.set(false);
        this.feedbackList.set([]);
        // Old app surfaced err.status here; we show a generic message instead.
        this.notify.alert('Failed to load feedback', 'error');
      },
    });
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }
  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  protected benName(row: FeedbackRow): string {
    return beneficiaryName(row);
  }

  /** Detail-view display helpers (old form patched these from the NESTED response fields). */
  protected detBenName = detailBeneficiaryName;
  protected detInstitution = detailInstitution;
  protected detDesignation = detailDesignation;
  protected detSeverity = detailSeverity;
  protected detSummary = detailSummary;
  protected detDate = detailDate;
  protected detModifiedBy(): string {
    return this.sessionStore.user()?.userName ?? '';
  }

  // ---- edit / update -------------------------------------------------------
  protected startEdit(row: FeedbackRow): void {
    this.selected.set(row);
    this.detailForm.reset({
      comments: '',
      feedbackStatusID: row.feedbackStatusID != null ? String(row.feedbackStatusID) : '',
      emailStatusID: row.emailStatusID != null ? String(row.emailStatusID) : '',
    });
    this.detailForm.controls.emailStatusID.enable();
    this.history.set(row.consolidatedRequests ?? []);
    this.mode.set('edit');
  }

  protected startUpdate(row: FeedbackRow): void {
    this.selected.set(row);
    this.pendingFile.set(null);
    this.fileError.set(null);
    this.detailForm.reset({
      comments: '',
      feedbackStatusID: row.feedbackStatusID != null ? String(row.feedbackStatusID) : '',
      emailStatusID: row.emailStatusID != null ? String(row.emailStatusID) : '',
    });
    // Email status is fixed in update mode.
    this.detailForm.controls.emailStatusID.disable();
    this.history.set(row.consolidatedRequests ?? []);
    this.mode.set('update');
  }

  protected backToList(): void {
    this.mode.set('view');
    this.search();
  }

  /** Old requestFeedback vs updateResponse patched a few fields DIFFERENTLY:
   * edit = muser name + LAST request's summary; update = beneficiary name + FIRST. */
  private commonDetailFields(row: FeedbackRow, mode: 'edit' | 'update'): Record<string, unknown> {
    const v = this.detailForm.getRawValue();
    return {
      feedbackSupSummary:
        mode === 'edit'
          ? detailSummary(row)
          : row.feedbackRequests?.[0]?.feedbackSupSummary || row.feedback || '',
      beneficiaryName: mode === 'edit' ? detailBeneficiaryName(row) : beneficiaryName(row),
      comments: v.comments.trim(),
      createdBy: row.createdBy,
      // Old prefill: the ROW's original createdDate, not today (an absent createdDate posts
      // "Invalid Date" — the old app did the same, unguarded).
      feedbackDate: detailDate(row),
      feedbackTypeName: row.feedbackType?.feedbackTypeName,
      feedbackStatus: undefined,
      emailStatus: undefined,
      // Old only set this control when instituteType existed — otherwise it stayed null.
      institutionName: row.instituteType ? detailInstitution(row) : null,
      designationName: detailDesignation(row),
      severityTypeName: detailSeverity(row),
      modifiedBy: this.sessionStore.user()?.userName,
      emailStatusID: row.emailStatusID,
      feedbackStatusID: v.feedbackStatusID ? Number(v.feedbackStatusID) : row.feedbackStatusID,
      serviceID: this.serviceId(),
    };
  }

  protected saveEdit(): void {
    const row = this.selected();
    if (!row || this.detailForm.invalid) {
      this.detailForm.markAllAsTouched();
      return;
    }
    const body: Record<string, unknown> = {
      ...this.commonDetailFields(row, 'edit'),
      feedbackID: row.feedbackID,
      createdDate: null,
      supUserID: null,
      updateResponse: null,
      feedbackRequestID: null,
    };
    this.saving.set(true);
    this.api.requestFeedback(body).subscribe({
      next: () => {
        this.saving.set(false);
        // On success the old app opened the authority-email dialog.
        this.openEmailPanel(row);
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to save feedback', 'error');
      },
    });
  }

  protected saveUpdate(): void {
    const row = this.selected();
    const serviceId = this.serviceId();
    if (!row || serviceId == null || this.detailForm.invalid || this.fileError() || this.reading()) {
      this.detailForm.markAllAsTouched();
      return;
    }
    const body: Record<string, unknown> = {
      ...this.commonDetailFields(row, 'update'),
      feedbackID: row.feedbackID,
      feedbackRequestID: row.feedbackRequests?.[0]?.feedbackRequestID,
      feedbackResponseID: undefined,
      // Old posted the reset form verbatim — these rode along as null on every update.
      createdDate: null,
      supUserID: null,
      updateResponse: null,
    };
    const file = this.pendingFile();
    if (file) {
      body['kmFileManager'] = {
        fileName: file.fileName,
        fileExtension: file.fileExtension,
        providerServiceMapID: serviceId,
        userID: this.sessionStore.userId(),
        fileContent: file.fileContent,
        createdBy: this.sessionStore.user()?.userName,
      };
    }
    this.saving.set(true);
    this.api.updateResponse(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert('Successfully updated', 'success');
        this.backToList();
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to update', 'error');
      },
    });
  }

  protected onFileSelected(event: Event): void {
    this.fileError.set(null);
    this.pendingFile.set(null);
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    const parts = file.name.split('.');
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
    if (file.size / 1024 / 1024 > 5) {
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
    this.reading.set(true);
    reader.readAsDataURL(file);
  }

  // ---- email panel ---------------------------------------------------------
  private openEmailPanel(row: FeedbackRow): void {
    this.emailFeedbackID = row.feedbackID ?? null;
    this.manualEmails.set([]);
    this.autoEmails.set([]);
    this.manualEmailForm.reset({ email: '' });
    this.mode.set('email');
    if (row.districtID == null) {
      return;
    }
    this.api.getAuthorityEmails(row.districtID).subscribe({
      next: (res) => this.autoEmails.set(Array.isArray(res?.data) ? (res.data as string[]) : []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load emails', 'error'),
    });
  }

  protected addManualEmail(): void {
    const control = this.manualEmailForm.controls.email;
    const email = control.value.trim();
    if (!email || control.invalid) {
      control.markAsTouched();
      return;
    }
    this.manualEmails.update((list) => [...list, email]);
    this.manualEmailForm.reset({ email: '' });
  }

  protected removeManualEmail(index: number): void {
    this.manualEmails.update((list) => list.filter((_, i) => i !== index));
  }

  protected sendEmail(): void {
    if (this.emailFeedbackID == null) {
      return;
    }
    const emailID = [...this.autoEmails(), ...this.manualEmails()].join(',');
    this.saving.set(true);
    this.api.sendEmail(this.emailFeedbackID, emailID).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert('Email sent', 'success');
        this.backToList();
      },
      // Old app swallowed send errors as success; here we still return to the list.
      error: () => {
        this.saving.set(false);
        this.backToList();
      },
    });
  }
}
