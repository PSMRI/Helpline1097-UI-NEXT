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

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { ApiResponse } from '../models';
import { ConfigService } from './config.service';

/** A notification-type record from `notification/getNotificationType`. */
export interface NotificationType {
  notificationType?: string;
  notificationTypeID?: number;
}

/** An emergency-contact record from `notification/getEmergencyContacts`. */
export interface EmergencyContact {
  emergContactName?: string;
  designation?: string;
  location?: string;
  emergContactNo?: string;
}

/**
 * Notification-domain API (types, emergency contacts, alerts). Ported from the old
 * `notificationService`. `providerServiceMapID` is the selected service's id
 * (old `dataService.current_service.serviceID`). More methods (alerts/notifications for the
 * dashboard panels) are added in Phase 4c.
 */
@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(ConfigService);

  /** POST notification/getNotificationType — the notification types for a service. */
  getNotificationTypes(providerServiceMapID: number): Observable<ApiResponse<NotificationType[]>> {
    return this.http.post<ApiResponse<NotificationType[]>>(
      `${this.config.commonBaseURL}notification/getNotificationType`,
      { providerServiceMapID },
    );
  }

  /** POST notification/getEmergencyContacts — contacts for the "Emergency Contact" type. */
  getEmergencyContacts(
    providerServiceMapID: number,
    notificationTypeID: number,
  ): Observable<ApiResponse<EmergencyContact[]>> {
    return this.http.post<ApiResponse<EmergencyContact[]>>(
      `${this.config.commonBaseURL}notification/getEmergencyContacts`,
      { providerServiceMapID, notificationTypeID },
    );
  }
}
