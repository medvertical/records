// ============================================================================
// Modern Dashboard Component - Wireframe-Based Design
// ============================================================================

import React from 'react';
import { ModernDashboardLayout } from '@/components/dashboard/layout/ModernDashboardLayout';

/**
 * Modern Dashboard Component - Single responsibility: Main dashboard page with modern design
 * Follows global rules: Under 100 lines, single responsibility, uses wireframe-based layout
 * Implements modern UI components with clean design and no emojis
 */
export default function Dashboard() {
  return (
    <div className="min-h-screen bg-background">
      <ModernDashboardLayout />
    </div>
  );
}