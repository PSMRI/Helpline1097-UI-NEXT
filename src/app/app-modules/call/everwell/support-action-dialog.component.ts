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
import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { Z_MODAL_DATA, ZardDialogRef } from '@common-ui/ui/dialog';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { EverwellApiService, EverwellFamilyRow, EverwellFeedbackRow } from './everwell-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CallStore } from '@/app-modules/core/state/call.store';

/** Handed over by the adherence slide (old `MD_DIALOG_DATA` + the dataService reads). */
export interface SupportActionData {
  srcPath: string | null;
  fileName: string | null;
  /** 'MM/dd/yyyy' of the clicked past day (old `previousDay`). */
  previousDay: string;
  /** The selected family member (old `_common.outboundEverwellData` at dialog time). */
  benData: EverwellFamilyRow;
  /** Prior support actions for the member (old `_common.previousFeedback`). */
  previousFeedback: EverwellFeedbackRow[];
  /** Runs on dialog destroy — the old `afterClosed()` refresh hook. */
  onClosed: () => void;
}

/** Old `category`/`actionTaken` single-option lists. The old submit read `item.category[0]`
 * off the pristine array model, which resolves to this whole string — sent verbatim. */
const CATEGORY = 'Support_Action_Call';
const ACTION_TAKEN = 'Call';

/** Old connected-call subcategory list. */
const SUBCATEGORIES = [
  'Dose not taken',
  'Dose taken but not reported by technology',
  'Wrong Phone number',
  'Do not disturb for today',
  'Patient died',
  'Others',
];
/** Old not-connected list (`everwellCallNotConnected === 'yes'`). */
const SUBCATEGORIES_NOT_CONNECTED = [
  'Phone not reachable',
  'Phone switched off',
  'Did not receive the call',
  'Others',
];

/**
 * Support-action feedback dialog (old `SupportActionModal`, everwell-worklist/support.html).
 * New mode records a dose feedback for the clicked day; edit mode (a prior action exists on
 * that exact date) prefills and updates it behind an "Edit Feedback" unlock toggle. The
 * guideline PDF fetched by the slide is linked at the bottom.
 */
@Component({
  selector: 'app-support-action-dialog',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, ...ZardSelectImports],
  providers: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-3 text-sm">
      <div class="grid gap-2 sm:grid-cols-2" [class.text-muted-foreground]="isEdit() && locked()">
        <span>Missed Doses : {{ benData.MissedDoses }}</span>
        <span>Adherence Percentage : {{ benData.AdherencePercentage }}</span>
        <span>Current month missed doses : {{ benData.CurrentMonthMissedDoses }}</span>
        @if (isEdit()) {
          <label class="flex items-center justify-end gap-2 font-semibold text-primary">
            <input type="checkbox" [checked]="!locked()" (change)="toggleLock()" />
            Edit Feedback
          </label>
        }
      </div>

      <form [formGroup]="form" class="grid gap-3 sm:grid-cols-2">
        <label class="flex flex-col gap-1.5">
          <span>Category <span class="text-destructive">*</span></span>
          <z-select formControlName="category" zPlaceholder="Category" [zDisabled]="isEdit() && locked()">
            <z-select-item [zValue]="CATEGORY">{{ CATEGORY }}</z-select-item>
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5">
          <span>Sub - Category <span class="text-destructive">*</span></span>
          <z-select formControlName="subCategory" zPlaceholder="Sub - Category" [zDisabled]="isEdit() && locked()">
            @for (item of subcategories; track item) {
              <z-select-item [zValue]="item">{{ item }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5">
          <span>Action Taken <span class="text-destructive">*</span></span>
          <z-select formControlName="actionTaken" zPlaceholder="Action Taken" [zDisabled]="isEdit() && locked()">
            <z-select-item [zValue]="ACTION_TAKEN">{{ ACTION_TAKEN }}</z-select-item>
          </z-select>
        </label>
        <label class="flex flex-col gap-1.5">
          <span>Date of Action</span>
          <input z-input formControlName="dob" readonly />
        </label>
        <label class="flex flex-col gap-1.5 sm:col-span-2">
          <span>Comments <span class="text-destructive">*</span></span>
          <textarea z-input rows="2" maxlength="500" formControlName="comments"></textarea>
          @if (form.controls.comments.invalid && form.controls.comments.touched) {
            <span class="text-destructive">Enter minimum 2 characters</span>
          }
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" formControlName="addMblNum" (change)="onAddNumberToggle()" />
          <span>Add Mobile Number</span>
        </label>
        @if (form.controls.addMblNum.value) {
          <label class="flex flex-col gap-1.5">
            <span>Secondary Mobile Number</span>
            <input z-input formControlName="mblNum" type="tel" maxlength="10" inputmode="numeric" />
            @if (form.controls.mblNum.invalid && form.controls.mblNum.touched) {
              <span class="text-destructive">Mobile number should be 10 digits</span>
            }
          </label>
        }
      </form>

      @if (data.fileName != null) {
        <div>
          <strong>Guideline Document :</strong>
          <button type="button" class="ml-1 text-primary underline hover:text-primary/80" (click)="openPdf()">
            {{ data.fileName }}
          </button>
        </div>
      }

      <div class="flex items-center justify-end gap-3">
        @if (!isEdit()) {
          <button z-button type="button" [zDisabled]="form.invalid || busy()" (click)="submit()">
            Submit
          </button>
        } @else {
          <button
            z-button
            type="button"
            [zDisabled]="form.invalid || form.pristine || busy()"
            (click)="update()"
          >
            Update
          </button>
          <button z-button zType="outline" type="button" (click)="close()">Ok</button>
        }
      </div>
    </div>
  `,
})
export class SupportActionDialogComponent implements OnInit, OnDestroy {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(EverwellApiService);
  private readonly notify = inject(NotificationService);
  private readonly callStore = inject(CallStore);
  private readonly dialogRef = inject(ZardDialogRef);
  private readonly datePipe = inject(DatePipe);
  protected readonly data = inject<SupportActionData>(Z_MODAL_DATA);

  protected readonly CATEGORY = CATEGORY;
  protected readonly ACTION_TAKEN = ACTION_TAKEN;
  protected readonly benData = this.data.benData;

  /** Old ngOnInit swap: the not-connected call gets the reduced list. */
  protected readonly subcategories =
    this.callStore.everwellCallNotConnected() === 'yes'
      ? SUBCATEGORIES_NOT_CONNECTED
      : SUBCATEGORIES;

  protected readonly isEdit = signal(false);
  /** Old `enablecontrols` — edit fields stay disabled until the toggle unlocks them. */
  protected readonly locked = signal(true);
  protected readonly busy = signal(false);
  private efid: number | string | null = null;

  protected readonly form = this.fb.group({
    category: this.fb.control<string>(CATEGORY, { nonNullable: true, validators: [Validators.required] }),
    subCategory: this.fb.control<string | null>(null, Validators.required),
    actionTaken: this.fb.control<string>(ACTION_TAKEN, { nonNullable: true, validators: [Validators.required] }),
    dob: this.fb.control<string>('', { nonNullable: true }),
    comments: this.fb.control<string | null>(null, [
      Validators.required,
      Validators.minLength(2),
      Validators.maxLength(500),
    ]),
    addMblNum: this.fb.control<boolean>(false, { nonNullable: true }),
    mblNum: this.fb.control<string | null>(null, [Validators.minLength(10), Validators.maxLength(10)]),
  });

  ngOnInit(): void {
    this.form.controls.dob.setValue(this.data.previousDay);
    // Old prefill scan: a prior action on this exact date switches the dialog to edit mode.
    const target = new Date(this.data.previousDay).getTime();
    for (const entry of this.data.previousFeedback ?? []) {
      if (entry.dateOfAction != null && new Date(entry.dateOfAction).getTime() === target) {
        this.isEdit.set(true);
        this.efid = (entry.efid as number | string | undefined) ?? null;
        const secondary = entry.secondaryPhoneNo;
        this.form.patchValue({
          category: (entry.category as string) ?? CATEGORY,
          subCategory: (entry.subCategory as string) ?? null,
          actionTaken: (entry.actionTaken as string) ?? ACTION_TAKEN,
          comments: (entry.comments as string) ?? null,
          // Old loose `== undefined` check also matched null.
          addMblNum: secondary != null,
          mblNum: secondary == null ? '' : (secondary as string),
        });
        this.form.markAsPristine();
        this.applyLock();
      }
    }
  }

  ngOnDestroy(): void {
    // Old `dialog_Ref.afterClosed()` — the slide refreshes whatever way the dialog closed.
    this.data.onClosed();
  }

  protected toggleLock(): void {
    this.locked.set(!this.locked());
    this.applyLock();
  }

  /** Edit mode: everything except the unlock toggle is disabled while locked. The three
   * z-selects ALSO bind [zDisabled] in the template — the library's setDisabledState is a
   * no-op, so the reactive disable() alone would leave them clickable. */
  private applyLock(): void {
    const controls = this.form.controls;
    for (const c of [controls.category, controls.subCategory, controls.actionTaken, controls.dob, controls.comments, controls.addMblNum, controls.mblNum]) {
      if (this.isEdit() && this.locked()) {
        c.disable();
      } else {
        c.enable();
      }
    }
  }

  protected onAddNumberToggle(): void {
    // Old `(change)="addNumber($event); mblNum=null"` — the number resets on every toggle.
    this.form.controls.mblNum.setValue(null);
  }

  /** Shared payload body — keys in the OLD `providerObj` insertion order. */
  private buildPayload(withEfid: boolean): Record<string, unknown> {
    const v = this.form.getRawValue();
    const payload: Record<string, unknown> = {};
    if (withEfid && this.efid != null) {
      payload['efid'] = this.efid;
    }
    payload['eapiId'] = this.benData.eapiId;
    payload['Id'] = this.benData.Id;
    payload['providerServiceMapId'] = this.benData.providerServiceMapId;
    payload['MissedDoses'] = this.benData.MissedDoses;
    // Old copied `CurrentMonthMissedDoses` onto a lowercase alias before sending.
    payload['currentMonthMissedDoses'] = this.benData.CurrentMonthMissedDoses;
    payload['category'] = v.category;
    payload['subCategory'] = v.subCategory;
    payload['AdherencePercentage'] = this.benData.AdherencePercentage;
    payload['actionTaken'] = v.actionTaken;
    payload['comments'] = v.comments != null ? v.comments.trim() : null;
    payload['dateOfAction'] = this.datePipe.transform(new Date(v.dob), 'yyyy-MM-dd');
    payload['secondaryPhoneNo'] = v.mblNum === '' || v.mblNum == null ? null : v.mblNum;
    // Old quirk: createdBy comes from the worklist ROW, not the logged-in user.
    payload['createdBy'] = this.benData.createdBy;
    return payload;
  }

  private post(payload: Record<string, unknown>, successMessage: string, pushDate: boolean): void {
    this.busy.set(true);
    this.api.saveFeedback(payload).subscribe({
      next: (res) => {
        this.busy.set(false);
        const saved = (res?.data as { savedData?: unknown } | undefined)?.savedData;
        if (saved != null) {
          this.callStore.feedbackData.update((list) => [...list, payload]);
          this.callStore.checkEverwellResponse.set(true);
          if (pushDate && !this.callStore.updatedFeedbackList().includes(this.form.getRawValue().dob)) {
            this.callStore.updatedFeedbackList.update((list) => [...list, this.form.getRawValue().dob]);
          }
          this.notify.alert(successMessage, 'success');
          this.dialogRef.close();
        }
      },
      error: (err: { errorMessage?: string }) => {
        this.busy.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to save feedback', 'error');
      },
    });
  }

  /** Old `submitFeedback` — with a found efid it behaves as an update: 'updated' alert and
   * no date push; without one it submits fresh. */
  protected submit(): void {
    if (this.busy()) {
      return;
    }
    const hasEfid = this.efid != null;
    this.post(
      this.buildPayload(true),
      hasEfid ? 'Feedback updated successfully' : 'Feedback submitted successfully',
      !hasEfid,
    );
  }

  /** Old `updateFeedback` — efid included ONLY when this date was submitted this call. */
  protected update(): void {
    if (this.busy()) {
      return;
    }
    const withEfid = this.callStore.updatedFeedbackList().includes(this.form.getRawValue().dob);
    this.post(this.buildPayload(withEfid), 'Feedback updated successfully', true);
  }

  protected close(): void {
    this.dialogRef.close();
  }

  /** Old `openPDFGuidelines` — base64 → blob → new tab. */
  protected openPdf(): void {
    if (!this.data.srcPath) {
      return;
    }
    const base64 = this.data.srcPath.replace('data:application/pdf;base64,', '');
    const bytes = atob(base64);
    const buffer = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) {
      buffer[i] = bytes.charCodeAt(i);
    }
    window.open(URL.createObjectURL(new Blob([buffer], { type: 'application/pdf' })));
  }
}
