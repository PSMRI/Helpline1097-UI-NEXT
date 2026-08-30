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
import { of } from 'rxjs';

import { LanguageService } from '../services/language.service';
import { NotificationService } from '../services/notification.service';
import { ENCRYPTED_KEYS, SessionStorageService } from '../services/session-storage.service';
import { LanguageStore } from './language.store';
import { UiStore } from './ui.store';

/**
 * Contract tests for the i18n runtime (old `HttpServices` subject + multi-role-screen
 * handlers): asset path shape, `file[language]` unwrap, `setLanguage` persistence, the two
 * verbatim alert strings (one WITHOUT a space before the name), and `t()`'s empty-string
 * fallback for missing keys.
 */
describe('LanguageStore', () => {
  let store: LanguageStore;
  let httpMock: HttpTestingController;
  let notify: jasmine.SpyObj<NotificationService>;
  let storage: jasmine.SpyObj<SessionStorageService>;
  let languageApi: jasmine.SpyObj<LanguageService>;
  let ui: UiStore;

  const LIST = [{ languageName: 'English' }, { languageName: 'Hindi' }];

  beforeEach(() => {
    notify = jasmine.createSpyObj<NotificationService>('NotificationService', ['alert']);
    storage = jasmine.createSpyObj<SessionStorageService>('SessionStorageService', [
      'getItem',
      'setItem',
    ]);
    languageApi = jasmine.createSpyObj<LanguageService>('LanguageService', ['getLanguageList']);
    languageApi.getLanguageList.and.returnValue(of(LIST) as never);

    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: NotificationService, useValue: notify },
        { provide: SessionStorageService, useValue: storage },
        { provide: LanguageService, useValue: languageApi },
      ],
    });
    store = TestBed.inject(LanguageStore);
    ui = TestBed.inject(UiStore);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('init loads the persisted language from encrypted storage', () => {
    storage.getItem.and.returnValue('Hindi');
    store.init();
    const req = httpMock.expectOne('./assets/Hindi.json');
    req.flush({ Hindi: { welcome: 'स्वागत है' } });
    expect(store.currentLanguageSet()?.['welcome']).toBe('स्वागत है');
    expect(store.languageList().length).toBe(2);
  });

  it('init falls back to the UiStore default (English) when nothing persisted', () => {
    storage.getItem.and.returnValue(null);
    store.init();
    httpMock.expectOne('./assets/English.json').flush({ English: { welcome: 'Welcome' } });
    expect(store.t('welcome')).toBe('Welcome');
  });

  it('changeLanguage unwraps file[language], persists the name, updates appLanguage', () => {
    store.languageList.set(LIST);
    store.changeLanguage('Hindi');
    httpMock.expectOne('./assets/Hindi.json').flush({ Hindi: { sno: 'क्रम सं.' } });
    expect(store.t('sno')).toBe('क्रम सं.');
    expect(storage.setItem).toHaveBeenCalledWith(ENCRYPTED_KEYS.setLanguage, 'Hindi');
    expect(ui.language()).toBe('Hindi');
  });

  it('keeps appLanguage unchanged when the set loads but the name is not in the list (old quirk)', () => {
    ui.setLanguage('English');
    store.languageList.set(LIST);
    store.changeLanguage('Bodo');
    httpMock.expectOne('./assets/Bodo.json').flush({ Bodo: { sno: 'x' } });
    expect(store.t('sno')).toBe('x');
    // Set is truthy but 'Bodo' is not in the backend list → old app skipped the appLanguage
    // update in that branch.
    expect(ui.language()).toBe('English');
  });

  it('missing file alerts the old no-space message and keeps the previous set', () => {
    store.currentLanguageSet.set({ welcome: 'Welcome' });
    store.changeLanguage('Bengali');
    httpMock.expectOne('./assets/Bengali.json').flush('', { status: 404, statusText: 'Not Found' });
    // Verbatim old concat: '...language' + '' + name — no space before the name.
    expect(notify.alert).toHaveBeenCalledWith('We are coming up with this languageBengali', 'info');
    expect(store.t('welcome')).toBe('Welcome');
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('a null file body alerts "Language not defined" as an error', () => {
    store.changeLanguage('Hindi');
    httpMock.expectOne('./assets/Hindi.json').flush(null);
    expect(notify.alert).toHaveBeenCalledWith('Language not defined', 'error');
  });

  it('t() renders missing keys as empty string (old optional-chain semantics)', () => {
    expect(store.t('anything')).toBe('');
    store.currentLanguageSet.set({ known: 'value' });
    expect(store.t('known')).toBe('value');
    expect(store.t('unknown')).toBe('');
  });
});
