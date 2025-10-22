// Quick test script to debug profile downloading
const axios = require('axios');
const AdmZip = require('adm-zip');

async function testDownload() {
  console.log('Testing MII Profile Download...\n');
  
  const packageId = 'de.medizininformatikinitiative.kerndatensatz.person';
  const canonicalUrl = 'https://www.medizininformatik-initiative.de/fhir/core/modul-person/StructureDefinition/Patient';
  
  try {
    // Step 1: Download package
    console.log(`[1] Downloading package: ${packageId}`);
    const packageUrl = `https://packages.simplifier.net/${packageId}/-/${packageId}-2025.0.1.tgz`;
    console.log(`    URL: ${packageUrl}`);
    
    const response = await axios.get(packageUrl, {
      responseType: 'arraybuffer',
      timeout: 30000,
      headers: {
        'User-Agent': 'FHIR-Records-App/1.0'
      }
    });
    
    console.log(`    ✓ Downloaded: ${response.data.length} bytes\n`);
    
    // Step 2: Extract package
    console.log(`[2] Extracting package...`);
    const zip = new AdmZip(Buffer.from(response.data));
    const entries = zip.getEntries();
    console.log(`    Found ${entries.length} files\n`);
    
    // Step 3: Find StructureDefinitions
    console.log(`[3] Searching for StructureDefinitions...`);
    let found = 0;
    let matchingSD = null;
    
    for (const entry of entries) {
      if (entry.entryName.includes('StructureDefinition') && 
          entry.entryName.endsWith('.json') &&
          !entry.isDirectory) {
        found++;
        
        try {
          const content = entry.getData().toString('utf8');
          const sd = JSON.parse(content);
          
          if (sd.resourceType === 'StructureDefinition') {
            console.log(`    [${found}] ${entry.entryName}`);
            console.log(`        URL: ${sd.url}`);
            console.log(`        Name: ${sd.name}`);
            
            if (sd.url === canonicalUrl) {
              matchingSD = sd;
              console.log(`        ✓✓✓ MATCH! ✓✓✓`);
            }
          }
        } catch (e) {
          // Skip invalid JSON
        }
      }
    }
    
    console.log(`\n[4] Summary:`);
    console.log(`    Total StructureDefinitions found: ${found}`);
    console.log(`    Matching profile found: ${matchingSD ? 'YES' : 'NO'}`);
    
    if (matchingSD) {
      console.log(`\n[5] Profile Details:`);
      console.log(`    URL: ${matchingSD.url}`);
      console.log(`    Version: ${matchingSD.version}`);
      console.log(`    Snapshot elements: ${matchingSD.snapshot?.element?.length || 0}`);
      console.log(`    Differential elements: ${matchingSD.differential?.element?.length || 0}`);
      
      // Count slices
      const elements = matchingSD.snapshot?.element || matchingSD.differential?.element || [];
      const slices = elements.filter(e => e.sliceName);
      console.log(`    Elements with sliceName: ${slices.length}`);
      
      if (slices.length > 0) {
        console.log(`\n[6] Slices found:`);
        slices.forEach(s => {
          console.log(`    - ${s.path} : ${s.sliceName}`);
        });
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response headers:', error.response.headers);
    }
  }
}

testDownload();

