/**
 * Deep comparison utility for detecting actual changes in settings
 */

export function deepEqual(obj1: any, obj2: any): boolean {
  // Handle null/undefined
  if (obj1 === obj2) return true;
  if (obj1 == null || obj2 == null) return false;
  
  // Handle different types
  if (typeof obj1 !== typeof obj2) return false;
  
  // Handle primitives
  if (typeof obj1 !== 'object') return obj1 === obj2;
  
  // Handle arrays
  if (Array.isArray(obj1) && Array.isArray(obj2)) {
    if (obj1.length !== obj2.length) return false;
    return obj1.every((item, index) => deepEqual(item, obj2[index]));
  }
  
  // Handle arrays vs objects
  if (Array.isArray(obj1) !== Array.isArray(obj2)) return false;
  
  // Handle objects
  const keys1 = Object.keys(obj1);
  const keys2 = Object.keys(obj2);
  
  if (keys1.length !== keys2.length) return false;
  
  return keys1.every(key => deepEqual(obj1[key], obj2[key]));
}

