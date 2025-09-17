# Records FHIR Validation Platform

A comprehensive FHIR (Fast Healthcare Interoperability Resources) validation and management platform designed for healthcare organizations, FHIR server administrators, and healthcare IT professionals.

## Features

- **Comprehensive FHIR Validation**: Complete validation coverage for all 146+ FHIR resource types across R4 and R5 specifications
- **Enterprise Scale Performance**: Handle 800K+ resources efficiently with sub-second dashboard loading
- **Real-time Monitoring**: Live validation progress tracking with Server-Sent Events (SSE)
- **Multi-Server Management**: Support connection to and validation across multiple FHIR servers
- **Advanced Validation Engine**: 6-aspect validation (Structural, Profile, Terminology, Reference, Business Rules, Metadata)
- **Modern UI/UX**: Intuitive dashboard with responsive design

## Technology Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time Communication**: Server-Sent Events (SSE)
- **State Management**: TanStack Query, React hooks
- **Build Tools**: Vite, esbuild
- **Type Safety**: Comprehensive TypeScript with runtime validation
- **Error Handling**: Advanced error categorization and recovery
- **Caching**: Intelligent LRU caching with TTL and tag-based invalidation
- **Logging**: Structured logging with contextual information

## Real-time Communication: Server-Sent Events (SSE)

The platform uses Server-Sent Events (SSE) for real-time validation updates instead of WebSockets. This provides better reliability and compatibility, especially in serverless environments.

### SSE Implementation

- **Endpoint**: `/api/validation/stream`
- **Protocol**: HTTP/1.1 with `text/event-stream` content type
- **Reconnection**: Automatic with exponential backoff
- **Fallback**: API polling when SSE is unavailable

### Benefits of SSE over WebSocket

- ✅ Better browser compatibility
- ✅ Automatic reconnection handling
- ✅ Works through firewalls and proxies
- ✅ More reliable in serverless environments (Vercel)
- ✅ Simpler implementation and debugging
- ✅ Built-in error handling

### Usage Example

```javascript
// Connect to SSE stream
const eventSource = new EventSource('/api/validation/stream');

eventSource.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'validation-progress':
      updateProgressBar(message.data);
      break;
    case 'validation-completed':
      showCompletionMessage();
      eventSource.close();
      break;
  }
};

eventSource.onerror = (error) => {
  console.error('SSE connection error:', error);
  // Automatic reconnection will be attempted
};
```

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL (for production)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd records
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

4. Set up the database:
```bash
npm run db:push
```

### Development

Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

### Production Build

Build for production:
```bash
npm run build
```

Start the production server:
```bash
npm start
```

## API Documentation

For detailed API documentation, see [API_DOCUMENTATION.md](./API_DOCUMENTATION.md).

### Key Endpoints

- `GET /api/validation/stream` - SSE endpoint for real-time updates
- `GET /api/validation/bulk/progress` - Get validation progress
- `POST /api/validation/start` - Start validation process
- `POST /api/validation/stop` - Stop validation process
- `GET /api/dashboard/combined` - Get dashboard data

## Architecture

### Frontend Architecture

- **Components**: Modular React components with TypeScript
- **Hooks**: Custom hooks for data fetching and SSE management
- **State Management**: TanStack Query for server state, React hooks for local state
- **Routing**: Wouter for client-side routing
- **Styling**: Tailwind CSS with shadcn/ui components
- **Type Safety**: Runtime type validation with Zod schemas
- **Error Handling**: Comprehensive error boundaries and fallback UI

### Backend Architecture

- **Server**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Services**: Modular service architecture for validation, FHIR client, and storage
- **Real-time**: Server-Sent Events for live updates
- **API**: RESTful API with comprehensive error handling
- **Type Safety**: Complete type definitions with runtime validation
- **Error Handling**: Categorized error handling with recovery strategies
- **Caching**: Multi-layer caching with intelligent invalidation
- **Logging**: Structured logging with contextual information

### SSE Architecture

```
Client (Browser)          Server (Express.js)
     |                           |
     |---> GET /api/validation/stream
     |<--- 200 OK (text/event-stream)
     |                           |
     |<--- data: {"type": "connected"}
     |                           |
     |<--- data: {"type": "validation-progress", "data": {...}}
     |                           |
     |<--- data: {"type": "validation-completed"}
     |                           |
     |---> Connection closed
```

## Configuration

### Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/records

# FHIR Server
FHIR_SERVER_URL=http://hapi.fhir.org/baseR4

# Server
PORT=3000
NODE_ENV=production
```

### Validation Settings

The platform supports comprehensive validation configuration:

- **Structural Validation**: JSON schema and FHIR structure compliance
- **Profile Validation**: Conformance to specific FHIR profiles
- **Terminology Validation**: Code system and value set validation
- **Reference Validation**: Resource reference integrity checking
- **Business Rule Validation**: Cross-field logic and business constraints
- **Metadata Validation**: Version, timestamp, and metadata compliance

## Deployment

### Vercel Deployment

The platform is optimized for Vercel deployment:

1. Connect your repository to Vercel
2. Configure environment variables in Vercel dashboard
3. Deploy automatically on push to main branch

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

## Monitoring and Logging

- **SSE Connection Monitoring**: Automatic reconnection and error handling
- **Validation Progress Tracking**: Real-time progress updates
- **Error Logging**: Comprehensive error tracking and reporting
- **Performance Metrics**: Dashboard performance monitoring
- **Structured Logging**: Contextual logging with service identification
- **Error Categorization**: 12 error categories with specific handling
- **Recovery Strategies**: Automatic error recovery with fallback mechanisms
- **Cache Monitoring**: Cache hit rates and performance metrics

## Troubleshooting

### SSE Connection Issues

1. **Connection Fails**: Check if the server is running and accessible
2. **Messages Not Received**: Verify the endpoint URL and headers
3. **Reconnection Issues**: Check network connectivity and server status

### Common Issues

- **Build Errors**: Ensure all dependencies are installed with `npm install`
- **Database Connection**: Verify DATABASE_URL is correctly configured
- **FHIR Server Access**: Check FHIR_SERVER_URL and network connectivity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Check the API documentation
- Review the troubleshooting guide

## Changelog

### Recent Changes

- **Migration to SSE**: Replaced WebSocket with Server-Sent Events for better reliability
- **Enhanced Validation**: Improved validation engine with 6-aspect validation
- **Performance Optimization**: Added intelligent caching and batch processing
- **UI Improvements**: Modern React components with responsive design
- **Type Safety**: Comprehensive TypeScript with runtime validation using Zod
- **Error Handling**: Advanced error categorization with 12 error types and recovery strategies
- **Code Organization**: Reorganized services with better separation of concerns
- **Logging System**: Structured logging with contextual information and service identification
- **Database Optimization**: Query optimization with intelligent caching and performance monitoring
- **Service Architecture**: Complete service interface contracts with type safety

For detailed release notes, see [RELEASE_NOTES_BETA.md](./RELEASE_NOTES_BETA.md).
