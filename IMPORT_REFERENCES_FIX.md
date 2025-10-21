# Import References Fix - Deprecated Server Components

## Problem

Nach dem Löschen der veralteten Server-Komponenten (`server-list.tsx`, `terminology-servers-section.tsx`, `terminology-server-card.tsx`) gab es noch Import-Referenzen in anderen Dateien, die zu 404-Fehlern führten:

```
GET http://localhost:5175/src/components/settings/server-list.tsx?t=1761044482753 net::ERR_ABORTED 404 (Not Found)
```

## Behobene Import-Referenzen

### 1. server-connection-modal.tsx

**Vorher:**
```typescript
import { ServerList } from './server-list';

<ServerList
  servers={existingServers || []}
  isConnecting={connectingId !== null}
  isDisconnecting={disconnectingId !== null}
  isAnyOperationPending={isAnyOperationPending}
  connectingId={connectingId}
  disconnectingId={disconnectingId}
  onEditServer={handleEditServer}
  onConnectServer={handleConnectServer}
  onDisconnectServer={handleDisconnectServer}
  onDeleteServer={handleDeleteServer}
/>
```

**Nachher:**
```typescript
import { FhirServerList } from './servers';

<FhirServerList
  servers={existingServers || []}
  connectingId={connectingId}
  disconnectingId={disconnectingId}
  isAnyOperationPending={isAnyOperationPending}
  onEditServer={handleEditServer}
  onConnectServer={handleConnectServer}
  onDisconnectServer={handleDisconnectServer}
  onDeleteServer={handleDeleteServer}
/>
```

**Änderungen:**
- ✅ Import von `ServerList` → `FhirServerList`
- ✅ Import-Pfad von `./server-list` → `./servers`
- ✅ Props vereinfacht (entfernt: `isConnecting`, `isDisconnecting`)

---

### 2. server-management-tab.tsx

**Vorher:**
```typescript
import { ServerList } from './server-list';

<ServerList
  servers={existingServers || []}
  isConnecting={connectingId !== null}
  isDisconnecting={disconnectingId !== null}
  isAnyOperationPending={isAnyOperationPending}
  connectingId={connectingId}
  disconnectingId={disconnectingId}
  onEditServer={handleEditServer}
  onConnectServer={handleConnectServer}
  onDisconnectServer={handleDisconnectServer}
  onDeleteServer={handleDeleteServer}
/>
```

**Nachher:**
```typescript
import { FhirServerList } from './servers';

<FhirServerList
  servers={existingServers || []}
  connectingId={connectingId}
  disconnectingId={disconnectingId}
  isAnyOperationPending={isAnyOperationPending}
  onEditServer={handleEditServer}
  onConnectServer={handleConnectServer}
  onDisconnectServer={handleDisconnectServer}
  onDeleteServer={handleDeleteServer}
/>
```

**Änderungen:**
- ✅ Import von `ServerList` → `FhirServerList`
- ✅ Import-Pfad von `./server-list` → `./servers`
- ✅ Props vereinfacht

---

### 3. validation-settings-tab.tsx

**Vorher:**
```typescript
import { TerminologyServersSection } from './terminology-servers-section';

<TerminologyServersSection
  servers={settings.terminologyServers || DEFAULT_TERMINOLOGY_SERVERS}
  onChange={(servers: TerminologyServer[]) => {
    setSettings({
      ...settings,
      terminologyServers: servers
    });
  }}
  onSave={saveSettings}
/>
```

**Nachher:**
```typescript
import { TerminologyServerList } from './servers';

<TerminologyServerList
  servers={settings.terminologyServers || DEFAULT_TERMINOLOGY_SERVERS}
  onChange={(servers: TerminologyServer[]) => {
    setSettings({
      ...settings,
      terminologyServers: servers
    });
  }}
  onSave={saveSettings}
/>
```

**Änderungen:**
- ✅ Import von `TerminologyServersSection` → `TerminologyServerList`
- ✅ Import-Pfad von `./terminology-servers-section` → `./servers`
- ✅ Komponenten-Name angepasst

---

### 4. index.ts (Export-Datei)

**Vorher:**
```typescript
// Server management components
export { ServerList } from './server-list';
export { ServerForm } from './server-form';
```

**Nachher:**
```typescript
// Server management components
export { FhirServerList, TerminologyServerList, ServerItem } from './servers';
export { ServerForm } from './server-form';
```

**Änderungen:**
- ✅ Export von `ServerList` entfernt
- ✅ Neue Exports hinzugefügt: `FhirServerList`, `TerminologyServerList`, `ServerItem`
- ✅ Export-Pfad von `./server-list` → `./servers`

---

## Zusammenfassung

### Geänderte Dateien:
1. ✅ `client/src/components/settings/server-connection-modal.tsx`
2. ✅ `client/src/components/settings/server-management-tab.tsx`
3. ✅ `client/src/components/settings/validation-settings-tab.tsx`
4. ✅ `client/src/components/settings/index.ts`

### Gelöschte Dateien (erfolgreich migriert):
1. ✅ `client/src/components/settings/server-list.tsx`
2. ✅ `client/src/components/settings/terminology-servers-section.tsx`
3. ✅ `client/src/components/settings/terminology-server-card.tsx`

### Neue Komponenten (Ziel der Migration):
1. ✅ `client/src/components/settings/servers/ServerItem.tsx`
2. ✅ `client/src/components/settings/servers/ServerListContainer.tsx`
3. ✅ `client/src/components/settings/servers/FhirServerList.tsx`
4. ✅ `client/src/components/settings/servers/TerminologyServerList.tsx`
5. ✅ `client/src/components/settings/servers/index.ts`

## Linter-Status

```bash
✅ No linter errors found
```

Alle 4 geänderten Dateien haben erfolgreich die Linter-Prüfung bestanden.

## Props-Vereinfachung

Die neue `FhirServerList`-Komponente hat eine sauberere Prop-Struktur:

**Alt (ServerList):**
```typescript
interface ServerListProps {
  servers: FhirServer[];
  isConnecting: boolean;              // Abgeleitet aus connectingId
  isDisconnecting: boolean;           // Abgeleitet aus disconnectingId
  isAnyOperationPending: boolean;
  connectingId: number | string | null;
  disconnectingId: number | string | null;
  onEditServer: (server: FhirServer) => void;
  onConnectServer: (serverId: number | string) => void;
  onDisconnectServer: (serverId: number | string) => void;
  onDeleteServer: (serverId: number | string) => void;
}
```

**Neu (FhirServerList):**
```typescript
interface FhirServerListProps {
  servers: FhirServer[];
  connectingId: number | string | null;
  disconnectingId: number | string | null;
  isAnyOperationPending: boolean;
  onEditServer: (server: FhirServer) => void;
  onConnectServer: (serverId: number | string) => void;
  onDisconnectServer: (serverId: number | string) => void;
  onDeleteServer: (serverId: number | string) => void;
}
```

**Unterschiede:**
- ❌ Entfernt: `isConnecting` (wird intern aus `connectingId !== null` berechnet)
- ❌ Entfernt: `isDisconnecting` (wird intern aus `disconnectingId !== null` berechnet)
- ✅ Sauberere API ohne redundante Props

## Test-Schritte

Nach der Migration sollten folgende Bereiche getestet werden:

### Server Connection Modal:
- [ ] Modal öffnet sich korrekt
- [ ] Server-Liste wird angezeigt
- [ ] Add Server funktioniert
- [ ] Edit Server funktioniert
- [ ] Connect/Disconnect funktioniert
- [ ] Delete Server funktioniert

### Server Management Tab:
- [ ] Tab lädt korrekt
- [ ] Server-Liste wird angezeigt
- [ ] Alle CRUD-Operationen funktionieren

### Validation Settings Tab:
- [ ] Tab lädt korrekt
- [ ] Terminology Servers Sektion wird angezeigt
- [ ] Drag-and-drop funktioniert
- [ ] Add/Edit/Delete funktioniert
- [ ] Test Server funktioniert

### Servers Tab (ServersTab.tsx):
- [ ] Beide Listen (FHIR + Terminology) werden angezeigt
- [ ] Alle Operationen funktionieren

## Vorteile der Migration

1. **Keine 404-Fehler mehr:** Alle Import-Pfade zeigen auf existierende Dateien
2. **Sauberere API:** Weniger redundante Props
3. **Konsistente Struktur:** Alle Server-Komponenten im `/servers` Verzeichnis
4. **Wiederverwendbarkeit:** Unified `ServerItem` kann für weitere Server-Typen verwendet werden
5. **Bessere Wartbarkeit:** Zentrale Server-UI-Logik
6. **Type Safety:** Alle Komponenten mit TypeScript typisiert

## Nächste Schritte

1. ✅ Alle Import-Fehler behoben
2. ✅ Linter-Prüfung bestanden
3. ⏳ Manuelle Tests durchführen
4. ⏳ Browser-Console auf weitere Fehler prüfen
5. ⏳ Funktionalität aller Server-Listen testen

Die Migration ist technisch abgeschlossen. Die Anwendung sollte jetzt ohne 404-Fehler laufen.

