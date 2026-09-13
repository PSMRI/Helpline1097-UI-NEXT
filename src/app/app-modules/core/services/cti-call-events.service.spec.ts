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
import { Router } from '@angular/router';

import { CtiCallEventsService } from './cti-call-events.service';
import { CALL_SCREEN_ROUTE, CallStore } from '../state/call.store';

describe('CtiCallEventsService (release-3.6.3 Accept semantics)', () => {
  let service: CtiCallEventsService;
  let callStore: CallStore;
  let router: jasmine.SpyObj<Router>;

  function dispatch(data: string): void {
    service['onCtiMessage'](new MessageEvent('message', { data }));
  }

  beforeEach(() => {
    router = jasmine.createSpyObj<Router>('Router', ['navigate'], { url: '/MultiRoleScreenComponent/dashboard' });
    TestBed.configureTestingModule({
      providers: [provideZonelessChangeDetection(), { provide: Router, useValue: router }],
    });
    service = TestBed.inject(CtiCallEventsService);
    callStore = TestBed.inject(CallStore);
    callStore.reset();
  });

  it('accepts a normal inbound Accept', () => {
    dispatch('Accept|9999888877|1234567890.0987654321|INBOUND');
    expect(callStore.sessionId()).toBe('1234567890.0987654321');
    expect(router.navigate).toHaveBeenCalledWith([CALL_SCREEN_ROUTE]);
  });

  it('accepts a transfer leg: integer session id + empty phone + no call type → INBOUND', () => {
    dispatch('Accept||12345|');
    expect(callStore.sessionId()).toBe('12345');
    expect(callStore.cli()).toBe('');
    expect(callStore.callCategory()).toBe('INBOUND');
    expect(router.navigate).toHaveBeenCalled();
  });

  it('silently ignores a malformed session id', () => {
    dispatch('Accept|9999888877|abc|INBOUND');
    expect(callStore.sessionId()).toBeNull();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('ignores non-Accept events', () => {
    dispatch('CustDisconnect|9999888877|1234567890.0987654321|INBOUND');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('suppresses the warm-transfer echo (on call screen + on call)', () => {
    (Object.getOwnPropertyDescriptor(router, 'url')?.get as jasmine.Spy)?.and?.returnValue(
      `/MultiRoleScreenComponent/${'RedirectToInnerpageComponent'}`,
    );
    callStore.isOnCall.set(true);
    dispatch('Accept|9999888877|1788944053.8023186099|INBOUND');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('does NOT suppress on the call screen once the session is closed (isOnCall false)', () => {
    (Object.getOwnPropertyDescriptor(router, 'url')?.get as jasmine.Spy)?.and?.returnValue(
      `/MultiRoleScreenComponent/${'RedirectToInnerpageComponent'}`,
    );
    callStore.isOnCall.set(false);
    dispatch('Accept|9999888877|999|INBOUND');
    expect(callStore.sessionId()).toBe('999');
    expect(router.navigate).toHaveBeenCalled();
  });
});
