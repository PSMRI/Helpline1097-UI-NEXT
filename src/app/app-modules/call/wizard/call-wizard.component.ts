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
  OnInit,
  signal,
} from '@angular/core';

import { Router } from '@angular/router';

import { ZardButtonComponent } from '@common-ui/ui/button';

import { BeneficiaryRegistrationComponent } from '../registration/beneficiary-registration.component';
import { ClosureComponent } from '../closure/closure.component';
import { CoServicesComponent } from '../services-tab/co-services.component';
import { GrievanceResolutionComponent } from '../grievance/grievance-resolution.component';
import { UpdatesFromBeneficiaryComponent } from '../updates/updates-from-beneficiary.component';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import {
  ENCRYPTED_KEYS,
  SessionStorageService,
} from '@/app-modules/core/services/session-storage.service';
import { CallStore } from '@/app-modules/core/state/call.store';

/**
 * CO call wizard — faithful port of the old `1097-co` bs-wizard + jQuery carousel, driven
 * by signals instead of jQuery (same steps, same button state machine). Standard flow:
 * Search Beneficiary → Provide Services → Other Details → Closure. Everwell/grievance
 * calls use a 2-step variant (worklist/complaint → Closure), toggled by the session flags.
 * The step CONTENT (registration/services/updates/closure forms) is Phase 6 — placeholder
 * slides here.
 */
@Component({
  selector: 'app-call-wizard',
  imports: [
    ZardButtonComponent,
    BeneficiaryRegistrationComponent,
    CoServicesComponent,
    UpdatesFromBeneficiaryComponent,
    GrievanceResolutionComponent,
    ClosureComponent,
  ],
  templateUrl: './call-wizard.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CallWizardComponent implements OnInit {
  private readonly notify = inject(NotificationService);
  private readonly storage = inject(SessionStorageService);
  private readonly callStore = inject(CallStore);
  private readonly router = inject(Router);

  /** Which carousel variant is active (old `#myCarousel` / `Everwell` / `Grievance`). */
  protected readonly variant = signal<'standard' | 'everwell' | 'grievance'>('standard');

  protected readonly steps = computed<string[]>(() => {
    switch (this.variant()) {
      case 'everwell':
        return ['Beneficiary Details', 'Closure'];
      case 'grievance':
        return ['Complaint Details', 'Closure'];
      default:
        return ['Search Beneficiary', 'Provide Services', 'Other Details', 'Closure'];
    }
  });

  /** Active slide index (old `jQuery('.carousel-inner div.active').index()`). */
  protected readonly step = signal(0);

  // Old 1097-co button flags, initial values verbatim.
  protected readonly isCancelDisable = signal(true);
  protected readonly isClosureDisable = signal(false);
  protected readonly isPrevious = signal(false);
  protected readonly isNext = signal(false);
  /** Old `disableBack` — Previous stays disabled until a beneficiary is selected (Phase 6). */
  protected readonly disableBack = signal(false);

  private readonly lastStepIndex = computed(() => this.steps().length - 1);

  constructor() {
    // Old ngOnInit subscription to `custDisconnectCall$`: lock nav onto the closure step.
    // The counter re-fires this on every CustDisconnect (old Subject semantics), so a
    // duplicate event re-locks the wizard even after the agent stepped back.
    effect(() => {
      if (this.callStore.custDisconnected() > 0) {
        this.step.set(this.lastStepIndex());
        this.isPrevious.set(true);
        this.disableBack.set(false);
        this.isNext.set(false);
        this.isClosureDisable.set(true);
      }
    });
  }

  ngOnInit(): void {
    // Old app reset the subject on wizard init (`enablePreviousOnCustDisconnect(null)`).
    this.callStore.custDisconnected.set(0);
    if (this.storage.getItem(ENCRYPTED_KEYS.isEverwellCall) === 'yes') {
      this.variant.set('everwell');
    } else if (this.storage.getItem(ENCRYPTED_KEYS.isGrievanceCall) === 'yes') {
      this.variant.set('grievance');
    }
  }

  /**
   * Old `benService('benService')` — the registration form emits this once a beneficiary is
   * picked: advance to Provide Services and enable Next/Cancel. Called by Phase 6's form.
   */
  benService(): void {
    this.step.set(1);
    this.isNext.set(true);
    this.isCancelDisable.set(false);
  }

  /**
   * Old `serviceGiven → closure.onView()` — a service tab persisted something, so the closure
   * call-summary needs refreshing. Wired to the closure slide's summary reload in 6e.
   */
  protected onServiceProvided(): void {
    // The closure slide reloads its own summary on init (only the active slide renders), so
    // no cross-slide refresh is needed here — old `closure.onView()` equivalent.
  }

  /**
   * Old `closeCall(compain_type)` — the closure emitted `callClosed`: clear the call flags
   * and return to the dashboard. Faithful to the old app (which also cleared the same keys).
   */
  protected onCallClosed(): void {
    this.storage.removeItem(ENCRYPTED_KEYS.isOnCall);
    this.storage.removeItem(ENCRYPTED_KEYS.isEverwellCall);
    this.storage.removeItem(ENCRYPTED_KEYS.isGrievanceCall);
    this.callStore.reset();
    this.router.navigate(['/MultiRoleScreenComponent/dashboard']);
  }

  /** Old `closedContinue()` — restart the wizard for a new service on the same call. */
  protected onClosedContinue(): void {
    this.step.set(0);
    this.isCancelDisable.set(true);
    this.isClosureDisable.set(false);
    this.isNext.set(false);
    this.isPrevious.set(false);
  }

  /** Old `nxtVisual()` + bootstrap `data-slide="next"` (index read before the move). */
  protected next(): void {
    const idx = this.step();
    if (idx === 1) {
      this.step.set(2);
      this.isNext.set(true);
      this.isPrevious.set(true);
    } else if (idx === 2) {
      this.step.set(3);
      this.isClosureDisable.set(true);
      this.isNext.set(false);
      this.isPrevious.set(true);
    }
  }

  /** Old `prevVisual()` + `data-slide="prev"`. */
  protected previous(): void {
    const idx = this.step();
    this.isClosureDisable.set(false);
    if (idx === 2) {
      this.step.set(1);
      this.isNext.set(true);
      this.isPrevious.set(false);
    } else if (idx === 3) {
      this.step.set(2);
      this.isNext.set(true);
      this.isPrevious.set(true);
    }
  }

  /** Old `openDialog()` (and its Everwell/grievance twins) — confirm, then reset to step 0. */
  protected cancel(): void {
    this.notify.confirm('Do you want to cancel?', 'Cancel Call').subscribe((confirmed) => {
      if (!confirmed) {
        return;
      }
      this.step.set(0);
      this.isCancelDisable.set(true);
      this.isClosureDisable.set(false);
      this.isNext.set(false);
      this.isPrevious.set(false);
      // TODO(Phase 6): clear the closure form + reload the outbound beneficiary
      // (old `ClearForm.clearFormSender('closure')` + `ReloadBenOutbound('reloadcall')`).
    });
  }

  /** Old `openDialogClosure()` — confirm, then jump to the Closure step. */
  protected closure(): void {
    this.notify
      .confirm('Do you want to close the call?', 'Closure')
      .subscribe((confirmed) => {
        if (!confirmed) {
          return;
        }
        this.step.set(this.lastStepIndex());
        this.isClosureDisable.set(true);
        this.isCancelDisable.set(false);
        this.isNext.set(false);
        this.isPrevious.set(true);
      });
  }
}
