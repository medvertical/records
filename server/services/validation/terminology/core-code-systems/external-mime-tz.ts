/**
 * MIME Types and IANA Timezones
 * 
 * Common MIME types used in FHIR attachments and communications.
 * IANA timezone identifiers used in FHIR timing and scheduling.
 * 
 * Sources:
 * - MIME types: https://www.iana.org/assignments/media-types/
 * - Timezones: https://www.iana.org/time-zones
 */

import type { CoreCodeSystemMap } from './types';

export const MIME_AND_TIMEZONE_SYSTEMS: CoreCodeSystemMap = {
  // MIME Types (BCP 13 / RFC 2046)
  'urn:ietf:bcp:13': [
    // Application types
    { code: 'application/pdf', display: 'PDF Document' },
    { code: 'application/json', display: 'JSON' },
    { code: 'application/xml', display: 'XML' },
    { code: 'application/fhir+json', display: 'FHIR JSON' },
    { code: 'application/fhir+xml', display: 'FHIR XML' },
    { code: 'application/hl7-v2+er7', display: 'HL7 v2 ER7' },
    { code: 'application/hl7-v3+xml', display: 'HL7 v3 XML' },
    { code: 'application/cda+xml', display: 'CDA XML' },
    { code: 'application/dicom', display: 'DICOM' },
    { code: 'application/zip', display: 'ZIP Archive' },
    { code: 'application/gzip', display: 'GZIP' },
    { code: 'application/rtf', display: 'Rich Text Format' },
    { code: 'application/msword', display: 'Microsoft Word' },
    { code: 'application/vnd.ms-excel', display: 'Microsoft Excel' },
    { code: 'application/vnd.ms-powerpoint', display: 'Microsoft PowerPoint' },
    { code: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', display: 'Word (OOXML)' },
    { code: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', display: 'Excel (OOXML)' },
    { code: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', display: 'PowerPoint (OOXML)' },
    { code: 'application/octet-stream', display: 'Binary Data' },
    { code: 'application/javascript', display: 'JavaScript' },
    
    // Text types
    { code: 'text/plain', display: 'Plain Text' },
    { code: 'text/html', display: 'HTML' },
    { code: 'text/xml', display: 'XML Text' },
    { code: 'text/csv', display: 'CSV' },
    { code: 'text/css', display: 'CSS' },
    { code: 'text/javascript', display: 'JavaScript Text' },
    { code: 'text/rtf', display: 'Rich Text Format' },
    { code: 'text/markdown', display: 'Markdown' },
    
    // Image types
    { code: 'image/jpeg', display: 'JPEG Image' },
    { code: 'image/jpg', display: 'JPG Image' },
    { code: 'image/png', display: 'PNG Image' },
    { code: 'image/gif', display: 'GIF Image' },
    { code: 'image/bmp', display: 'Bitmap Image' },
    { code: 'image/tiff', display: 'TIFF Image' },
    { code: 'image/svg+xml', display: 'SVG Image' },
    { code: 'image/webp', display: 'WebP Image' },
    { code: 'image/dicom', display: 'DICOM Image' },
    
    // Audio types
    { code: 'audio/mpeg', display: 'MP3 Audio' },
    { code: 'audio/mp3', display: 'MP3 Audio' },
    { code: 'audio/wav', display: 'WAV Audio' },
    { code: 'audio/ogg', display: 'OGG Audio' },
    { code: 'audio/webm', display: 'WebM Audio' },
    { code: 'audio/aac', display: 'AAC Audio' },
    
    // Video types
    { code: 'video/mp4', display: 'MP4 Video' },
    { code: 'video/mpeg', display: 'MPEG Video' },
    { code: 'video/webm', display: 'WebM Video' },
    { code: 'video/ogg', display: 'OGG Video' },
    { code: 'video/quicktime', display: 'QuickTime Video' },
    { code: 'video/x-msvideo', display: 'AVI Video' },
  ],

  // IANA Timezones (major zones commonly used in healthcare)
  'http://www.iana.org/time-zones': [
    // Americas - North America
    { code: 'America/New_York', display: 'Eastern Time (US & Canada)' },
    { code: 'America/Chicago', display: 'Central Time (US & Canada)' },
    { code: 'America/Denver', display: 'Mountain Time (US & Canada)' },
    { code: 'America/Los_Angeles', display: 'Pacific Time (US & Canada)' },
    { code: 'America/Phoenix', display: 'Arizona' },
    { code: 'America/Anchorage', display: 'Alaska' },
    { code: 'America/Adak', display: 'Hawaii-Aleutian' },
    { code: 'Pacific/Honolulu', display: 'Hawaii' },
    { code: 'America/Toronto', display: 'Toronto' },
    { code: 'America/Vancouver', display: 'Vancouver' },
    { code: 'America/Halifax', display: 'Halifax' },
    { code: 'America/St_Johns', display: 'Newfoundland' },
    { code: 'America/Mexico_City', display: 'Mexico City' },
    { code: 'America/Cancun', display: 'Cancun' },
    { code: 'America/Monterrey', display: 'Monterrey' },
    
    // Americas - Central & South America
    { code: 'America/Guatemala', display: 'Guatemala' },
    { code: 'America/Costa_Rica', display: 'Costa Rica' },
    { code: 'America/Panama', display: 'Panama' },
    { code: 'America/Bogota', display: 'Bogota' },
    { code: 'America/Lima', display: 'Lima' },
    { code: 'America/Santiago', display: 'Santiago' },
    { code: 'America/Buenos_Aires', display: 'Buenos Aires' },
    { code: 'America/Sao_Paulo', display: 'São Paulo' },
    { code: 'America/Rio_de_Janeiro', display: 'Rio de Janeiro' },
    { code: 'America/Caracas', display: 'Caracas' },
    
    // Europe
    { code: 'Europe/London', display: 'London (GMT)' },
    { code: 'Europe/Dublin', display: 'Dublin' },
    { code: 'Europe/Paris', display: 'Paris' },
    { code: 'Europe/Berlin', display: 'Berlin' },
    { code: 'Europe/Rome', display: 'Rome' },
    { code: 'Europe/Madrid', display: 'Madrid' },
    { code: 'Europe/Amsterdam', display: 'Amsterdam' },
    { code: 'Europe/Brussels', display: 'Brussels' },
    { code: 'Europe/Vienna', display: 'Vienna' },
    { code: 'Europe/Warsaw', display: 'Warsaw' },
    { code: 'Europe/Prague', display: 'Prague' },
    { code: 'Europe/Budapest', display: 'Budapest' },
    { code: 'Europe/Bucharest', display: 'Bucharest' },
    { code: 'Europe/Athens', display: 'Athens' },
    { code: 'Europe/Istanbul', display: 'Istanbul' },
    { code: 'Europe/Moscow', display: 'Moscow' },
    { code: 'Europe/Helsinki', display: 'Helsinki' },
    { code: 'Europe/Stockholm', display: 'Stockholm' },
    { code: 'Europe/Oslo', display: 'Oslo' },
    { code: 'Europe/Copenhagen', display: 'Copenhagen' },
    { code: 'Europe/Zurich', display: 'Zurich' },
    { code: 'Europe/Lisbon', display: 'Lisbon' },
    
    // Africa
    { code: 'Africa/Cairo', display: 'Cairo' },
    { code: 'Africa/Johannesburg', display: 'Johannesburg' },
    { code: 'Africa/Lagos', display: 'Lagos' },
    { code: 'Africa/Nairobi', display: 'Nairobi' },
    { code: 'Africa/Algiers', display: 'Algiers' },
    { code: 'Africa/Casablanca', display: 'Casablanca' },
    { code: 'Africa/Tunis', display: 'Tunis' },
    { code: 'Africa/Accra', display: 'Accra' },
    { code: 'Africa/Addis_Ababa', display: 'Addis Ababa' },
    { code: 'Africa/Dar_es_Salaam', display: 'Dar es Salaam' },
    
    // Asia - Middle East
    { code: 'Asia/Dubai', display: 'Dubai' },
    { code: 'Asia/Riyadh', display: 'Riyadh' },
    { code: 'Asia/Kuwait', display: 'Kuwait' },
    { code: 'Asia/Doha', display: 'Doha' },
    { code: 'Asia/Bahrain', display: 'Bahrain' },
    { code: 'Asia/Baghdad', display: 'Baghdad' },
    { code: 'Asia/Tehran', display: 'Tehran' },
    { code: 'Asia/Jerusalem', display: 'Jerusalem' },
    { code: 'Asia/Beirut', display: 'Beirut' },
    { code: 'Asia/Amman', display: 'Amman' },
    { code: 'Asia/Damascus', display: 'Damascus' },
    
    // Asia - South Asia
    { code: 'Asia/Kolkata', display: 'Kolkata (India)' },
    { code: 'Asia/Mumbai', display: 'Mumbai' },
    { code: 'Asia/Delhi', display: 'Delhi' },
    { code: 'Asia/Karachi', display: 'Karachi' },
    { code: 'Asia/Dhaka', display: 'Dhaka' },
    { code: 'Asia/Colombo', display: 'Colombo' },
    { code: 'Asia/Kathmandu', display: 'Kathmandu' },
    
    // Asia - Southeast Asia
    { code: 'Asia/Bangkok', display: 'Bangkok' },
    { code: 'Asia/Ho_Chi_Minh', display: 'Ho Chi Minh City' },
    { code: 'Asia/Jakarta', display: 'Jakarta' },
    { code: 'Asia/Singapore', display: 'Singapore' },
    { code: 'Asia/Kuala_Lumpur', display: 'Kuala Lumpur' },
    { code: 'Asia/Manila', display: 'Manila' },
    { code: 'Asia/Yangon', display: 'Yangon' },
    { code: 'Asia/Phnom_Penh', display: 'Phnom Penh' },
    
    // Asia - East Asia
    { code: 'Asia/Tokyo', display: 'Tokyo' },
    { code: 'Asia/Seoul', display: 'Seoul' },
    { code: 'Asia/Shanghai', display: 'Shanghai' },
    { code: 'Asia/Hong_Kong', display: 'Hong Kong' },
    { code: 'Asia/Taipei', display: 'Taipei' },
    { code: 'Asia/Beijing', display: 'Beijing' },
    { code: 'Asia/Chongqing', display: 'Chongqing' },
    { code: 'Asia/Urumqi', display: 'Urumqi' },
    
    // Asia - Central Asia
    { code: 'Asia/Almaty', display: 'Almaty' },
    { code: 'Asia/Tashkent', display: 'Tashkent' },
    { code: 'Asia/Ashgabat', display: 'Ashgabat' },
    { code: 'Asia/Baku', display: 'Baku' },
    { code: 'Asia/Yerevan', display: 'Yerevan' },
    { code: 'Asia/Tbilisi', display: 'Tbilisi' },
    
    // Oceania
    { code: 'Pacific/Auckland', display: 'Auckland' },
    { code: 'Pacific/Wellington', display: 'Wellington' },
    { code: 'Australia/Sydney', display: 'Sydney' },
    { code: 'Australia/Melbourne', display: 'Melbourne' },
    { code: 'Australia/Brisbane', display: 'Brisbane' },
    { code: 'Australia/Perth', display: 'Perth' },
    { code: 'Australia/Adelaide', display: 'Adelaide' },
    { code: 'Australia/Darwin', display: 'Darwin' },
    { code: 'Australia/Hobart', display: 'Hobart' },
    { code: 'Pacific/Fiji', display: 'Fiji' },
    { code: 'Pacific/Guam', display: 'Guam' },
    { code: 'Pacific/Port_Moresby', display: 'Port Moresby' },
    { code: 'Pacific/Noumea', display: 'Noumea' },
    { code: 'Pacific/Tahiti', display: 'Tahiti' },
    { code: 'Pacific/Samoa', display: 'Samoa' },
    { code: 'Pacific/Tongatapu', display: 'Tonga' },
    
    // Atlantic
    { code: 'Atlantic/Azores', display: 'Azores' },
    { code: 'Atlantic/Cape_Verde', display: 'Cape Verde' },
    { code: 'Atlantic/Reykjavik', display: 'Reykjavik' },
    { code: 'Atlantic/Bermuda', display: 'Bermuda' },
    
    // Special/UTC
    { code: 'UTC', display: 'Coordinated Universal Time' },
    { code: 'GMT', display: 'Greenwich Mean Time' },
    { code: 'Etc/UTC', display: 'UTC' },
    { code: 'Etc/GMT', display: 'GMT' },
  ],
};

