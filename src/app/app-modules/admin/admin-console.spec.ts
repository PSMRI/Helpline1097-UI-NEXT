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
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { AdminApiService } from './admin-api.service';
import { AdminServiceMasterComponent } from './admin-service-master.component';
import { AdminServiceProviderComponent } from './admin-service-provider.component';
import { AdminUserComponent } from './admin-user.component';

/**
 * Contract tests for the super-admin console. The old app posted `FormGroup.value`, so the
 * control DECLARATION ORDER is the JSON key order — these specs pin that order, the hardcoded
 * audit values, and the two payload quirks that a well-meaning refactor would silently "fix".
 */
describe('Admin console payload contracts', () => {
  let api: jasmine.SpyObj<AdminApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<AdminApiService>('AdminApiService', [
      'getProviders',
      'saveProvider',
      'deleteProvider',
      'getUsers',
      'saveUser',
      'getServiceMaster',
      'saveServiceMaster',
    ]);
    api.getProviders.and.returnValue(of([]) as never);
    api.saveProvider.and.returnValue(of({}) as never);
    api.deleteProvider.and.returnValue(of([]) as never);
    api.getUsers.and.returnValue(of([]) as never);
    api.saveUser.and.returnValue(of({}) as never);
    api.getServiceMaster.and.returnValue(of([]) as never);
    api.saveServiceMaster.and.returnValue(of({}) as never);

    await TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: AdminApiService, useValue: api },
      ],
    }).compileComponents();
  });

  describe('Service Provider (tab 1)', () => {
    function mount() {
      const fixture = TestBed.createComponent(AdminServiceProviderComponent);
      fixture.detectChanges();
      return fixture.componentInstance as unknown as {
        submit: () => void;
        editProvider: (row: Record<string, unknown>) => void;
        deleteProvider: (row: Record<string, unknown>) => void;
        form: { patchValue: (v: Record<string, unknown>) => void };
      };
    }
    const sent = () => api.saveProvider.calls.mostRecent().args[0] as unknown as Record<string, unknown>;

    it('posts all 39 keys in the old declaration order', () => {
      mount().submit();
      expect(Object.keys(sent())).toEqual([
        'logoFilePath', 'primaryContactName', 'primaryContactNo', 'emailID', 'address',
        'validity', 'roleName', 'roleDescription', 'services', 'minEducationalQualification',
        'specialization', 'role', 'zoneDistrict', 'zoneName', 'stateParkingPlace',
        'zoneParkingPlace', 'districtParkingPlace', 'parkingPlace', 'stateServicePoint',
        'parkingPlaceServicePoint', 'servicePoint', 'loginID', 'pwd', 'firstName', 'lastName',
        'education', 'employeeID', 'aadharNo', 'gender', 'panNo', 'father', 'mother',
        'emergencyContactPerson', 'emergencyContactNo', 'serviceProviderName', 'createdBy',
        'createdDate', 'stateId', 'joiningDate',
      ]);
    });

    it('ships the old hardcoded audit/tenant values', () => {
      mount().submit();
      const body = sent();
      expect(body['createdBy']).toBe('test');
      expect(body['createdDate']).toBe('2017-01-01');
      expect(body['stateId']).toBe('1');
      expect(body['joiningDate']).toBe('2017-01-01');
    });

    it('leaves the 33 unrendered controls null', () => {
      mount().submit();
      const body = sent();
      expect(body['roleName']).toBeNull();
      expect(body['loginID']).toBeNull();
      expect(body['emergencyContactNo']).toBeNull();
      expect(body['logoFilePath']).toBeNull();
    });

    it('drops emailID/address after Edit, as the old PascalCase-vs-camelCase read did', () => {
      const c = mount();
      // A real `getprovider` row: PascalCase, so the camelCase reads yield undefined.
      c.editProvider({
        ServiceProviderId: 7,
        ServiceProviderName: 'Acme',
        PrimaryContactName: 'Ann',
        PrimaryContactNo: '9000000000',
      });
      c.submit();
      // Old body carried 37 keys: JSON.stringify omits undefined values.
      const serialised = JSON.parse(JSON.stringify(sent()));
      expect('emailID' in serialised).toBeFalse();
      expect('address' in serialised).toBeFalse();
      expect(serialised.serviceProviderName).toBe('Acme');
    });

    it('sends validity as an ISO datetime, not yyyy-MM-dd', () => {
      const c = mount();
      c.form.patchValue({ validity: '2026-08-27' });
      c.submit();
      // The old Material datepicker held a Date, which serialises with a time component.
      expect(sent()['validity']).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('deletes with the id as a STRING and no confirmation', () => {
      mount().deleteProvider({ ServiceProviderId: 42 });
      expect(api.deleteProvider).toHaveBeenCalledWith('42');
    });
  });

  describe('Admin User (tab 2)', () => {
    it('posts all 11 keys in order with the old hardcoded values', () => {
      const fixture = TestBed.createComponent(AdminUserComponent);
      fixture.detectChanges();
      (fixture.componentInstance as unknown as { submit: () => void }).submit();

      const body = api.saveUser.calls.mostRecent().args[0] as unknown as Record<string, unknown>;
      expect(Object.keys(body)).toEqual([
        'firstName', 'middleName', 'lastName', 'titleID', 'userName', 'password', 'statusID',
        'createdBy', 'createdDate', 'modifiedBy', 'lastModDate',
      ]);
      expect(body['titleID']).toBe('1');
      expect(body['statusID']).toBe('1');
      expect(body['createdBy']).toBe('test');
      expect(body['createdDate']).toBe('2017-05-25');
      expect(body['modifiedBy']).toBe('test1');
      expect(body['lastModDate']).toBe('2017-05-26');
    });

    it('does not refresh the list after saving (unlike tab 1)', () => {
      const fixture = TestBed.createComponent(AdminUserComponent);
      fixture.detectChanges();
      api.getUsers.calls.reset();
      (fixture.componentInstance as unknown as { submit: () => void }).submit();
      expect(api.getUsers).not.toHaveBeenCalled();
    });
  });

  describe('Service Master (tab 3)', () => {
    it('posts all 6 keys in order with the old hardcoded values', () => {
      const fixture = TestBed.createComponent(AdminServiceMasterComponent);
      fixture.detectChanges();
      (fixture.componentInstance as unknown as { submit: () => void }).submit();

      const body = api.saveServiceMaster.calls.mostRecent().args[0] as unknown as Record<string, unknown>;
      expect(Object.keys(body)).toEqual([
        'serviceName', 'serviceDesc', 'createdBy', 'createdDate', 'modifiedBy', 'lastModDate',
      ]);
      expect(body['createdBy']).toBe('test');
      expect(body['createdDate']).toBe('2017-05-25');
      expect(body['modifiedBy']).toBe('test1');
      expect(body['lastModDate']).toBe('2017-05-26');
    });
  });
});
