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
  inject,
  OnInit,
  output,
  signal,
} from '@angular/core';

import { ZardTabComponent, ZardTabGroupComponent } from '@common-ui/ui/tabs';

import { TranslatePipe } from '@/app-modules/core/pipes/translate.pipe';

import { CoCategoryServiceComponent } from './co-category-service.component';
import { CoFeedbackComponent } from './co-feedback.component';
import { CoReferralComponent } from './co-referral.component';
import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { CoServicesApiService } from '@/app-modules/core/services/co-services-api.service';
import { RegistrationData, SubServiceType } from '@/app-modules/core/models';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * "Provide Services" slide (old `co-services` tab host). Four tabs — Information /
 * Counselling / Referral / Feedback — each of which persists a service and re-emits
 * `serviceProvided` up so the wizard refreshes the closure call-summary (old
 * `serviceGiven → closure.onView`).
 *
 * The tab group renders all four bodies eagerly, so the master data every tab needs
 * (`service/servicetypes`, the states list from `getRegistrationDataV1`) is fetched ONCE
 * here and passed down — the old app (and our first cut) fired 4 identical requests at
 * mount. Declared fewer-identical-calls deviation; payloads unchanged.
 */
@Component({
  selector: 'app-co-services',
  imports: [
    ZardTabGroupComponent,
    ZardTabComponent,
    CoCategoryServiceComponent,
    CoReferralComponent,
    CoFeedbackComponent,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-tab-group>
      <z-tab [label]="'informationServices' | t">
        <app-co-category-service
          serviceType="information"
          [serviceTypes]="serviceTypes()"
          (serviceProvided)="serviceProvided.emit()"
        />
      </z-tab>
      <z-tab [label]="'counsellingServices' | t">
        <app-co-category-service
          serviceType="counselling"
          [serviceTypes]="serviceTypes()"
          (serviceProvided)="serviceProvided.emit()"
        />
      </z-tab>
      <z-tab [label]="'referralServices' | t">
        <app-co-referral
          [serviceTypes]="serviceTypes()"
          [states]="states()"
          (serviceProvided)="serviceProvided.emit()"
        />
      </z-tab>
      <z-tab [label]="'feedbackSystem' | t">
        <app-co-feedback
          [serviceTypes]="serviceTypes()"
          [states]="states()"
          (serviceProvided)="serviceProvided.emit()"
        />
      </z-tab>
    </z-tab-group>
  `,
})
export class CoServicesComponent implements OnInit {
  private readonly api = inject(CoServicesApiService);
  private readonly beneficiaryApi = inject(BeneficiaryApiService);
  private readonly sessionStore = inject(SessionStore);

  readonly serviceProvided = output<void>();

  private readonly serviceId = computed(() => this.sessionStore.currentServiceId());

  protected readonly serviceTypes = signal<SubServiceType[]>([]);
  protected readonly states = signal<NonNullable<RegistrationData['states']>>([]);

  ngOnInit(): void {
    const serviceId = this.serviceId();
    if (serviceId == null) {
      return;
    }
    this.api.getServiceTypes(serviceId).subscribe({
      next: (res) => this.serviceTypes.set(res?.data ?? []),
      error: () => {
        // Old app only logged this per tab.
      },
    });
    this.beneficiaryApi.getRegistrationData(serviceId).subscribe({
      next: (res) => this.states.set(res?.data?.states ?? []),
      error: () => this.states.set([]),
    });
  }
}
