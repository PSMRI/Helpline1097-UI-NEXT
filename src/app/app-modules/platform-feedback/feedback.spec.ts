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
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { FeedbackApiService } from './feedback-api.service';
import { FeedbackDialogComponent } from './feedback-dialog.component';
import { PLAIN_KEYS, SessionStorageService } from '@/app-modules/core/services/session-storage.service';

/** Contract specs for the public platform-feedback dialog (old `FeedbackDialogComponent`). */
describe('Platform-feedback dialog', () => {
  const CATS = [
    { categoryID: '1', slug: 'general-feedback', label: 'General', scope: 'GLOBAL', active: true },
    { categoryID: '2', slug: 'call-quality', label: 'Call quality', scope: '1097', active: false },
  ];

  let api: jasmine.SpyObj<FeedbackApiService>;
  let storage: jasmine.SpyObj<SessionStorageService>;

  function setup(opts?: { userId?: string | null; cats?: unknown[] }) {
    api = jasmine.createSpyObj<FeedbackApiService>('FeedbackApiService', [
      'listCategories',
      'submitFeedback',
    ]);
    api.listCategories.and.returnValue(of(opts?.cats ?? CATS) as never);
    api.submitFeedback.and.returnValue(of({ id: 'fb-1' }) as never);
    storage = jasmine.createSpyObj<SessionStorageService>('SessionStorageService', [
      'getItem',
      'setItem',
      'removeItem',
    ]);
    storage.getItem.and.callFake((key: string) =>
      key === PLAIN_KEYS.userId ? (opts?.userId ?? null) : null,
    );
    TestBed.configureTestingModule({
      providers: [
        provideZonelessChangeDetection(),
        provideRouter([]),
        { provide: FeedbackApiService, useValue: api },
        { provide: SessionStorageService, useValue: storage },
      ],
    });
    const fixture = TestBed.createComponent(FeedbackDialogComponent);
    fixture.componentRef.setInput('serviceLine', '1097');
    fixture.componentRef.setInput('defaultCategorySlug', 'general-feedback');
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  it('keeps inactive categories (old `active || true` filter) and defaults to the first slug', () => {
    const cmp = setup();
    expect(cmp['categories']().length).toBe(2);
    expect(cmp['form'].controls.categorySlug.value).toBe('general-feedback');
  });

  it('anonymous submission carries NO userId and posts the old field set', () => {
    const cmp = setup({ userId: '3950' });
    cmp['setRating'](4);
    cmp['form'].controls.comment.setValue('smooth experience');
    cmp['submit']();
    const payload = api.submitFeedback.calls.mostRecent().args[0];
    expect(payload).toEqual({
      rating: 4,
      categorySlug: 'general-feedback',
      comment: 'smooth experience',
      isAnonymous: true,
      serviceLine: '1097',
    });
  });

  it('identified submission (box unchecked + stored userID) parses the id to a number', () => {
    const cmp = setup({ userId: '3950' });
    expect(cmp['isLoggedIn']).toBeTrue();
    cmp['setRating'](5);
    cmp['form'].controls.isAnonymous.setValue(false);
    cmp['submit']();
    const payload = api.submitFeedback.calls.mostRecent().args[0];
    expect(payload.isAnonymous).toBeFalse();
    expect(payload.userId).toBe(3950);
    // empty comment → undefined (old `comment || undefined`), dropped from the JSON
    expect('comment' in payload && payload.comment !== undefined).toBeFalse();
  });

  it('without a stored userID the page is anonymous-only and userId never attaches', () => {
    const cmp = setup({ userId: null });
    expect(cmp['isLoggedIn']).toBeFalse();
    cmp['setRating'](3);
    cmp['form'].controls.isAnonymous.setValue(false); // even unchecked
    cmp['submit']();
    expect('userId' in api.submitFeedback.calls.mostRecent().args[0]).toBeFalse();
  });

  it('rating 0 blocks submit with the old inline error', () => {
    const cmp = setup();
    cmp['submit']();
    expect(api.submitFeedback).not.toHaveBeenCalled();
    expect(cmp['error']()).toBe('Pick a rating and a category.');
  });

  it('empty category list hides the dropdown and submit stays blocked (old throw semantics)', () => {
    const cmp = setup({ cats: [] });
    expect(cmp['showCategory']()).toBeFalse();
    cmp['setRating'](4);
    expect(cmp['form'].invalid).toBeTrue();
  });

  it('429 shows the rate-limit text; a body error field shows verbatim', () => {
    const cmp = setup();
    cmp['setRating'](2);
    api.submitFeedback.and.returnValue(throwError(() => ({ status: 429 })) as never);
    cmp['submit']();
    expect(cmp['error']()).toBe('Too many attempts. Try later.');
    api.submitFeedback.and.returnValue(
      throwError(() => ({ status: 400, error: { error: 'Bad category' } })) as never,
    );
    cmp['submit']();
    expect(cmp['error']()).toBe('Bad category');
  });

  it('success shows the thank-you line and resets to rating 0 / first category / anonymous', () => {
    const cmp = setup({ userId: '3950' });
    cmp['setRating'](5);
    cmp['form'].controls.isAnonymous.setValue(false);
    cmp['submit']();
    expect(cmp['successId']()).toBe('fb-1');
    const v = cmp['form'].getRawValue();
    expect(v.rating).toBe(0);
    expect(v.categorySlug).toBe('general-feedback');
    expect(v.isAnonymous).toBeTrue();
  });
});
