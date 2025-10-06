import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { 
  Save, 
  Download, 
  Upload, 
  Trash2, 
  RotateCcw,
  Clock,
  HardDrive,
  CheckCircle,
  AlertTriangle,
  XCircle,
  MoreHorizontal,
  Plus,
  FileText,
  Calendar,
  Tag,
  User,
  Server,
  Info
} from 'lucide-react';
import { 
  ValidationSettingsBackup,
  useValidationSettingsBackup 
} from '@/lib/validation-settings-backup';
import { cn } from '@/lib/utils';

interface ValidationSettingsBackupManagerProps {
  onRestore?: (backup: ValidationSettingsBackup) => void;
  onExport?: (backup: ValidationSettingsBackup) => void;
  onImport?: (backupData: string) => void;
  className?: string;
  showDetails?: boolean;
  compact?: boolean;
  maxDisplay?: number;
}

export const ValidationSettingsBackupManager: React.FC<ValidationSettingsBackupManagerProps> = ({
  onRestore,
  onExport,
  onImport,
  className,
  showDetails = true,
  compact = false,
  maxDisplay = 5,
}) => {
  const [selectedBackup, setSelectedBackup] = useState<ValidationSettingsBackup | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [newBackupDescription, setNewBackupDescription] = useState('');
  const [importData, setImportData] = useState('');
  const [expandedBackups, setExpandedBackups] = useState<Set<string>>(new Set());

  const {
    backups,
    loading,
    error,
    createBackup,
    restoreBackup,
    deleteBackup,
    getBackup,
    getBackups,
    getRecentBackups,
    exportBackup,
    importBackup,
    validateBackup,
    cleanupOldBackups,
    getBackupStatistics,
    clearAllBackups,
  } = useValidationSettingsBackup({
    enableAutoBackup: true,
    autoBackupInterval: 24 * 60 * 60 * 1000,
    maxBackups: 10,
    enableCompression: true,
    enableEncryption: false,
    enableValidation: true,
    enableExportImport: true,
    storageLocation: 'localStorage',
    enableVersioning: true,
    maxBackupAge: 30,
  });

  const toggleBackupExpansion = (backupId: string) => {
    setExpandedBackups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(backupId)) {
        newSet.delete(backupId);
      } else {
        newSet.add(backupId);
      }
      return newSet;
    });
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatTimestamp = (timestamp: Date): string => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(timestamp);
  };

  const getBackupStatus = (backup: ValidationSettingsBackup) => {
    const validationResult = validateBackup(backup);
    if (validationResult.success) {
      if (validationResult.warnings && validationResult.warnings.length > 0) {
        return { status: 'warning', icon: AlertTriangle, color: 'text-yellow-500' };
      }
      return { status: 'valid', icon: CheckCircle, color: 'text-green-500' };
    }
    return { status: 'invalid', icon: XCircle, color: 'text-red-500' };
  };

  const getBackupSourceIcon = (source: string) => {
    switch (source) {
      case 'manual': return <User className="h-4 w-4" />;
      case 'auto': return <Clock className="h-4 w-4" />;
      case 'import': return <Upload className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const handleCreateBackup = async () => {
    if (!selectedBackup) return;
    
    try {
      const result = await createBackup(
        selectedBackup.settings,
        newBackupDescription || undefined
      );
      
      if (result.success) {
        setShowCreateDialog(false);
        setNewBackupDescription('');
        setSelectedBackup(null);
      }
    } catch (error) {
      console.error('Error creating backup:', error);
    }
  };

  const handleRestoreBackup = async (backup: ValidationSettingsBackup) => {
    try {
      const result = await restoreBackup(backup.id);
      if (result.success && onRestore) {
        onRestore(backup);
      }
    } catch (error) {
      console.error('Error restoring backup:', error);
    }
  };

  const handleDeleteBackup = async (backup: ValidationSettingsBackup) => {
    try {
      await deleteBackup(backup.id);
    } catch (error) {
      console.error('Error deleting backup:', error);
    }
  };

  const handleExportBackup = async (backup: ValidationSettingsBackup) => {
    try {
      const exportData = await exportBackup(backup.id);
      const blob = new Blob([exportData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `validation-settings-backup-${backup.id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      if (onExport) {
        onExport(backup);
      }
    } catch (error) {
      console.error('Error exporting backup:', error);
    }
  };

  const handleImportBackup = async () => {
    try {
      const result = await importBackup(importData);
      if (result.success) {
        setShowImportDialog(false);
        setImportData('');
      }
    } catch (error) {
      console.error('Error importing backup:', error);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setImportData(content);
      };
      reader.readAsText(file);
    }
  };

  const stats = getBackupStatistics();
  const displayBackups = backups.slice(0, maxDisplay);
  const hasMoreBackups = backups.length > maxDisplay;

  if (compact) {
    return (
      <Card className={className}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center justify-between">
            <span className="flex items-center gap-2">
              <HardDrive className="h-5 w-5" />
              Backups
            </span>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {stats.totalBackups}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowCreateDialog(true)}
                className="text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Create
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Recent backups */}
          {displayBackups.map((backup, index) => {
            const status = getBackupStatus(backup);
            const StatusIcon = status.icon;
            
            return (
              <div key={backup.id} className="flex items-center gap-2 text-sm">
                <StatusIcon className={cn("h-4 w-4", status.color)} />
                <span className="flex-1">{backup.description || 'Backup'}</span>
                <span className="text-xs text-muted-foreground">
                  {formatTimestamp(backup.timestamp)}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleRestoreBackup(backup)}
                  className="text-xs"
                >
                  <RotateCcw className="h-3 w-3" />
                </Button>
              </div>
            );
          })}
          
          {hasMoreBackups && (
            <div className="text-xs text-muted-foreground">
              +{backups.length - maxDisplay} more backups
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Settings Backup Manager
          </span>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm">
              {stats.totalBackups} backups
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowCreateDialog(true)}
            >
              <Plus className="h-4 w-4 mr-1" />
              Create Backup
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowImportDialog(true)}
            >
              <Upload className="h-4 w-4 mr-1" />
              Import
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Backup statistics */}
        {showDetails && (
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Total Size:</span>
              <span className="ml-2 font-medium">{formatFileSize(stats.totalSize)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Average Size:</span>
              <span className="ml-2 font-medium">{formatFileSize(stats.averageSize)}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Oldest:</span>
              <span className="ml-2 font-medium">
                {stats.oldestBackup ? formatTimestamp(stats.oldestBackup) : 'N/A'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">Newest:</span>
              <span className="ml-2 font-medium">
                {stats.newestBackup ? formatTimestamp(stats.newestBackup) : 'N/A'}
              </span>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={cleanupOldBackups}
            className="text-xs"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Cleanup Old
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={clearAllBackups}
            className="text-xs"
          >
            <Trash2 className="h-3 w-3 mr-1" />
            Clear All
          </Button>
        </div>

        {/* Backup list */}
        <div className="space-y-3">
          {displayBackups.map((backup, index) => {
            const isExpanded = expandedBackups.has(backup.id);
            const status = getBackupStatus(backup);
            const StatusIcon = status.icon;
            
            return (
              <div
                key={backup.id}
                className="p-3 rounded border text-sm"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <StatusIcon className={cn("h-4 w-4", status.color)} />
                    <span className="font-medium">{backup.description || 'Backup'}</span>
                    <Badge variant="outline" className="text-xs">
                      {backup.metadata.source || 'unknown'}
                    </Badge>
                    {getBackupSourceIcon(backup.metadata.source || 'unknown')}
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {formatTimestamp(backup.timestamp)}
                    </span>
                    {showDetails && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleBackupExpansion(backup.id)}
                        className="text-xs"
                      >
                        {isExpanded ? 'Hide' : 'Show'} Details
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleRestoreBackup(backup)}
                      className="text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Restore
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleExportBackup(backup)}
                      className="text-xs"
                    >
                      <Download className="h-3 w-3 mr-1" />
                      Export
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteBackup(backup)}
                      className="text-xs text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {isExpanded && showDetails && (
                  <div className="space-y-2 text-xs">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <span className="font-medium">ID:</span>
                        <span className="ml-2 font-mono">{backup.id}</span>
                      </div>
                      <div>
                        <span className="font-medium">Size:</span>
                        <span className="ml-2">{formatFileSize(backup.size)}</span>
                      </div>
                      <div>
                        <span className="font-medium">Version:</span>
                        <span className="ml-2">{backup.version}</span>
                      </div>
                      <div>
                        <span className="font-medium">Checksum:</span>
                        <span className="ml-2 font-mono">{backup.checksum}</span>
                      </div>
                    </div>
                    
                    {backup.serverName && (
                      <div>
                        <span className="font-medium">Server:</span>
                        <span className="ml-2">{backup.serverName}</span>
                      </div>
                    )}
                    
                    {backup.metadata.tags && backup.metadata.tags.length > 0 && (
                      <div>
                        <span className="font-medium">Tags:</span>
                        <div className="ml-2 mt-1 flex gap-1 flex-wrap">
                          {backup.metadata.tags.map((tag, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              <Tag className="h-3 w-3 mr-1" />
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {backup.metadata.notes && (
                      <div>
                        <span className="font-medium">Notes:</span>
                        <p className="ml-2 mt-1 text-muted-foreground">{backup.metadata.notes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {hasMoreBackups && (
          <div className="text-center text-sm text-muted-foreground">
            +{backups.length - maxDisplay} more backups
          </div>
        )}

        {/* Create Backup Dialog */}
        {showCreateDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Create Backup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={newBackupDescription}
                    onChange={(e) => setNewBackupDescription(e.target.value)}
                    placeholder="Enter backup description..."
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleCreateBackup} className="flex-1">
                    <Save className="h-4 w-4 mr-1" />
                    Create Backup
                  </Button>
                  <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Import Backup Dialog */}
        {showImportDialog && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle>Import Backup</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Backup Data</label>
                  <Textarea
                    value={importData}
                    onChange={(e) => setImportData(e.target.value)}
                    placeholder="Paste backup JSON data here..."
                    className="mt-1"
                    rows={6}
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Or Upload File</label>
                  <Input
                    type="file"
                    accept=".json"
                    onChange={handleFileImport}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleImportBackup} className="flex-1">
                    <Upload className="h-4 w-4 mr-1" />
                    Import Backup
                  </Button>
                  <Button variant="outline" onClick={() => setShowImportDialog(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ValidationSettingsBackupManager;

