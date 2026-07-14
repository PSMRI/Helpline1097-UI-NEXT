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
 * Beneficiary domain models — field names mirror the backend payloads verbatim (incl. the
 * `i_bendemographics` spelling). Everything optional: deployments populate unevenly and the
 * same shapes serve create requests, search results and update round-trips.
 */

/** One phone mapping (`benPhoneMaps[]`); index 0 is always the caller's CLI on create. */
export interface BenPhoneMap {
  parentBenRegID?: number | string | null;
  benRelationshipID?: number | string | null;
  benRelationshipType?: { benRelationshipType?: string };
  phoneNo?: string;
  createdBy?: string;
  deleted?: boolean;
}

/** `i_bendemographics` — location + community + language slice. */
export interface BenDemographics {
  communityID?: number | string | null;
  stateID?: number | string | null;
  districtID?: number | string | null;
  blockID?: number | string | null;
  districtBranchID?: number | string | null;
  pinCode?: string | null;
  preferredLangID?: number | string | null;
  occupationID?: number | string | null;
  educationID?: number | string | null;
  stateName?: string;
  districtName?: string;
  blockName?: string;
  districtBranchName?: string;
  deleted?: boolean;
}

/** A beneficiary record — create payload / search row / update round-trip. */
export interface BeneficiaryRecord {
  beneficiaryID?: number | string;
  beneficiaryRegID?: number | string;
  vanID?: number;
  providerServiceMapID?: number;
  titleId?: number | string | null;
  firstName?: string;
  lastName?: string;
  genderID?: number | string | null;
  genderName?: string;
  dOB?: string;
  actualAge?: number;
  ageUnits?: string;
  maritalStatusID?: number | string | null;
  govtIdentityNo?: string | null;
  govtIdentityTypeID?: number | string | null;
  sexualOrientationID?: number | string | null;
  placeOfWork?: string | null;
  remarks?: string | null;
  isHIVPos?: string | null;
  sourceOfInformation?: string | null;
  benPhoneMaps?: BenPhoneMap[];
  i_bendemographics?: BenDemographics;
  statusID?: number;
  createdBy?: string;
  deleted?: boolean;
  is1097?: boolean;
  /** Update-path change flags — the backend contract depends on these. */
  changeInSelfDetails?: boolean;
  changeInAddress?: boolean;
  changeInContacts?: boolean;
  changeInIdentities?: boolean;
  changeInOtherDetails?: boolean;
  changeInFamilyDetails?: boolean;
  changeInAssociations?: boolean;
  changeInBankDetails?: boolean;
  changeInBenImage?: boolean;
  [key: string]: unknown;
}

/** `beneficiary/getRegistrationDataV1` — master-data bundle for the registration forms. */
export interface RegistrationData {
  states?: { stateID?: number; stateName?: string }[];
  sexualOrientations?: { sexualOrientationId?: number; sexualOrientation?: string }[];
  i_BeneficiaryEducation?: { educationID?: number; educationType?: string }[];
  beneficiaryOccupations?: { occupationID?: number; occupationType?: string }[];
  [key: string]: unknown;
}

/** `call/startCall` request (old innerpage/registration `startCallData`). */
export interface StartCallRequest {
  callID?: string | null;
  is1097?: boolean;
  createdBy?: string;
  calledServiceID?: number;
  phoneNo?: string | null;
  agentID?: number | string | null;
  callReceivedUserID?: number | string | null;
  receivedRoleName?: string;
  beneficiaryRegID?: number | string | null;
  isOutbound?: boolean;
  isCalledEarlier?: boolean;
}

/** `call/startCall` response — the call record (old `dataService.callData`). */
export interface CallData {
  benCallID?: number | string;
  beneficiaryRegID?: number | string | null;
  isCalledEarlier?: boolean | string | null;
  [key: string]: unknown;
}
