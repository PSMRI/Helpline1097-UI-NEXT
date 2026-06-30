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

import * as CryptoJS from 'crypto-js';
import { encryptPassword } from './password-crypto';

/**
 * These tests lock the backend wire contract: the password blob MUST be
 * `salt(hex, 64 chars) + iv(hex, 32 chars) + ciphertext(base64)`, AES-CBC with a
 * PBKDF2-SHA512 key (1989 iterations, passphrase 'Piramal12Piramal'). The backend decrypts
 * using exactly these parameters, so any drift here breaks login server-side.
 */
describe('encryptPassword', () => {
  const PASSPHRASE = 'Piramal12Piramal';

  it('emits a 64-char hex salt + 32-char hex iv prefix, then base64 ciphertext', () => {
    const out = encryptPassword('Secret@123');
    const salt = out.slice(0, 64);
    const iv = out.slice(64, 96);
    const ciphertext = out.slice(96);

    expect(salt).toMatch(/^[0-9a-f]{64}$/);
    expect(iv).toMatch(/^[0-9a-f]{32}$/);
    expect(ciphertext.length).toBeGreaterThan(0);
    // base64 (CryptoJS uses standard alphabet with '=' padding)
    expect(ciphertext).toMatch(/^[A-Za-z0-9+/]+={0,2}$/);
  });

  it('is randomized per call (fresh salt + iv) for the same plaintext', () => {
    const a = encryptPassword('Secret@123');
    const b = encryptPassword('Secret@123');
    expect(a).not.toEqual(b);
    expect(a.slice(0, 64)).not.toEqual(b.slice(0, 64)); // different salt
    expect(a.slice(64, 96)).not.toEqual(b.slice(64, 96)); // different iv
  });

  it('round-trips: decrypting with the same PBKDF2/AES params recovers the plaintext', () => {
    const plain = 'Str0ng#Pwd';
    const out = encryptPassword(plain);
    const salt = out.slice(0, 64);
    const iv = out.slice(64, 96);
    const ciphertext = out.slice(96);

    const key = CryptoJS.PBKDF2(PASSPHRASE, CryptoJS.enc.Hex.parse(salt), {
      hasher: CryptoJS.algo.SHA512,
      keySize: 256 / 32,
      iterations: 1989,
    });
    const decrypted = CryptoJS.AES.decrypt(
      CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Base64.parse(ciphertext),
      }),
      key,
      { iv: CryptoJS.enc.Hex.parse(iv) },
    );

    expect(decrypted.toString(CryptoJS.enc.Utf8)).toBe(plain);
  });
});
