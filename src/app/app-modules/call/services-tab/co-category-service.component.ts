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
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideDownload } from '@ng-icons/lucide';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardSelectImports } from '@common-ui/ui/select';

import { CoServicesApiService } from '@/app-modules/core/services/co-services-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CoCategory, CoSubCategory, SubServiceType } from '@/app-modules/core/models';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Shared Information / Counselling service tab (old `co-information-services` +
 * `co-counselling-services`, which were near-clones). Parameterized by `serviceType`:
 * both pick their sub-service by name match (INFO / COUN), then Category → Sub-Category →
 * "Get Details", which SAVES the mapping AND returns the guidance documents (old "Get Details"
 * was the save; there is no separate save button). Each returned `subCatFilePath` is shown as a
 * link (bound raw — broken where the backend leaves `${KM_*}` unresolved, e.g. UAT; opens the
 * real document in prod). Counselling's save uses the `coCategoryID`/`coSubCategoryID` keys and
 * a different endpoint — handled by the API service.
 */
@Component({
  selector: 'app-co-category-service',
  imports: [ReactiveFormsModule, ZardButtonComponent, NgIcon, ...ZardSelectImports],
  viewProviders: [provideIcons({ lucideDownload })],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col gap-4">
      <form [formGroup]="form" class="flex flex-wrap items-end gap-3">
        <label class="flex min-w-48 flex-col gap-1.5 text-sm">
          <span>Category <span class="text-destructive">*</span></span>
          <z-select formControlName="categoryId" zPlaceholder="Select category" (zValueChange)="onCategoryChange($event)">
            @for (c of categories(); track c.categoryID) {
              <z-select-item [zValue]="c.categoryID + ''">{{ c.categoryName }}</z-select-item>
            }
          </z-select>
        </label>
        <label class="flex min-w-48 flex-col gap-1.5 text-sm">
          <span>Sub-Category <span class="text-destructive">*</span></span>
          <z-select formControlName="subCategoryId" zPlaceholder="Select sub-category">
            @for (s of subCategories(); track s.subCategoryID) {
              <z-select-item [zValue]="s.subCategoryID + ''">{{ s.subCategoryName }}</z-select-item>
            }
          </z-select>
        </label>
        <button
          z-button
          type="button"
          [zDisabled]="form.invalid"
          [zLoading]="saving()"
          (click)="provideService()"
        >
          Get Details
        </button>
      </form>

      @if (savedFiles().length) {
        <div class="rounded-md border border-border p-3 text-sm">
          <p class="mb-1 font-medium">Details</p>
          <ul class="flex flex-col gap-1">
            @for (f of savedFiles(); track f.subCategoryName) {
              <li>
                <!-- Old app: the returned document opens in a new tab; no path → not available.
                     The KM path is bound raw (broken where KM_* is unresolved, e.g. UAT). -->
                @if (f.subCatFilePath) {
                  <a
                    [href]="f.subCatFilePath"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <ng-icon name="lucideDownload" class="text-base" />
                    <span>{{ f.subCategoryName }}@if (f.subCategoryDesc) {: {{ f.subCategoryDesc }}}</span>
                  </a>
                } @else {
                  <span class="text-muted-foreground">{{ f.subCategoryName }} — No document available</span>
                }
              </li>
            }
          </ul>
        </div>
      }

      <div class="overflow-x-auto rounded-md border border-border">
        <table class="w-full text-sm">
          <thead class="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th class="px-3 py-2">Category</th>
              <th class="px-3 py-2">Sub-Category</th>
              <th class="px-3 py-2">By</th>
              <th class="px-3 py-2">Date</th>
            </tr>
          </thead>
          <tbody>
            @for (h of history(); track $index) {
              <tr class="border-t border-border">
                <td class="px-3 py-2">{{ h.categoryDetails?.categoryName }}</td>
                <td class="px-3 py-2">{{ h.subCategoryDetails?.subCategoryName }}</td>
                <td class="px-3 py-2">{{ h.createdBy }}</td>
                <td class="px-3 py-2">{{ h.createdDate }}</td>
              </tr>
            } @empty {
              <tr>
                <td colspan="4" class="px-3 py-4 text-center text-muted-foreground">
                  No {{ serviceType() }} services recorded yet.
                </td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
})
export class CoCategoryServiceComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(CoServicesApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);
  private readonly callStore = inject(CallStore);

  /** 'information' → INFO + saveInformationMapping; 'counselling' → COUN + saveCounsellingMapping. */
  readonly serviceType = input.required<'information' | 'counselling'>();
  /** Sub-service master, fetched ONCE by the co-services host (all four tabs share it). */
  readonly serviceTypes = input<SubServiceType[]>([]);
  readonly serviceProvided = output<void>();

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private readonly subServiceId = computed(() => {
    const token = this.serviceType() === 'information' ? 'INFO' : 'COUN';
    return (
      this.serviceTypes().find((t) => t.subServiceName?.toUpperCase().includes(token))
        ?.subServiceID ?? null
    );
  });
  private categoriesLoaded = false;

  protected readonly categories = signal<CoCategory[]>([]);
  protected readonly subCategories = signal<CoSubCategory[]>([]);
  protected readonly savedFiles = signal<CoSubCategory[]>([]);
  protected readonly history = signal<
    { categoryDetails?: CoCategory; subCategoryDetails?: CoSubCategory; createdBy?: string; createdDate?: string }[]
  >([]);
  protected readonly saving = signal(false);

  protected readonly form = this.fb.group({
    categoryId: this.fb.control<string | null>(null),
    subCategoryId: this.fb.control<string | null>(null),
  });

  constructor() {
    // The host's servicetypes fetch resolves after this tab mounts — load the category
    // master once the matching sub-service id lands.
    effect(() => {
      const subServiceID = this.subServiceId();
      if (subServiceID != null && !this.categoriesLoaded) {
        this.categoriesLoaded = true;
        this.loadCategories(subServiceID);
      }
    });
  }

  ngOnInit(): void {
    this.loadHistory();
  }

  private loadCategories(subServiceID: number): void {
    this.api.getCategories(subServiceID).subscribe({
      next: (res) => this.categories.set(res?.data ?? []),
      error: () => this.categories.set([]),
    });
  }

  // Takes the emitted value: z-select fires zValueChange BEFORE its CVA writes the form
  // control, so reading the control here would see the previous selection.
  protected onCategoryChange(value: string | string[]): void {
    this.subCategories.set([]);
    this.form.patchValue({ subCategoryId: null });
    const categoryId = value as string;
    if (!categoryId) {
      return;
    }
    this.api.getSubCategories(categoryId).subscribe({
      next: (res) => this.subCategories.set(res?.data ?? []),
      error: () => this.subCategories.set([]),
    });
  }

  /** Old "Get Details": a SAVE (persist the mapping), then render files + refresh history. */
  protected provideService(): void {
    const categoryId = this.form.controls.categoryId.value;
    const subCategoryId = this.form.controls.subCategoryId.value;
    if (!categoryId || !subCategoryId) {
      return;
    }
    const beneficiaryRegID = this.beneficiaryRegID();
    const benCallID = this.callStore.benCallID();
    const createdBy = this.sessionStore.user()?.userName;
    const subServiceID = this.subServiceId();

    this.saving.set(true);
    const request$ =
      this.serviceType() === 'information'
        ? this.api.saveInformationMapping({
            beneficiaryRegID,
            benCallID,
            subServiceID,
            categoryID: categoryId,
            subCategoryID: subCategoryId,
            createdBy,
          })
        : this.api.saveCounsellingMapping({
            beneficiaryRegID,
            benCallID,
            subServiceID,
            coCategoryID: categoryId,
            coSubCategoryID: subCategoryId,
            createdBy,
          });

    request$.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.savedFiles.set(res?.data ?? []);
        this.notify.alert('Service recorded', 'success');
        this.serviceProvided.emit();
        this.loadHistory();
      },
      error: (err: { errorMessage?: string }) => {
        this.saving.set(false);
        this.notify.alert(err?.errorMessage ?? 'Failed to save service', 'error');
      },
    });
  }

  private loadHistory(): void {
    const beneficiaryRegID = this.beneficiaryRegID();
    // Old history fetches posted current_service.providerServiceMapID (not .serviceID) as
    // calledServiceID — equal on UAT (both 1722), kept to the old field source.
    const serviceId = this.sessionStore.currentProviderServiceMapId();
    if (beneficiaryRegID == null || serviceId == null) {
      return;
    }
    const source =
      this.serviceType() === 'information'
        ? this.api.getInformationHistory(beneficiaryRegID, serviceId)
        : this.api.getCounsellingHistory(beneficiaryRegID, serviceId);
    source.subscribe({
      next: (res) => this.history.set(Array.isArray(res?.data) ? res.data : []),
      error: () => this.history.set([]),
    });
  }

  private beneficiaryRegID(): number | string | null {
    return this.callStore.beneficiaryRegId();
  }
}
