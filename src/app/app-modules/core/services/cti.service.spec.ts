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
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { CzentrixHttpService } from './cti.service';
import { SKIP_LOADER } from '../http/http-context';

describe('CzentrixHttpService loader mapping', () => {
  let service: CzentrixHttpService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        CzentrixHttpService,
      ],
    });
    service = TestBed.inject(CzentrixHttpService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  function skipsLoader(url: string): boolean {
    const req = http.expectOne((r) => r.url.endsWith(url));
    const skipped = req.request.context.get(SKIP_LOADER);
    req.flush({ statusCode: 200, data: {} });
    return skipped;
  }

  it('polled status/stats/IP/language calls do not raise the global loader', () => {
    service.getAgentStatus().subscribe();
    expect(skipsLoader('cti/getAgentState')).toBeTrue();
    service.getIvrsPathDetails().subscribe();
    expect(skipsLoader('cti/getIVRSPathDetails')).toBeTrue();
    service.getCallDetails().subscribe();
    expect(skipsLoader('cti/getAgentCallStats')).toBeTrue();
    service.getIpAddress().subscribe();
    expect(skipsLoader('cti/getAgentIPAddress')).toBeTrue();
    service.setCustomerPreferredLanguage({}).subscribe();
    expect(skipsLoader('cti/customerPreferredLanguage')).toBeTrue();
  });

  it('user-initiated dial and agent logout still raise the global loader', () => {
    service.dialBeneficiary('9999888877').subscribe();
    expect(skipsLoader('cti/callBeneficiary')).toBeFalse();
    service.agentLogout().subscribe();
    expect(skipsLoader('cti/doAgentLogout')).toBeFalse();
  });
});
