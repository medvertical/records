# FHIR Resource Validation Dashboard

## Overview

This application is a FHIR (Fast Healthcare Interoperability Resources) resource validation dashboard built with Express.js, React, and PostgreSQL. It provides functionality to connect to FHIR servers, browse and validate healthcare resources, and manage validation profiles with a comprehensive dashboard interface.

## System Architecture

### Full-Stack Architecture
- **Frontend**: React with TypeScript, using Vite for development and building
- **Backend**: Express.js server with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Styling**: TailwindCSS with shadcn/ui components
- **State Management**: TanStack Query (React Query) for server state
- **Routing**: Wouter for client-side routing

### Deployment Strategy
- Configured for Replit deployment with autoscale target
- Development server runs on port 5000
- Production builds serve static files from Express server

## Key Components

### Backend Services
- **FHIR Client Service**: Handles communication with external FHIR servers, including connection testing, resource fetching, and validation
- **Validation Engine**: Processes FHIR resources against validation profiles and generates validation reports
- **Storage Layer**: Database abstraction layer using Drizzle ORM for data persistence

### Frontend Architecture
- **Component-based**: Modular React components using shadcn/ui design system
- **Hook-based Data Management**: Custom hooks for FHIR data fetching and management
- **Responsive Design**: Mobile-first approach with TailwindCSS

### Database Schema
- **FHIR Servers**: Store connection details for multiple FHIR endpoints
- **FHIR Resources**: Cache FHIR resources locally with metadata
- **Validation Profiles**: Store validation rules and profile definitions
- **Validation Results**: Track validation outcomes and error details
- **Dashboard Cards**: Configurable dashboard widgets

## Data Flow

1. **FHIR Server Connection**: Application connects to external FHIR servers through the FHIR Client service
2. **Resource Fetching**: Resources are fetched from FHIR servers and cached locally in PostgreSQL
3. **Validation Processing**: Resources are validated against configured profiles using the Validation Engine
4. **Dashboard Presentation**: Validation results and resource statistics are displayed through configurable dashboard cards
5. **User Interaction**: Users can browse resources, view validation details, and manage server connections

## External Dependencies

### Core Dependencies
- **@neondatabase/serverless**: PostgreSQL connection for Neon database
- **drizzle-orm**: Type-safe ORM for database operations
- **axios**: HTTP client for FHIR server communication
- **@tanstack/react-query**: Server state management and caching

### UI Dependencies
- **@radix-ui/***: Accessible UI primitives for form controls and overlays
- **tailwindcss**: Utility-first CSS framework
- **class-variance-authority**: Type-safe variant API for component styling
- **wouter**: Lightweight client-side routing

### Development Dependencies
- **vite**: Fast development server and build tool
- **tsx**: TypeScript execution for Node.js
- **esbuild**: Fast JavaScript bundler for production builds

## Deployment Strategy

### Development Environment
- Uses Vite dev server for hot module replacement
- Express server serves API endpoints on `/api/*`
- Automatic database schema synchronization with `drizzle-kit push`

### Production Environment
- Vite builds optimized static assets to `dist/public`
- Express server bundles with esbuild for efficient Node.js execution
- Serves static files and API endpoints from single server instance
- Configured for Replit's autoscale deployment platform

### Database Configuration
- PostgreSQL database configured through `DATABASE_URL` environment variable
- Schema migrations managed through Drizzle Kit
- Connection pooling handled by Neon serverless driver

## Changelog

Changelog:
- July 4, 2025 (Evening). Fixed header to always display "Records" app name instead of dynamic view names, consolidated validation results display to eliminate duplication, restored validation functionality with revalidate button
- July 4, 2025 (Evening). Fixed resource detail API to handle FHIR resource IDs, implemented working sidebar toggle functionality, dynamic page titles now working correctly, resource validation results display operational
- July 4, 2025 (Evening). Moved validation settings to main Settings page, added FHIR server package scanning, implemented automatic resource validation, and removed manual validate buttons for improved UX
- July 4, 2025. Enhanced validation engine with automatic profile detection, profile fetching from FHIR server/Simplifier.net, and configurable validation settings
- June 24, 2025. Initial setup

## User Preferences

Preferred communication style: Simple, everyday language.
App branding: Header should always show "Records" as the app name, not dynamic view names.