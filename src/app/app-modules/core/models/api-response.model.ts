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
 * Standard AMRIT API response envelope used by the Helpline1097 backend.
 * Every JSON endpoint returns this shape.
 */
export interface ApiResponse<T = unknown> {
  statusCode: number;
  data: T;
  errorMessage?: string;
  status?: string;
}

/** Status codes the response/error interceptor branches on (ported from the old InterceptedHttp). */
export const ApiStatus = {
  /** Success. */
  OK: 200,
  /** Session conflict / auth issue (e.g. "already logged in", "Invalid username or password"). */
  SESSION_CONFLICT: 5002,
  /** Domain error the backend wants surfaced to the caller. */
  DOMAIN_ERROR: 5006,
} as const;

/** Messages that trigger the "logout from other device" confirmation on a 5002. */
export const SESSION_CONFLICT_CONFIRM_MESSAGES = [
  'You are already logged in,please confirm to logout from other device and login again',
  'Invalid username or password',
];

/**
 * A 5002 carrying this message is a captcha failure, not a session conflict. The old app
 * surfaced it inline on the login form (and reset the captcha) rather than treating it as
 * "session expired", so the interceptor re-throws it to the caller instead of swallowing.
 */
export const CAPTCHA_FAILED_MESSAGE = 'captcha validation failed';
