# On-Premise Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- At least 2GB RAM available
- Port 5000 available for the application
- Port 5432 available for PostgreSQL (or change it in .env)

## Quick Start (5 Minutes)

### 1. Configure Environment

Create a `.env` file in the project root:

```bash
# Copy and customize
cat > .env << EOF
DB_NAME=records
DB_USER=records_user
DB_PASSWORD=$(openssl rand -base64 32)
DB_PORT=5432
APP_PORT=5000
NODE_ENV=production
EOF
```

Or manually set a secure password:

```bash
DB_NAME=records
DB_USER=records_user
DB_PASSWORD=your_secure_password_here
DB_PORT=5432
APP_PORT=5000
NODE_ENV=production
```

### 2. Start Everything

```bash
# Build and start all services (PostgreSQL + Application)
docker-compose up -d
```

This will:
- ✅ Pull PostgreSQL image
- ✅ Build the Records application
- ✅ Start PostgreSQL database
- ✅ Wait for database to be healthy
- ✅ Start the application
- ✅ Connect application to database

### 3. Run Database Migrations

```bash
# Wait for services to start (about 30 seconds)
sleep 30

# Run migrations
docker-compose exec app node -e "
  const { Pool } = require('pg');
  const { drizzle } = require('drizzle-orm/node-postgres');
  const { migrate } = require('drizzle-orm/node-postgres/migrator');
  
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);
  
  migrate(db, { migrationsFolder: './migrations' })
    .then(() => console.log('✅ Migrations completed'))
    .catch(err => console.error('❌ Migration failed:', err))
    .finally(() => pool.end());
"
```

Or use the migration script directly:

```bash
# From the host machine
DATABASE_URL="postgresql://records_user:your_password@localhost:5432/records" npm run db:migrate
```

### 4. Verify Deployment

```bash
# Check health
curl http://localhost:5000/api/health

# Should return:
# {
#   "status": "ok",
#   "services": {
#     "database": "connected",
#     ...
#   }
# }

# Check servers
curl http://localhost:5000/api/servers

# Should return:
# {
#   "servers": [],
#   "activeServer": null
# }
```

### 5. Access the Application

Open your browser:
- **Application**: http://localhost:5000
- **API**: http://localhost:5000/api/health

## Management Commands

### View Logs

```bash
# All services
docker-compose logs -f

# Just the application
docker-compose logs -f app

# Just the database
docker-compose logs -f postgres
```

### Stop Services

```bash
# Stop but keep data
docker-compose stop

# Stop and remove containers (data persists in volume)
docker-compose down

# Stop and REMOVE ALL DATA (⚠️ Warning: destroys database)
docker-compose down -v
```

### Restart Services

```bash
# Restart everything
docker-compose restart

# Restart just the app
docker-compose restart app
```

### Update Application

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose up -d --build
```

### Database Backup

```bash
# Backup database to file
docker-compose exec postgres pg_dump -U records_user records > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore from backup
docker-compose exec -T postgres psql -U records_user records < backup-20231012-143000.sql
```

## Troubleshooting

### Database Connection Failed

```bash
# Check if PostgreSQL is running
docker-compose ps postgres

# Check database logs
docker-compose logs postgres

# Verify connection
docker-compose exec postgres psql -U records_user -d records -c "SELECT 1"
```

### Application Won't Start

```bash
# Check application logs
docker-compose logs app

# Check if database is healthy
docker-compose ps

# Restart application
docker-compose restart app
```

### Port Already in Use

```bash
# Change ports in .env file
APP_PORT=5001  # Change from 5000
DB_PORT=5433   # Change from 5432

# Restart
docker-compose down
docker-compose up -d
```

### Build Fails

```bash
# Clean build
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## Production Considerations

### 1. Use a Reverse Proxy

Use Nginx or Traefik to:
- Add HTTPS/SSL
- Add domain name
- Handle load balancing

Example Nginx config:

```nginx
server {
    listen 80;
    server_name records.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Regular Backups

Set up automated backups:

```bash
# Add to crontab (daily backup at 2 AM)
0 2 * * * cd /path/to/records && docker-compose exec -T postgres pg_dump -U records_user records > /backups/records-$(date +\%Y\%m\%d).sql
```

### 3. Monitoring

Add monitoring services:

```yaml
# Add to docker-compose.yml
  prometheus:
    image: prom/prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
  
  grafana:
    image: grafana/grafana
    ports:
      - "3000:3000"
    depends_on:
      - prometheus
```

### 4. Resource Limits

Add resource limits to docker-compose.yml:

```yaml
services:
  app:
    # ... existing config
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          memory: 1G
```

### 5. Log Rotation

Configure Docker logging:

```yaml
services:
  app:
    # ... existing config
    logging:
      driver: "json-file"
      options:
        max-size: "10m"
        max-file: "3"
```

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_NAME` | records | PostgreSQL database name |
| `DB_USER` | records_user | PostgreSQL username |
| `DB_PASSWORD` | change_this_password | PostgreSQL password (CHANGE THIS!) |
| `DB_PORT` | 5432 | PostgreSQL port (host) |
| `APP_PORT` | 5000 | Application port (host) |
| `NODE_ENV` | production | Node environment |
| `DATABASE_URL` | auto-constructed | Full PostgreSQL connection string |

## Scaling Considerations

### Multiple Application Instances

```yaml
services:
  app:
    # ... existing config
    deploy:
      replicas: 3  # Run 3 instances
    
  # Add load balancer
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
    depends_on:
      - app
```

### Separate Database Server

For production, run PostgreSQL on a separate server:

```yaml
services:
  app:
    environment:
      DATABASE_URL: postgresql://user:pass@external-db-server.com:5432/records
    # Remove postgres service dependency
```

## Alternative: PM2 Deployment

If you prefer PM2 instead of Docker, see `PM2_DEPLOYMENT.md`.

## Alternative: Systemd Service

If you prefer systemd instead of Docker, see `SYSTEMD_DEPLOYMENT.md`.

## Support

- Check logs: `docker-compose logs -f`
- Check health: `curl http://localhost:5000/api/health`
- Database status: `docker-compose exec postgres pg_isready`

