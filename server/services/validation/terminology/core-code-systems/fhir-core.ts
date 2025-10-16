/**
 * Core FHIR Code Systems
 * 
 * Standard FHIR code systems that are part of the FHIR specification.
 * These are universally known and don't require external terminology server validation.
 * 
 * Source: http://hl7.org/fhir/terminologies-systems.html
 */

import type { CoreCodeSystemMap } from './types';

export const FHIR_CORE_SYSTEMS: CoreCodeSystemMap = {
  // Administrative Gender
  // http://hl7.org/fhir/administrative-gender
  'http://hl7.org/fhir/administrative-gender': [
    { code: 'male', display: 'Male', definition: 'Male' },
    { code: 'female', display: 'Female', definition: 'Female' },
    { code: 'other', display: 'Other', definition: 'Other' },
    { code: 'unknown', display: 'Unknown', definition: 'Unknown' },
  ],

  // Observation Status
  // http://hl7.org/fhir/observation-status
  'http://hl7.org/fhir/observation-status': [
    { code: 'registered', display: 'Registered' },
    { code: 'preliminary', display: 'Preliminary' },
    { code: 'final', display: 'Final' },
    { code: 'amended', display: 'Amended' },
    { code: 'corrected', display: 'Corrected' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Publication Status
  // http://hl7.org/fhir/publication-status
  'http://hl7.org/fhir/publication-status': [
    { code: 'draft', display: 'Draft' },
    { code: 'active', display: 'Active' },
    { code: 'retired', display: 'Retired' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Request Status
  // http://hl7.org/fhir/request-status
  'http://hl7.org/fhir/request-status': [
    { code: 'draft', display: 'Draft' },
    { code: 'active', display: 'Active' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'revoked', display: 'Revoked' },
    { code: 'completed', display: 'Completed' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Event Status
  // http://hl7.org/fhir/event-status
  'http://hl7.org/fhir/event-status': [
    { code: 'preparation', display: 'Preparation' },
    { code: 'in-progress', display: 'In Progress' },
    { code: 'not-done', display: 'Not Done' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'stopped', display: 'Stopped' },
    { code: 'completed', display: 'Completed' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Name Use
  // http://hl7.org/fhir/name-use
  'http://hl7.org/fhir/name-use': [
    { code: 'usual', display: 'Usual' },
    { code: 'official', display: 'Official' },
    { code: 'temp', display: 'Temp' },
    { code: 'nickname', display: 'Nickname' },
    { code: 'anonymous', display: 'Anonymous' },
    { code: 'old', display: 'Old' },
    { code: 'maiden', display: 'Maiden' },
  ],

  // Address Use
  // http://hl7.org/fhir/address-use
  'http://hl7.org/fhir/address-use': [
    { code: 'home', display: 'Home' },
    { code: 'work', display: 'Work' },
    { code: 'temp', display: 'Temporary' },
    { code: 'old', display: 'Old / Incorrect' },
    { code: 'billing', display: 'Billing' },
  ],

  // Contact Point System
  // http://hl7.org/fhir/contact-point-system
  'http://hl7.org/fhir/contact-point-system': [
    { code: 'phone', display: 'Phone' },
    { code: 'fax', display: 'Fax' },
    { code: 'email', display: 'Email' },
    { code: 'pager', display: 'Pager' },
    { code: 'url', display: 'URL' },
    { code: 'sms', display: 'SMS' },
    { code: 'other', display: 'Other' },
  ],

  // Contact Point Use
  // http://hl7.org/fhir/contact-point-use
  'http://hl7.org/fhir/contact-point-use': [
    { code: 'home', display: 'Home' },
    { code: 'work', display: 'Work' },
    { code: 'temp', display: 'Temp' },
    { code: 'old', display: 'Old' },
    { code: 'mobile', display: 'Mobile' },
  ],

  // Identifier Use
  // http://hl7.org/fhir/identifier-use
  'http://hl7.org/fhir/identifier-use': [
    { code: 'usual', display: 'Usual' },
    { code: 'official', display: 'Official' },
    { code: 'temp', display: 'Temp' },
    { code: 'secondary', display: 'Secondary' },
    { code: 'old', display: 'Old' },
  ],

  // Quantity Comparator
  // http://hl7.org/fhir/quantity-comparator
  'http://hl7.org/fhir/quantity-comparator': [
    { code: '<', display: 'Less than' },
    { code: '<=', display: 'Less or Equal to' },
    { code: '>=', display: 'Greater or Equal to' },
    { code: '>', display: 'Greater than' },
  ],
};

