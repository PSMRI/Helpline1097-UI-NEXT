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

import { HttpErrorResponse, HttpInterceptorFn, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { EMPTY, of, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { ApiResponse, ApiStatus, SESSION_CONFLICT_CONFIRM_MESSAGES } from '../models';
import { AuthService } from '../auth/auth.service';
import { AuthEventsService } from '../auth/auth-events.service';
import { NotificationService } from '../services/notification.service';

function isEnvelope(body: unknown): body is ApiResponse {
  return (
    !!body && typeof body === 'object' && typeof (body as ApiResponse).statusCode === 'number'
  );
}

/**
 * Ports the session/error logic from the old InterceptedHttp.onSuccess/onError:
 *  - statusCode 200 → pass through
 *  - 5002 → two paths: "already logged in" / "invalid credentials" → confirm dialog →
 *    logout-from-other-device; otherwise redirect + "session expired" + clear token
 *  - 5006 → surface the envelope as an error to the caller
 *  - 401/403 → session expired + clear + redirect to login
 * Non-envelope bodies (e.g. blob downloads) pass through untouched.
 */
export const responseInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  const notify = inject(NotificationService);
  const authEvents = inject(AuthEventsService);

  return next(req).pipe(
    mergeMap((event) => {
      if (event instanceof HttpResponse && isEnvelope(event.body)) {
        const body = event.body;
        switch (body.statusCode) {
          case ApiStatus.OK:
            return of(event);
          case ApiStatus.SESSION_CONFLICT: {
            const message = body.errorMessage ?? '';
            if (SESSION_CONFLICT_CONFIRM_MESSAGES.includes(message)) {
              notify.confirm(message).subscribe((confirmed) => {
                if (confirmed) {
                  authEvents.requestLogoutFromOtherDevice();
                }
              });
            } else {
              router.navigate(['']);
              const data = body.data as { response?: string } | undefined;
              if (!(data && data.response === 'User successfully logged out')) {
                notify.alert('Session expired, please login again', 'error');
              }
              auth.removeToken();
            }
            return EMPTY;
          }
          case ApiStatus.DOMAIN_ERROR:
            return throwError(() => body);
          default:
            return throwError(() => event.body);
        }
      }
      return of(event);
    }),
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && (error.status === 401 || error.status === 403)) {
        notify.alert('Your session has expired. Please login again.', 'error');
        auth.removeToken();
        sessionStorage.clear();
        router.navigate(['']);
      }
      return throwError(() => error);
    }),
  );
};
