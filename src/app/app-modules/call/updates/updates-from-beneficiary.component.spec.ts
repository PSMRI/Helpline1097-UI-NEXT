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

import { UpdatesFromBeneficiaryComponent } from './updates-from-beneficiary.component';
import { BeneficiaryApiService } from '@/app-modules/core/services/beneficiary-api.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

/**
 * Contract tests for the "Other Details" slide. The old app posted `sourceOfInformation` as a
 * CSV of source NAMES (multi-select, with "Not Disclosed" mutually exclusive) and `isHIVPos`
 * as ""/"yes"/"no" — these assert that byte-level contract, plus the re-entrancy guard on the
 * select (a model-output write-back previously recursed until the stack blew).
 */
describe('UpdatesFromBeneficiaryComponent (source-of-information contract)', () => {
  let fixture: ComponentFixture<UpdatesFromBeneficiaryComponent>;
  let component: UpdatesFromBeneficiaryComponent;
  let callStore: CallStore;
  let updateSpy: jasmine.Spy;

  /** Access protected members without loosening the component's own API. */
  const api = () => component as unknown as {
    form: { patchValue: (v: Record<string, unknown>) => void; controls: Record<string, { value: unknown }> };
    onSourcesChange: (v: string | string[]) => void;
    sourcesSelected: () => string[] | undefined;
    sources: () => { value: string; disabled: boolean }[];
    submit: () => void;
  };

  beforeEach(async () => {
    const beneficiaryApi = jasmine.createSpyObj<BeneficiaryApiService>('BeneficiaryApiService', [
      'getRegistrationData',
      'updateBeneficiary',
    ]);
    beneficiaryApi.getRegistrationData.and.returnValue(
      of({
        data: { beneficiaryOccupations: [], i_BeneficiaryEducation: [], sexualOrientations: [] },
      }) as never,
    );
    beneficiaryApi.updateBeneficiary.and.returnValue(of({ data: 'ok' }) as never);
    updateSpy = beneficiaryApi.updateBeneficiary as jasmine.Spy;

    await TestBed.configureTestingModule({
      imports: [UpdatesFromBeneficiaryComponent],
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: BeneficiaryApiService, useValue: beneficiaryApi },
      ],
    }).compileComponents();

    TestBed.inject(SessionStore).currentServiceId.set(1722);
    callStore = TestBed.inject(CallStore);
    callStore.beneficiary.set({ beneficiaryRegID: 123, i_bendemographics: {} } as never);
    callStore.beneficiaryRegId.set(123);

    fixture = TestBed.createComponent(UpdatesFromBeneficiaryComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  /** The posted beneficiary body from the most recent submit. */
  function postedBody(): Record<string, unknown> {
    return updateSpy.calls.mostRecent().args[0] as Record<string, unknown>;
  }

  it('posts a CSV of source NAMES, not option ids', () => {
    api().onSourcesChange(['Television', 'Radio']);
    api().submit();
    expect(postedBody()['sourceOfInformation']).toBe('Television,Radio');
  });

  it('omits sourceOfInformation when never touched (old sent undefined)', () => {
    api().submit();
    expect(postedBody()['sourceOfInformation']).toBeUndefined();
  });

  it('posts "" when the selection is cleared after interaction (old [].toString())', () => {
    api().onSourcesChange(['Radio']);
    api().onSourcesChange([]);
    api().submit();
    expect(postedBody()['sourceOfInformation']).toBe('');
  });

  it('collapses to "Not Disclosed" and disables the other options', () => {
    api().onSourcesChange(['Radio', 'Not Disclosed']);
    expect(api().sourcesSelected()).toEqual(['Not Disclosed']);
    const others = api().sources().filter((s) => s.value !== 'Not Disclosed');
    expect(others.every((s) => s.disabled)).toBeTrue();
    api().submit();
    expect(postedBody()['sourceOfInformation']).toBe('Not Disclosed');
  });

  it('re-enables the other options once "Not Disclosed" is removed', () => {
    api().onSourcesChange(['Not Disclosed']);
    api().onSourcesChange([]);
    expect(api().sources().every((s) => !s.disabled)).toBeTrue();
  });

  it('does not recurse when "Not Disclosed" is already the only selection', () => {
    // Regression: the handler used to write a fresh array back into its own control, which
    // re-emitted the select's model output and recursed until the call stack overflowed.
    expect(() => {
      api().onSourcesChange(['Not Disclosed']);
      api().onSourcesChange(['Not Disclosed']);
    }).not.toThrow();
    expect(api().sourcesSelected()).toEqual(['Not Disclosed']);
  });

  it('prefills an existing CSV back into the selection without rewriting it', () => {
    callStore.beneficiary.set({
      beneficiaryRegID: 123,
      i_bendemographics: {},
      sourceOfInformation: 'Television,Radio',
    } as never);
    const fresh = TestBed.createComponent(UpdatesFromBeneficiaryComponent);
    fresh.detectChanges();
    const other = fresh.componentInstance as unknown as { sourcesSelected: () => string[] | undefined };
    expect(other.sourcesSelected()).toEqual(['Television', 'Radio']);
  });

  it('posts isHIVPos "" for the not-disclosed option and untouched control', () => {
    api().submit();
    expect(postedBody()['isHIVPos']).toBe('');

    api().form.patchValue({ isHIVPos: 'yes' });
    api().submit();
    expect(postedBody()['isHIVPos']).toBe('yes');
  });
});
