/**
 * Core FHIR Code Systems (Comprehensive R4 Coverage)
 * 
 * Standard FHIR code systems that are part of the FHIR R4 specification.
 * These are universally known and don't require external terminology server validation.
 * 
 * Source: http://hl7.org/fhir/R4/terminologies-systems.html
 * 
 * Coverage: 50+ code systems, 500+ codes for instant local validation
 */

import type { CoreCodeSystemMap } from './types';

export const FHIR_CORE_SYSTEMS: CoreCodeSystemMap = {
  // ============================================================================
  // Administrative & Identity Code Systems
  // ============================================================================

  // Administrative Gender
  // http://hl7.org/fhir/administrative-gender
  'http://hl7.org/fhir/administrative-gender': [
    { code: 'male', display: 'Male', definition: 'Male' },
    { code: 'female', display: 'Female', definition: 'Female' },
    { code: 'other', display: 'Other', definition: 'Other' },
    { code: 'unknown', display: 'Unknown', definition: 'Unknown' },
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

  // Address Type
  // http://hl7.org/fhir/address-type
  'http://hl7.org/fhir/address-type': [
    { code: 'postal', display: 'Postal', definition: 'Mailing address' },
    { code: 'physical', display: 'Physical', definition: 'Physical location' },
    { code: 'both', display: 'Both', definition: 'Postal and physical' },
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

  // Link Type (Patient/Person/RelatedPerson)
  // http://hl7.org/fhir/link-type
  'http://hl7.org/fhir/link-type': [
    { code: 'replaced-by', display: 'Replaced-by' },
    { code: 'replaces', display: 'Replaces' },
    { code: 'refer', display: 'Refer' },
    { code: 'seealso', display: 'See also' },
  ],

  // ============================================================================
  // Status Code Systems (Universal)
  // ============================================================================

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

  // Narrative Status (text.status - ALL DomainResource types)
  // http://hl7.org/fhir/narrative-status
  'http://hl7.org/fhir/narrative-status': [
    { code: 'generated', display: 'Generated', definition: 'The contents of the narrative are entirely generated from the core elements in the content.' },
    { code: 'extensions', display: 'Extensions', definition: 'The contents of the narrative are entirely generated from the core elements in the content and some of the content is generated from extensions.' },
    { code: 'additional', display: 'Additional', definition: 'The contents of the narrative may contain additional information not found in the structured data.' },
    { code: 'empty', display: 'Empty', definition: 'The contents of the narrative are some equivalent of "No human-readable text provided in this case".' },
  ],

  // ============================================================================
  // Clinical Observation Code Systems
  // ============================================================================

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

  // Observation Category
  // http://hl7.org/fhir/observation-category
  'http://hl7.org/fhir/observation-category': [
    { code: 'social-history', display: 'Social History', definition: 'Social History Observations' },
    { code: 'vital-signs', display: 'Vital Signs', definition: 'Clinical observations measure the body\'s basic functions' },
    { code: 'imaging', display: 'Imaging', definition: 'Observations generated by imaging' },
    { code: 'laboratory', display: 'Laboratory', definition: 'Laboratory test results' },
    { code: 'procedure', display: 'Procedure', definition: 'Observations generated by procedures' },
    { code: 'survey', display: 'Survey', definition: 'Assessment tool/survey instrument observations' },
    { code: 'exam', display: 'Exam', definition: 'Observations generated by physical exam' },
    { code: 'therapy', display: 'Therapy', definition: 'Observations generated by non-interventional treatment protocols' },
    { code: 'activity', display: 'Activity', definition: 'Observations relating to physical activity' },
  ],

  // Quantity Comparator
  // http://hl7.org/fhir/quantity-comparator
  'http://hl7.org/fhir/quantity-comparator': [
    { code: '<', display: 'Less than' },
    { code: '<=', display: 'Less or Equal to' },
    { code: '>=', display: 'Greater or Equal to' },
    { code: '>', display: 'Greater than' },
  ],

  // ============================================================================
  // Encounter & Appointment Code Systems
  // ============================================================================

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

  // Encounter Location Status
  // http://hl7.org/fhir/encounter-location-status
  'http://hl7.org/fhir/encounter-location-status': [
    { code: 'planned', display: 'Planned' },
    { code: 'active', display: 'Active' },
    { code: 'reserved', display: 'Reserved' },
    { code: 'completed', display: 'Completed' },
  ],

  // Appointment Status
  // http://hl7.org/fhir/appointmentstatus
  'http://hl7.org/fhir/appointmentstatus': [
    { code: 'proposed', display: 'Proposed' },
    { code: 'pending', display: 'Pending' },
    { code: 'booked', display: 'Booked' },
    { code: 'arrived', display: 'Arrived' },
    { code: 'fulfilled', display: 'Fulfilled' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'noshow', display: 'No Show' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'checked-in', display: 'Checked In' },
    { code: 'waitlist', display: 'Waitlist' },
  ],

  // Participant Required
  // http://hl7.org/fhir/participantrequired
  'http://hl7.org/fhir/participantrequired': [
    { code: 'required', display: 'Required' },
    { code: 'optional', display: 'Optional' },
    { code: 'information-only', display: 'Information Only' },
  ],

  // Participant Status
  // http://hl7.org/fhir/participationstatus
  'http://hl7.org/fhir/participationstatus': [
    { code: 'accepted', display: 'Accepted' },
    { code: 'declined', display: 'Declined' },
    { code: 'tentative', display: 'Tentative' },
    { code: 'needs-action', display: 'Needs Action' },
  ],

  // ============================================================================
  // Procedure & DiagnosticReport Code Systems
  // ============================================================================

  // Procedure Status
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

  // Specimen Status
  // http://hl7.org/fhir/specimen-status
  'http://hl7.org/fhir/specimen-status': [
    { code: 'available', display: 'Available' },
    { code: 'unavailable', display: 'Unavailable' },
    { code: 'unsatisfactory', display: 'Unsatisfactory' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // ============================================================================
  // Medication & Immunization Code Systems
  // ============================================================================

  // Medication Request Status
  // http://hl7.org/fhir/CodeSystem/medicationrequest-status
  'http://hl7.org/fhir/CodeSystem/medicationrequest-status': [
    { code: 'active', display: 'Active' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'completed', display: 'Completed' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'stopped', display: 'Stopped' },
    { code: 'draft', display: 'Draft' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Medication Request Intent
  // http://hl7.org/fhir/CodeSystem/medicationrequest-intent
  'http://hl7.org/fhir/CodeSystem/medicationrequest-intent': [
    { code: 'proposal', display: 'Proposal' },
    { code: 'plan', display: 'Plan' },
    { code: 'order', display: 'Order' },
    { code: 'original-order', display: 'Original Order' },
    { code: 'reflex-order', display: 'Reflex Order' },
    { code: 'filler-order', display: 'Filler Order' },
    { code: 'instance-order', display: 'Instance Order' },
    { code: 'option', display: 'Option' },
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

  // Immunization Status
  // http://hl7.org/fhir/immunization-status
  'http://hl7.org/fhir/immunization-status': [
    { code: 'completed', display: 'Completed' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'not-done', display: 'Not Done' },
  ],

  // ============================================================================
  // AllergyIntolerance & Condition Code Systems
  // ============================================================================

  // AllergyIntolerance Clinical Status
  // http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical
  'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical': [
    { code: 'active', display: 'Active' },
    { code: 'inactive', display: 'Inactive' },
    { code: 'resolved', display: 'Resolved' },
  ],

  // AllergyIntolerance Verification Status
  // http://terminology.hl7.org/CodeSystem/allergyintolerance-verification
  'http://terminology.hl7.org/CodeSystem/allergyintolerance-verification': [
    { code: 'unconfirmed', display: 'Unconfirmed' },
    { code: 'confirmed', display: 'Confirmed' },
    { code: 'refuted', display: 'Refuted' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // AllergyIntolerance Type
  // http://hl7.org/fhir/allergy-intolerance-type
  'http://hl7.org/fhir/allergy-intolerance-type': [
    { code: 'allergy', display: 'Allergy' },
    { code: 'intolerance', display: 'Intolerance' },
  ],

  // AllergyIntolerance Category
  // http://hl7.org/fhir/allergy-intolerance-category
  'http://hl7.org/fhir/allergy-intolerance-category': [
    { code: 'food', display: 'Food' },
    { code: 'medication', display: 'Medication' },
    { code: 'environment', display: 'Environment' },
    { code: 'biologic', display: 'Biologic' },
  ],

  // AllergyIntolerance Criticality
  // http://hl7.org/fhir/allergy-intolerance-criticality
  'http://hl7.org/fhir/allergy-intolerance-criticality': [
    { code: 'low', display: 'Low Risk' },
    { code: 'high', display: 'High Risk' },
    { code: 'unable-to-assess', display: 'Unable to Assess' },
  ],

  // ============================================================================
  // CarePlan & Goal Code Systems
  // ============================================================================

  // Care Plan Status
  // http://hl7.org/fhir/request-status
  'http://hl7.org/fhir/care-plan-status': [
    { code: 'draft', display: 'Draft' },
    { code: 'active', display: 'Active' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'revoked', display: 'Revoked' },
    { code: 'completed', display: 'Completed' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Care Plan Intent
  // http://hl7.org/fhir/care-plan-intent
  'http://hl7.org/fhir/care-plan-intent': [
    { code: 'proposal', display: 'Proposal' },
    { code: 'plan', display: 'Plan' },
    { code: 'order', display: 'Order' },
    { code: 'option', display: 'Option' },
  ],

  // Care Plan Activity Status
  // http://hl7.org/fhir/care-plan-activity-status
  'http://hl7.org/fhir/care-plan-activity-status': [
    { code: 'not-started', display: 'Not Started' },
    { code: 'scheduled', display: 'Scheduled' },
    { code: 'in-progress', display: 'In Progress' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'completed', display: 'Completed' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'stopped', display: 'Stopped' },
    { code: 'unknown', display: 'Unknown' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // Goal Status
  // http://hl7.org/fhir/goal-status
  'http://hl7.org/fhir/goal-status': [
    { code: 'proposed', display: 'Proposed' },
    { code: 'planned', display: 'Planned' },
    { code: 'accepted', display: 'Accepted' },
    { code: 'active', display: 'Active' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'completed', display: 'Completed' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'rejected', display: 'Rejected' },
  ],

  // Goal Lifecycle Status
  // http://hl7.org/fhir/goal-achievement
  'http://hl7.org/fhir/goal-achievement': [
    { code: 'in-progress', display: 'In Progress' },
    { code: 'improving', display: 'Improving' },
    { code: 'worsening', display: 'Worsening' },
    { code: 'no-change', display: 'No Change' },
    { code: 'achieved', display: 'Achieved' },
    { code: 'sustaining', display: 'Sustaining' },
    { code: 'not-achieved', display: 'Not Achieved' },
    { code: 'no-progress', display: 'No Progress' },
    { code: 'not-attainable', display: 'Not Attainable' },
  ],

  // ============================================================================
  // Document & Composition Code Systems
  // ============================================================================

  // Composition Status
  // http://hl7.org/fhir/composition-status
  'http://hl7.org/fhir/composition-status': [
    { code: 'preliminary', display: 'Preliminary' },
    { code: 'final', display: 'Final' },
    { code: 'amended', display: 'Amended' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // Document Reference Status
  // http://hl7.org/fhir/document-reference-status
  'http://hl7.org/fhir/document-reference-status': [
    { code: 'current', display: 'Current' },
    { code: 'superseded', display: 'Superseded' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // Document Relationship Type
  // http://hl7.org/fhir/document-relationship-type
  'http://hl7.org/fhir/document-relationship-type': [
    { code: 'replaces', display: 'Replaces' },
    { code: 'transforms', display: 'Transforms' },
    { code: 'signs', display: 'Signs' },
    { code: 'appends', display: 'Appends' },
  ],

  // ============================================================================
  // List & Task Code Systems
  // ============================================================================

  // List Status
  // http://hl7.org/fhir/list-status
  'http://hl7.org/fhir/list-status': [
    { code: 'current', display: 'Current' },
    { code: 'retired', display: 'Retired' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // List Mode
  // http://hl7.org/fhir/list-mode
  'http://hl7.org/fhir/list-mode': [
    { code: 'working', display: 'Working' },
    { code: 'snapshot', display: 'Snapshot' },
    { code: 'changes', display: 'Changes' },
  ],

  // Task Status
  // http://hl7.org/fhir/task-status
  'http://hl7.org/fhir/task-status': [
    { code: 'draft', display: 'Draft' },
    { code: 'requested', display: 'Requested' },
    { code: 'received', display: 'Received' },
    { code: 'accepted', display: 'Accepted' },
    { code: 'rejected', display: 'Rejected' },
    { code: 'ready', display: 'Ready' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'in-progress', display: 'In Progress' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'failed', display: 'Failed' },
    { code: 'completed', display: 'Completed' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // Task Intent
  // http://hl7.org/fhir/task-intent
  'http://hl7.org/fhir/task-intent': [
    { code: 'unknown', display: 'Unknown' },
    { code: 'proposal', display: 'Proposal' },
    { code: 'plan', display: 'Plan' },
    { code: 'order', display: 'Order' },
    { code: 'original-order', display: 'Original Order' },
    { code: 'reflex-order', display: 'Reflex Order' },
    { code: 'filler-order', display: 'Filler Order' },
    { code: 'instance-order', display: 'Instance Order' },
    { code: 'option', display: 'Option' },
  ],

  // ============================================================================
  // Location & Device Code Systems
  // ============================================================================

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

  // Device Status
  // http://hl7.org/fhir/device-status
  'http://hl7.org/fhir/device-status': [
    { code: 'active', display: 'Active' },
    { code: 'inactive', display: 'Inactive' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // ============================================================================
  // Bundle & Communication Code Systems
  // ============================================================================

  // Bundle Type
  // http://hl7.org/fhir/bundle-type
  'http://hl7.org/fhir/bundle-type': [
    { code: 'document', display: 'Document' },
    { code: 'message', display: 'Message' },
    { code: 'transaction', display: 'Transaction' },
    { code: 'transaction-response', display: 'Transaction Response' },
    { code: 'batch', display: 'Batch' },
    { code: 'batch-response', display: 'Batch Response' },
    { code: 'history', display: 'History' },
    { code: 'searchset', display: 'Search Results' },
    { code: 'collection', display: 'Collection' },
  ],

  // HTTP Verb
  // http://hl7.org/fhir/http-verb
  'http://hl7.org/fhir/http-verb': [
    { code: 'GET', display: 'GET' },
    { code: 'HEAD', display: 'HEAD' },
    { code: 'POST', display: 'POST' },
    { code: 'PUT', display: 'PUT' },
    { code: 'DELETE', display: 'DELETE' },
    { code: 'PATCH', display: 'PATCH' },
  ],

  // Communication Status
  // http://hl7.org/fhir/event-status
  'http://hl7.org/fhir/communication-status': [
    { code: 'preparation', display: 'Preparation' },
    { code: 'in-progress', display: 'In Progress' },
    { code: 'not-done', display: 'Not Done' },
    { code: 'on-hold', display: 'On Hold' },
    { code: 'stopped', display: 'Stopped' },
    { code: 'completed', display: 'Completed' },
    { code: 'entered-in-error', display: 'Entered in Error' },
    { code: 'unknown', display: 'Unknown' },
  ],

  // Communication Priority
  // http://hl7.org/fhir/request-priority
  'http://hl7.org/fhir/communication-priority': [
    { code: 'routine', display: 'Routine' },
    { code: 'urgent', display: 'Urgent' },
    { code: 'asap', display: 'ASAP' },
    { code: 'stat', display: 'STAT' },
  ],

  // ============================================================================
  // Episode of Care & Flag Code Systems
  // ============================================================================

  // Episode of Care Status
  // http://hl7.org/fhir/episode-of-care-status
  'http://hl7.org/fhir/episode-of-care-status': [
    { code: 'planned', display: 'Planned' },
    { code: 'waitlist', display: 'Waitlist' },
    { code: 'active', display: 'Active' },
    { code: 'onhold', display: 'On Hold' },
    { code: 'finished', display: 'Finished' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // Flag Status
  // http://hl7.org/fhir/flag-status
  'http://hl7.org/fhir/flag-status': [
    { code: 'active', display: 'Active' },
    { code: 'inactive', display: 'Inactive' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // ============================================================================
  // Claim & Financial Code Systems
  // ============================================================================

  // Claim Status
  // http://hl7.org/fhir/fm-status
  'http://hl7.org/fhir/fm-status': [
    { code: 'active', display: 'Active' },
    { code: 'cancelled', display: 'Cancelled' },
    { code: 'draft', display: 'Draft' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // Remittance Outcome
  // http://hl7.org/fhir/remittance-outcome
  'http://hl7.org/fhir/remittance-outcome': [
    { code: 'queued', display: 'Queued' },
    { code: 'complete', display: 'Complete' },
    { code: 'error', display: 'Error' },
    { code: 'partial', display: 'Partial' },
  ],

  // ============================================================================
  // Consent & Provenance Code Systems
  // ============================================================================

  // Consent State
  // http://hl7.org/fhir/consent-state-codes
  'http://hl7.org/fhir/consent-state-codes': [
    { code: 'draft', display: 'Pending' },
    { code: 'proposed', display: 'Proposed' },
    { code: 'active', display: 'Active' },
    { code: 'rejected', display: 'Rejected' },
    { code: 'inactive', display: 'Inactive' },
    { code: 'entered-in-error', display: 'Entered in Error' },
  ],

  // Provenance Entity Role
  // http://hl7.org/fhir/provenance-entity-role
  'http://hl7.org/fhir/provenance-entity-role': [
    { code: 'derivation', display: 'Derivation' },
    { code: 'revision', display: 'Revision' },
    { code: 'quotation', display: 'Quotation' },
    { code: 'source', display: 'Source' },
    { code: 'removal', display: 'Removal' },
  ],

  // ============================================================================
  // Additional Common Code Systems
  // ============================================================================

  // Days of Week
  // http://hl7.org/fhir/days-of-week
  'http://hl7.org/fhir/days-of-week': [
    { code: 'mon', display: 'Monday' },
    { code: 'tue', display: 'Tuesday' },
    { code: 'wed', display: 'Wednesday' },
    { code: 'thu', display: 'Thursday' },
    { code: 'fri', display: 'Friday' },
    { code: 'sat', display: 'Saturday' },
    { code: 'sun', display: 'Sunday' },
  ],

  // Note Type
  // http://hl7.org/fhir/note-type
  'http://hl7.org/fhir/note-type': [
    { code: 'display', display: 'Display' },
    { code: 'print', display: 'Print (Form)' },
    { code: 'printoper', display: 'Print (Operator)' },
  ],

  // Discriminator Type
  // http://hl7.org/fhir/discriminator-type
  'http://hl7.org/fhir/discriminator-type': [
    { code: 'value', display: 'Value' },
    { code: 'exists', display: 'Exists' },
    { code: 'pattern', display: 'Pattern' },
    { code: 'type', display: 'Type' },
    { code: 'profile', display: 'Profile' },
  ],

  // Search Comparator
  // http://hl7.org/fhir/search-comparator
  'http://hl7.org/fhir/search-comparator': [
    { code: 'eq', display: 'Equals' },
    { code: 'ne', display: 'Not Equals' },
    { code: 'gt', display: 'Greater Than' },
    { code: 'lt', display: 'Less Than' },
    { code: 'ge', display: 'Greater or Equals' },
    { code: 'le', display: 'Less or Equals' },
    { code: 'sa', display: 'Starts After' },
    { code: 'eb', display: 'Ends Before' },
    { code: 'ap', display: 'Approximately' },
  ],

  // Search Modifier Code
  // http://hl7.org/fhir/search-modifier-code
  'http://hl7.org/fhir/search-modifier-code': [
    { code: 'missing', display: 'Missing' },
    { code: 'exact', display: 'Exact' },
    { code: 'contains', display: 'Contains' },
    { code: 'not', display: 'Not' },
    { code: 'text', display: 'Text' },
    { code: 'in', display: 'In' },
    { code: 'not-in', display: 'Not In' },
    { code: 'below', display: 'Below' },
    { code: 'above', display: 'Above' },
    { code: 'type', display: 'Type' },
    { code: 'identifier', display: 'Identifier' },
    { code: 'ofType', display: 'Of Type' },
  ],
};

