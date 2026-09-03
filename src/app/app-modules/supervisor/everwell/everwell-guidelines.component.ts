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
import { INPUT_FIELD_BLOCK, TEXTAREA_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { EverwellGuidelinesApiService } from './everwell-guidelines-api.service';
import { ApiResponse } from '@/app-modules/core/models';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** A row returned by fetchEverwellGuidelines. */
interface GuidelineRow {
  id?: number;
  guidelineName?: string;
  guidelineDesc?: string;
  category?: string;
  fileName?: string;
  fileContent?: string;
  createdBy?: string;
  deleted?: boolean;
  [key: string]: unknown;
}

/** A file staged for upload — `fileContent` keeps the FULL data-URL (prefix included). */
interface PendingFile {
  fileName: string;
  fileExtension: string;
  fileContent: string;
}

/** Old app allowed PDF only. */
const ALLOWED_EXT = ['pdf'];
const ROWS_PER_PAGE = 5;
/** At most two active (non-deleted) guidelines may exist at a time (old `go2form` gate). */
const MAX_ACTIVE = 2;
/** The two fixed category options (old `Categories`). */
const CATEGORIES = ['> 95 adherence percentage', '<= 95 adherence percentage'];

/** Local Date at start-of-day (00:00:00.000). */
function startOfDay(): Date {
  const c = new Date();
  c.setHours(0, 0, 0, 0);
  return c;
}

/** Local Date at 23:59:59.000, a given number of years from now. */
function endOfDayPlusYears(years: number): Date {
  const c = new Date();
  c.setFullYear(c.getFullYear() + years);
  c.setHours(23, 59, 59, 0);
  return c;
}

/**
 * Everwell Guidelines Upload (supervisor page 28). A list + create + soft-delete screen for
 * PDF guideline documents. Faithful to the old `everwell-guidelines-upload`:
 *  - at most two active guidelines (the Upload button gates on it);
 *  - PDF-only, ≤5 MB (decimal), single-dot filenames;
 *  - the save body is a SINGLE object and `fileContent` is the FULL base64 data-URL
 *    (prefix NOT stripped — the backend stores it whole and `openDoc` strips on read);
 *  - `validFrom` = today 00:00, `validTill` = today + 20 years 23:59:59 (local → UTC on post);
 *  - delete sends `modifiedBy = row.createdBy` (the row's creator, not the current user).
 */
@Component({
  selector: 'app-everwell-guidelines',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, RestrictInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './everwell-guidelines.component.html',
})
export class EverwellGuidelinesComponent implements OnInit {
  protected readonly inputFieldBlock = INPUT_FIELD_BLOCK;
  protected readonly textAreaBlock = TEXTAREA_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(EverwellGuidelinesApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  protected readonly categories = CATEGORIES;
  protected readonly mode = signal<'list' | 'form'>('list');
  protected readonly rows = signal<GuidelineRow[]>([]);
  protected readonly pageIndex = signal(0);
  protected readonly saving = signal(false);
  protected readonly pendingFile = signal<PendingFile | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly reading = signal(false);

  /** Only non-deleted rows are shown, and the "max 2 active" gate counts these. */
  protected readonly activeRows = computed(() => this.rows().filter((r) => !r.deleted));
  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.activeRows().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedRows = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.activeRows().slice(start, start + ROWS_PER_PAGE);
  });

  protected readonly form = this.fb.group({
    guidelineName: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(100)],
    }),
    guidelineDesc: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(300)],
    }),
    category: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    this.loadList();
  }

  private loadList(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.fetchGuidelines(serviceId).subscribe({
      next: (res: ApiResponse) => {
        const list = (res?.data as { data?: unknown } | undefined)?.data;
        this.rows.set(Array.isArray(list) ? (list as GuidelineRow[]) : []);
        this.pageIndex.set(0);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load guidelines', 'error'),
    });
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }
  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  protected serial(indexOnPage: number): number {
    return this.pageIndex() * ROWS_PER_PAGE + indexOnPage + 1;
  }

  /** Old `go2form`: blocks the form when two active guidelines already exist. */
  protected startCreate(): void {
    if (this.activeRows().length >= MAX_ACTIVE) {
      this.notify.alert(
        'Please delete any existing guidelines to continue',
        'info',
      );
      return;
    }
    this.pendingFile.set(null);
    this.fileError.set(null);
    this.form.reset({ guidelineName: '', guidelineDesc: '', category: '' });
    this.mode.set('form');
  }

  /** Old `go2table` (the form's Back button): clear the staged file, re-fetch, show the list. */
  protected cancelForm(): void {
    this.pendingFile.set(null);
    this.fileError.set(null);
    this.mode.set('list');
    this.loadList();
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
    // Old app accepted single-dot filenames only (split length must be exactly 2)…
    if (parts.length !== 2 || parts[0] === '') {
      // …and required a non-empty base name.
      this.fileError.set('Invalid file name — exactly one "." with a name is required');
      input.value = '';
      return;
    }
    const ext = parts[1].toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      this.fileError.set('Supported file format is .pdf');
      input.value = '';
      return;
    }
    // Old app's decimal-MB size check (bytes / 1000 / 1000), not 1024-based.
    if (file.size / 1000 / 1000 > 5) {
      this.fileError.set('File size should not exceed 5 MB');
      input.value = '';
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      this.pendingFile.set({
        fileName: file.name,
        fileExtension: '.' + parts[1],
        // Keep the FULL data-URL — the old save sent it with the prefix intact.
        fileContent: String(reader.result ?? ''),
      });
      this.reading.set(false);
    };
    reader.onerror = () => {
      this.reading.set(false);
      this.fileError.set('Could not read the file');
    };
    // Guard the async read: Save stays disabled until the base64 content is ready.
    this.reading.set(true);
    reader.readAsDataURL(file);
  }

  protected save(): void {
    const serviceId = this.serviceId();
    const file = this.pendingFile();
    if (serviceId == null || this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!file) {
      this.notify.alert('Please upload document', 'info');
      return;
    }
    const v = this.form.getRawValue();
    // Old app sent the RAW numeric uid and only null-substituted name/desc when the raw
    // value was null/undefined — a whitespace-only value serialised as "" (kept faithful).
    const userIdStr = this.sessionStore.userId();
    const body: Record<string, unknown> = {
      guidelineName: v.guidelineName.trim(),
      guidelineDesc: v.guidelineDesc.trim(),
      fileName: file.fileName,
      fileExtension: file.fileExtension,
      providerServiceMapID: serviceId,
      fileContent: file.fileContent,
      createdBy: this.sessionStore.user()?.userName,
      validFrom: startOfDay().toISOString(),
      validTill: endOfDayPlusYears(20).toISOString(),
      userID: userIdStr != null ? Number(userIdStr) : null,
      category: v.category,
    };
    this.saving.set(true);
    this.api.saveGuidelines(body).subscribe({
      next: (res: ApiResponse) => {
        this.saving.set(false);
        const data = (res?.data as { data?: { id?: unknown } } | undefined)?.data;
        if (data && data.id !== undefined) {
          // Old app stayed on the form after a successful upload: reset the fields, clear the
          // staged file, and do NOT refresh the list (its getGuidelines() call was commented
          // out). Kept faithful — the list refreshes when the user clicks Back.
          this.form.reset({ guidelineName: '', guidelineDesc: '', category: '' });
          this.pendingFile.set(null);
          this.fileError.set(null);
          this.notify.alert('File uploaded successfully', 'success');
        } else {
          this.notify.alert(String(data ?? 'Failed to upload guideline'), 'error');
        }
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to upload guideline', 'error');
      },
    });
  }

  /** Soft-delete: `modifiedBy` is the row's own creator (old contract, not the current user). */
  protected deactivate(row: GuidelineRow): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.notify.confirm('Do you want to delete the guideline?').subscribe((ok) => {
      if (!ok) {
        return;
      }
      this.api
        .deleteGuidelines({
          id: row.id,
          providerServiceMapID: serviceId,
          modifiedBy: row.createdBy,
          deleted: true,
        })
        .subscribe({
          next: (res: ApiResponse) => {
            const msg = (res?.data as { response?: unknown } | undefined)?.response;
            this.notify.alert(String(msg ?? 'Deleted successfully'), 'success');
            this.loadList();
          },
          error: (err: { errorMessage?: string }) =>
            this.notify.alert(err?.errorMessage ?? 'Failed to delete guideline', 'error'),
        });
    });
  }

  /** Old `openDoc`: strip the PDF data-URL prefix, decode base64, open the blob in a new tab. */
  protected openDoc(content: string | undefined): void {
    if (!content) {
      return;
    }
    const base64 = content.replace('data:application/pdf;base64,', '');
    try {
      const byteChars = atob(base64);
      const bytes = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        bytes[i] = byteChars.charCodeAt(i);
      }
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
      window.open(url, '_blank');
    } catch {
      this.notify.alert('Could not open the document', 'error');
    }
  }
}
