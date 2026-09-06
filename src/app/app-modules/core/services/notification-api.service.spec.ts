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
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';

import { NotificationApiService } from './notification-api.service';

describe('NotificationApiService alert-detail contracts', () => {
  let service: NotificationApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
    service = TestBed.inject(NotificationApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('getAlertsAndNotificationDetail posts the old 4-key payload', () => {
    service.getAlertsAndNotificationDetail(9, 2, 5, 1722).subscribe();
    const req = httpMock.expectOne((r) =>
      r.url.endsWith('notification/getAlertsAndNotificationDetail'),
    );
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      userID: 9,
      roleID: 2,
      notificationTypeID: 5,
      providerServiceMapID: 1722,
    });
    req.flush({ data: [] });
  });

  it('changeNotificationStatus keeps the backend "notficationStatus" (sic) key', () => {
    service.changeNotificationStatus('read', [11, 12]).subscribe();
    const req = httpMock.expectOne((r) =>
      r.url.endsWith('notification/changeNotificationStatus'),
    );
    expect(req.request.body).toEqual({
      notficationStatus: 'read',
      userNotificationMapIDList: [11, 12],
    });
    req.flush({ data: { status: 'success' } });
  });

  it('markDeleteNotification posts isDeleted true + id list', () => {
    service.markDeleteNotification([7]).subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('notification/markDelete'));
    expect(req.request.body).toEqual({ isDeleted: true, userNotificationMapIDList: [7] });
    req.flush({ data: { status: 'success' } });
  });
});
