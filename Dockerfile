# Multi-stage Dockerfile for Records FHIR Validation Platform
# Includes Java Runtime for HAPI FHIR Validator CLI

# Stage 1: Build stage
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Build frontend
RUN npm run build

# Stage 2: Runtime stage
FROM node:18-alpine AS runtime

# Install Java Runtime for HAPI FHIR Validator
RUN apk add --no-cache openjdk11-jre

# Verify Java installation
RUN java -version

WORKDIR /app

# Copy node_modules from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/package.json ./

# Create directory for HAPI validator
RUN mkdir -p /app/server/lib

# Note: validator_cli.jar must be downloaded separately due to size
# See server/lib/README.md for download instructions
# Or download during container build:
# RUN wget -O /app/server/lib/validator_cli.jar \
#     https://github.com/hapifhir/org.hl7.fhir.core/releases/download/6.3.23/validator_cli.jar

# Create cache directories
RUN mkdir -p /app/server/storage/igs
RUN mkdir -p /app/server/storage/terminology

# Set environment variables
ENV NODE_ENV=production
ENV HAPI_JAR_PATH=/app/server/lib/validator_cli.jar
ENV HAPI_IG_CACHE_PATH=/app/server/storage/igs
ENV HAPI_TERMINOLOGY_CACHE_PATH=/app/server/storage/terminology

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:5000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["npm", "start"]

