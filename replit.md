# FHIR Resource Validation Dashboard

## Overview
This application is a FHIR (Fast Healthcare Interoperability Resources) resource validation dashboard. It enables connection to FHIR servers, browsing and validation of healthcare resources, and management of validation profiles. The project aims to provide comprehensive FHIR server validation with complete resource coverage and an optimal user experience, including enterprise-scale validation.

## User Preferences
Preferred communication style: Simple, everyday language in English.
Interface language: English (not German).
App branding: Header should always show "Records" as the app name, not dynamic view names.
Card design: Never use shadow hover effects on cards - no hover:shadow, shadow-, or transition-shadow classes on Card components.
Icon animations: No icon rotation animation - no animate-spin classes on icons.
Server management: Always sort servers alphabetically by name in the server connection modal.

## System Architecture
### Full-Stack Architecture
- **Frontend**: React with TypeScript, using Vite for development and building. Styling with TailwindCSS and shadcn/ui components. State management via TanStack Query and client-side routing with Wouter.
- **Backend**: Express.js server with TypeScript.
- **Database**: PostgreSQL with Drizzle ORM.

### Technical Implementations
- **FHIR Client Service**: Manages communication with external FHIR servers for connection testing, resource fetching, and validation, including dynamic resource type discovery based on FHIR version.
- **Validation Engine**: Processes FHIR resources against validation profiles, generates reports, and implements comprehensive 6-aspect FHIR validation (Structural, Profile Conformance, Terminology, Reference Consistency, Cross-field Logic, Version/Metadata). It uses a Unified Validation Service with timestamp-based invalidation for intelligent re-validation and supports profile resolution during validation from external sources.
- **Storage Layer**: Drizzle ORM for data persistence of FHIR server details, cached resources, validation profiles, results, and dashboard configurations.
- **Frontend Architecture**: Modular React components, custom hooks for data management, and responsive design.
- **Deployment Strategy**: Configured for Replit deployment, serving static files from an Express server in production.

### UI/UX Decisions
- Clean design without shadow hover effects or icon rotation.
- Optimized resource detail view layout with prominent validation score display, direct tree structure access, and dedicated validation messages section.
- Comprehensive filtering system for validation messages by category and severity.
- Human-readable validation messages toggle for non-technical users.
- Dynamic validation badge counting that adapts to tree expansion state.
- Resource tree with a clear two-column layout for readability.

## External Dependencies
- **@neondatabase/serverless**: PostgreSQL connection for Neon database.
- **drizzle-orm**: Type-safe ORM for database operations.
- **axios**: HTTP client for FHIR server communication.
- **@tanstack/react-query**: Server state management and caching.
- **@radix-ui/*** Accessible UI primitives.
- **tailwindcss**: Utility-first CSS framework.
- **class-variance-authority**: Type-safe variant API for component styling.
- **wouter**: Lightweight client-side routing.
- **vite**: Development server and build tool.
- **tsx**: TypeScript execution for Node.js.
- **esbuild**: Fast JavaScript bundler.
- **FHIR Package Registry (packages.fhir.org)**: For authentic FHIR package discovery.
- **Simplifier.net**: For profile resolution and package discovery.