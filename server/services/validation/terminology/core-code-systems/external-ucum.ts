/**
 * UCUM (Unified Code for Units of Measure)
 * 
 * Common units used in healthcare for measurements, medications, and observations.
 * This is a curated list of the most frequently used UCUM units in FHIR.
 * 
 * Source: https://ucum.org/ucum
 * Full specification: http://unitsofmeasure.org
 */

import type { CoreCodeSystemMap } from './types';

export const UCUM_SYSTEMS: CoreCodeSystemMap = {
  'http://unitsofmeasure.org': [
    // Time units
    { code: 's', display: 'second' },
    { code: 'min', display: 'minute' },
    { code: 'h', display: 'hour' },
    { code: 'd', display: 'day' },
    { code: 'wk', display: 'week' },
    { code: 'mo', display: 'month' },
    { code: 'a', display: 'year' },

    // Mass units
    { code: 'g', display: 'gram' },
    { code: 'kg', display: 'kilogram' },
    { code: 'mg', display: 'milligram' },
    { code: 'ug', display: 'microgram' },
    { code: 'ng', display: 'nanogram' },
    { code: 'pg', display: 'picogram' },
    { code: 'lb_av', display: 'pound (US and British)' },
    { code: 'oz_av', display: 'ounce (US and British)' },

    // Length units
    { code: 'm', display: 'meter' },
    { code: 'cm', display: 'centimeter' },
    { code: 'mm', display: 'millimeter' },
    { code: 'um', display: 'micrometer' },
    { code: 'nm', display: 'nanometer' },
    { code: 'km', display: 'kilometer' },
    { code: '[in_i]', display: 'inch (international)' },
    { code: '[ft_i]', display: 'foot (international)' },

    // Volume units
    { code: 'L', display: 'liter' },
    { code: 'mL', display: 'milliliter' },
    { code: 'uL', display: 'microliter' },
    { code: 'dL', display: 'deciliter' },
    { code: '[gal_us]', display: 'gallon (US)' },
    { code: '[foz_us]', display: 'fluid ounce (US)' },
    { code: '[tsp_us]', display: 'teaspoon (US)' },
    { code: '[tbs_us]', display: 'tablespoon (US)' },
    { code: '[cup_us]', display: 'cup (US)' },

    // Temperature units
    { code: 'Cel', display: 'degree Celsius' },
    { code: '[degF]', display: 'degree Fahrenheit' },
    { code: 'K', display: 'kelvin' },

    // Pressure units
    { code: 'mm[Hg]', display: 'millimeter of mercury' },
    { code: 'Pa', display: 'pascal' },
    { code: 'kPa', display: 'kilopascal' },
    { code: 'bar', display: 'bar' },

    // Concentration units
    { code: 'g/L', display: 'gram per liter' },
    { code: 'mg/L', display: 'milligram per liter' },
    { code: 'mg/dL', display: 'milligram per deciliter' },
    { code: 'mg/mL', display: 'milligram per milliliter' },
    { code: 'ug/L', display: 'microgram per liter' },
    { code: 'ug/mL', display: 'microgram per milliliter' },
    { code: 'ng/mL', display: 'nanogram per milliliter' },
    { code: 'mmol/L', display: 'millimole per liter' },
    { code: 'umol/L', display: 'micromole per liter' },
    { code: 'mol/L', display: 'mole per liter' },
    { code: '%', display: 'percent' },
    { code: 'mg/g', display: 'milligram per gram' },

    // Frequency/rate units
    { code: '/min', display: 'per minute' },
    { code: '/h', display: 'per hour' },
    { code: '/d', display: 'per day' },
    { code: '/s', display: 'per second' },
    { code: '{beats}/min', display: 'beats per minute' },
    { code: '{breaths}/min', display: 'breaths per minute' },

    // Energy units
    { code: 'J', display: 'joule' },
    { code: 'kJ', display: 'kilojoule' },
    { code: 'cal', display: 'calorie' },
    { code: 'kcal', display: 'kilocalorie' },
    { code: '[Cal]', display: 'nutrition label Calories' },

    // Area units
    { code: 'm2', display: 'square meter' },
    { code: 'cm2', display: 'square centimeter' },
    { code: 'mm2', display: 'square millimeter' },

    // Velocity units
    { code: 'm/s', display: 'meter per second' },
    { code: 'km/h', display: 'kilometer per hour' },

    // Dosage units
    { code: '[IU]', display: 'international unit' },
    { code: '[iU]', display: 'international unit' },
    { code: 'U', display: 'unit' },
    { code: 'mU', display: 'milliunit' },
    { code: 'uU', display: 'microunit' },
    { code: '[IU]/L', display: 'international unit per liter' },
    { code: '[IU]/mL', display: 'international unit per milliliter' },
    { code: 'U/L', display: 'unit per liter' },
    { code: 'U/mL', display: 'unit per milliliter' },

    // Blood cell counts
    { code: '10*3/uL', display: 'thousand per microliter' },
    { code: '10*6/uL', display: 'million per microliter' },
    { code: '10*9/L', display: 'billion per liter' },
    { code: '10*12/L', display: 'trillion per liter' },
    { code: '/uL', display: 'per microliter' },
    { code: '/mm3', display: 'per cubic millimeter' },

    // Ratio units
    { code: '{ratio}', display: 'ratio' },
    { code: '{score}', display: 'score' },
    { code: '{index}', display: 'index' },

    // Medication-specific units
    { code: '{tablet}', display: 'tablet' },
    { code: '{capsule}', display: 'capsule' },
    { code: '{pill}', display: 'pill' },
    { code: '{dose}', display: 'dose' },
    { code: '{application}', display: 'application' },
    { code: '{spray}', display: 'spray' },
    { code: '{drop}', display: 'drop' },
    { code: '{puff}', display: 'puff' },
    { code: '{actuation}', display: 'actuation' },

    // Laboratory units
    { code: 'eq/L', display: 'equivalent per liter' },
    { code: 'meq/L', display: 'milliequivalent per liter' },
    { code: 'pg/mL', display: 'picogram per milliliter' },
    { code: 'fmol/L', display: 'femtomole per liter' },
    { code: 'pmol/L', display: 'picomole per liter' },

    // pH and special units
    { code: '[pH]', display: 'pH' },
    { code: 'Osm/kg', display: 'osmole per kilogram' },
    { code: 'mOsm/kg', display: 'milliosmole per kilogram' },

    // Enzymatic activity
    { code: 'kat', display: 'katal' },
    { code: 'ukat', display: 'microkatal' },
    { code: 'nkat', display: 'nanokatal' },

    // Radiation units
    { code: 'Bq', display: 'becquerel' },
    { code: 'Gy', display: 'gray' },
    { code: 'Sv', display: 'sievert' },
    { code: 'mSv', display: 'millisievert' },
    { code: 'uSv', display: 'microsievert' },

    // Electrical units
    { code: 'V', display: 'volt' },
    { code: 'mV', display: 'millivolt' },
    { code: 'uV', display: 'microvolt' },

    // Molecular biology units
    { code: '{copies}/mL', display: 'copies per milliliter' },
    { code: '{genomes}/mL', display: 'genomes per milliliter' },

    // Body surface area
    { code: 'm2{body}', display: 'square meter (body surface area)' },

    // Dimensionless units
    { code: '1', display: 'dimensionless (unity)' },
    { code: '{count}', display: 'count' },

    // Common ratios
    { code: 'g/g', display: 'gram per gram' },
    { code: 'mg/mg', display: 'milligram per milligram' },
    { code: 'mL/min', display: 'milliliter per minute' },
    { code: 'L/min', display: 'liter per minute' },
    { code: 'L/s', display: 'liter per second' },

    // Pulse oximetry
    { code: '%{saturation}', display: 'percent saturation' },

    // Common complex units
    { code: 'g/kg/d', display: 'gram per kilogram per day' },
    { code: 'mg/kg/d', display: 'milligram per kilogram per day' },
    { code: 'mg/kg', display: 'milligram per kilogram' },
    { code: 'ug/kg', display: 'microgram per kilogram' },
    { code: 'mg/m2', display: 'milligram per square meter' },
    { code: 'mL/kg/h', display: 'milliliter per kilogram per hour' },

    // Vision units
    { code: '[diop]', display: 'diopter' },
    { code: '[degA]', display: 'degree of arc' },

    // Density
    { code: 'g/mL', display: 'gram per milliliter' },
    { code: 'kg/L', display: 'kilogram per liter' },
  ],
};

