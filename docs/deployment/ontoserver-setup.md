# Ontoserver Setup Requirements

## Overview

This document describes the requirements and setup process for deploying and configuring a local Ontoserver instance for offline FHIR terminology validation in the Records FHIR Validation Platform.

---

## What is Ontoserver?

[Ontoserver](https://ontoserver.csiro.au/) is a high-performance FHIR terminology server developed by CSIRO that provides:
- Fast terminology validation (ValueSet expansion, code validation)
- Support for SNOMED CT, LOINC, ICD-10, and custom terminologies
- FHIR R4, R5, and R6 compatibility
- Offline operation for environments without internet access
- Caching and pre-expansion for optimal performance

---

## When to Use Ontoserver

### Use Cases
- **Offline Validation**: Validate FHIR resources without internet connection
- **High Performance**: Faster terminology lookups compared to remote services
- **Data Privacy**: Keep terminology lookups within your infrastructure
- **High Availability**: Reduce dependency on external services (tx.fhir.org)

### Hybrid Mode
The Records platform supports hybrid mode:
- **Online Mode**: Uses tx.fhir.org for terminology validation
- **Offline Mode**: Uses local Ontoserver instance
- **Fallback Chain**: Automatic fallback to cached ValueSets if Ontoserver unavailable

---

## System Requirements

### Hardware
| Component | Minimum | Recommended |
|-----------|---------|-------------|
| **CPU** | 2 cores | 4+ cores |
| **RAM** | 4 GB | 8 GB+ |
| **Disk** | 20 GB | 50 GB+ (with full SNOMED CT) |
| **Network** | 100 Mbps | 1 Gbps |

### Software
- **Docker**: 20.10+ (recommended for containerized deployment)
- **Java**: JRE 11+ (if running natively)
- **OS**: Linux (Ubuntu 20.04+, RHEL 8+), Windows Server 2019+, macOS

---

## Installation Methods

### Method 1: Docker (Recommended)

#### 1. Pull the Ontoserver Docker Image

```bash
docker pull aehrc/ontoserver:latest
```

#### 2. Create Data Directory

```bash
mkdir -p /var/ontoserver/data
chmod 755 /var/ontoserver/data
```

#### 3. Run Ontoserver Container

```bash
docker run -d \
  --name ontoserver \
  -p 8081:8080 \
  -v /var/ontoserver/data:/usr/local/ontoserver/data \
  -e SPRING_PROFILES_ACTIVE=default \
  -e SERVER_PORT=8080 \
  --restart unless-stopped \
  aehrc/ontoserver:latest
```

#### 4. Verify Installation

```bash
curl http://localhost:8081/fhir/metadata
```

Expected response: FHIR CapabilityStatement in JSON format.

---

### Method 2: Docker Compose (Integrated Deployment)

Add Ontoserver to your `docker-compose.yml`:

```yaml
services:
  ontoserver:
    image: aehrc/ontoserver:latest
    container_name: records-ontoserver
    ports:
      - "8081:8080"
    volumes:
      - ontoserver-data:/usr/local/ontoserver/data
    environment:
      - SPRING_PROFILES_ACTIVE=default
      - SERVER_PORT=8080
      - JAVA_OPTS=-Xmx4g -Xms2g
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8080/fhir/metadata"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 60s

volumes:
  ontoserver-data:
    driver: local
```

Start with:
```bash
docker-compose up -d ontoserver
```

---

### Method 3: Native Installation

#### 1. Download Ontoserver

Visit [Ontoserver Downloads](https://ontoserver.csiro.au/downloads/) and download the appropriate distribution.

#### 2. Extract and Configure

```bash
unzip ontoserver-<version>.zip
cd ontoserver-<version>
```

Edit `application.properties`:
```properties
server.port=8081
server.servlet.context-path=/fhir
```

#### 3. Start Ontoserver

```bash
./bin/ontoserver
```

---

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_PORT` | 8080 | HTTP port for Ontoserver |
| `SPRING_PROFILES_ACTIVE` | default | Active Spring profiles |
| `JAVA_OPTS` | -Xmx2g | JVM memory settings |
| `ONTOSERVER_LICENSE` | - | License key (if required) |

### Java Memory Settings

Adjust based on your workload:

```bash
# For small deployments (< 1000 validations/day)
JAVA_OPTS="-Xmx2g -Xms1g"

# For medium deployments (1000-10000 validations/day)
JAVA_OPTS="-Xmx4g -Xms2g"

# For large deployments (> 10000 validations/day)
JAVA_OPTS="-Xmx8g -Xms4g"
```

---

## Loading Terminologies

### SNOMED CT

#### 1. Download SNOMED CT

Obtain a SNOMED CT distribution from the [SNOMED International](https://www.snomed.org/) or your National Release Center.

#### 2. Load into Ontoserver

```bash
# Using REST API
curl -X POST "http://localhost:8081/fhir/CodeSystem/$import" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@SnomedCT_InternationalRF2_PRODUCTION_20230131T120000Z.zip"
```

Or via UI: Navigate to `http://localhost:8081/fhir` and use the import interface.

### LOINC

```bash
curl -X POST "http://localhost:8081/fhir/CodeSystem/$import" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@Loinc_2.74.zip"
```

### Custom ValueSets

Upload custom ValueSets via FHIR API:

```bash
curl -X POST "http://localhost:8081/fhir/ValueSet" \
  -H "Content-Type: application/fhir+json" \
  -d @my-valueset.json
```

---

## Integration with Records Platform

### 1. Update Environment Variables

```bash
# .env
ONTOSERVER_BASE_URL=http://localhost:8081/fhir
ONTOSERVER_R4_URL=http://localhost:8081/fhir
ONTOSERVER_R5_URL=http://localhost:8081/fhir
ONTOSERVER_R6_URL=http://localhost:8081/fhir
VALIDATION_MODE=offline  # or 'hybrid' for fallback
```

### 2. Configure Validation Settings

Via UI: Navigate to **Settings → Validation** and configure:
- **Validation Mode**: Offline
- **Local Server (Ontoserver)**: `http://localhost:8081/fhir`

### 3. Verify Connection

Check the **Mode Indicator Badge** in the header:
- 🌐 **Online**: Using tx.fhir.org
- 📦 **Offline**: Using local Ontoserver

---

## Health Monitoring

### Health Check Endpoint

```bash
curl http://localhost:8081/fhir/metadata
```

Expected: HTTP 200 with CapabilityStatement.

### Automated Health Checks

The Records platform automatically monitors Ontoserver health:
- Interval: 60 seconds (healthy), 15 seconds (unhealthy)
- Timeout: 5 seconds
- Failure Threshold: 3 consecutive failures

Health status visible in:
- **Mode Indicator Badge** tooltip
- **System Settings** tab
- Platform logs

---

## Performance Optimization

### Pre-Expand Common ValueSets

```bash
# Expand and cache frequently used ValueSets
curl -X GET "http://localhost:8081/fhir/ValueSet/\$expand?url=http://hl7.org/fhir/ValueSet/administrative-gender"
```

### Enable Caching

Edit `application.properties`:
```properties
ontoserver.cache.enabled=true
ontoserver.cache.max-size=10000
```

### Index Optimization

Ensure terminologies are indexed:
```bash
curl -X POST "http://localhost:8081/fhir/CodeSystem/\$reindex"
```

---

## Troubleshooting

### Issue: Ontoserver Not Starting

**Symptoms**: Container exits immediately or fails to start.

**Solutions**:
1. Check logs: `docker logs ontoserver`
2. Verify port availability: `lsof -i :8081`
3. Increase memory: `JAVA_OPTS="-Xmx4g"`
4. Check disk space: `df -h`

### Issue: Terminology Not Found

**Symptoms**: Validation fails with "CodeSystem not found" errors.

**Solutions**:
1. Verify terminology loaded: `curl http://localhost:8081/fhir/CodeSystem?url=http://snomed.info/sct`
2. Re-import terminology if missing
3. Check terminology URL in FHIR resources matches Ontoserver CodeSystem URL

### Issue: Slow Performance

**Symptoms**: Validation takes > 5 seconds per resource.

**Solutions**:
1. Increase JVM memory: `JAVA_OPTS="-Xmx8g"`
2. Pre-expand ValueSets (see Performance Optimization)
3. Enable caching in `application.properties`
4. Ensure SSD storage for data directory

### Issue: Connection Refused

**Symptoms**: Records platform cannot connect to Ontoserver.

**Solutions**:
1. Verify Ontoserver is running: `docker ps | grep ontoserver`
2. Check network connectivity: `curl http://localhost:8081/fhir/metadata`
3. Verify firewall rules allow connections on port 8081
4. Update `ONTOSERVER_BASE_URL` in Records `.env` file

---

## Security Considerations

### Authentication (Optional)

Ontoserver supports basic authentication:

```yaml
environment:
  - SECURITY_BASIC_ENABLED=true
  - SECURITY_USER_NAME=admin
  - SECURITY_USER_PASSWORD=secure_password_here
```

Update Records configuration:
```bash
ONTOSERVER_AUTH_USERNAME=admin
ONTOSERVER_AUTH_PASSWORD=secure_password_here
```

### Network Security

- **Production**: Restrict Ontoserver access to internal network only
- **Firewall**: Only allow connections from Records application server
- **HTTPS**: Use reverse proxy (nginx, Apache) for HTTPS termination

---

## Backup and Recovery

### Backup Data Directory

```bash
# Docker volume backup
docker run --rm \
  -v ontoserver-data:/data \
  -v $(pwd):/backup \
  ubuntu \
  tar czf /backup/ontoserver-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### Restore from Backup

```bash
# Stop Ontoserver
docker stop ontoserver

# Restore backup
docker run --rm \
  -v ontoserver-data:/data \
  -v $(pwd):/backup \
  ubuntu \
  bash -c "cd /data && tar xzf /backup/ontoserver-backup-YYYYMMDD.tar.gz"

# Start Ontoserver
docker start ontoserver
```

---

## Maintenance

### Regular Tasks

1. **Update Terminologies**: Monthly (or per release schedule)
2. **Monitor Disk Space**: Weekly
3. **Review Logs**: Daily
4. **Performance Metrics**: Weekly
5. **Backup Data**: Daily (automated)

### Updates

```bash
# Pull latest image
docker pull aehrc/ontoserver:latest

# Recreate container
docker-compose up -d --force-recreate ontoserver
```

---

## Resources

- **Official Documentation**: [https://ontoserver.csiro.au/docs/](https://ontoserver.csiro.au/docs/)
- **Docker Hub**: [https://hub.docker.com/r/aehrc/ontoserver](https://hub.docker.com/r/aehrc/ontoserver)
- **FHIR Terminology Services**: [https://www.hl7.org/fhir/terminology-service.html](https://www.hl7.org/fhir/terminology-service.html)
- **Records Platform**: [See main README.md](../../README.md)

---

## Support

For Ontoserver-specific issues, contact CSIRO or consult the official documentation.

For Records platform integration issues, refer to the main troubleshooting guide or open an issue on GitHub.

---

*Last Updated: 2025-01-10*
*Records Platform Version: MVP V1.2*

