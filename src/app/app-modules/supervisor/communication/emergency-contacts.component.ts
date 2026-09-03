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
import { MOBILE_NUMBER_BLOCK, NAME_WITH_SPACE_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { CommunicationApiService, Designation } from './communication-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

/** An emergency-contact row (getSupervisorEmergencyContacts). */
interface ContactRow {
  notificationID: number;
  notificationTypeID: number;
  providerServiceMapID?: number;
  designationID?: number;
  designation?: { designationName?: string };
  designationName?: string;
  emergContactName?: string;
  emergContactNo?: string;
  location?: string;
  deleted?: boolean;
  [key: string]: unknown;
}

/** A staged create row (the exact object posted in the `createEmergencyContacts` array). */
interface BufferRow {
  providerServiceMapID: number;
  notificationTypeID: number | null;
  createdBy?: string;
  designationID?: number;
  emergContactName: string | null;
  location: string | null;
  emergContactNo: string;
  designationName?: string;
}

/**
 * Emergency Contacts (supervisor case 22). Create stages rows into a local buffer (each with a
 * duplicate-mobile guard against both the saved list and the buffer), then posts the whole
 * buffer as an ARRAY to `createEmergencyContacts`. Edit and activate/deactivate post a single
 * OBJECT to `updateEmergencyContacts`.
 */
@Component({
  selector: 'app-emergency-contacts',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, RestrictInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './emergency-contacts.component.html',
})
export class EmergencyContactsComponent implements OnInit {
  protected readonly nameWithSpaceBlock = NAME_WITH_SPACE_BLOCK;
  protected readonly mobileNumberBlock = MOBILE_NUMBER_BLOCK;

  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CommunicationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private notificationTypeID: number | null = null;

  protected readonly mode = signal<'list' | 'create' | 'edit'>('list');
  protected readonly editing = signal<ContactRow | null>(null);
  protected readonly designations = signal<Designation[]>([]);
  protected readonly contacts = signal<ContactRow[]>([]);
  protected readonly buffer = signal<BufferRow[]>([]);
  protected readonly searchTerm = signal('');
  protected readonly saving = signal(false);

  protected readonly filteredContacts = computed(() => {
    const term = this.searchTerm().trim().toLowerCase();
    if (!term) {
      return this.contacts();
    }
    return this.contacts().filter(
      (c) =>
        (c.emergContactName ?? '').toLowerCase().includes(term) ||
        (c.emergContactNo ?? '').toLowerCase().includes(term) ||
        (c.location ?? '').toLowerCase().includes(term),
    );
  });

  protected readonly createForm = this.fb.group({
    name: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(50)],
    }),
    designation: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    location: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(90)],
    }),
    contactNumber: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.pattern(/^[1-9][0-9]*$/), Validators.minLength(10), Validators.maxLength(10)],
    }),
  });

  protected readonly editForm = this.fb.group({
    name: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(50)],
    }),
    designation: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    location: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(3), Validators.maxLength(90)],
    }),
    contactNumber: this.fb.control<string>('', {
      nonNullable: true,
      validators: [Validators.required, Validators.minLength(10), Validators.maxLength(10)],
    }),
  });

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getNotificationTypes(serviceId).subscribe({
      next: (res) => {
        const match = (res?.data ?? []).find((t) => t.notificationType === 'Emergency Contact');
        this.notificationTypeID = match?.notificationTypeID ?? null;
        this.loadContacts();
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load notification type', 'error'),
    });
    this.api.getDesignations().subscribe({
      next: (res) => this.designations.set(Array.isArray(res?.data) ? res.data : []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load designations', 'error'),
    });
  }

  private loadContacts(): void {
    const serviceId = this.serviceId();
    if (serviceId == null || this.notificationTypeID == null) {
      return;
    }
    this.api.getSupervisorEmergencyContacts(serviceId, this.notificationTypeID).subscribe({
      next: (res) => this.contacts.set(Array.isArray(res?.data) ? (res.data as ContactRow[]) : []),
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load contacts', 'error'),
    });
  }

  protected onSearch(event: Event): void {
    this.searchTerm.set((event.target as HTMLInputElement).value);
  }

  // ---- create (buffer) -----------------------------------------------------
  protected startCreate(): void {
    this.editing.set(null);
    this.buffer.set([]);
    this.createForm.reset({ name: '', designation: '', location: '', contactNumber: '' });
    this.mode.set('create');
  }

  /** Stage one row, guarding against a mobile already present in the list or the buffer. */
  protected addToBuffer(): void {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }
    const serviceId = this.serviceId();
    if (serviceId == null || this.notificationTypeID == null) {
      return;
    }
    const v = this.createForm.getRawValue();
    const dupInList = this.contacts().some((c) => c.emergContactNo === v.contactNumber);
    const dupInBuffer = this.buffer().some((b) => b.emergContactNo === v.contactNumber);
    if (dupInList || dupInBuffer) {
      this.notify.alert('This mobile number already exists', 'info');
      return;
    }
    const designation = this.designations().find((d) => String(d.designationID) === v.designation);
    this.buffer.update((rows) => [
      ...rows,
      {
        providerServiceMapID: serviceId,
        notificationTypeID: this.notificationTypeID,
        createdBy: this.sessionStore.user()?.userName,
        designationID: designation?.designationID,
        emergContactName: v.name.trim() || null,
        location: v.location.trim() || null,
        emergContactNo: v.contactNumber, // old app did NOT trim the create mobile
        designationName: designation?.designationName,
      },
    ]);
    this.createForm.reset({ name: '', designation: '', location: '', contactNumber: '' });
  }

  protected removeFromBuffer(index: number): void {
    this.buffer.update((rows) => rows.filter((_, i) => i !== index));
  }

  protected saveBuffer(): void {
    if (this.buffer().length === 0) {
      return;
    }
    this.saving.set(true);
    this.api.createEmergencyContacts(this.buffer()).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert('Emergency contacts saved successfully', 'success');
        this.buffer.set([]);
        this.mode.set('list');
        this.loadContacts();
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to save', 'error');
      },
    });
  }

  // ---- edit ----------------------------------------------------------------
  protected startEdit(row: ContactRow): void {
    this.editing.set(row);
    this.editForm.reset({
      name: row.emergContactName ?? '',
      designation: row.designationID != null ? String(row.designationID) : '',
      location: row.location ?? '',
      contactNumber: row.emergContactNo ?? '',
    });
    this.mode.set('edit');
  }

  protected update(): void {
    const row = this.editing();
    if (!row || this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }
    const v = this.editForm.getRawValue();
    // Old edit mutated only these four fields on the row and re-posted it — name is sent raw
    // (no trim), and no `modifiedBy` is added (unlike the notification-update screens).
    const body: Record<string, unknown> = {
      ...row,
      emergContactName: v.name,
      designationID: Number(v.designation),
      emergContactNo: v.contactNumber.trim() || null,
      location: v.location.trim() || null,
    };
    this.saving.set(true);
    this.api.updateEmergencyContacts(body).subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert('Updated successfully', 'success');
        this.mode.set('list');
        this.loadContacts();
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to update', 'error');
      },
    });
  }

  protected cancelForm(): void {
    this.mode.set('list');
  }

  // ---- activate / deactivate ----------------------------------------------
  protected toggleActive(row: ContactRow): void {
    const next = !row.deleted;
    this.notify
      .confirm(next ? 'Deactivate this contact?' : 'Activate this contact?')
      .subscribe((ok) => {
        if (!ok) {
          return;
        }
        // Old app mutated only `deleted` on the row and re-posted it (no `modifiedBy`).
        this.api
          .updateEmergencyContacts({ ...row, deleted: next })
          .subscribe({
            next: () => {
              this.notify.alert('Updated successfully', 'success');
              this.loadContacts();
            },
            error: (err: { errorMessage?: string }) =>
              this.notify.alert(err?.errorMessage ?? 'Failed to update', 'error'),
          });
      });
  }
}
