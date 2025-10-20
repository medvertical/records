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

  // Narrative Status (text.status - ALL DomainResource types)
  // http://hl7.org/fhir/narrative-status
  'http://hl7.org/fhir/narrative-status': [
    { code: 'generated', display: 'Generated', definition: 'The contents of the narrative are entirely generated from the core elements in the content.' },
    { code: 'extensions', display: 'Extensions', definition: 'The contents of the narrative are entirely generated from the core elements in the content and some of the content is generated from extensions.' },
    { code: 'additional', display: 'Additional', definition: 'The contents of the narrative may contain additional information not found in the structured data.' },
    { code: 'empty', display: 'Empty', definition: 'The contents of the narrative are some equivalent of "No human-readable text provided in this case".' },
  ],

  // Request Intent
  // http://hl7.org/fhir/request-intent
  'http://hl7.org/fhir/request-intent': [
    { code: 'proposal', display: 'Proposal' },
    { code: 'plan', display: 'Plan' },
    { code: 'directive', display: 'Directive' },
    { code: 'order', display: 'Order' },
    { code: 'original-order', display: 'Original Order' },
    { code: 'reflex-order', display: 'Reflex Order' },
    { code: 'filler-order', display: 'Filler Order' },
    { code: 'instance-order', display: 'Instance Order' },
    { code: 'option', display: 'Option' },
  ],

  // Request Priority
  // http://hl7.org/fhir/request-priority
  'http://hl7.org/fhir/request-priority': [
    { code: 'routine', display: 'Routine' },
    { code: 'urgent', display: 'Urgent' },
    { code: 'asap', display: 'ASAP' },
    { code: 'stat', display: 'STAT' },
  ],

  // Encounter Status
  // http://hl7.org/fhir/encounter-status
  'http://hl7.org/fhir/encounter-status': [
    { code: 'planned', display: 'Planned' },
    { code: 'arrived', display: 'Arrived' },
    { code: 'triaged', display: 'Triaged' },
    { code: 'in-progress', display: 'In Progress' },
    { code: 'onleave', display: 'On Leave' },
    { code: 'finished', display: 'Finished' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Procedure Status (uses event-status codes)
  // http://hl7.org/fhir/event-status
  'http://hl7.org/fhir/procedure-status': [
    { code: 'preparation', display: 'Preparation' },
    { code: 'in-progress', display: 'In Progress' },
    { code: 'not-done', display: 'Not Done' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'stopped', display: 'Stopped' },
    { code: 'completed', display: 'Completed' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Medication Statement Status
  // http://hl7.org/fhir/medication-statement-status
  'http://hl7.org/fhir/medication-statement-status': [
    { code: 'active', display: 'Active' },
    { code: 'completed', display: 'Completed' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'intended', display: 'Intended' },
    { code: 'stopped', display: 'Stopped' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'unknown', display: 'Unknown' },
    { code: 'not-taken', display: 'Not Taken' },
  ],

  // AllergyIntolerance Clinical Status
  // http://hl7.org/fhir/allergyintolerance-clinical
  'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical': [
    { code: 'active', display: 'Active' },
    { code: 'inactive', display: 'Inactive' },
    { code: 'resolved', display: 'Resolved' },
  ],

  // AllergyIntolerance Verification Status
  // http://hl7.org/fhir/allergyintolerance-verification
  'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification': [
    { code: 'unconfirmed', display: 'Unconfirmed' },
    { code: 'confirmed', display: 'Confirmed' },
    { code: 'refuted', display: 'Refuted' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // DiagnosticReport Status
  // http://hl7.org/fhir/diagnostic-report-status
  'http://hl7.org/fhir/diagnostic-report-status': [
    { code: 'registered', display: 'Registered' },
    { code: 'partial', display: 'Partial' },
    { code: 'preliminary', display: 'Preliminary' },
    { code: 'final', display: 'Final' },
    { code: 'amended', display: 'Amended' },
    { code: 'corrected', display: 'Corrected' },
    { code: 'appended', display: 'Appended' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Location Status
  // http://hl7.org/fhir/location-status
  'http://hl7.org/fhir/location-status': [
    { code: 'active', display: 'Active' },
    { code: 'suspended', display: 'Suspended' },
    { code: 'inactive', display: 'Inactive' },
  ],

  // Location Mode
  // http://hl7.org/fhir/location-mode
  'http://hl7.org/fhir/location-mode': [
    { code: 'instance', display: 'Instance' },
    { code: 'kind', display: 'Kind' },
  ],

  // Encounter Location Status (Encounter.location.status)
  // http://hl7.org/fhir/encounter-location-status
  'http://hl7.org/fhir/encounter-location-status': [
    { code: 'planned', display: 'Planned' },
    { code: 'active', display: 'Active' },
    { code: 'reserved', display: 'Reserved' },
    { code: 'completed', display: 'Completed' },
  ],
};

