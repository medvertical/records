#!/bin/bash
# Test validation speed with cached packages

JAVA_HOME=/opt/homebrew/opt/openjdk@17
VALIDATOR_JAR="server/lib/validator_cli.jar"

# Patient resource (same as in Records)
cat > /tmp/test-patient.json <<'EOF'
{
  "resourceType": "Patient",
  "id": "mii-exa-person-patient-full",
  "meta": {
    "profile": ["https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient|2025.0.1"]
  },
  "identifier": [{
    "use": "official",
    "type": {
      "coding": [{
        "system": "http://terminology.hl7.org/CodeSystem/v2-0203",
        "code": "MR"
      }]
    },
    "system": "https://www.example.org/fhir/sid/patienten",
    "value": "42285243",
    "assigner": {
      "identifier": {
        "system": "http://fhir.de/sid/destatis/ags",
        "value": "261030000000"
      }
    }
  }],
  "name": [{
    "use": "official",
    "family": "Fürstin von Musterfrau",
    "given": ["Erika"],
    "_family": {
      "extension": [
        {"url": "http://fhir.de/StructureDefinition/humanname-namenszusatz", "valueString": "Fürstin"},
        {"url": "http://hl7.org/fhir/StructureDefinition/humanname-own-prefix", "valueString": "von"},
        {"url": "http://hl7.org/fhir/StructureDefinition/humanname-own-name", "valueString": "Musterfrau"}
      ]
    }
  }],
  "gender": "female",
  "birthDate": "1982-05-17",
  "address": [{
    "extension": [{"url": "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-precinct", "valueString": "Mitte"}],
    "use": "home",
    "type": "both",
    "line": ["Musterweg 2", "3. Etage"],
    "_line": [
      {"extension": [
        {"url": "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-streetName", "valueString": "Musterweg"},
        {"url": "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-houseNumber", "valueString": "2"}
      ]},
      {"extension": [{"url": "http://hl7.org/fhir/StructureDefinition/iso21090-ADXP-additionalLocator", "valueString": "3. Etage"}]}
    ],
    "city": "Kiel",
    "postalCode": "24105",
    "country": "DE"
  }]
}
EOF

echo "════════════════════════════════════════════════════════════════"
echo "  HAPI Validation Speed Test (with cached packages)"
echo "════════════════════════════════════════════════════════════════"
echo ""

echo "🔄 Running validation..."
"$JAVA_HOME/bin/java" -jar "$VALIDATOR_JAR" \
  /tmp/test-patient.json \
  -version 4.0 \
  -ig de.medizininformatikinitiative.kerndatensatz.person#2025.0.1 \
  -ig de.basisprofil.r4#1.5.0 \
  -ig de.medizininformatikinitiative.kerndatensatz.meta#2025.0.1 \
  -profile 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient|2025.0.1' \
  -tx https://tx.fhir.org/r4 \
  -level hints \
  -best-practice warning \
  2>&1 | tee /tmp/validation-output.log

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "📊 Validation Results:"
echo "════════════════════════════════════════════════════════════════"
echo ""

# Count issues
TOTAL_ISSUES=$(grep -c "@ Patient" /tmp/validation-output.log || echo "0")
ERRORS=$(grep -c "Error @ Patient" /tmp/validation-output.log || echo "0")
WARNINGS=$(grep -c "Warning @ Patient" /tmp/validation-output.log || echo "0")
INFO=$(grep -c "Information @ Patient" /tmp/validation-output.log || echo "0")

echo "Total Issues: $TOTAL_ISSUES"
echo "  - Errors: $ERRORS"
echo "  - Warnings: $WARNINGS"
echo "  - Information: $INFO"
echo ""

# Show timing
grep "Times:" /tmp/validation-output.log

echo ""
echo "📝 Issues found:"
grep "@ Patient" /tmp/validation-output.log | head -10

rm -f /tmp/test-patient.json /tmp/validation-output.log

