#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Define the correct import paths for each directory
const importMappings = {
  // Files in core/ directory
  'server/services/validation/core/': {
    'validation-settings-service': '../settings/validation-settings-service',
    'validation-engine-core': '../engine/validation-engine-core',
    'validation-pipeline': '../core/validation-pipeline',
    'validation-pipeline-new': '../core/validation-pipeline-new',
    'rock-solid-validation-engine': '../core/rock-solid-validation-engine'
  },
  
  // Files in features/ directory
  'server/services/validation/features/': {
    'validation-queue-service': '../performance/validation-queue-service',
    'validation-pipeline': '../core/validation-pipeline',
    'validation-performance-service': '../performance/validation-performance-service',
    'validation-state-service': '../features/validation-state-service'
  },
  
  // Files in performance/ directory
  'server/services/validation/performance/': {
    'validation-pipeline': '../core/validation-pipeline',
    'validation-state-service': '../features/validation-state-service'
  },
  
  // Files in quality/ directory
  'server/services/validation/quality/': {
    'validation-settings-service': '../settings/validation-settings-service'
  },
  
  // Files in settings/ directory
  'server/services/validation/settings/': {
    'validation-settings-service': '../settings/validation-settings-service'
  }
};

// Function to fix imports in a file
function fixImportsInFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let modified = false;
  
  // Find the directory this file is in
  const dirPath = path.dirname(filePath) + '/';
  
  // Check if we have mappings for this directory
  const mappings = Object.entries(importMappings).find(([dir]) => filePath.startsWith(dir));
  if (!mappings) return false;
  
  const [, dirMappings] = mappings;
  
  // Fix each import
  for (const [oldImport, newImport] of Object.entries(dirMappings)) {
    const oldPattern = new RegExp(`from ['"]\\./${oldImport}(['"]|\\.[jt]s['"])`, 'g');
    const newPattern = `from '${newImport}$1`;
    
    if (oldPattern.test(content)) {
      const newContent = content.replace(oldPattern, newPattern);
      fs.writeFileSync(filePath, newContent);
      console.log(`Fixed import in ${filePath}: ${oldImport} -> ${newImport}`);
      modified = true;
    }
  }
  
  return modified;
}

// Find all TypeScript files in the validation services directory
function findTsFiles(dir) {
  const files = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...findTsFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  
  return files;
}

// Main execution
const validationDir = 'server/services/validation';
const tsFiles = findTsFiles(validationDir);

console.log(`Found ${tsFiles.length} TypeScript files to check...`);

let fixedCount = 0;
for (const file of tsFiles) {
  if (fixImportsInFile(file)) {
    fixedCount++;
  }
}

console.log(`Fixed imports in ${fixedCount} files.`);
