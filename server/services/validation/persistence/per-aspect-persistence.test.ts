import { describe, it, expect } from 'vitest';
import { computeSettingsSnapshotHash, computeMessageSignature } from './per-aspect-persistence';

describe('per-aspect-persistence utils', () => {
  it('computeSettingsSnapshotHash: deterministic for same input regardless of key order', () => {
    const snapshotA = {
      aspects: {
        structural: { enabled: true },
        profile: { enabled: true },
        terminology: { enabled: false },
        reference: { enabled: true },
        businessRule: { enabled: true },
        metadata: { enabled: true },
      },
    } as any;

    const snapshotB = {
      aspects: {
        profile: { enabled: true },
        structural: { enabled: true },
        reference: { enabled: true },
        businessRule: { enabled: true },
        metadata: { enabled: true },
        terminology: { enabled: false },
      },
    } as any;

    const h1 = computeSettingsSnapshotHash(snapshotA);
    const h2 = computeSettingsSnapshotHash(snapshotB);
    expect(h1).toBe(h2);
  });

  it('computeMessageSignature: stable under whitespace/text normalization', () => {
    const a = computeMessageSignature({
      aspect: 'structural',
      severity: 'error',
      code: 'required',
      canonicalPath: 'patient.name',
      ruleId: undefined,
      normalizedText: 'patient.name: minimum required = 1, but only found 0',
    } as any);

    const b = computeMessageSignature({
      aspect: 'STRUCTURAL' as any,
      severity: 'ERROR' as any,
      code: 'required',
      canonicalPath: 'patient.name',
      ruleId: undefined,
      normalizedText: 'Patient.name:   minimum   required = 1,  but only    found 0',
    } as any);

    expect(a).toBe(b);
  });
});


