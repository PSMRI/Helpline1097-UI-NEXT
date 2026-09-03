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
import { of } from 'rxjs';

import { Z_MODAL_DATA, ZardDialogRef } from '@common-ui/ui/dialog';

import { BeneficiaryHistoryDialogComponent } from './beneficiary-history-dialog.component';
import { TrainingDocsDialogComponent } from '@/app-modules/auth/dashboard/components/training-docs-dialog.component';
import {
  MOBILE_NUMBER_BLOCK,
  NAME_BLOCK,
  TEXTAREA_BLOCK,
} from '@/app-modules/core/directives/input-patterns';
import { CoServicesApiService } from '@/app-modules/core/services/co-services-api.service';
import { NotificationService } from '@/app-modules/core/services/notification.service';
import { CallStore } from '@/app-modules/core/state/call.store';
import { SessionStore } from '@/app-modules/core/state/session.store';

describe('Phase 13 contracts', () => {
  describe('Beneficiary call-history dialog', () => {
    it('posts {beneficiaryRegID, calledServiceID} and strips the current call loosely', () => {
      const api = jasmine.createSpyObj<CoServicesApiService>('CoServicesApiService', [
        'getBeneficiaryCallsHistory',
      ]);
      api.getBeneficiaryCallsHistory.and.returnValue(
        of({
          data: [
            { benCallID: '777', remarks: 'current call (string vs number)' },
            { benCallID: 555, remarks: 'older' },
          ],
        }) as never,
      );
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: CoServicesApiService, useValue: api },
          {
            provide: NotificationService,
            useValue: jasmine.createSpyObj('NotificationService', ['alert']),
          },
          { provide: ZardDialogRef, useValue: { close: () => {} } },
          {
            provide: Z_MODAL_DATA,
            useValue: { beneficiaryRegID: 901, onClosed: () => {} },
          },
        ],
      });
      TestBed.inject(SessionStore).currentProviderServiceMapId.set(1722);
      TestBed.inject(CallStore).benCallID.set(777);
      const fixture = TestBed.createComponent(BeneficiaryHistoryDialogComponent);
      fixture.detectChanges();
      expect(api.getBeneficiaryCallsHistory).toHaveBeenCalledWith(901, 1722);
      // '777' (string) == 777 (number) → stripped; only the older row stays.
      const rows = fixture.componentInstance['rows']();
      expect(rows.length).toBe(1);
      expect(rows[0].benCallID).toBe(555);
    });
  });

  describe('Training-docs URL extraction (old checkForURL)', () => {
    function docsFor(desc: string): string[] {
      TestBed.configureTestingModule({
        providers: [
          provideZonelessChangeDetection(),
          { provide: Z_MODAL_DATA, useValue: { kmdocs: [{ notificationDesc: desc }] } },
        ],
      });
      const fixture = TestBed.createComponent(TrainingDocsDialogComponent);
      fixture.detectChanges();
      return fixture.componentInstance['docs']()[0].urls;
    }

    it('extracts whitelisted-TLD tokens and force-prepends https on bare www', () => {
      expect(docsFor('see www.example.com and https://amrit.org for details')).toEqual([
        'https://www.example.com',
        'https://amrit.org',
      ]);
    });

    it('silently drops other TLDs and punctuation-glued URLs (old quirk)', () => {
      // .dev not whitelisted; trailing ')' breaks the endsWith check.
      expect(docsFor('visit www.example.dev or (www.example.com)')).toEqual([]);
    });

    it('splits on comma and newline as well as space', () => {
      // 'links:www.a.com' keeps its prefix through every split → startsWith fails → dropped.
      expect(docsFor('links:www.a.com,www.b.in\nwww.c.org')).toEqual([
        'https://www.b.in',
        'https://www.c.org',
      ]);
    });
  });

  describe('Input patterns (old directive regexes)', () => {
    it('MOBILE_NUMBER_BLOCK blocks letters and symbols, allows digits', () => {
      expect(MOBILE_NUMBER_BLOCK.test('a')).toBeTrue();
      expect(MOBILE_NUMBER_BLOCK.test('#')).toBeTrue();
      expect(MOBILE_NUMBER_BLOCK.test(' ')).toBeTrue();
      expect(MOBILE_NUMBER_BLOCK.test('7')).toBeFalse();
    });
    it('NAME_BLOCK blocks digits, symbols AND space; letters pass', () => {
      expect(NAME_BLOCK.test('5')).toBeTrue();
      expect(NAME_BLOCK.test(' ')).toBeTrue();
      expect(NAME_BLOCK.test('R')).toBeFalse();
    });
    it('TEXTAREA_BLOCK blocks the symbol set, allows letters/digits/space', () => {
      expect(TEXTAREA_BLOCK.test('<')).toBeTrue();
      expect(TEXTAREA_BLOCK.test('|')).toBeTrue();
      expect(TEXTAREA_BLOCK.test('a')).toBeFalse();
      expect(TEXTAREA_BLOCK.test('5')).toBeFalse();
      expect(TEXTAREA_BLOCK.test(' ')).toBeFalse();
    });
  });
});
