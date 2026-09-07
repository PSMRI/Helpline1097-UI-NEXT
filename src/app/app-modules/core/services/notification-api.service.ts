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

/** One per-type unread count from `notification/getAlertsAndNotificationCount`. */
export interface NotificationCount {
  notificationType?: string;
  notificationTypeUnreadCount?: number;
}

/** One agent notification row from `notification/getAlertsAndNotificationDetail`. */
export interface UserNotification {
  userNotificationMapID?: number;
  notificationState?: string;
  notification?: {
    notification?: string;
    notificationDesc?: string;
  };
}

/** A knowledge-management (training) document from `notification/getNotification`. */
export interface KmDocument {
  notificationID?: number;
  notificationTitle?: string;
  fileName?: string;
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

  /** POST notification/getAlertsAndNotificationCount — per-type unread counts for the agent. */
  getAlertsAndNotificationCount(
    userID: number,
    roleID: number,
    providerServiceMapID: number,
  ): Observable<ApiResponse<{ userNotificationTypeList?: NotificationCount[] }>> {
    return this.http.post<ApiResponse<{ userNotificationTypeList?: NotificationCount[] }>>(
      `${this.config.commonBaseURL}notification/getAlertsAndNotificationCount`,
      { userID, roleID, providerServiceMapID },
    );
  }

  /** POST notification/getNotification — knowledge-management (training) docs for a role. */
  getKMs(
    providerServiceMapID: number,
    notificationTypeID: number,
    roleId: number,
    validFrom: Date,
    validTill: Date,
  ): Observable<ApiResponse<KmDocument[]>> {
    return this.http.post<ApiResponse<KmDocument[]>>(
      `${this.config.commonBaseURL}notification/getNotification`,
      { providerServiceMapID, notificationTypeID, roleIDs: [roleId], validFrom, validTill },
    );
  }

  /** POST notification/getAlertsAndNotificationDetail — the agent's rows for one type. */
  getAlertsAndNotificationDetail(
    userID: number,
    roleID: number,
    notificationTypeID: number,
    providerServiceMapID: number,
  ): Observable<ApiResponse<UserNotification[]>> {
    return this.http.post<ApiResponse<UserNotification[]>>(
      `${this.config.commonBaseURL}notification/getAlertsAndNotificationDetail`,
      { userID, roleID, notificationTypeID, providerServiceMapID },
    );
  }

  /** POST notification/changeNotificationStatus — mark rows read/unread.
   * `notficationStatus` (sic) is the backend's field name. */
  changeNotificationStatus(
    status: 'read' | 'unread',
    userNotificationMapIDList: number[],
  ): Observable<ApiResponse<{ status?: string }>> {
    return this.http.post<ApiResponse<{ status?: string }>>(
      `${this.config.commonBaseURL}notification/changeNotificationStatus`,
      { notficationStatus: status, userNotificationMapIDList },
    );
  }

  /** POST notification/markDelete — soft-delete rows for this agent. */
  markDeleteNotification(
    userNotificationMapIDList: number[],
  ): Observable<ApiResponse<{ status?: string }>> {
    return this.http.post<ApiResponse<{ status?: string }>>(
      `${this.config.commonBaseURL}notification/markDelete`,
      { isDeleted: true, userNotificationMapIDList },
    );
  }
}
