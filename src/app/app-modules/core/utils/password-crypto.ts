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

/**
 * Password encryption — a byte-for-byte port of the old app's scheme
 * (login/set-password/set-security-questions all share it). The backend decrypts the
 * transmitted blob, so these parameters and the output layout MUST NOT change.
 *
 * Layout of the returned string:  salt(hex, 64 chars) + iv(hex, 32 chars) + ciphertext(base64)
 *   - key  = PBKDF2(passphrase, salt) with SHA-512, 1989 iterations, 256-bit key
 *   - iv   = random 128-bit
 *   - salt = random 256-bit
 *   - AES (CBC, PKCS7) of the plaintext password
 */
const PASSPHRASE = 'Piramal12Piramal';
const KEY_SIZE = 256;
const IV_SIZE = 128;
const ITERATION_COUNT = 1989;

function generateKey(salt: string, passPhrase: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(passPhrase, CryptoJS.enc.Hex.parse(salt), {
    hasher: CryptoJS.algo.SHA512,
    keySize: KEY_SIZE / 32,
    iterations: ITERATION_COUNT,
  });
}

function encryptWithIvSalt(salt: string, iv: string, passPhrase: string, plainText: string): string {
  const key = generateKey(salt, passPhrase);
  const encrypted = CryptoJS.AES.encrypt(plainText, key, {
    iv: CryptoJS.enc.Hex.parse(iv),
  });
  return encrypted.ciphertext.toString(CryptoJS.enc.Base64);
}

/** Encrypt a plaintext password for transmission to the backend (salt + iv + ciphertext). */
export function encryptPassword(plainText: string): string {
  const iv = CryptoJS.lib.WordArray.random(IV_SIZE / 8).toString(CryptoJS.enc.Hex);
  const salt = CryptoJS.lib.WordArray.random(KEY_SIZE / 8).toString(CryptoJS.enc.Hex);
  const ciphertext = encryptWithIvSalt(salt, iv, PASSPHRASE, plainText);
  return salt + iv + ciphertext;
}
