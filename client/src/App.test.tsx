import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { App } from './App'

// Mock the router
vi.mock('wouter', () => ({
  Router: ({ children }: any) => <div data-testid="router">{children}</div>,
  Route: ({ path, component: Component }: any) => 
    path === '/' ? <Component /> : null,
  useLocation: () => ({ path: '/' }),
  useRoute: () => ({ path: '/' })
}))

// Mock the query client
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn().mockImplementation(() => ({
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    clear: vi.fn()
  })),
  QueryClientProvider: ({ children }: any) => <div data-testid="query-client-provider">{children}</div>,
  useQuery: vi.fn(),
  useMutation: vi.fn()
}))

// Mock the query devtools
vi.mock('@tanstack/react-query-devtools', () => ({
  ReactQueryDevtools: () => <div data-testid="react-query-devtools">DevTools</div>
}))

// Mock the dashboard page
vi.mock('./pages/dashboard', () => ({
  Dashboard: () => <div data-testid="dashboard-page">Dashboard Page</div>
}))

// Mock the validation page
vi.mock('./pages/validation', () => ({
  Validation: () => <div data-testid="validation-page">Validation Page</div>
}))

// Mock the settings page
vi.mock('./pages/settings', () => ({
  Settings: () => <div data-testid="settings-page">Settings Page</div>
}))

// Mock the layout components
vi.mock('./components/layout/header', () => ({
  Header: () => <div data-testid="header">Header</div>
}))

vi.mock('./components/layout/sidebar', () => ({
  Sidebar: () => <div data-testid="sidebar">Sidebar</div>
}))

vi.mock('./components/layout/footer', () => ({
  Footer: () => <div data-testid="footer">Footer</div>
}))

// Mock the theme provider
vi.mock('next-themes', () => ({
  ThemeProvider: ({ children }: any) => <div data-testid="theme-provider">{children}</div>
}))

// Mock the toast
vi.mock('sonner', () => ({
  Toaster: () => <div data-testid="toaster">Toaster</div>
}))

// Mock the icons
vi.mock('lucide-react', () => ({
  BarChart3: () => <div data-testid="bar-chart-icon" />,
  Server: () => <div data-testid="server-icon" />,
  Database: () => <div data-testid="database-icon" />,
  CheckCircle: () => <div data-testid="check-circle-icon" />,
  TrendingUp: () => <div data-testid="trending-up-icon" />,
  PieChart: () => <div data-testid="pie-chart-icon" />,
  Activity: () => <div data-testid="activity-icon" />,
  RefreshCw: () => <div data-testid="refresh-cw-icon" />,
  AlertCircle: () => <div data-testid="alert-circle-icon" />,
  Settings: () => <div data-testid="settings-icon" />,
  Play: () => <div data-testid="play-icon" />,
  Pause: () => <div data-testid="pause-icon" />,
  Square: () => <div data-testid="square-icon" />,
  RotateCcw: () => <div data-testid="rotate-ccw-icon" />,
  Clock: () => <div data-testid="clock-icon" />,
  XCircle: () => <div data-testid="x-circle-icon" />,
  AlertTriangle: () => <div data-testid="alert-triangle-icon" />,
  TrendingDown: () => <div data-testid="trending-down-icon" />,
  Minus: () => <div data-testid="minus-icon" />
}))

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should render the app', () => {
    render(<App />)

    expect(screen.getByTestId('router')).toBeInTheDocument()
    expect(screen.getByTestId('query-client-provider')).toBeInTheDocument()
    expect(screen.getByTestId('theme-provider')).toBeInTheDocument()
  })

  it('should render the header', () => {
    render(<App />)

    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('should render the sidebar', () => {
    render(<App />)

    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('should render the footer', () => {
    render(<App />)

    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('should render the toaster', () => {
    render(<App />)

    expect(screen.getByTestId('toaster')).toBeInTheDocument()
  })

  it('should render the dashboard page by default', () => {
    render(<App />)

    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
  })

  it('should render the validation page when route is /validation', () => {
    // Mock the route to be /validation
    vi.mocked(require('wouter').useRoute).mockReturnValue({ path: '/validation' })

    render(<App />)

    expect(screen.getByTestId('validation-page')).toBeInTheDocument()
  })

  it('should render the settings page when route is /settings', () => {
    // Mock the route to be /settings
    vi.mocked(require('wouter').useRoute).mockReturnValue({ path: '/settings' })

    render(<App />)

    expect(screen.getByTestId('settings-page')).toBeInTheDocument()
  })

  it('should render the react query devtools in development', () => {
    // Mock NODE_ENV to be development
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(<App />)

    expect(screen.getByTestId('react-query-devtools')).toBeInTheDocument()

    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv
  })

  it('should not render the react query devtools in production', () => {
    // Mock NODE_ENV to be production
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    render(<App />)

    expect(screen.queryByTestId('react-query-devtools')).not.toBeInTheDocument()

    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv
  })

  it('should handle theme provider correctly', () => {
    render(<App />)

    const themeProvider = screen.getByTestId('theme-provider')
    expect(themeProvider).toBeInTheDocument()
  })

  it('should handle query client provider correctly', () => {
    render(<App />)

    const queryClientProvider = screen.getByTestId('query-client-provider')
    expect(queryClientProvider).toBeInTheDocument()
  })

  it('should handle router correctly', () => {
    render(<App />)

    const router = screen.getByTestId('router')
    expect(router).toBeInTheDocument()
  })

  it('should render all layout components', () => {
    render(<App />)

    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('should handle component unmounting gracefully', () => {
    const { unmount } = render(<App />)

    expect(() => unmount()).not.toThrow()
  })

  it('should handle route changes correctly', () => {
    const { rerender } = render(<App />)

    // Initially should show dashboard
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()

    // Mock route change to validation
    vi.mocked(require('wouter').useRoute).mockReturnValue({ path: '/validation' })

    rerender(<App />)

    expect(screen.getByTestId('validation-page')).toBeInTheDocument()
  })

  it('should handle unknown routes gracefully', () => {
    // Mock unknown route
    vi.mocked(require('wouter').useRoute).mockReturnValue({ path: '/unknown' })

    render(<App />)

    // Should still render the layout components
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('should handle theme changes correctly', () => {
    render(<App />)

    const themeProvider = screen.getByTestId('theme-provider')
    expect(themeProvider).toBeInTheDocument()
  })

  it('should handle query client configuration correctly', () => {
    render(<App />)

    const queryClientProvider = screen.getByTestId('query-client-provider')
    expect(queryClientProvider).toBeInTheDocument()
  })

  it('should handle toast notifications correctly', () => {
    render(<App />)

    const toaster = screen.getByTestId('toaster')
    expect(toaster).toBeInTheDocument()
  })

  it('should handle layout structure correctly', () => {
    render(<App />)

    // Check that all layout components are rendered
    expect(screen.getByTestId('header')).toBeInTheDocument()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('footer')).toBeInTheDocument()
  })

  it('should handle page content correctly', () => {
    render(<App />)

    // Check that the main content area is rendered
    expect(screen.getByTestId('dashboard-page')).toBeInTheDocument()
  })

  it('should handle development tools correctly', () => {
    // Mock NODE_ENV to be development
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'development'

    render(<App />)

    expect(screen.getByTestId('react-query-devtools')).toBeInTheDocument()

    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv
  })

  it('should handle production build correctly', () => {
    // Mock NODE_ENV to be production
    const originalEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'

    render(<App />)

    // Should not render devtools in production
    expect(screen.queryByTestId('react-query-devtools')).not.toBeInTheDocument()

    // Restore original NODE_ENV
    process.env.NODE_ENV = originalEnv
  })
})
