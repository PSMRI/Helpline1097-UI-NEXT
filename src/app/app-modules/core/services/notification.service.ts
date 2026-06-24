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

import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { toast } from 'ngx-sonner';
import { ZardDialogService } from '@common-ui/ui/dialog';

export type AlertType = 'info' | 'success' | 'error' | 'warning';

/**
 * Replaces the old `ConfirmationDialogsService` / `message.service`.
 * `alert()` → ngx-sonner toast (requires <z-toaster> in the app shell).
 * `confirm()` → Zard dialog, returning Observable<boolean> to match the old API used by
 * the interceptor's 5002 "logout from other device" flow.
 */
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly dialog = inject(ZardDialogService);

  alert(message: string, type: AlertType = 'info'): void {
    switch (type) {
      case 'error':
        toast.error(message);
        break;
      case 'success':
        toast.success(message);
        break;
      case 'warning':
        toast.warning(message);
        break;
      default:
        toast(message);
    }
  }

  confirm(message: string, title = 'Confirm'): Observable<boolean> {
    return new Observable<boolean>((observer) => {
      this.dialog.create<unknown, unknown>({
        zTitle: title,
        zContent: message,
        zOkText: 'Yes',
        zCancelText: 'No',
        zMaskClosable: false,
        zOnOk: () => {
          observer.next(true);
          observer.complete();
        },
        zOnCancel: () => {
          observer.next(false);
          observer.complete();
        },
      });
    });
  }
}
