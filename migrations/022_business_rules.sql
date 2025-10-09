-- Migration: Business Rules Table
-- Task 6.4-6.5: Create database table for storing custom business rules

-- Create business_rules table
CREATE TABLE IF NOT EXISTS business_rules (
    id SERIAL PRIMARY KEY,
    
    -- Rule Identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_id VARCHAR(100) UNIQUE NOT NULL, -- Unique identifier (e.g., "BR-001")
    
    -- FHIRPath Expression
    expression TEXT NOT NULL, -- The FHIRPath expression to evaluate
    
    -- Configuration
    severity VARCHAR(20) NOT NULL DEFAULT 'error', -- error, warning, information
    enabled BOOLEAN DEFAULT true,
    
    -- Resource Targeting
    resource_types TEXT[] NOT NULL, -- Array of resource types (e.g., ['Patient', 'Observation'])
    fhir_versions TEXT[] DEFAULT ARRAY['R4'], -- Supported FHIR versions
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(100),
    updated_by VARCHAR(100),
    
    -- Validation metadata
    validation_message TEXT, -- Custom message to display when rule fails
    suggestions TEXT[], -- Array of suggestion strings
    
    -- Performance & Stats
    execution_count INTEGER DEFAULT 0,
    last_executed_at TIMESTAMP,
    avg_execution_time_ms NUMERIC(10, 2),
    
    -- Rule categorization
    category VARCHAR(50), -- e.g., 'data-quality', 'compliance', 'business-logic'
    tags TEXT[] DEFAULT ARRAY[]::TEXT[]
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_business_rules_enabled ON business_rules(enabled);
CREATE INDEX IF NOT EXISTS idx_business_rules_resource_types ON business_rules USING GIN(resource_types);
CREATE INDEX IF NOT EXISTS idx_business_rules_category ON business_rules(category);
CREATE INDEX IF NOT EXISTS idx_business_rules_rule_id ON business_rules(rule_id);

-- Create business_rule_executions table for audit trail
CREATE TABLE IF NOT EXISTS business_rule_executions (
    id SERIAL PRIMARY KEY,
    business_rule_id INTEGER REFERENCES business_rules(id) ON DELETE CASCADE,
    
    -- Execution context
    resource_id INTEGER, -- ID of validated resource (if applicable)
    resource_type VARCHAR(50),
    fhir_version VARCHAR(10),
    
    -- Execution result
    passed BOOLEAN NOT NULL,
    result_value TEXT, -- The actual FHIRPath result (JSON)
    execution_time_ms NUMERIC(10, 2),
    
    -- Error tracking
    error_message TEXT,
    
    -- Timestamps
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for executions
CREATE INDEX IF NOT EXISTS idx_business_rule_executions_rule_id ON business_rule_executions(business_rule_id);
CREATE INDEX IF NOT EXISTS idx_business_rule_executions_resource_id ON business_rule_executions(resource_id);
CREATE INDEX IF NOT EXISTS idx_business_rule_executions_executed_at ON business_rule_executions(executed_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_business_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER update_business_rules_timestamp
    BEFORE UPDATE ON business_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_business_rules_updated_at();

-- Insert example business rules (German healthcare context)
INSERT INTO business_rules (
    name,
    description,
    rule_id,
    expression,
    severity,
    resource_types,
    validation_message,
    suggestions,
    category
) VALUES 
(
    'Patient must have name',
    'Ensures all Patient resources have at least one name',
    'BR-PAT-001',
    'Patient.name.exists()',
    'error',
    ARRAY['Patient'],
    'Patient muss mindestens einen Namen haben',
    ARRAY['Fügen Sie Patient.name hinzu', 'Name ist Pflichtfeld nach deutschem Profil'],
    'data-quality'
),
(
    'Observation must have value',
    'Ensures Observation has either value or dataAbsentReason',
    'BR-OBS-001',
    'Observation.value.exists() or Observation.dataAbsentReason.exists()',
    'error',
    ARRAY['Observation'],
    'Observation muss entweder einen Wert oder dataAbsentReason haben',
    ARRAY['Fügen Sie Observation.valueQuantity hinzu', 'Oder fügen Sie dataAbsentReason hinzu'],
    'data-quality'
),
(
    'Patient identifier must be valid',
    'Ensures Patient has identifier with system and value',
    'BR-PAT-002',
    'Patient.identifier.all(system.exists() and value.exists())',
    'warning',
    ARRAY['Patient'],
    'Alle Patient-Identifikatoren müssen System und Value haben',
    ARRAY['Prüfen Sie Patient.identifier[].system', 'Prüfen Sie Patient.identifier[].value'],
    'data-quality'
),
(
    'Medication must have code',
    'Ensures Medication resource has a code',
    'BR-MED-001',
    'Medication.code.exists()',
    'error',
    ARRAY['Medication'],
    'Medication muss einen Code haben',
    ARRAY['Fügen Sie Medication.code hinzu'],
    'data-quality'
);

COMMENT ON TABLE business_rules IS 'Custom business rules for FHIR validation using FHIRPath expressions';
COMMENT ON COLUMN business_rules.expression IS 'FHIRPath expression that must evaluate to true for the rule to pass';
COMMENT ON COLUMN business_rules.resource_types IS 'Array of FHIR resource types this rule applies to';
COMMENT ON TABLE business_rule_executions IS 'Audit trail of business rule execution results';

