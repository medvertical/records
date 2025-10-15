#!/usr/bin/env node
/**
 * Test HAPI validator directly to verify it works
 */

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

const javaPath = '/opt/homebrew/opt/openjdk@17/bin/java';
const jarPath = './server/lib/validator_cli.jar';

const testResource = {
  resourceType: "Patient",
  id: "test",
  meta: {
    profile: ["http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient"]
  },
  name: [{family: "Test"}]
};

const tempFile = '/tmp/test-patient.json';
writeFileSync(tempFile, JSON.stringify(testResource, null, 2));

const args = [
  '-jar', jarPath,
  tempFile,
  '-version', '4.0',
  '-output', 'json',
  '-locale', 'en',
  '-profile', 'http://hl7.org/fhir/us/core/StructureDefinition/us-core-patient'
];

console.log(`Running: ${javaPath} ${args.join(' ')}`);

const child = spawn(javaPath, args, {
  env: process.env,
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log(`\nProcess exited with code: ${code}`);
  process.exit(code || 0);
});

