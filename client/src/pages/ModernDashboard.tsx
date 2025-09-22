import React from 'react';
import { ModernDashboardLayout } from '@/components/dashboard/layout/ModernDashboardLayout';

/**
 * Modern Dashboard Component - Single responsibility: Main dashboard page with modern design
 * Follows global rules: Under 200 lines, single responsibility, uses existing patterns
 * Implements wireframe-based layout with modern UI components
 */
export default function ModernDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <ModernDashboardLayout />
    </div>
  );
}
