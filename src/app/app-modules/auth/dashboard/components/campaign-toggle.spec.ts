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
import { of, throwError } from 'rxjs';

import { CampaignToggleComponent } from './campaign-toggle.component';
import { CtiService, CzentrixStubService } from '@/app-modules/core/services/cti.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

describe('CampaignToggleComponent radios', () => {
  let fixture: ComponentFixture<CampaignToggleComponent>;
  let cti: CzentrixStubService;
  let notify: jasmine.SpyObj<NotificationService>;

  function host(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function checkedDots(): boolean[] {
    return Array.from(host().querySelectorAll('input[type=radio] + span')).map((dot) =>
      dot.classList.contains('opacity-100'),
    );
  }

  async function clickOutbound(): Promise<void> {
    (host().querySelector('input[value="0"]') as HTMLInputElement).click();
    await fixture.whenStable();
  }

  beforeEach(async () => {
    cti = new CzentrixStubService();
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['alert', 'confirm']);
    notify.confirm.and.returnValue(of(true));
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: CtiService, useValue: cti },
        { provide: NotificationService, useValue: notify },
      ],
    });
    const session = TestBed.inject(SessionStore);
    session.privileges.set([{ roles: [{ RoleID: 1, inbound: true, outbound: true }] }]);
    session.currentRoleId.set(1);
    fixture = TestBed.createComponent(CampaignToggleComponent);
    await fixture.whenStable();
  });

  it('starts on inbound with a single lit dot', () => {
    expect(checkedDots()).toEqual([true, false]);
  });

  it('a successful switch lights only the outbound dot', async () => {
    await clickOutbound();
    expect(checkedDots()).toEqual([false, true]);
    expect(TestBed.inject(CallStore).currentCampaign()).toBe('OUTBOUND');
  });

  it('a failed switch reverts to the inbound dot only', async () => {
    spyOn(cti, 'switchToOutbound').and.returnValue(throwError(() => ({ errorMessage: 'nope' })));
    await clickOutbound();
    expect(checkedDots()).toEqual([true, false]);
    expect(notify.alert).toHaveBeenCalledWith('nope', 'error');
  });
});
