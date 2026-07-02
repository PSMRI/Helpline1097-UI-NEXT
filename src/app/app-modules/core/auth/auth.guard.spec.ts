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
import {
  ActivatedRouteSnapshot,
  provideRouter,
  Router,
  RouterStateSnapshot,
  UrlTree,
} from '@angular/router';
import { TestBed } from '@angular/core/testing';

import { authGuard, onCallGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { NotificationService } from '../services/notification.service';
import { ENCRYPTED_KEYS, SessionStorageService } from '../services/session-storage.service';

class AuthServiceStub {
  loggedIn = false;
  isLoggedIn(): boolean {
    return this.loggedIn;
  }
}
class StorageStub {
  store: Record<string, string> = {};
  getItem(key: string): string | null {
    return this.store[key] ?? null;
  }
}

const route = {} as ActivatedRouteSnapshot;
const state = {} as RouterStateSnapshot;

describe('authGuard', () => {
  let auth: AuthServiceStub;
  let storage: StorageStub;
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    auth = new AuthServiceStub();
    storage = new StorageStub();
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['alert']);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: AuthService, useValue: auth },
        { provide: SessionStorageService, useValue: storage },
        { provide: NotificationService, useValue: notify },
      ],
    });
  });

  const run = () => TestBed.runInInjectionContext(() => authGuard(route, state));

  it('redirects to login (UrlTree "/") when not logged in', () => {
    auth.loggedIn = false;
    const result = run();
    expect(result instanceof UrlTree).toBeTrue();
    expect((result as UrlTree).toString()).toBe('/');
  });

  it('blocks (false) + alerts when logged in but on an active call', () => {
    auth.loggedIn = true;
    storage.store[ENCRYPTED_KEYS.isOnCall] = 'yes';
    expect(run()).toBeFalse();
    expect(notify.alert).toHaveBeenCalled();
  });

  it('allows (true) when logged in and not on a call', () => {
    auth.loggedIn = true;
    expect(run()).toBeTrue();
    expect(notify.alert).not.toHaveBeenCalled();
  });
});

describe('onCallGuard', () => {
  let storage: StorageStub;
  let notify: jasmine.SpyObj<NotificationService>;

  beforeEach(() => {
    storage = new StorageStub();
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['alert']);
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: SessionStorageService, useValue: storage },
        { provide: NotificationService, useValue: notify },
      ],
    });
  });

  const run = () => TestBed.runInInjectionContext(() => onCallGuard(route, state));

  it('allows (true) only during an active call', () => {
    storage.store[ENCRYPTED_KEYS.isOnCall] = 'yes';
    expect(run()).toBeTrue();
  });

  it('blocks (false) + alerts when there is no active call', () => {
    expect(run()).toBeFalse();
    expect(notify.alert).toHaveBeenCalled();
  });
});
