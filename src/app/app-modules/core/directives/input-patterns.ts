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

/**
 * The old validation-directive suite's keypress DENYLISTS, regex-for-regex verbatim
 * (each old directive blocked a typed character matching its pattern; most also blocked
 * paste/copy/cut — the "WithCopyPaste" variants instead scanned pasted text and rejected
 * the whole paste when any character matched).
 */

/** Old `[myMobileNumber]` — blocks letters, symbols and space (digits only). */
export const MOBILE_NUMBER_BLOCK = /^[a-zA-Z~!@#$%^&*()_+\-=\[\]{};'`:"\\|,.<>\/? ]*$/;

/** Old `[myName]` — blocks digits, symbols AND space. */
export const NAME_BLOCK = /^[0-9 ~!@#$%^&*()_+\-=\[\]{};'`:"\\|,.<>\/?]*$/;

/** Old `[myName_space]` — like myName but space is allowed. */
export const NAME_WITH_SPACE_BLOCK = /^[0-9~!@#$%^&*()_+\-=\[\]{};':`"\\|,.<>\/?]*$/;

/** Old `[inputFieldValidator]`. */
export const INPUT_FIELD_BLOCK = /^[~!@#$%^&*()_+\-=\[\]{};"`'.,:'\\|<>\/?]*$/;

/** Old `[searchIdValidator]` (feedback-id search box). */
export const SEARCH_ID_BLOCK = /^[~!@#$%^&*()_+\-=\[\]{};"`'.,:'\\|<>\?]*$/;

/** Old `[textAreaValidator]`. */
export const TEXTAREA_BLOCK = /^[~!@#$%^&*()_+\-=\[\]{};"`':'\\|<>\/?]*$/;

/** Old `[textAreaValidatorWithCopyPaste]` (paste allowed, scanned). */
export const TEXTAREA_PASTE_BLOCK = /^[~!@#$%^*()+\=\[\]{};"`':'\\|<>\/?]*$/;

/** Old `[smsTemplateValidator]`. */
export const SMS_TEMPLATE_BLOCK = /^[~!@#%^&*_+\=\[\]{}"`''\\|<>\?]*$/;

/** Old `[smsTemplateValidatorWithCopyPaste]` (paste allowed, scanned; note: no `#`). */
export const SMS_TEMPLATE_PASTE_BLOCK = /^[~!@%^&*_+\=\[\]{}"`''\\|<>\?]*$/;
