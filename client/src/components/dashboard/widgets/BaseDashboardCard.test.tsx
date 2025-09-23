import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { BaseDashboardCard, LoadingCard, ErrorCard } from './BaseDashboardCard'
import { Bell, Database } from 'lucide-react'

// Mock lucide-react icons
vi.mock('lucide-react', () => ({
  Bell: () => <div data-testid="bell-icon" />,
  Database: () => <div data-testid="database-icon" />
}))

describe('BaseDashboardCard', () => {
  it('should render with title and icon', () => {
    render(
      <BaseDashboardCard title="Test Card" icon={Bell}>
        <div data-testid="card-content">Test Content</div>
      </BaseDashboardCard>
    )

    expect(screen.getByText('Test Card')).toBeInTheDocument()
    expect(screen.getByTestId('bell-icon')).toBeInTheDocument()
    expect(screen.getByTestId('card-content')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <BaseDashboardCard title="Test Card" icon={Bell} className="custom-class">
        <div>Test Content</div>
      </BaseDashboardCard>
    )

    expect(container.firstChild).toHaveClass('custom-class')
  })

  it('should render children correctly', () => {
    render(
      <BaseDashboardCard title="Test Card" icon={Bell}>
        <div data-testid="child-1">Child 1</div>
        <div data-testid="child-2">Child 2</div>
      </BaseDashboardCard>
    )

    expect(screen.getByTestId('child-1')).toBeInTheDocument()
    expect(screen.getByTestId('child-2')).toBeInTheDocument()
  })
})

describe('LoadingCard', () => {
  it('should render loading state', () => {
    render(<LoadingCard title="Loading Card" icon={Database} />)

    expect(screen.getByText('Loading Card')).toBeInTheDocument()
    expect(screen.getByTestId('database-icon')).toBeInTheDocument()
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <LoadingCard title="Loading Card" icon={Database} className="loading-class" />
    )

    expect(container.firstChild).toHaveClass('loading-class')
  })
})

describe('ErrorCard', () => {
  it('should render error state', () => {
    render(<ErrorCard title="Error Card" icon={Bell} error="Test error message" />)

    expect(screen.getByText('Error Card')).toBeInTheDocument()
    expect(screen.getByTestId('bell-icon')).toBeInTheDocument()
    expect(screen.getByText('Test error message')).toBeInTheDocument()
  })

  it('should apply custom className', () => {
    const { container } = render(
      <ErrorCard 
        title="Error Card" 
        icon={Bell} 
        error="Test error" 
        className="error-class" 
      />
    )

    expect(container.firstChild).toHaveClass('error-class')
  })

  it('should display error message with destructive styling', () => {
    render(<ErrorCard title="Error Card" icon={Bell} error="Test error message" />)

    const errorMessage = screen.getByText('Test error message')
    expect(errorMessage).toBeInTheDocument()
    expect(errorMessage).toHaveClass('text-destructive')
  })
})
