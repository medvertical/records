/**
 * Handler factory functions for resource detail page
 * These create handler functions with necessary dependencies injected
 */

/**
 * Create a path click handler
 * Handles clicks on validation message paths, expanding the resource tree and highlighting the path
 */
export function createPathClickHandler(
  resource: any,
  getExpandedPaths: (resourceId: string) => Set<string>,
  setExpandedPaths: (resourceId: string, paths: Set<string>) => void,
  setHighlightedPath: (path: string | undefined) => void
) {
  return (path: string) => {
    console.log('[ResourceDetail] Path clicked:', path);
    if (!resource?.resourceId) return;
    
    // Remove resource type prefix if present (e.g., "patient.status" -> "status" or "Patient.status" -> "status")
    const parts = path.split('.');
    // Check if first part is a resource type (starts with letter, case-insensitive)
    const treePath = parts.length > 0 && /^[a-zA-Z]/.test(parts[0]) && resource?.resourceType?.toLowerCase() === parts[0].toLowerCase()
      ? parts.slice(1).join('.')
      : path;
    console.log('[ResourceDetail] Converted to tree path:', treePath);
    
    // Generate all parent paths that need to be expanded
    // For a path like "identifier.[0].assigner.identifier.system", we need to expand:
    // - resourceType (root)
    // - resourceType.identifier
    // - resourceType.identifier.[0]
    // - resourceType.identifier.[0].assigner
    // - resourceType.identifier.[0].assigner.identifier
    const pathsToExpand = new Set<string>();
    const resourceType = resource.resourceType || 'Resource';
    
    // Always expand the root
    pathsToExpand.add(resourceType);
    
    if (treePath) {
      const segments = treePath.split('.');
      let currentPath = resourceType;
      
      for (let i = 0; i < segments.length; i++) {
        currentPath += '.' + segments[i];
        pathsToExpand.add(currentPath);
      }
    }
    
    // Merge with existing expanded paths
    const currentExpandedPaths = getExpandedPaths(resource.resourceId);
    const newExpandedPaths = new Set([...currentExpandedPaths, ...pathsToExpand]);
    
    console.log('[ResourceDetail] Expanding paths:', Array.from(pathsToExpand));
    setExpandedPaths(resource.resourceId, newExpandedPaths);
    
    // Set highlighted path after a small delay to allow expansion to happen first
    setTimeout(() => {
      setHighlightedPath(treePath);
      // Clear the highlight after enough time to see it
      setTimeout(() => {
        console.log('[ResourceDetail] Clearing highlighted path');
        setHighlightedPath(undefined);
      }, 3500);
    }, 100);
  };
}

/**
 * Create a severity click handler
 * Handles clicks on severity badges in the resource tree
 */
export function createSeverityClickHandler() {
  return (severity: string, path: string) => {
    console.log('[ResourceDetail] Severity clicked:', { severity, path });
    // This will be used to highlight messages based on path and severity
    // We'll pass this through ResourceViewer to the tree
    // For now, we'll trigger a custom event that ValidationMessagesPerAspect can listen to
    const event = new CustomEvent('highlight-messages', {
      detail: { severity, path }
    });
    window.dispatchEvent(event);
  };
}

