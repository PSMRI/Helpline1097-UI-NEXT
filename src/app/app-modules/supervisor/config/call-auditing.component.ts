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

import { ConfigApiService, tzShift } from './config-api.service';
import { localDate } from '../allocation/allocation-api.service';
import { RestrictInputDirective } from '@/app-modules/core/directives/restrict-input.directive';
import { MOBILE_NUMBER_BLOCK } from '@/app-modules/core/directives/input-patterns';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SessionStore } from '@/app-modules/core/state/session.store';

interface ServiceLine {
  serviceID?: number;
  serviceName?: string;
  isNational?: boolean;
  [key: string]: unknown;
}
interface RoleRow {
  roleID?: number;
  roleName?: string;
  [key: string]: unknown;
}
interface AgentRow {
  agentID?: number | string;
  [key: string]: unknown;
}
interface CallTypeGroup {
  callGroupType?: string;
  callTypes?: { callTypeID?: number; callType?: string }[];
}
interface CallRecord {
  benCallID?: number;
  callID?: number | string;
  agentID?: number | string;
  callTime?: number;
  beneficiaryID?: number;
  name?: string;
  phoneNo?: number;
  remarks?: string;
  callType?: string;
  beneficiaryModel?: Record<string, unknown>;
  [key: string]: unknown;
}
interface CaseSheet {
  informations?: unknown[];
  counsellings?: unknown[];
  referrals?: unknown[];
  feedbacks?: unknown[];
  [key: string]: unknown;
}

/** Case-sheet item shapes (old quality-audit template bindings, backend casing verbatim). */
interface CategoryItem {
  categoryDetails?: { categoryName?: string };
  subCategoryName?: string;
}
interface FeedbackItem {
  states?: { stateName?: string };
  district?: { districtName?: string };
  districtBlock?: { blockName?: string };
  designation?: { designationName?: string };
  FeedbackTypeID?: { feedbackTypeName?: string };
  serviceAvailDate?: string;
  severity?: { severityTypeName?: string };
  feedback?: string;
  feedbackID?: number | string;
}
interface ReferralItem {
  institutionDetails?: {
    states?: { stateName?: string };
    m_district?: { districtName?: string };
    block?: { blockName?: string };
    institutionName?: string;
    address?: string;
  };
  directory?: { instituteDirectoryName?: string };
  subDirectory?: { instituteSubDirectoryName?: string };
}

/** Nested demographics on the worklist row's `beneficiaryModel` (old benData reads). */
interface CaseSheetBenModel {
  firstName?: string;
  lastName?: string;
  actualAge?: number | string;
  ageUnits?: string;
  m_gender?: { genderName?: string };
  beneficiaryID?: number | string;
  i_bendemographics?: {
    districtBranchName?: string;
    blockName?: string;
    districtName?: string;
    stateName?: string;
    pinCode?: string;
  };
}

function inputDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const DAY_MS = 86400000;

/**
 * Call Auditing / Quality Audit (supervisor page 5). READ-ONLY: a filtered search over
 * `call/filterCallList` (server-paged), inline CTI audio playback per row, and a read-only
 * case-sheet summary that prints. The old screen has NO audit scoring or submit despite the
 * name — none is added here.
 */
@Component({
  selector: 'app-call-auditing',
  imports: [ReactiveFormsModule, DatePipe, ZardButtonComponent, ZardInputDirective, RestrictInputDirective, ...ZardSelectImports],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './call-auditing.component.html',
})
export class CallAuditingComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ConfigApiService);
  private readonly notify = inject(NotificationService);
  private readonly sessionStore = inject(SessionStore);

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());
  private serviceProviderID: number | null = null;
  private auditServiceID: number | null = null;
  private readonly audioCache = new Map<string, string>();

  protected readonly serviceLines = signal<ServiceLine[]>([]);
  protected readonly roles = signal<RoleRow[]>([]);
  protected readonly agents = signal<AgentRow[]>([]);
  private allAgents: AgentRow[] = [];
  protected readonly callGroups = signal<CallTypeGroup[]>([]);
  protected readonly callSubTypes = signal<{ callTypeID?: number; callType?: string }[]>([]);

  protected readonly records = signal<CallRecord[]>([]);
  protected readonly pageNo = signal(1);
  protected readonly pageCount = signal(0);
  protected readonly searching = signal(false);
  /** benCallID→callID key of the row whose inline <audio> is open, and its resolved URL. */
  protected readonly audioRowIndex = signal<number | null>(null);
  protected readonly audioUrl = signal<string | null>(null);

  // Case sheet
  protected readonly mobileNumberBlock = MOBILE_NUMBER_BLOCK;
  protected readonly caseSheet = signal<CaseSheet | null>(null);
  protected readonly caseSheetBen = signal<CallRecord | null>(null);

  // Typed views for the case-sheet template (old benData?.beneficiaryModel + service arrays).
  protected readonly benModel = computed(
    () => (this.caseSheetBen()?.beneficiaryModel ?? {}) as CaseSheetBenModel,
  );
  protected readonly infoItems = computed(
    () => (this.caseSheet()?.informations ?? []) as CategoryItem[],
  );
  protected readonly counsellingItems = computed(
    () => (this.caseSheet()?.counsellings ?? []) as CategoryItem[],
  );
  protected readonly feedbackItems = computed(
    () => (this.caseSheet()?.feedbacks ?? []) as FeedbackItem[],
  );
  protected readonly referralItems = computed(
    () => (this.caseSheet()?.referrals ?? []) as ReferralItem[],
  );

  /** Old gate: the Service Requested block (heading included) renders only with data. */
  protected readonly hasServiceItems = computed(
    () =>
      this.infoItems().length > 0 ||
      this.counsellingItems().length > 0 ||
      this.feedbackItems().length > 0 ||
      this.referralItems().length > 0,
  );

  /** Old `current_date` — stamped on the printed sheet (LOCAL time, deliberately). */
  protected readonly caseSheetDate = new Date();

  /** Old address-part ternaries: every missing fragment prints "-". */
  protected dash(value: unknown): string {
    return value ? String(value) : '-';
  }

  protected readonly maxDay = inputDay(new Date());

  protected readonly form = this.fb.group({
    startDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    endDate: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    serviceLine: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    role: this.fb.control<string>('', { nonNullable: true }),
    inboundOutbound: this.fb.control<string>('', { nonNullable: true }),
    agent: this.fb.control<string>('', { nonNullable: true }),
    benPhoneNo: this.fb.control<string>('', { nonNullable: true }),
    callType: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
    // Required, but disabled (⇒ excluded from validation) when Call Type is "All" — faithful.
    callSubType: this.fb.control<string>('', { nonNullable: true, validators: [Validators.required] }),
  });

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    const today = new Date();
    this.form.patchValue({ startDate: inputDay(today), endDate: inputDay(today) });
    // Initial default (unfiltered, today's calls) — Variant A.
    this.searchDefault(1);
    // Old app fired a duplicate default load here; dropped as a redundant no-op (flagged).
    this.initLookups(serviceId);
  }

  /** Sequential lookup chain (each depends on the previous), old app faithful ordering. */
  private initLookups(serviceId: number): void {
    this.api.getServiceProviderID(serviceId).subscribe({
      next: (res) => {
        const data = res?.data as { serviceProviderID?: number } | undefined;
        this.serviceProviderID = data?.serviceProviderID ?? this.serviceProviderID;
        const userId = this.sessionStore.user()?.userID;
        if (userId == null) {
          return;
        }
        this.api.getServiceLines(userId).subscribe({
          next: (linesRes) => {
            const lines = Array.isArray(linesRes?.data) ? (linesRes.data as ServiceLine[]) : [];
            this.serviceLines.set(lines);
            const line = lines.find((l) => l.serviceName === '1097');
            this.auditServiceID = line?.serviceID ?? null;
            if (line) {
              this.form.patchValue({ serviceLine: String(line.serviceID) });
            }
            if (this.serviceProviderID != null && this.auditServiceID != null) {
              this.api
                .getRoles(this.serviceProviderID, this.auditServiceID, line?.isNational ?? false)
                .subscribe({
                  next: (rolesRes) =>
                    this.roles.set(Array.isArray(rolesRes?.data) ? (rolesRes.data as RoleRow[]) : []),
                  error: (err: { errorMessage?: string }) =>
                    this.notify.alert(err?.errorMessage ?? 'Failed to load roles', 'error'),
                });
            }
          },
          error: (err: { errorMessage?: string }) =>
            this.notify.alert(err?.errorMessage ?? 'Failed to load service lines', 'error'),
        });
      },
      error: () => {},
    });
    this.api.getAllAgentIds(serviceId).subscribe({
      next: (res) => {
        this.allAgents = Array.isArray(res?.data) ? (res.data as AgentRow[]) : [];
        this.agents.set(this.allAgents);
      },
      error: () => {},
    });
    this.api.getCallTypes(serviceId).subscribe({
      next: (res) => {
        const all = Array.isArray(res?.data) ? (res.data as CallTypeGroup[]) : [];
        const filtered = all.filter((g) =>
          ['valid', 'invalid'].includes((g.callGroupType ?? '').toLowerCase()),
        );
        // Old app appends a synthetic "All" group.
        filtered.push({ callGroupType: 'All', callTypes: [] });
        this.callGroups.set(filtered);
      },
      error: () => {},
    });
  }

  protected onRoleChange(value: string | string[]): void {
    const serviceId = this.serviceId();
    this.agents.set(this.allAgents);
    this.form.patchValue({ agent: '' });
    // The Role select binds the role NAME (for the receivedRoleName filter), so resolve its
    // numeric roleID for the agent lookup rather than Number(name), which would be NaN → null.
    const roleId = this.roles().find((r) => r.roleName === value)?.roleID;
    if (serviceId == null || roleId == null) {
      return;
    }
    this.api.getAgentByRoleID(serviceId, roleId).subscribe({
      next: (res) => this.agents.set(Array.isArray(res?.data) ? (res.data as AgentRow[]) : []),
      error: () => {},
    });
  }

  protected onCallTypeChange(value: string | string[]): void {
    this.form.patchValue({ callSubType: '' });
    const group = this.callGroups().find((g) => g.callGroupType === value);
    this.callSubTypes.set(group?.callTypes ?? []);
    // "All" has no sub-types — disable so the required sub-type is excluded from validation.
    if (value === 'All') {
      this.form.controls.callSubType.disable();
    } else {
      this.form.controls.callSubType.enable();
    }
  }

  /** Local Date at start/end of a yyyy-MM-dd, then the codebase's fake-UTC shift. */
  private boundary(dateStr: string, edge: 'start' | 'end'): string {
    const d = localDate(dateStr);
    if (edge === 'end') {
      d.setHours(23, 59, 59, 0);
    }
    return tzShift(d);
  }

  // ---- date-range clamp (old setEndDate: max 30-day window, capped at today) ---------------
  protected onStartDateChange(): void {
    this.clampEndDate();
  }
  private clampEndDate(): void {
    const start = this.form.controls.startDate.value;
    const end = this.form.controls.endDate.value;
    if (!start || !end) {
      return;
    }
    const startD = localDate(start);
    const endD = localDate(end);
    if ((endD.getTime() - startD.getTime()) / DAY_MS > 30) {
      const capped = new Date(startD);
      capped.setDate(capped.getDate() + 30);
      this.form.patchValue({ endDate: inputDay(capped) });
    }
  }

  // ---- search / pagination -------------------------------------------------
  /** Variant A — default unfiltered window (init/reset). */
  private searchDefault(page: number): void {
    const serviceId = this.serviceId();
    const v = this.form.getRawValue();
    if (serviceId == null || !v.startDate || !v.endDate) {
      return;
    }
    this.runSearch(
      {
        calledServiceID: serviceId,
        filterStartDate: this.boundary(v.startDate, 'start'),
        filterEndDate: this.boundary(v.endDate, 'end'),
        is1097: true,
        pageNo: page,
      },
      page,
    );
  }

  /** Variant B — full filter body (Search button + pagination). */
  private searchFiltered(page: number): void {
    const serviceId = this.serviceId();
    const v = this.form.getRawValue();
    if (serviceId == null || !v.startDate || !v.endDate) {
      return;
    }
    this.runSearch(
      {
        calledServiceID: serviceId,
        callTypeID: v.callSubType ? Number(v.callSubType) : undefined,
        filterStartDate: this.boundary(v.startDate, 'start'),
        filterEndDate: this.boundary(v.endDate, 'end'),
        receivedRoleName: v.role || null,
        phoneNo: v.benPhoneNo || null,
        // Old md-select bound the numeric agentID; keep it a number, not the option string.
        agentID: v.agent ? Number(v.agent) : null,
        inboundOutbound: v.inboundOutbound || null,
        is1097: true,
        pageNo: page,
      },
      page,
    );
  }

  private runSearch(body: Record<string, unknown>, page: number): void {
    this.searching.set(true);
    this.audioRowIndex.set(null);
    this.audioCache.clear();
    this.api.filterCallList(body).subscribe({
      next: (res) => {
        this.searching.set(false);
        const data = res?.data as { workList?: CallRecord[]; totalPages?: number } | undefined;
        if (!data?.workList || data.workList.length === 0) {
          this.records.set([]);
          this.pageCount.set(0);
          return;
        }
        this.records.set(data.workList);
        this.pageCount.set(data.totalPages ?? 0);
        this.pageNo.set(page);
      },
      error: (err: { status?: number }) => {
        this.searching.set(false);
        this.records.set([]);
        // Old app surfaced err.status here (a quirk) — we show a generic message instead.
        this.notify.alert('Failed to load calls', 'error');
      },
    });
  }

  protected search(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.searchFiltered(1);
  }

  protected prevPage(): void {
    if (this.pageNo() > 1) {
      this.searchFiltered(this.pageNo() - 1);
    }
  }
  protected nextPage(): void {
    if (this.pageNo() < this.pageCount()) {
      this.searchFiltered(this.pageNo() + 1);
    }
  }

  // ---- audio ---------------------------------------------------------------
  protected playAudio(row: CallRecord, index: number): void {
    if (row.agentID == null || row.callID == null) {
      return;
    }
    const key = `${row.callID}|${row.agentID}`;
    const cached = this.audioCache.get(key);
    if (cached !== undefined) {
      this.audioUrl.set(cached);
      this.audioRowIndex.set(index);
      return;
    }
    this.api.getFilePathCTI(row.agentID, row.callID).subscribe({
      next: (res) => {
        const url = (res?.data as { response?: string } | undefined)?.response ?? '';
        this.audioCache.set(key, url);
        this.audioUrl.set(url);
        this.audioRowIndex.set(index);
      },
      error: () => this.notify.alert('Failed to get the voice file path', 'error'),
    });
  }

  // ---- case sheet ----------------------------------------------------------
  protected openCaseSheet(row: CallRecord): void {
    if (row.benCallID == null) {
      return;
    }
    this.caseSheetBen.set(row);
    this.api.getCaseSheet(row.benCallID).subscribe({
      next: (res) => {
        const arr = res?.data as CaseSheet[] | undefined;
        this.caseSheet.set(Array.isArray(arr) && arr.length > 0 ? arr[0] : {});
      },
      // Old set showCaseSheet BEFORE the request, so a failed fetch still showed the
      // beneficiary panel — an empty sheet reproduces that.
      error: () => this.caseSheet.set({}),
    });
  }

  protected closeCaseSheet(): void {
    this.caseSheet.set(null);
    this.caseSheetBen.set(null);
  }

  protected print(): void {
    window.print();
  }
}
