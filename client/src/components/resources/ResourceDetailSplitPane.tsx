import { useState, useCallback, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { GripVertical } from 'lucide-react';
import ResourceTreeViewer from './resource-tree-viewer';
import { ValidationMessageList, type ValidationMessage } from '@/components/validation/ValidationMessageList';
import { cn } from '@/lib/utils';

// ============================================================================
// Types
// ============================================================================

export interface ResourceDetailSplitPaneProps {
  resource: any;
  messages: ValidationMessage[];
  aspect: string;
  onMessageClick?: (message: ValidationMessage) => void;
  onSignatureClick?: (signature: string) => void;
  onPathClick?: (path: string) => void;
  highlightedPath?: string;
  selectedMessageId?: string;
  className?: string;
}

// ============================================================================
// Path Mapping Utilities
// ============================================================================

/**
 * Map validation message canonical path to tree node path
 * Converts FHIR path format to tree traversal format
 */
function mapCanonicalPathToTreePath(canonicalPath: string): string {
  // Convert "Patient.name.given" to "name.given"
  // Remove resource type prefix if present
  const parts = canonicalPath.split('.');
  if (parts.length > 0 && /^[A-Z]/.test(parts[0])) {
    parts.shift(); // Remove resource type
  }
  return parts.join('.');
}

/**
 * Generate tree node ID from path
 */
function generateNodeId(path: string): string {
  return `node-${path.replace(/\./g, '-')}`;
}

// ============================================================================
// Main Component
// ============================================================================

export function ResourceDetailSplitPane({
  resource,
  messages,
  aspect,
  onMessageClick,
  onSignatureClick,
  onPathClick,
  highlightedPath,
  selectedMessageId,
  className,
}: ResourceDetailSplitPaneProps) {
  const [selectedPath, setSelectedPath] = useState<string | undefined>(highlightedPath);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  // Convert validation messages to legacy format for tree viewer
  const validationIssues = useMemo(() => {
    return messages.map((msg, idx) => ({
      id: msg.id || `${msg.signature}-${idx}`,
      code: msg.code,
      message: msg.text,
      category: aspect,
      severity: msg.severity,
      path: msg.canonicalPath,
      location: [msg.canonicalPath],
    }));
  }, [messages, aspect]);

  // Handle tree node click - find and scroll to corresponding message
  const handleTreeNodeClick = useCallback((path: string) => {
    setSelectedPath(path);
    
    // Find message with matching path
    const matchingMessage = messages.find(msg => {
      const treePath = mapCanonicalPathToTreePath(msg.canonicalPath);
      return treePath === path || msg.canonicalPath === path;
    });

    if (matchingMessage) {
      // Scroll to message
      const messageElement = document.getElementById(`message-${matchingMessage.signature}`);
      messageElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      
      // Trigger message click callback
      onMessageClick?.(matchingMessage);
    }
  }, [messages, onMessageClick]);

  // Handle message click - expand and highlight tree node
  const handleMessageClickInternal = useCallback((message: ValidationMessage) => {
    const treePath = mapCanonicalPathToTreePath(message.canonicalPath);
    setSelectedPath(treePath);
    
    // Expand all parent paths
    const parts = treePath.split('.');
    const pathsToExpand = new Set(expandedPaths);
    let currentPath = '';
    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}.${part}` : part;
      pathsToExpand.add(currentPath);
    }
    setExpandedPaths(pathsToExpand);

    // Scroll tree node into view
    const nodeId = generateNodeId(treePath);
    const nodeElement = document.getElementById(nodeId);
    nodeElement?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Call parent callback
    onMessageClick?.(message);
  }, [expandedPaths, onMessageClick]);

  // Handle path click - highlight in tree and messages
  const handlePathClickInternal = useCallback((path: string) => {
    const treePath = mapCanonicalPathToTreePath(path);
    setSelectedPath(treePath);
    onPathClick?.(path);
  }, [onPathClick]);

  return (
    <div className={cn('h-full border rounded-lg overflow-hidden bg-white', className)}>
      <PanelGroup direction="horizontal">
        {/* Left Panel: Resource Tree */}
        <Panel 
          defaultSize={66.67} 
          minSize={30}
          className="relative"
        >
          <div className="h-full overflow-auto p-4">
            <div className="sticky top-0 bg-white pb-3 border-b mb-4 z-10">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider">
                Resource Structure
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Click nodes to see validation messages
              </p>
            </div>
            
            <ResourceTreeViewer
              resourceData={resource}
              validationResults={validationIssues}
              selectedPath={selectedPath}
              onSeverityChange={(_severity, path) => {
                if (path) handleTreeNodeClick(path);
              }}
              expandAll={false}
            />
          </div>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-2 hover:bg-blue-100 transition-colors relative group">
          <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 bg-gray-200 group-hover:bg-blue-400 transition-colors" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white border rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="h-4 w-4 text-gray-400" />
          </div>
        </PanelResizeHandle>

        {/* Right Panel: Validation Messages */}
        <Panel 
          defaultSize={33.33} 
          minSize={30}
          className="relative"
        >
          <div className="h-full overflow-auto p-4">
            <div className="sticky top-0 bg-white pb-3 border-b mb-4 z-10">
              <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wider">
                {aspect} Validation Messages
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                Click messages to highlight in tree
              </p>
            </div>

            <ValidationMessageList
              messages={messages}
              aspect={aspect}
              onMessageClick={handleMessageClickInternal}
              onSignatureClick={onSignatureClick}
              onPathClick={handlePathClickInternal}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
