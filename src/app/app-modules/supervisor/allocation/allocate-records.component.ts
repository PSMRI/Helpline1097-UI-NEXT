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
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';

import { ZardButtonComponent } from '@common-ui/ui/button';
import { ZardInputDirective } from '@common-ui/ui/input';
import { ZardSelectImports } from '@common-ui/ui/select';

import { AllocationApiService, AllocationFlavor } from './allocation-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';
import { numOrNull } from '@/app-modules/core/utils/select-value';

/** Context handed down by the allocation/reallocation parents (old `outboundCallRequests`). */
export interface AllocationContext {
  /** Raw picker dates (allocation flavors that fetch a record list). */
  startDate?: Date;
  endDate?: Date;
  /** Boundary strings for the grievance allocate payload. */
  startDateBoundary?: string;
  endDateBoundary?: string;
  language?: string;
  noOfRecords?: number;
  assignedUserID?: number | string;
  isAllocate?: boolean;
}

export interface FilterAgent {
  agentName: string;
  roleID: number | string;
  languageName: string;
  assignedUserID: number | string;
}

interface RoleRow {
  roleID?: number | string;
  roleName?: string;
}

interface AgentRow {
  userID?: number | string;
  firstName?: string;
  lastName?: string;
}

/**
 * Shared allocate-to-agents form (the old app had three near-identical copies:
 * `outbound-allocate-records`, grievance and everwell `*-allocate-records`).
 * Role → agents (multi) → count, then the flavor's allocation endpoint.
 */
@Component({
  selector: 'app-allocate-records',
  imports: [ReactiveFormsModule, ZardButtonComponent, ZardInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form class="flex flex-wrap items-end gap-3 rounded-md border border-border p-3" [formGroup]="form">
      @if (context().language) {
        <div class="flex flex-col gap-1.5 text-sm">
          <span class="text-muted-foreground">Language</span>
          <span class="font-medium">{{ context().language }}</span>
        </div>
      }
      <label class="flex min-w-44 flex-col gap-1.5 text-sm">
        <span>Role <span class="text-destructive">*</span></span>
        <z-select formControlName="roleID" zPlaceholder="Select role" (zValueChange)="onRoleChange()">
          @for (r of roles(); track r.roleID) {
            <z-select-item [zValue]="r.roleID + ''">{{ r.roleName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex min-w-52 flex-col gap-1.5 text-sm">
        <span>Agents <span class="text-destructive">*</span></span>
        <z-select formControlName="agents" [zMultiple]="true" zPlaceholder="Select agents" (zValueChange)="onAgentsChange()">
          @for (a of agents(); track a.userID) {
            <z-select-item [zValue]="a.userID + ''">{{ a.firstName }} {{ a.lastName }}</z-select-item>
          }
        </z-select>
      </label>
      <label class="flex w-36 flex-col gap-1.5 text-sm">
        <span>No. to allocate <span class="text-destructive">*</span></span>
        <input z-input formControlName="allocateNo" type="number" (change)="clampAllocateNo()" />
      </label>
      <button z-button type="button" [zDisabled]="form.invalid" [zLoading]="saving()" (click)="allocate()">
        Allocate
      </button>
      @if (noAgents()) {
        <p class="w-full text-sm text-destructive">No agents available for this language.</p>
      }
    </form>
  `,
})
export class AllocateRecordsComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AllocationApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  readonly flavor = input.required<AllocationFlavor>();
  readonly context = input.required<AllocationContext>();
  readonly filterAgent = input<FilterAgent | null>(null);
  readonly allocated = output<void>();

  protected readonly roles = signal<RoleRow[]>([]);
  protected readonly agents = signal<AgentRow[]>([]);
  protected readonly noAgents = signal(false);
  protected readonly saving = signal(false);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private recordList: unknown[] = [];
  private initialCount = 0;

  protected readonly form = this.fb.group({
    roleID: this.fb.control<string | null>(null, Validators.required),
    agents: this.fb.control<string[]>([], Validators.required),
    allocateNo: this.fb.control<number | null>(null, Validators.required),
  });

  constructor() {
    effect(() => {
      this.context();
      this.onContextChange();
    });
  }

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getRoles(serviceId).subscribe({
      next: (res) => {
        const rows = Array.isArray(res?.data) ? (res.data as RoleRow[]) : [];
        this.roles.set(
          rows.filter(
            (r) =>
              r.roleName?.toLowerCase() !== 'supervisor' &&
              r.roleName?.toLowerCase() !== 'provideradmin',
          ),
        );
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load roles', 'error'),
    });
  }

  private onContextChange(): void {
    const ctx = this.context();
    const serviceId = this.serviceId();
    this.form.reset({ agents: [] });
    this.agents.set([]);
    this.noAgents.set(false);
    this.recordList = [];

    if (this.flavor() === 'grievance') {
      // The old grievance child never fetched a list — count comes with the context.
      this.initialCount = ctx.noOfRecords ?? 0;
      this.form.patchValue({ allocateNo: this.initialCount });
    } else if (serviceId != null) {
      this.fetchRecords(ctx, serviceId);
    }

    const agent = this.filterAgent();
    if (agent) {
      this.form.patchValue({ roleID: String(agent.roleID) });
      this.loadAgents(agent.roleID, agent.languageName);
    }
  }

  private fetchRecords(ctx: AllocationContext, serviceId: number): void {
    const options: Parameters<AllocationApiService['listRecords']>[2] = ctx.assignedUserID
      ? { assignedUserID: ctx.assignedUserID, preferredLanguageName: ctx.language }
      : {
          filterStartDate: this.normalized(ctx.startDate, 'start'),
          filterEndDate: this.normalized(ctx.endDate, 'end'),
          preferredLanguageName: ctx.language,
        };
    this.api.listRecords(this.flavor(), serviceId, options).subscribe({
      next: (res) => {
        this.recordList = Array.isArray(res?.data) ? res.data : [];
        this.initialCount = this.recordList.length;
        this.form.patchValue({ allocateNo: this.initialCount });
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load records', 'error'),
    });
  }

  /** Old child re-normalized the picker date to the day edge before posting (ISO string). */
  private normalized(date: Date | undefined, edge: 'start' | 'end'): string | undefined {
    if (!date) {
      return undefined;
    }
    const d = new Date(date);
    if (edge === 'start') {
      d.setHours(0, 0, 0, 0);
    } else {
      d.setHours(23, 59, 59, 0);
    }
    return d.toJSON();
  }

  protected onRoleChange(): void {
    const roleID = this.form.controls.roleID.value;
    this.form.patchValue({ agents: [], allocateNo: this.initialCount });
    if (roleID) {
      this.loadAgents(roleID, this.context().language);
    }
  }

  private loadAgents(roleID: number | string, languageName?: string): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getAgents(serviceId, numOrNull(String(roleID)) ?? roleID, languageName).subscribe({
      next: (res) => {
        let rows = Array.isArray(res?.data) ? (res.data as AgentRow[]) : [];
        const excluded = this.filterAgent();
        if (excluded) {
          rows = rows.filter((a) => `${a.firstName} ${a.lastName}` !== excluded.agentName);
        }
        this.agents.set(rows);
        this.noAgents.set(rows.length === 0);
      },
      error: (err: { errorMessage?: string }) =>
        this.notify.alert(err?.errorMessage ?? 'Failed to load agents', 'error'),
    });
  }

  /** Old `OnSelectChange` — split the pool evenly across the selected agents. */
  protected onAgentsChange(): void {
    const selected = this.form.controls.agents.value ?? [];
    if (selected.length > 0) {
      const pool = this.flavor() === 'grievance' ? (this.context().noOfRecords ?? 0) : this.recordList.length;
      const share = Math.floor(pool / selected.length);
      this.initialCount = share;
      this.form.patchValue({ allocateNo: share });
    }
  }

  /** Old `validate` — below 1 clears the field, above the pool clamps to it. */
  protected clampAllocateNo(): void {
    const value = this.form.controls.allocateNo.value;
    if (value != null && value < 1) {
      this.form.patchValue({ allocateNo: null });
    } else if (value != null && value > this.initialCount) {
      this.form.patchValue({ allocateNo: this.initialCount });
    }
  }

  protected allocate(): void {
    const v = this.form.getRawValue();
    const ctx = this.context();
    const agentIds = (v.agents ?? []).map((id) => numOrNull(id) ?? id);
    this.saving.set(true);

    const request$ =
      this.flavor() === 'grievance'
        ? this.api.allocateGrievance(
            {
              startDate: ctx.startDateBoundary,
              endDate: ctx.endDateBoundary,
              providerServiceMapId: this.serviceId(),
              language: ctx.language,
              fromUserId: ctx.assignedUserID,
              roleID: numOrNull(v.roleID),
              touserID: agentIds,
              allocateNo: v.allocateNo,
            },
            ctx.isAllocate !== false,
          )
        : this.flavor() === 'everwell'
          ? this.api.allocateEverwell({
              roleID: numOrNull(v.roleID) ?? '',
              agentId: agentIds,
              allocateNo: v.allocateNo ?? 0,
              outboundCallRequests: this.recordList,
            })
          : this.api.allocateGeneric({
              roleID: numOrNull(v.roleID) ?? '',
              userID: agentIds,
              allocateNo: v.allocateNo ?? 0,
              outboundCallRequests: this.recordList,
            });

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.notify.alert('Call allocated successfully', 'success');
        this.form.reset({ agents: [] });
        this.allocated.emit();
      },
      error: (err: { status?: number }) => {
        this.saving.set(false);
        // Old handlers alerted the bare HTTP status (quirk).
        this.notify.alert(String(err?.status ?? 'error'), 'error');
      },
    });
  }
}
