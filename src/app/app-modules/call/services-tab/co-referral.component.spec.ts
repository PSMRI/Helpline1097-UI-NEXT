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

import { CoReferralComponent } from './co-referral.component';
import { InstitutionDetails, SendSmsRequest } from '@/app-modules/core/models';
import { CoServicesApiService } from '@/app-modules/core/services/co-services-api.service';
import { LocationApiService } from '@/app-modules/core/services/location-api.service';
import { SmsApiService } from '@/app-modules/core/services/sms-api.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Contract tests for the referral SMS pipeline. The old app posted one `sms/sendSMS` item per
 * ticked institution, taking state/district/block from the INSTITUTION row (not the form), and
 * left `smsTemplateID` as `''` when no active template matched.
 */
describe('CoReferralComponent (referral SMS contract)', () => {
  let fixture: ComponentFixture<CoReferralComponent>;
  let component: CoReferralComponent;
  let smsApi: jasmine.SpyObj<SmsApiService>;

  const institutionA: InstitutionDetails = {
    institutionID: 11,
    institutionName: 'Alpha Clinic',
    address: 'Main Road',
    contactNo1: '9000000001',
    stateID: 21,
    districtID: 321,
    blockID: 4321,
  };
  const institutionB: InstitutionDetails = {
    institutionID: 22,
    institutionName: 'Beta Hospital',
    stateID: 21,
    districtID: 322,
    blockID: 4322,
  };

  /** Access protected members without loosening the component's own API. */
  const api = () =>
    component as unknown as {
      institutions: { set: (v: { institutionDetails: InstitutionDetails }[]) => void };
      selectedRows: { set: (v: number[]) => void };
      institutionLine: (i: InstitutionDetails) => string;
      isSelected: (i: number) => boolean;
      toggleSms: (e: Event, i: number) => void;
    };

  /** Invoke the private send pipeline directly (the dialog is exercised separately). */
  const send = (alternateNo?: string) =>
    (component as unknown as { sendReferralSms: (n?: string) => void }).sendReferralSms(alternateNo);

  function tickEvent(checked: boolean): Event {
    return { target: { checked } } as unknown as Event;
  }

  beforeEach(async () => {
    smsApi = jasmine.createSpyObj<SmsApiService>('SmsApiService', [
      'getSmsTypes',
      'getSmsTemplates',
      'sendSms',
    ]);
    smsApi.getSmsTypes.and.returnValue(
      of({ data: [{ smsTypeID: 7, smsType: 'Referral SMS' }] }) as never,
    );
    smsApi.getSmsTemplates.and.returnValue(
      of({ data: [{ smsTemplateID: 55, deleted: false }] }) as never,
    );
    smsApi.sendSms.and.returnValue(of({ data: 'ok' }) as never);

    const coApi = jasmine.createSpyObj<CoServicesApiService>('CoServicesApiService', [
      'saveReferralMapping',
      'getReferralHistory',
    ]);
    coApi.getReferralHistory.and.returnValue(of({ data: [] }) as never);
    const locationApi = jasmine.createSpyObj<LocationApiService>('LocationApiService', [
      'getDirectories',
      'getDistricts',
      'getTaluks',
      'getSubDirectories',
    ]);
    locationApi.getDirectories.and.returnValue(of({ data: { directory: [] } }) as never);

    await TestBed.configureTestingModule({
      imports: [CoReferralComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: SmsApiService, useValue: smsApi },
        { provide: CoServicesApiService, useValue: coApi },
        { provide: LocationApiService, useValue: locationApi },
      ],
    }).compileComponents();

    const session = TestBed.inject(SessionStore);
    session.currentServiceId.set(1722);
    // `serviceMasterId` (old `current_serviceID`) is walked out of the privilege tree and is a
    // DIFFERENT number space from the providerServiceMapID above.
    session.setUser({
      userID: 3950,
      userName: 'co',
      previlegeObj: [
        {
          roles: [
            {
              serviceRoleScreenMappings: [
                { providerServiceMapping: { m_ServiceMaster: { serviceID: 1 } } },
              ],
            },
          ],
        },
      ],
    } as never);
    TestBed.inject(CallStore).beneficiaryRegId.set(9911);

    fixture = TestBed.createComponent(CoReferralComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();

    api().institutions.set([
      { institutionDetails: institutionA },
      { institutionDetails: institutionB },
    ]);
  });

  function sentRequests(): SendSmsRequest[] {
    return smsApi.sendSms.calls.mostRecent().args[0];
  }

  it('posts one request per ticked institution, with row-sourced location ids', () => {
    api().selectedRows.set([0, 1]);
    send(undefined);

    const requests = sentRequests();
    expect(requests.length).toBe(2);
    expect(requests[0].instituteID).toBe(11);
    expect(requests[0].stateID).toBe(21);
    expect(requests[0].districtID).toBe(321);
    expect(requests[0].blockID).toBe(4321);
    expect(requests[1].instituteID).toBe(22);
    expect(requests[1].districtID).toBe(322);
  });

  it('sends the exact old key set and fixed values', () => {
    api().selectedRows.set([0]);
    send(undefined);

    expect(Object.keys(sentRequests()[0])).toEqual([
      'alternateNo',
      'createdBy',
      'is1097',
      'providerServiceMapID',
      'smsTemplateID',
      'smsTemplateTypeID',
      'instituteID',
      'stateID',
      'districtID',
      'blockID',
      'beneficiaryRegID',
    ]);
    const req = sentRequests()[0];
    expect(req.is1097).toBeTrue();
    expect(req.createdBy).toBe('co');
    expect(req.providerServiceMapID).toBe(1722);
    expect(req.smsTemplateTypeID).toBe(7);
    expect(req.smsTemplateID).toBe(55);
    expect(req.beneficiaryRegID).toBe(9911);
  });

  it('resolves the SMS type with the service-master id, not the providerServiceMapID', () => {
    // UAT proof: `sms/getSMSTypes` returns [] for the providerServiceMapID (1722) and the real
    // types for the service-master id (1), so passing the wrong one silently sends nothing.
    api().selectedRows.set([0]);
    send(undefined);
    expect(smsApi.getSmsTypes).toHaveBeenCalledWith(1);
    // Templates and the payload still key off the providerServiceMapID.
    expect(smsApi.getSmsTemplates).toHaveBeenCalledWith(1722, 7);
  });

  it('omits alternateNo entirely when sending to the primary number', () => {
    api().selectedRows.set([0]);
    send(undefined);
    // Old sent `alternateNo: undefined`, which JSON.stringify drops.
    expect(JSON.parse(JSON.stringify(sentRequests()[0])).alternateNo).toBeUndefined();
  });

  it('sends the alternate number when one was entered', () => {
    api().selectedRows.set([0]);
    send('9876543210');
    expect(sentRequests()[0].alternateNo).toBe('9876543210');
  });

  it('sends smsTemplateID "" when no active template matches (old default)', () => {
    smsApi.getSmsTemplates.and.returnValue(
      of({ data: [{ smsTemplateID: 55, deleted: true }] }) as never,
    );
    api().selectedRows.set([0]);
    send(undefined);
    expect(sentRequests()[0].smsTemplateID).toBe('');
  });

  it('does not send at all when the templates response carries no data', () => {
    smsApi.getSmsTemplates.and.returnValue(of({ data: null }) as never);
    api().selectedRows.set([0]);
    send(undefined);
    expect(smsApi.sendSms).not.toHaveBeenCalled();
  });

  it('does not send when no "Referral SMS" type exists', () => {
    smsApi.getSmsTypes.and.returnValue(
      of({ data: [{ smsTypeID: 1, smsType: 'Registration SMS' }] }) as never,
    );
    api().selectedRows.set([0]);
    send(undefined);
    expect(smsApi.sendSms).not.toHaveBeenCalled();
  });

  it('ticks and unticks per row, keeping duplicate ids independent', () => {
    api().institutions.set([
      { institutionDetails: institutionA },
      { institutionDetails: { ...institutionA } },
    ]);
    api().toggleSms(tickEvent(true), 0);
    expect(api().isSelected(0)).toBeTrue();
    expect(api().isSelected(1)).toBeFalse();

    send(undefined);
    expect(sentRequests().length).toBe(1);
  });

  it('renders the institution line as the old comma-separated list', () => {
    expect(api().institutionLine(institutionA)).toBe('Alpha Clinic, Main Road, 9000000001');
  });
});
