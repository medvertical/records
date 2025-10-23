# HAPI Validation Parity - Root Cause Analysis

## 🔴 ROOT CAUSE GEFUNDEN!

Das Problem lag **NICHT** an fehlenden CLI-Flags, sondern an der **falschen Engine-Konfiguration**!

### Problem:
Die Default-Einstellung für strukturelle Validierung verwendete `'schema'` statt `'hapi'`:

```typescript
// shared/validation-settings.ts - VORHER (FALSCH)
structural: { enabled: true, severity: 'error', engine: 'schema' },  // ❌

// NACHHER (KORRIGIERT)  
structural: { enabled: true, severity: 'error', engine: 'hapi' },    // ✅
```

### Warum das wichtig ist:

1. **Schema-Validator**: Einfacher JSON-Schema-Validator
   - Prüft nur Basis-Struktur
   - Keine Best-Practice-Checks
   - Keine FHIR-spezifischen Constraints
   - **KEIN** dom-6 (Narrative)
   - **KEINE** Informationsmeldungen

2. **HAPI-Validator**: Vollständiger FHIR-Validator
   - Alle strukturellen Constraints
   - Best-Practice-Empfehlungen
   - FHIR-Invariants (dom-6, etc.)
   - Alle Severity-Level (error, warning, information, hint)

### Lösung:

**Dateien geändert:**
1. `shared/validation-settings.ts` - Zeile 534: `engine: 'schema'` → `engine: 'hapi'`
2. `shared/validation-settings.ts` - Zeile 570: Gleiche Änderung für R5

**Zusätzliche Verbesserungen** (bereits implementiert):
- ✅ `-level hints` Flag hinzugefügt
- ✅ `-best-practice warning` Flag hinzugefügt  
- ✅ `enableBestPracticeChecks` Setting hinzugefügt
- ✅ UI-Toggle für Best-Practice-Checks
- ✅ `hint` Severity-Mapping

### Status:
- ✅ Code-Änderungen implementiert
- ✅ Server neu gestartet
- ✅ Settings automatisch aktualisiert
- ⏳ Alte Validierungsergebnisse müssen noch gelöscht werden
- ⏳ Neue Validierung muss noch ausgeführt werden

### Next Steps:
1. Alte Validierungsergebnisse aus Datenbank löschen
2. Neue Validierung mit HAPI-Engine durchführen
3. Überprüfen, ob alle 8 Meldungen erscheinen

