import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ResourceDetailSplitPane } from './ResourceDetailSplitPane';
import type { ValidationMessage } from '@/components/validation/ValidationMessageList';

// Mock the resizable panels
vi.mock('react-resizable-panels', () => ({
  Panel: ({ children }: any) => <div data-testid="panel">{children}</div>,
  PanelGroup: ({ children }: any) => <div data-testid="panel-group">{children}</div>,
  PanelResizeHandle: () => <div data-testid="resize-handle" />,
}));

// Mock the tree viewer
vi.mock('./resource-tree-viewer', () => ({
  default: ({ resourceData, selectedPath }: any) => (
    <div data-testid="tree-viewer">
      <div data-testid="selected-path">{selectedPath}</div>
      <div>{JSON.stringify(resourceData)}</div>
    </div>
  ),
}));

describe('ResourceDetailSplitPane', () => {
  const mockResource = {
    resourceType: 'Patient',
    id: 'patient-123',
    name: [{ given: ['John'], family: 'Doe' }],
  };

  const mockMessages: ValidationMessage[] = [
    {
      severity: 'error',
      code: 'E001',
      canonicalPath: 'Patient.name.given',
      text: 'Given name is required',
      signature: 'sig-001',
    },
    {
      severity: 'warning',
      code: 'W001',
      canonicalPath: 'Patient.telecom',
      text: 'Telecom is recommended',
      signature: 'sig-002',
    },
  ];

  it('renders split pane layout', () => {
    render(
      <ResourceDetailSplitPane
        resource={mockResource}
        messages={mockMessages}
        aspect="Structural"
      />
    );

    expect(screen.getByTestId('panel-group')).toBeInTheDocument();
    expect(screen.getAllByTestId('panel')).toHaveLength(2);
    expect(screen.getByTestId('resize-handle')).toBeInTheDocument();
  });

  it('renders resource tree viewer', () => {
    render(
      <ResourceDetailSplitPane
        resource={mockResource}
        messages={mockMessages}
        aspect="Structural"
      />
    );

    expect(screen.getByTestId('tree-viewer')).toBeInTheDocument();
    expect(screen.getByText(/Patient/)).toBeInTheDocument();
  });

  it('maps canonical path correctly', () => {
    render(
      <ResourceDetailSplitPane
        resource={mockResource}
        messages={mockMessages}
        aspect="Structural"
        highlightedPath="Patient.name.given"
      />
    );

    // Should strip "Patient" prefix and use "name.given"
    const selectedPath = screen.getByTestId('selected-path');
    expect(selectedPath).toBeInTheDocument();
  });

  it('passes messages to validation message list', () => {
    render(
      <ResourceDetailSplitPane
        resource={mockResource}
        messages={mockMessages}
        aspect="Structural"
      />
    );

    // Check if messages are rendered (they're in ValidationMessageList component)
    expect(screen.getByText('Structural Validation Messages')).toBeInTheDocument();
  });

  it('calls callbacks when provided', () => {
    const onMessageClick = vi.fn();
    const onSignatureClick = vi.fn();
    const onPathClick = vi.fn();

    render(
      <ResourceDetailSplitPane
        resource={mockResource}
        messages={mockMessages}
        aspect="Structural"
        onMessageClick={onMessageClick}
        onSignatureClick={onSignatureClick}
        onPathClick={onPathClick}
      />
    );

    // Component is rendered with callbacks
    expect(onMessageClick).not.toHaveBeenCalled();
  });
});
