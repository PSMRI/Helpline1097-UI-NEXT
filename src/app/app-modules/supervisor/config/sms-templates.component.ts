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
import { INPUT_FIELD_BLOCK, SMS_TEMPLATE_PASTE_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { ConfigApiService } from './config-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

interface SmsType {
  smsTypeID: number;
  smsType?: string;
}
interface SmsParameter {
  smsParameterID: number;
  smsParameterType?: string;
  smsParameterName?: string;
}
/** getSMSParameters returns parameters grouped by type: [{smsParameterType, smsParameters[]}]. */
interface SmsParameterGroup {
  smsParameterType?: string;
  smsParameters?: SmsParameter[];
}
interface SmsParameterMap {
  createdBy?: string;
  modifiedBy?: string;
  smsParameterName?: string;
  smsParameterType?: string;
  smsParameterID?: number;
  smsParameterValue?: string;
}
interface SmsTemplateRow {
  smsTemplateID: number;
  smsTemplateName?: string;
  smsTemplate?: string;
  smsTypeID?: number;
  smsType?: { smsType?: string; smsTypeID?: number };
  deleted?: boolean;
  providerServiceMapID?: number;
  smsParameterMaps?: SmsParameterMap[];
  [key: string]: unknown;
}

/**
 * SMS_SERVICE_ID — the real 1097 service master ID (old `current_serviceID`, distinct from the
 * providerServiceMapID). This app is single-service (1097) so it is invariantly 1, matching the
 * old app's `current_serviceID || 1` fallback.
 */
const SMS_SERVICE_ID = 1;
const ROWS_PER_PAGE = 5;

/**
 * SMS Templates (supervisor page 24). List / create / read-only view of SMS templates. Create
 * parses `$$TOKEN$$` placeholders out of the body, appends a synthetic `SMS_PHONE_NO`, and
 * requires every token mapped to a parameter before saving. Activate/deactivate round-trips the
 * whole template row with `deleted`/`modifiedBy` mutated.
 */
@Component({
  selector: 'app-sms-templates',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, RestrictInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sms-templates.component.html',
})
export class SmsTemplatesComponent implements OnInit {
  protected readonly inputFieldBlock = INPUT_FIELD_BLOCK;
  protected readonly smsTemplatePasteBlock = SMS_TEMPLATE_PASTE_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ConfigApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  protected readonly mode = signal<'list' | 'create' | 'view'>('list');
  protected readonly templates = signal<SmsTemplateRow[]>([]);
  protected readonly smsTypes = signal<SmsType[]>([]);
  protected readonly smsParameterGroups = signal<SmsParameterGroup[]>([]);
  protected readonly pendingParameters = signal<string[]>([]);
  private parameterCount = 0;
  protected readonly buffer = signal<SmsParameterMap[]>([]);
  protected readonly showParameters = signal(false);
  protected readonly pageIndex = signal(0);
  protected readonly saving = signal(false);

  // View mode
  protected readonly viewParams = signal<SmsParameterMap[]>([]);

  /** smsTypeIDs already used by an active template (one active template per type). */
  private activeTypeIds: number[] = [];

  protected readonly pageCount = computed(() =>
    Math.max(1, Math.ceil(this.templates().length / ROWS_PER_PAGE)),
  );
  protected readonly pagedTemplates = computed(() => {
    const start = this.pageIndex() * ROWS_PER_PAGE;
    return this.templates().slice(start, start + ROWS_PER_PAGE);
  });

  /** The value-types available for mapping (the `valueType` select) — one per group. */
  protected readonly valueTypes = computed(() =>
    this.smsParameterGroups()
      .map((g) => g.smsParameterType ?? '')
      .filter(Boolean),
  );

  protected readonly form = this.fb.group({
    templateName: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.maxLength(40)],
    }),
    smsType: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    smsTemplate: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(20), Validators.maxLength(160)],
    }),
  });

  protected readonly mapForm = this.fb.group({
    parameter: this.fb.control<string>('', { nonNullable: true }),
    valueType: this.fb.control<string>('', { nonNullable: true }),
    value: this.fb.control<string>('', { nonNullable: true }),
  });

  // View form (read-only)
  protected readonly viewForm = this.fb.group({
    templateName: this.fb.control<string>({ value: '', disabled: true }),
    smsType: this.fb.control<string>({ value: '', disabled: true }),
    smsTemplate: this.fb.control<string>({ value: '', disabled: true }),
  });

  ngOnInit(): void {
    this.loadTemplates();
  }

  private loadTemplates(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getSMSTemplates(serviceId).subscribe({
      next: (res) => {
        const all = Array.isArray(res?.data) ? (res.data as SmsTemplateRow[]) : [];
        this.templates.set(all);
        this.activeTypeIds = all
          .filter((t) => t.deleted === false && t.smsTypeID != null)
          .map((t) => t.smsTypeID as number);
        this.pageIndex.set(0);
      },
      // Old app only console-logged this error (no toast) — kept silent.
      error: () => {},
    });
  }

  protected prevPage(): void {
    this.pageIndex.update((i) => Math.max(0, i - 1));
  }
  protected nextPage(): void {
    this.pageIndex.update((i) => Math.min(this.pageCount() - 1, i + 1));
  }

  // ---- create --------------------------------------------------------------
  protected startCreate(): void {
    this.form.reset({ templateName: '', smsType: '', smsTemplate: '' });
    this.form.enable();
    this.mapForm.reset({ parameter: '', valueType: '', value: '' });
    this.buffer.set([]);
    this.pendingParameters.set([]);
    this.smsParameterGroups.set([]);
    this.showParameters.set(false);
    this.parameterCount = 0;
    this.mode.set('create');
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getSMSTypes(SMS_SERVICE_ID).subscribe({
      next: (res) => {
        const all = Array.isArray(res?.data) ? (res.data as SmsType[]) : [];
        // One active template per type — hide types that already have one.
        const available = all.filter((t) => !this.activeTypeIds.includes(t.smsTypeID));
        this.smsTypes.set(available);
        if (available.length === 0) {
          this.notify.alert(
            'All SMS types have been used and those templates are active',
            'info',
          );
        }
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load SMS types', 'error'),
    });
  }

  /** Old `extractParameters`: pull `$$TOKEN$$` names from the body, then append SMS_PHONE_NO. */
  protected continueToParameters(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const body = this.form.controls.smsTemplate.value;
    const chunks = body.split(/[!?.,\n ]+/);
    const tokens: string[] = [];
    for (const chunk of chunks) {
      if (chunk.startsWith('$$') && chunk.endsWith('$$') && chunk.length > 4) {
        const name = chunk.slice(2, -2);
        if (!tokens.includes(name)) {
          tokens.push(name);
        }
      }
    }
    // The old app always appends the synthetic SMS_PHONE_NO token.
    tokens.push('SMS_PHONE_NO');
    this.pendingParameters.set(tokens);
    this.parameterCount = tokens.length;
    this.showParameters.set(true);
    this.form.disable(); // lock name/type/body while mapping
    // Load the value lookups once for the mapping selects.
    this.api.getSMSParameters(SMS_SERVICE_ID).subscribe({
      next: (res) =>
        this.smsParameterGroups.set(Array.isArray(res?.data) ? (res.data as SmsParameterGroup[]) : []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load SMS parameters', 'error'),
    });
  }

  protected onValueTypeChange(): void {
    this.mapForm.controls.value.setValue('');
  }

  protected valueOptions(): SmsParameter[] {
    const type = this.mapForm.controls.valueType.value;
    return this.smsParameterGroups().find((g) => g.smsParameterType === type)?.smsParameters ?? [];
  }

  protected addMapping(): void {
    const m = this.mapForm.getRawValue();
    if (!m.parameter || !m.valueType || !m.value) {
      this.notify.alert('Parameter, value type and value should be selected', 'info');
      return;
    }
    const value = this.valueOptions().find((p) => String(p.smsParameterID) === m.value);
    const userName = this.sessionStore.user()?.userName;
    this.buffer.update((rows) => [
      ...rows,
      {
        createdBy: userName,
        modifiedBy: userName,
        smsParameterName: m.parameter, // the token name
        smsParameterType: value?.smsParameterType,
        smsParameterID: value?.smsParameterID,
        smsParameterValue: value?.smsParameterName, // old app: value's label into smsParameterValue
      },
    ]);
    // Remove the just-mapped token from the pending list.
    this.pendingParameters.update((tokens) => tokens.filter((t) => t !== m.parameter));
    this.mapForm.reset({ parameter: '', valueType: '', value: '' });
  }

  protected removeMapping(index: number): void {
    const removed = this.buffer()[index];
    this.buffer.update((rows) => rows.filter((_, i) => i !== index));
    // Return its token to the pending list so it can be re-mapped.
    if (removed?.smsParameterName) {
      this.pendingParameters.update((tokens) => [...tokens, removed.smsParameterName as string]);
    }
  }

  protected canSubmit(): boolean {
    return this.buffer().length === this.parameterCount && this.parameterCount > 0;
  }

  protected submit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null || !this.canSubmit()) {
      return;
    }
    const v = this.form.getRawValue();
    const userName = this.sessionStore.user()?.userName;
    this.saving.set(true);
    this.api
      .saveSMSTemplate({
        createdBy: userName,
        providerServiceMapID: serviceId,
        smsParameterMaps: this.buffer(),
        smsTemplate: v.smsTemplate.trim() || null,
        smsTemplateName: v.templateName.trim() || null,
        smsTypeID: Number(v.smsType),
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.notify.alert('Template saved successfully', 'success');
          this.showTable();
        },
        error: (err: { errorMessage?: string }) => {
          this.saving.set(false);
          this.notify.alert(err?.errorMessage ?? 'Failed to save template', 'error');
        },
      });
  }

  protected cancelCreate(): void {
    this.buffer.set([]);
    this.showParameters.set(false);
    this.form.enable();
    this.mode.set('list');
  }

  // ---- view ----------------------------------------------------------------
  protected view(row: SmsTemplateRow): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getFullSMSTemplate(serviceId, row.smsTemplateID).subscribe({
      next: (res) => {
        const data = res?.data as SmsTemplateRow | undefined;
        this.viewParams.set(data?.smsParameterMaps ?? []);
        this.viewForm.setValue({
          templateName: data?.smsTemplateName ?? '',
          smsType: data?.smsType?.smsType ?? '',
          smsTemplate: data?.smsTemplate ?? '',
        });
        this.mode.set('view');
      },
      // Old app only console-logged this error.
      error: () => {},
    });
  }

  protected showTable(): void {
    this.mode.set('list');
    this.loadTemplates();
  }

  // ---- activate / deactivate ----------------------------------------------
  protected activateDeactivate(row: SmsTemplateRow, deactivate: boolean): void {
    const userName = this.sessionStore.user()?.userName;
    this.api.updateSMSTemplate({ ...row, deleted: deactivate, modifiedBy: userName }).subscribe({
      next: () => {
        this.notify.alert(
          deactivate ? 'Deactivated successfully' : 'Activated successfully',
          'success',
        );
        this.loadTemplates();
      },
      // Old app's activate/deactivate error callback was empty (silent) — kept faithful.
      error: () => {},
    });
  }
}
