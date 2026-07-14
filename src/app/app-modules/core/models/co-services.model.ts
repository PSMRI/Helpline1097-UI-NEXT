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
 * CO-services domain models (information / counselling / referral / feedback tabs).
 * Field names mirror the backend payloads verbatim — note the counselling save uses
 * `coCategoryID`/`coSubCategoryID` where the information save uses `categoryID`/
 * `subCategoryID` (a real contract difference, not a typo).
 */

/** `service/servicetypes` row — sub-services of the 1097 service (INFO/COUN/REFE/FEED). */
export interface SubServiceType {
  subServiceID?: number;
  subServiceName?: string;
}

/** `api/helpline1097/co/get/categoryByID` row. */
export interface CoCategory {
  categoryID?: number;
  categoryName?: string;
}

/** `service/subcategory` row (+ file metadata rendered after an information save). */
export interface CoSubCategory {
  subCategoryID?: number;
  subCategoryName?: string;
  subCategoryDesc?: string;
  subCatFilePath?: string;
}

/** Information-tab save (`iEMR/saveBenCalServiceCatSubcatMapping`, sent as a 1-item array). */
export interface InformationMappingRequest {
  beneficiaryRegID?: number | string | null;
  benCallID?: number | string | null;
  subServiceID?: number | null;
  subCategoryID?: number | string | null;
  categoryID?: number | string | null;
  createdBy?: string;
}

/** Counselling-tab save (`iEMR/saveBenCalServiceCOCatSubcatMapping`, 1-item array). */
export interface CounsellingMappingRequest {
  beneficiaryRegID?: number | string | null;
  benCallID?: number | string | null;
  subServiceID?: number | null;
  coSubCategoryID?: number | string | null;
  coCategoryID?: number | string | null;
  createdBy?: string;
}

/** Referral-tab save (`iEMR/saveBenCalReferralMapping`, 1-item array). */
export interface ReferralMappingRequest {
  beneficiaryRegID?: number | string | null;
  benCallID?: number | string | null;
  subServiceID?: number | null;
  createdBy?: string;
  instituteDirectoryID?: number | string | null;
  instituteSubDirectoryID?: number | string | null;
  stateID?: number | string | null;
  districtID?: number | string | null;
  blockID?: number | string | null;
}

/** Feedback-tab save (`co/saveBenFeedback`, 1-item array). */
export interface BenFeedbackRequest {
  instituteTypeID?: number | string | null;
  instituteName?: string | null;
  stateID?: number | string | null;
  districtID?: number | string | null;
  blockID?: number | string | null;
  designationID?: number | string | null;
  severityID?: number | string | null;
  feedbackTypeID?: number | string | null;
  feedback?: string | null;
  beneficiaryRegID?: number | string | null;
  serviceAvailDate?: string | null;
  serviceID?: number | null;
  subServiceID?: number | null;
  userID?: number | string | null;
  createdBy?: string;
  benCallID?: number | string | null;
  '1097ServiceID'?: number | null;
  beneficiaryConsent?: boolean;
}

/** `feedback/getFeedbacksList` — by beneficiary (`{beneficiaryRegID, serviceID}`) or by
 * search (`{phoneNum, requestID, is1097:true}`); one endpoint, two payload shapes. */
export interface FeedbackListRequest {
  beneficiaryRegID?: number | string | null;
  serviceID?: number | null;
  phoneNum?: string | null;
  requestID?: string | null;
  is1097?: boolean;
}

/** Directory / institution master rows (`directory/*`, `institute/getInstituteTypes`). */
export interface InstituteDirectory {
  instituteDirectoryID?: number;
  instituteDirectoryName?: string;
}
export interface InstituteSubDirectory {
  instituteSubDirectoryID?: number;
  instituteSubDirectoryName?: string;
}

/** `sms/getSMSTypes` / `sms/getSMSTemplates` rows. */
export interface SmsType {
  smsTypeID?: number;
  smsType?: string;
}
export interface SmsTemplate {
  smsTemplateID?: number;
  smsTemplateName?: string;
  deleted?: boolean;
}

/** One `sms/sendSMS` array item (registration + referral flows). */
export interface SendSmsRequest {
  alternateNo?: string | null;
  beneficiaryRegID?: number | string | null;
  createdBy?: string;
  is1097?: boolean;
  providerServiceMapID?: number | null;
  smsTemplateID?: number | null;
  smsTemplateTypeID?: number | null;
  instituteID?: number | string | null;
  stateID?: number | string | null;
  districtID?: number | string | null;
  blockID?: number | string | null;
}
