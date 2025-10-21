/**
 * Script to add default terminology servers to validation settings
 */

import { db } from '../server/db';
import { validationSettings } from '@shared/schema';
import { eq, desc, and, isNull } from 'drizzle-orm';

async function addTerminologyServers() {
  console.log('🔍 Fetching current validation settings...');
  
  // Get current active settings (global, no serverId)
  const result = await db
    .select()
    .from(validationSettings)
    .where(and(
      eq(validationSettings.isActive, true),
      isNull(validationSettings.serverId)
    ))
    .orderBy(desc(validationSettings.updatedAt))
    .limit(1);

  if (result.length === 0) {
    console.error('❌ No active validation settings found');
    process.exit(1);
  }

  const currentSettings = result[0];
  console.log('📦 Current settings ID:', currentSettings.id);
  
  // Create terminology servers array
  const terminologyServers = [
    {
      id: "term-hl7-tx-r4",
      name: "HL7 TX Server (R4)",
      url: "https://tx.fhir.org/r4",
      enabled: true,
      fhirVersions: ["R4"],
      status: "unknown",
      failureCount: 0,
      lastFailureTime: null,
      circuitOpen: false,
      responseTimeAvg: 0
    },
    {
      id: "term-hl7-tx-r5",
      name: "HL7 TX Server (R5)",
      url: "https://tx.fhir.org/r5",
      enabled: true,
      fhirVersions: ["R5"],
      status: "unknown",
      failureCount: 0,
      lastFailureTime: null,
      circuitOpen: false,
      responseTimeAvg: 0
    },
    {
      id: "term-csiro-ontoserver-r4",
      name: "CSIRO Ontoserver (R4)",
      url: "https://r4.ontoserver.csiro.au/fhir",
      enabled: true,
      fhirVersions: ["R4"],
      status: "unknown",
      failureCount: 0,
      lastFailureTime: null,
      circuitOpen: false,
      responseTimeAvg: 0
    },
    {
      id: "term-csiro-ontoserver-r5",
      name: "CSIRO Ontoserver (R5)",
      url: "https://r5.ontoserver.csiro.au/fhir",
      enabled: true,
      fhirVersions: ["R5"],
      status: "unknown",
      failureCount: 0,
      lastFailureTime: null,
      circuitOpen: false,
      responseTimeAvg: 0
    }
  ];

  // Update database
  await db
    .update(validationSettings)
    .set({
      terminologyServers: terminologyServers as any,
      updatedAt: new Date()
    })
    .where(eq(validationSettings.id, currentSettings.id));

  console.log('✅ Successfully added 4 terminology servers!');
  console.log(`📊 Total servers: ${terminologyServers.length}`);
  console.log('\n🌐 Servers added:');
  terminologyServers.forEach((server: any, i: number) => {
    console.log(`  ${i + 1}. ${server.name}: ${server.url}`);
  });

  process.exit(0);
}

addTerminologyServers().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});

