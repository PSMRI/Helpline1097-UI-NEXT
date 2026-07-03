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
 * Auth-flow models. Field names mirror the backend payloads EXACTLY (including the
 * inherited misspellings/casing) so the API contract is preserved verbatim. The nested
 * privilege/role shape lives in core models (`Privilege`) since SessionStore holds it.
 */
import { Privilege } from '@/app-modules/core/models';

/** `data` payload returned by `user/userAuthenticate` and `user/getLoginResponse`. */
export interface AuthenticateResponse {
  isAuthenticated?: boolean;
  /** 'Active' = go to role selection; 'New' = first login, go to set-security-questions. */
  Status?: string;
  /** Auth token stored in plain sessionStorage as `authToken`. */
  key?: string;
  userID?: number | string;
  userName?: string;
  agentID?: number | string;
  loginIPAddress?: string;
  previlegeObj?: Privilege[];
}

/** A security question as returned by `user/forgetPassword` (reset flow). */
export interface SecurityQuestion {
  questionId?: number;
  question?: string;
}

/**
 * A security question option from `user/getsecurityquetions` (new-user setup).
 * NOTE the PascalCase fields — this endpoint returns `QuestionID`/`Question`, unlike the
 * reset endpoint (`forgetPassword`) which returns `questionId`/`question`. Preserved verbatim.
 */
export interface SecurityQuestionMaster {
  QuestionID?: number;
  Question?: string;
}

/** One answered security question sent to `validateSecurityQuestionAndAnswer`. */
export interface SecurityQuestionAnswer {
  questionId: number;
  answer: string;
}

/** One security Q&A record sent to `saveUserSecurityQuesAns` (new-user setup). */
export interface SaveSecurityQuestion {
  userID: number | string;
  questionID: number;
  answers: string | null;
  mobileNumber: string;
  createdBy: string;
}
