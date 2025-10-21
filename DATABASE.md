# Database Setup

## Overview

**This project uses PostgreSQL** as its primary database, managed via [Drizzle ORM](https://orm.drizzle.team/).

> ⚠️ **Important**: If you see references to SQLite in archived documentation, please note that these are legacy. The current system exclusively uses PostgreSQL.

## Quick Start

### 1. PostgreSQL Installation

**macOS (Homebrew):**
```bash
brew install postgresql@16
brew services start postgresql@16
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Docker:**
```bash
docker run --name records-postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=records \
  -p 5432:5432 \
  -d postgres:16
```

### 2. Database Configuration

Set your `DATABASE_URL` environment variable in `.env`:

```bash
DATABASE_URL=postgresql://username:password@localhost:5432/records
```

**Connection String Format:**
```
postgresql://[user]:[password]@[host]:[port]/[database]?[params]
```

### 3. Run Migrations

```bash
# Push schema changes to database
npm run db:push

# Or run migrations
npm run db:migrate
```

## Key Files

### Configuration Files

- **`drizzle.config.ts`** - Drizzle Kit configuration for PostgreSQL
  - Specifies `dialect: "postgresql"`
  - Defines schema locations
  - Sets migration output directory

- **`server/db.ts`** - Database connection initialization
  - Creates PostgreSQL connection pool using `pg`
  - Initializes Drizzle ORM with schema
  - Exports `db` instance for use throughout the application

- **`shared/schema.ts`** - Main database schema
  - Uses `pgTable` (PostgreSQL-specific table definitions)
  - Defines all tables, columns, and relationships

### Schema Files

The database schema is split across multiple files:
- `shared/schema.ts` - Main tables (FHIR servers, resources, validation results)
- `shared/schema-validation-per-aspect.ts` - Validation aspect tables
- `shared/schema-business-rules.ts` - Business rules tables

## Database Commands

```bash
# Push schema changes to database (no migration files)
npm run db:push

# Run migrations
npm run db:migrate

# Rollback last migration
npm run db:migrate:down

# Seed database with validation data
npm run db:seed

# Seed development FHIR resources
npm run db:seed:dev

# Clear validation data
npm run db:clear

# Clear all data
npm run db:clear:all
```

## Connection Details

### Connection Pool

The application uses `pg` (node-postgres) with connection pooling:

```typescript
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL 
});

export const db = drizzle(pool, { schema });
```

### Environment Variables

Required environment variables (see `env.example.txt`):

```bash
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/records
PORT=5000
```

## Migrations

Migrations are stored in the `migrations/` directory and managed by Drizzle Kit.

### Create a Migration

```bash
npx drizzle-kit generate
```

### Apply Migrations

```bash
npm run db:migrate
```

### Migration Files

Migration files are SQL files that can be reviewed before applying:
- Located in `migrations/` directory
- Named with timestamps: `0001_initial.sql`, `0002_add_column.sql`, etc.
- Applied in order automatically

## Production Setup

### Deployment Checklist

1. ✅ Provision a PostgreSQL database (recommended: PostgreSQL 14+)
2. ✅ Set `DATABASE_URL` environment variable
3. ✅ Run migrations: `npm run db:migrate`
4. ✅ Verify connection: Check logs for successful database connection
5. ✅ (Optional) Seed initial data: `npm run db:seed`

### Recommended Providers

- **Vercel Postgres** - Serverless PostgreSQL on Vercel
- **Neon** - Serverless PostgreSQL with branching
- **Supabase** - PostgreSQL with additional features
- **Railway** - Simple PostgreSQL hosting
- **AWS RDS** - Managed PostgreSQL (production-grade)

### Connection Pooling

For serverless deployments (Vercel, AWS Lambda), use connection pooling:

```typescript
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
```

The `@neondatabase/serverless` package is already included for serverless compatibility.

## Troubleshooting

### "DATABASE_URL must be set"

**Problem:** Application crashes with database URL error.

**Solution:** Create `.env` file with valid PostgreSQL connection string:
```bash
cp env.example.txt .env
# Edit .env and set your DATABASE_URL
```

### "Connection refused"

**Problem:** Can't connect to PostgreSQL.

**Solutions:**
- Ensure PostgreSQL is running: `pg_isready`
- Check connection string (host, port, credentials)
- Verify network access (firewall, security groups)

### "relation does not exist"

**Problem:** Tables not found in database.

**Solution:** Run migrations:
```bash
npm run db:migrate
```

### Performance Issues

**Solutions:**
- Add indexes (defined in schema files)
- Use connection pooling (already configured)
- Monitor slow queries (see `server/utils/query-optimizer.ts`)

## Schema Overview

### Core Tables

- `fhir_servers` - FHIR server configurations
- `fhir_resources` - Stored FHIR resources
- `validation_profiles` - Validation profile definitions
- `validation_results` - Validation results per resource
- `validation_result_per_aspect` - Detailed aspect-level validation
- `validation_settings` - User validation preferences

### Additional Tables

- `business_rules` - Custom business rule definitions
- `terminology_servers` - Terminology server configurations
- `validation_groups` - Grouped validation jobs
- `validation_progress_state` - Progress tracking
- `dashboard_settings` - User dashboard preferences

## Further Reading

- [Drizzle ORM Documentation](https://orm.drizzle.team/docs/overview)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [node-postgres Documentation](https://node-postgres.com/)

---

**Need help?** Check the [Troubleshooting Guide](./docs/guides/TROUBLESHOOTING_GUIDE.md) or review the schema files in `shared/schema.ts`.

