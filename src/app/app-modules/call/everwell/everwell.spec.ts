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

import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ZardDialogRef } from '@common-ui/ui/dialog';
import { Z_MODAL_DATA } from '@common-ui/ui/dialog';

import { buildEverwellCompletionEntries, EverwellApiService } from './everwell-api.service';
import { SupportActionData, SupportActionDialogComponent } from './support-action-dialog.component';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CallStore } from '@/app-modules/core/state/call.store';

/**
 * Contract specs for the everwell in-call flow: the saveFeedback payload (key order, the
 * row-sourced createdBy, the efid rules, the ''→null phone), the completion-entry shape,
 * and the not-connected subcategory switch.
 */
describe('Everwell in-call contracts', () => {
  const BEN = {
    Id: 290488,
    eapiId: 7001,
    providerServiceMapId: 1722,
    MissedDoses: 4,
    CurrentMonthMissedDoses: 2,
    AdherencePercentage: 91,
    createdBy: 'worklist-creator',
  };

  let api: jasmine.SpyObj<EverwellApiService>;
  let notify: jasmine.SpyObj<NotificationService>;
  let dialogRef: jasmine.SpyObj<ZardDialogRef>;

  function setup(data?: Partial<SupportActionData>) {
    api = jasmine.createSpyObj<EverwellApiService>('EverwellApiService', ['saveFeedback']);
    api.saveFeedback.and.returnValue(of({ data: { savedData: {} } }) as never);
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['alert']);
    dialogRef = jasmine.createSpyObj<ZardDialogRef>('ZardDialogRef', ['close']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: EverwellApiService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: ZardDialogRef, useValue: dialogRef },
        {
          provide: Z_MODAL_DATA,
          useValue: {
            srcPath: null,
            fileName: null,
            previousDay: '09/01/2026',
            benData: BEN,
            previousFeedback: [],
            onClosed: () => {},
            ...data,
          } satisfies SupportActionData,
        },
      ],
    });
    const fixture = TestBed.createComponent(SupportActionDialogComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('posts the saveFeedback payload with the old key order and row-sourced createdBy', () => {
    const cmp = setup();
    cmp['form'].patchValue({ subCategory: 'Dose not taken', comments: '  counselled  ' });
    cmp['submit']();

    const payload = api.saveFeedback.calls.mostRecent().args[0];
    expect(Object.keys(payload)).toEqual([
      'eapiId',
      'Id',
      'providerServiceMapId',
      'MissedDoses',
      'currentMonthMissedDoses',
      'category',
      'subCategory',
      'AdherencePercentage',
      'actionTaken',
      'comments',
      'dateOfAction',
      'secondaryPhoneNo',
      'createdBy',
    ]);
    expect(payload['category']).toBe('Support_Action_Call');
    expect(payload['actionTaken']).toBe('Call');
    expect(payload['currentMonthMissedDoses']).toBe(2);
    expect(payload['comments']).toBe('counselled');
    expect(payload['dateOfAction']).toBe('2026-09-01');
    expect(payload['secondaryPhoneNo']).toBeNull();
    // Old quirk: createdBy comes from the worklist row, not the logged-in user.
    expect(payload['createdBy']).toBe('worklist-creator');
    expect(notify.alert).toHaveBeenCalledWith('Feedback submitted successfully', 'success');
    expect(TestBed.inject(CallStore).checkEverwellResponse()).toBeTrue();
  });

  it('a prior action on the date switches to edit mode: efid leads the payload, "updated" alert', () => {
    const cmp = setup({
      previousFeedback: [
        {
          efid: 555,
          // Same-parse format: the equality is local-vs-UTC sensitive, exactly like the old app.
          dateOfAction: '09/01/2026',
          category: 'Support_Action_Call',
          subCategory: 'Others',
          actionTaken: 'Call',
          comments: 'earlier',
        },
      ],
    });
    expect(cmp['isEdit']()).toBeTrue();
    cmp['form'].controls.comments.setValue('changed');
    cmp['form'].markAsDirty();
    // updatedFeedbackList holds this date → the update carries the efid.
    TestBed.inject(CallStore).updatedFeedbackList.set(['09/01/2026']);
    cmp['update']();

    const payload = api.saveFeedback.calls.mostRecent().args[0];
    expect(Object.keys(payload)[0]).toBe('efid');
    expect(payload['efid']).toBe(555);
    expect(notify.alert).toHaveBeenCalledWith('Feedback updated successfully', 'success');
  });

  it('update WITHOUT the date in updatedFeedbackList omits efid (old conditional)', () => {
    const cmp = setup({
      previousFeedback: [{ efid: 555, dateOfAction: '09/01/2026', comments: 'earlier' }],
    });
    cmp['form'].controls.comments.setValue('changed');
    cmp['update']();
    const payload = api.saveFeedback.calls.mostRecent().args[0];
    expect('efid' in payload).toBeFalse();
  });

  it('not-connected call switches to the reduced subcategory list', () => {
    api = jasmine.createSpyObj<EverwellApiService>('EverwellApiService', ['saveFeedback']);
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['alert']);
    dialogRef = jasmine.createSpyObj<ZardDialogRef>('ZardDialogRef', ['close']);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        { provide: EverwellApiService, useValue: api },
        { provide: NotificationService, useValue: notify },
        { provide: ZardDialogRef, useValue: dialogRef },
        {
          provide: Z_MODAL_DATA,
          useValue: {
            srcPath: null,
            fileName: null,
            previousDay: '09/01/2026',
            benData: BEN,
            previousFeedback: [],
            onClosed: () => {},
          } satisfies SupportActionData,
        },
      ],
    });
    // Set BEFORE construction — the old dialog read the flag once in ngOnInit.
    TestBed.inject(CallStore).everwellCallNotConnected.set('yes');
    const fixture = TestBed.createComponent(SupportActionDialogComponent);
    fixture.detectChanges();
    expect(fixture.componentInstance['subcategories']).toEqual([
      'Phone not reachable',
      'Phone switched off',
      'Did not receive the call',
      'Others',
    ]);
  });

  it('builds one completion entry per touched member with the old key order', () => {
    const entries = buildEverwellCompletionEntries(
      [
        { eapiId: 7001, beneficiaryRegId: 111 },
        { eapiId: 7002, beneficiaryRegId: 222 },
      ],
      {
        userId: 42,
        callId: 'sess-1',
        callTypeID: '9',
        benCallID: 12345,
        providerServiceMapID: '1722',
        createdBy: 'co-user',
      },
    );
    expect(entries.length).toBe(2);
    expect(Object.keys(entries[0])).toEqual([
      'eapiId',
      'assignedUserID',
      'isCompleted',
      'beneficiaryRegId',
      'callTypeID',
      'benCallID',
      'callId',
      'providerServiceMapId',
      'requestedServiceID',
      'preferredLanguageName',
      'createdBy',
    ]);
    expect(entries[0]['isCompleted']).toBeTrue();
    expect(entries[0]['requestedServiceID']).toBeNull();
    expect(entries[0]['preferredLanguageName']).toBe('All');
    expect(entries[1]['eapiId']).toBe(7002);
  });
});
