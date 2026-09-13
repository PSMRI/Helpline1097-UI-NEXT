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
import { ZardSelectImports } from '@common-ui/ui/select';

import { ConfigApiService } from './config-api.service';
import { ConfigService } from '@/app-modules/core/services/config.service';
import { KmFileEntry } from '@/app-modules/core/models';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { LanguageStore } from '@/app-modules/core/state/language.store';
import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';

interface SubService {
  subServiceID: number;
  subServiceName?: string;
}
interface Category {
  categoryID: number;
  categoryName?: string;
}
interface Subcategory {
  subCategoryID: number;
  subCategoryName?: string;
  subCatFilePath?: string;
  fileURL?: string;
  fileNameWithExtension?: string;
  /** release-3.6.3: every previously uploaded version. */
  fileManger?: KmFileEntry[];
}
interface PendingFile {
  fileName: string;
  fileExtension: string;
  fileContent: string;
}

const ALLOWED_EXT = ['msg', 'pdf', 'png', 'jpeg', 'jpg', 'doc', 'docx', 'xlsx', 'xls', 'csv', 'txt'];

/**
 * Knowledge Management (supervisor page 10). An upload-only form: service → category →
 * subcategory cascade, then a file uploaded to `kmfilemanager/addFile` (body = an ARRAY of one
 * object). Distinct from the Training Resources (KM) screen — different endpoint and no list.
 */
@Component({
  selector: 'app-knowledge-management',
  imports: [ReactiveFormsModule, TranslatePipe, ZardButtonComponent, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './knowledge-management.component.html',
})
export class KnowledgeManagementComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ConfigApiService);
  private readonly config = inject(ConfigService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly lang = inject(LanguageStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  protected readonly services = signal<SubService[]>([]);
  protected readonly categories = signal<Category[]>([]);
  protected readonly subcategories = signal<Subcategory[]>([]);
  protected readonly selectedSubcategory = signal<Subcategory | null>(null);
  protected readonly pendingFile = signal<PendingFile | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly reading = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    service: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    category: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    subCategory: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getServiceTypes(serviceId).subscribe({
      next: (res) => {
        const all = Array.isArray(res?.data) ? (res.data as SubService[]) : [];
        this.services.set(all.filter((s) => s.subServiceName != null));
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load services', 'error'),
    });
  }

  protected onServiceChange(value: string | string[]): void {
    this.categories.set([]);
    this.subcategories.set([]);
    this.selectedSubcategory.set(null);
    this.form.patchValue({ category: '', subCategory: '' });
    if (!value) {
      return;
    }
    this.api.getCategoryByID(Number(value)).subscribe({
      next: (res) => this.categories.set(Array.isArray(res?.data) ? (res.data as Category[]) : []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load categories', 'error'),
    });
  }

  protected onCategoryChange(value: string | string[]): void {
    this.subcategories.set([]);
    this.selectedSubcategory.set(null);
    this.form.patchValue({ subCategory: '' });
    if (!value) {
      return;
    }
    this.api.getSubcategory(Number(value)).subscribe({
      next: (res) =>
        this.subcategories.set(Array.isArray(res?.data) ? (res.data as Subcategory[]) : []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load subcategories', 'error'),
    });
  }

  protected onSubCategoryChange(value: string | string[]): void {
    this.selectedSubcategory.set(
      this.subcategories().find((s) => String(s.subCategoryID) === value) ?? null,
    );
  }

  /** release `getFileURL` — `openKMBaseURL + fileUID`. */
  protected kmFileUrl(fileUID?: string): string {
    return `${this.config.openKmBaseUrl}${fileUID ?? ''}`;
  }
  /** Unconfigured base would make hrefs relative SPA links — render plain text instead. */
  protected readonly kmConfigured = !!this.config.openKmBaseUrl;

  /** release-3.6.3: refresh the sub-category list (and re-select) after an upload so the
   * "previous uploaded file" versions reflect the new state. */
  private refreshSubcategories(categoryId: number, subCategoryId: number): void {
    this.api.getSubcategory(categoryId).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? (res.data as Subcategory[]) : [];
        this.subcategories.set(rows);
        this.selectedSubcategory.set(
          rows.find((s) => String(s.subCategoryID) === String(subCategoryId)) ?? null,
        );
      },
      error: () => {
        /* keep the stale list; the next manual change re-fetches */
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
    // Old app's decimal-MB size check (bytes / 1000 / 1000), not 1024-based.
    if (file.size / 1000 / 1000 > 5) {
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

  protected save(): void {
    const serviceId = this.serviceId();
    const file = this.pendingFile();
    const v = this.form.getRawValue();
    if (serviceId == null || this.form.invalid || !file) {
      return;
    }
    const entry: Record<string, unknown> = {
      fileName: file.fileName,
      fileExtension: file.fileExtension,
      providerServiceMapID: serviceId,
      userID: this.sessionStore.userId(),
      createdBy: this.sessionStore.user()?.userName,
      categoryID: Number(v.category),
      subCategoryID: Number(v.subCategory),
    };
    // Old app omitted fileContent entirely when empty (unreachable in normal flow, kept faithful).
    if (file.fileContent) {
      entry['fileContent'] = file.fileContent;
    }
    this.saving.set(true);
    this.api.addFile([entry]).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert(this.lang.t('fileUploadedSuccessfully'), 'success');
        this.pendingFile.set(null);
        this.fileError.set(null);
        // release-3.6.3: keep the selection and refresh the version list in place
        // (the old full-reset left "previous uploaded file" showing stale state).
        this.refreshSubcategories(Number(v.category), Number(v.subCategory));
      },
      error: () => {
        this.saving.set(false);
        this.notify.alert(this.lang.t('failedToUploadFile'), 'error');
      },
    });
  }
}
