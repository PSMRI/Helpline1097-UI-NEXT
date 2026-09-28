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

import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { BeneficiaryRegistrationComponent } from './beneficiary-registration.component';
import { BeneficiaryRecord } from '@/app-modules/core/models';
import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { CallApiService } from '@/app-modules/core/services/call-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { SmsApiService } from '@/app-modules/core/services/sms-api.service';
import { CallStore } from '@/app-modules/core/state/call.store';

const CLI = '9999888877';
const ON_CLI: BeneficiaryRecord[] = [
  { beneficiaryID: 207853452750, beneficiaryRegID: 1 },
  { beneficiaryID: 975024696324, beneficiaryRegID: 2 },
  { beneficiaryID: 601786460039, beneficiaryRegID: 3 },
];

describe('BeneficiaryRegistrationComponent search-by-id', () => {
  let fixture: ComponentFixture<BeneficiaryRegistrationComponent>;
  let api: jasmine.SpyObj<BeneficiaryApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<BeneficiaryApiService>('BeneficiaryApiService', [
      'searchByPhone',
      'searchByBeneficiaryId',
      'getRegistrationData',
    ]);
    api.searchByPhone.and.returnValue(of({ statusCode: 200, data: ON_CLI }));
    api.searchByBeneficiaryId.and.returnValue(of({ statusCode: 200, data: [ON_CLI[0]] }));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BeneficiaryApiService, useValue: api },
        {
          provide: CallApiService,
          useValue: jasmine.createSpyObj('CallApiService', { startCall: of({ statusCode: 200, data: {} }) }),
        },
        { provide: LocationApiService, useValue: jasmine.createSpyObj('LocationApiService', ['getDistricts']) },
        { provide: SmsApiService, useValue: jasmine.createSpyObj('SmsApiService', ['sendSms']) },
        { provide: NotificationService, useValue: jasmine.createSpyObj('NotificationService', ['alert', 'confirm']) },
      ],
    });
    const callStore = TestBed.inject(CallStore);
    callStore.cli.set(CLI);
    callStore.benCallID.set(777);
    fixture = TestBed.createComponent(BeneficiaryRegistrationComponent);
    await fixture.whenStable();
    api.searchByPhone.calls.reset();
  });

  function setSearchId(value: string): void {
    fixture.componentInstance['searchId'].setValue(value);
  }
  function results(): BeneficiaryRecord[] {
    return fixture.componentInstance['results']();
  }

  it('a complete 12-digit id is looked up on the backend', () => {
    setSearchId('207853452750');
    fixture.componentInstance['search']();
    expect(api.searchByBeneficiaryId).toHaveBeenCalledWith('207853452750');
    expect(api.searchByPhone).not.toHaveBeenCalled();
  });

  it('a partial id filters the calling-number list locally', () => {
    setSearchId('2078');
    fixture.componentInstance['search']();
    expect(api.searchByBeneficiaryId).not.toHaveBeenCalled();
    expect(api.searchByPhone).toHaveBeenCalledWith(CLI);
    expect(results().map((r) => r.beneficiaryID)).toEqual([207853452750]);
  });

  it('an empty id retrieves the whole calling-number list', () => {
    setSearchId('');
    fixture.componentInstance['search']();
    expect(api.searchByPhone).toHaveBeenCalledWith(CLI);
    expect(results().length).toBe(3);
  });

  it('clearing the id goes back to the calling-number list', () => {
    setSearchId('207853452750');
    fixture.componentInstance['search']();
    expect(results().length).toBe(1);
    fixture.componentInstance['clearSearchId']();
    expect(fixture.componentInstance['searchId'].value).toBe('');
    expect(api.searchByPhone).toHaveBeenCalledWith(CLI);
    expect(results().length).toBe(3);
  });
});
