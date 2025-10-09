# Records FHIR Platform

A comprehensive FHIR validation and management platform with simplified, user-friendly validation settings.

## Overview

The Records FHIR Platform provides a streamlined interface for managing FHIR resource validation with focus on essential functionality: 6 validation aspects, performance settings, and resource type filtering.

## Key Features

### Simplified Validation Settings
- **6 Core Validation Aspects**: Structural, Profile, Terminology, Reference, Business Rules, and Metadata validation
- **Performance Controls**: Configurable concurrent validation limits and batch sizes
- **Resource Type Filtering**: FHIR version-aware resource type selection
- **Quick Access**: Header dropdown for rapid settings adjustment
- **Auto-Migration**: Automatic settings migration between FHIR versions (R4/R5)

### Validation Engine
- **Comprehensive Validation**: Multi-aspect validation with detailed reporting
- **Performance Optimized**: Configurable concurrent processing and batch operations
- **FHIR Version Support**: Full support for FHIR R4 and R5 specifications
- **Real-time Progress**: Live validation progress tracking and status updates

### Dashboard & Analytics
- **Resource Overview**: Comprehensive FHIR resource statistics and breakdowns
- **Validation Results**: Detailed validation reports with scoring and metrics
- **Server Management**: Multi-server support with individual configuration
- **Performance Monitoring**: Real-time performance metrics and optimization insights

## Quick Start

### Prerequisites
- Node.js 18+ 
- PostgreSQL 12+
- Java Runtime 11+ (for HAPI FHIR Validator)
- FHIR server access

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd records
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Setup HAPI FHIR Validator**
   ```bash
   # Automated setup (downloads validator JAR and verifies Java)
   bash scripts/setup-hapi-validator.sh
   
   # Or manual setup:
   # 1. Install Java 11+: brew install openjdk@11 (macOS)
   # 2. Download validator JAR:
   #    curl -L -o server/lib/validator_cli.jar \
   #      https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.3.23/validator_cli.jar
   ```
   
   See `server/lib/README.md` for detailed setup instructions.

4. **Configure environment**
   ```bash
   cp env.example.txt .env
   # Edit .env with your database and FHIR server settings
   ```

5. **Run database migrations**
   ```bash
   npm run migrate
   ```

6. **Start the development server**
   ```bash
   npm run dev
   ```

The application will be available at:
- **Frontend**: http://localhost:5174
- **Backend API**: http://localhost:3000

## Validation Settings

### Core Configuration

The validation settings have been simplified to focus on essential functionality:

#### Validation Aspects
- **Structural**: JSON structure and syntax validation
- **Profile**: FHIR profile conformance validation  
- **Terminology**: Code system and value set validation
- **Reference**: Resource reference integrity validation
- **Business Rules**: Custom business logic validation
- **Metadata**: Resource metadata and provenance validation

#### Performance Settings
- **Max Concurrent**: Number of simultaneous validation processes (1-20, default: 5)
- **Batch Size**: Number of resources processed per batch (10-100, default: 50)

#### Resource Type Filtering
- **Enabled/Disabled**: Toggle resource type filtering
- **Included Types**: Specific resource types to validate (empty = all)
- **Excluded Types**: Resource types to skip during validation

### Quick Access

Use the header dropdown for rapid access to validation settings:
- Toggle validation aspects on/off
- Adjust performance settings
- Configure resource type filtering
- Reset to default settings

### FHIR Version Migration

The platform automatically detects FHIR server versions and migrates settings:
- **R4 to R5**: Automatically adapts resource types and validation rules
- **Version Detection**: Real-time FHIR version detection from server capabilities
- **Migration Impact**: Clear reporting of changes during version transitions

## API Documentation

### Validation Settings API

**Base URL**: `http://localhost:3000/api/validation`

#### Get Settings
```bash
GET /api/validation/settings?serverId=1
```

#### Update Settings
```bash
PUT /api/validation/settings
Content-Type: application/json

{
  "serverId": 1,
  "aspects": {
    "structural": { "enabled": true, "severity": "error" }
  },
  "performance": {
    "maxConcurrent": 10,
    "batchSize": 100
  }
}
```

#### Reset to Defaults
```bash
POST /api/validation/settings/reset
Content-Type: application/json

{
  "serverId": 1
}
```

#### Get Resource Types by Version
```bash
GET /api/validation/resource-types/R4
GET /api/validation/resource-types/R5
```

#### Migrate Settings Between Versions
```bash
POST /api/validation/settings/migrate
Content-Type: application/json

{
  "serverId": 1,
  "fromVersion": "R4",
  "toVersion": "R5"
}
```

For complete API documentation, see [docs/api/validation-settings-api.md](docs/api/validation-settings-api.md).

## Development

### Project Structure

```
records/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── hooks/         # Custom React hooks
│   │   └── lib/           # Utility libraries
├── server/                # Node.js backend
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   └── repositories/      # Data access layer
├── shared/                # Shared types and schemas
├── migrations/            # Database migrations
└── docs/                  # Documentation
```

### Key Technologies

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Validation**: Custom FHIR validation engine
- **Testing**: Vitest, React Testing Library, Playwright

### Development Commands

```bash
# Start development server
npm run dev

# Run tests
npm test

# Run integration tests
npm run test:integration

# Run end-to-end tests
npm run test:e2e

# Build for production
npm run build

# Run database migrations
npm run migrate

# Lint code
npm run lint

# Type check
npm run type-check
```

### Testing

The platform includes comprehensive testing:

- **Unit Tests**: Component and utility function testing
- **Integration Tests**: API endpoint and service testing  
- **End-to-End Tests**: Complete user workflow testing
- **Performance Tests**: Load and stress testing

Run all tests:
```bash
npm run test:all
```

## Configuration

### Environment Variables

Key environment variables for configuration:

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/records

# FHIR Server
FHIR_SERVER_URL=http://localhost:8080/fhir
FHIR_SERVER_AUTH=Bearer your-token

# Application
NODE_ENV=development
PORT=3000
FRONTEND_PORT=5174

# Validation
VALIDATION_MAX_CONCURRENT=5
VALIDATION_BATCH_SIZE=50
```

### Database Schema

The platform uses a simplified database schema focused on essential functionality:

- **validation_settings**: Core validation configuration
- **fhir_servers**: FHIR server configurations
- **validation_results**: Validation results and metrics
- **fhir_resources**: Cached FHIR resources

## Deployment

### Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Set production environment variables**
   ```bash
   NODE_ENV=production
   DATABASE_URL=your-production-database-url
   ```

3. **Run database migrations**
   ```bash
   npm run migrate:production
   ```

4. **Start the production server**
   ```bash
   npm start
   ```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000
CMD ["npm", "start"]
```

## Migration Guide

### From Complex to Simplified Settings

The platform has been simplified from complex validation settings to focus on essential functionality:

**Removed Features:**
- Complex preset configurations
- Audit trails and versioning
- Advanced validation rules
- Real-time synchronization (SSE/WebSocket)

**Simplified Features:**
- 6 core validation aspects only
- Basic performance settings
- Simple resource type filtering
- FHIR version-aware migration

**Migration Process:**
1. Existing settings are automatically migrated to simplified format
2. Unsupported features are removed or converted to defaults
3. Resource types are validated against current FHIR version
4. Settings are reset to safe defaults if migration fails

## Troubleshooting

### Common Issues

1. **Settings not loading**
   - Check server connectivity and authentication
   - Verify database connection
   - Check API endpoint accessibility

2. **Validation not starting**
   - Verify FHIR server connectivity
   - Check validation settings configuration
   - Review server logs for errors

3. **Migration failures**
   - Verify FHIR version compatibility
   - Check resource type availability
   - Review migration logs

4. **Performance issues**
   - Adjust maxConcurrent and batchSize settings
   - Monitor server resources
   - Check network connectivity

### Debug Mode

Enable debug mode for detailed logging:

```bash
DEBUG=validation:* npm run dev
```

### Logs

Application logs are available in:
- **Development**: Console output
- **Production**: `/var/log/records/`

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

### Code Style

- Use TypeScript for all new code
- Follow existing code patterns and conventions
- Add comprehensive tests for new features
- Update documentation for API changes

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Check the troubleshooting guide
- Review the API documentation
- Open an issue on GitHub
- Contact the development team

## Changelog

### Latest Version
- Simplified validation settings interface
- FHIR version-aware migration
- Performance optimizations
- Comprehensive testing suite
- Updated documentation

For detailed release notes, see [docs/releases/](docs/releases/).

