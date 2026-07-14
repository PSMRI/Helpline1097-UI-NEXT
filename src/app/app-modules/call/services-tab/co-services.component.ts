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

import { ChangeDetectionStrategy, Component, output } from '@angular/core';

import { ZardTabComponent, ZardTabGroupComponent } from '@common-ui/ui/tabs';

import { CoCategoryServiceComponent } from './co-category-service.component';
import { CoFeedbackComponent } from './co-feedback.component';
import { CoReferralComponent } from './co-referral.component';

/**
 * "Provide Services" slide (old `co-services` tab host). Four tabs — Information /
 * Counselling / Referral / Feedback — each of which persists a service and re-emits
 * `serviceProvided` up so the wizard refreshes the closure call-summary (old
 * `serviceGiven → closure.onView`).
 */
@Component({
  selector: 'app-co-services',
  imports: [
    ZardTabGroupComponent,
    ZardTabComponent,
    CoCategoryServiceComponent,
    CoReferralComponent,
    CoFeedbackComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <z-tab-group>
      <z-tab label="Information">
        <app-co-category-service serviceType="information" (serviceProvided)="serviceProvided.emit()" />
      </z-tab>
      <z-tab label="Counselling">
        <app-co-category-service serviceType="counselling" (serviceProvided)="serviceProvided.emit()" />
      </z-tab>
      <z-tab label="Referral">
        <app-co-referral (serviceProvided)="serviceProvided.emit()" />
      </z-tab>
      <z-tab label="Feedback">
        <app-co-feedback (serviceProvided)="serviceProvided.emit()" />
      </z-tab>
    </z-tab-group>
  `,
})
export class CoServicesComponent {
  readonly serviceProvided = output<void>();
}
