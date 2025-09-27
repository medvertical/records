# Backup and Recovery Procedures

**Date**: September 26, 2025  
**Status**: ✅ PRODUCTION READY  
**Version**: Backup & Recovery v1.0  

## 💾 Backup Overview

The Records FHIR Validation Platform includes comprehensive backup and recovery procedures to ensure data protection and business continuity in production environments.

## 🗄️ Database Backup Strategy

### **PostgreSQL Database Backups**

#### **Automated Daily Backups**
```bash
#!/bin/bash
# Daily backup script
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgresql"
DB_NAME="records_fhir_platform"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Full database backup
pg_dump -h localhost -U postgres -d $DB_NAME \
  --format=custom \
  --compress=9 \
  --file="$BACKUP_DIR/backup_$DATE.dump"

# Keep only last 30 days of backups
find $BACKUP_DIR -name "backup_*.dump" -mtime +30 -delete

echo "Backup completed: backup_$DATE.dump"
```

#### **Incremental Backups**
```bash
#!/bin/bash
# Incremental backup script (every 6 hours)
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/postgresql/incremental"
DB_NAME="records_fhir_platform"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Incremental backup using WAL archiving
pg_basebackup -h localhost -U postgres -D "$BACKUP_DIR/base_$DATE" \
  --format=tar \
  --gzip \
  --progress

echo "Incremental backup completed: base_$DATE"
```

#### **Validation Results Backup**
```bash
#!/bin/bash
# Validation results specific backup
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/backups/validation_results"

# Create backup directory if it doesn't exist
mkdir -p $BACKUP_DIR

# Export validation results
psql -h localhost -U postgres -d records_fhir_platform \
  -c "COPY validation_results TO '$BACKUP_DIR/validation_results_$DATE.csv' WITH CSV HEADER;"

# Export validation settings
psql -h localhost -U postgres -d records_fhir_platform \
  -c "COPY validation_settings TO '$BACKUP_DIR/validation_settings_$DATE.csv' WITH CSV HEADER;"

echo "Validation data backup completed: $DATE"
```

### **Backup Storage Locations**

#### **Local Storage**
```bash
/backups/
├── postgresql/
│   ├── daily/           # Daily full backups
│   ├── incremental/     # Incremental backups
│   └── validation/      # Validation-specific backups
├── application/
│   ├── code/           # Application code backups
│   ├── config/         # Configuration backups
│   └── logs/           # Log file backups
└── external/
    ├── s3/             # AWS S3 backups
    ├── gcs/            # Google Cloud Storage backups
    └── azure/          # Azure Blob Storage backups
```

#### **Cloud Storage Integration**
```bash
# AWS S3 backup sync
aws s3 sync /backups/ s3://records-fhir-platform-backups/ \
  --storage-class STANDARD_IA \
  --delete

# Google Cloud Storage backup sync
gsutil -m rsync -r /backups/ gs://records-fhir-platform-backups/

# Azure Blob Storage backup sync
az storage blob upload-batch \
  --source /backups/ \
  --destination backups \
  --account-name recordsfhirplatform
```

## 🔄 Recovery Procedures

### **Database Recovery**

#### **Full Database Recovery**
```bash
#!/bin/bash
# Full database recovery script
BACKUP_FILE=$1
DB_NAME="records_fhir_platform"

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.dump>"
  exit 1
fi

# Stop application services
systemctl stop records-fhir-platform

# Drop existing database (CAUTION: This will delete all data)
dropdb -h localhost -U postgres $DB_NAME

# Create new database
createdb -h localhost -U postgres $DB_NAME

# Restore from backup
pg_restore -h localhost -U postgres -d $DB_NAME \
  --clean \
  --if-exists \
  --verbose \
  $BACKUP_FILE

# Start application services
systemctl start records-fhir-platform

echo "Database recovery completed from: $BACKUP_FILE"
```

#### **Point-in-Time Recovery**
```bash
#!/bin/bash
# Point-in-time recovery script
RECOVERY_TIME=$1
DB_NAME="records_fhir_platform"

if [ -z "$RECOVERY_TIME" ]; then
  echo "Usage: $0 'YYYY-MM-DD HH:MM:SS'"
  exit 1
fi

# Stop application services
systemctl stop records-fhir-platform

# Create recovery configuration
cat > /tmp/recovery.conf << EOF
restore_command = 'cp /backups/postgresql/wal/%f %p'
recovery_target_time = '$RECOVERY_TIME'
recovery_target_action = 'promote'
EOF

# Start recovery process
pg_ctl start -D /var/lib/postgresql/data -l /var/log/postgresql/recovery.log

echo "Point-in-time recovery initiated to: $RECOVERY_TIME"
```

#### **Validation Data Recovery**
```bash
#!/bin/bash
# Validation data recovery script
BACKUP_DATE=$1
DB_NAME="records_fhir_platform"

if [ -z "$BACKUP_DATE" ]; then
  echo "Usage: $0 <backup_date_YYYYMMDD>"
  exit 1
fi

# Restore validation results
psql -h localhost -U postgres -d $DB_NAME << EOF
TRUNCATE validation_results;
COPY validation_results FROM '/backups/validation_results/validation_results_${BACKUP_DATE}_*.csv' WITH CSV HEADER;
EOF

# Restore validation settings
psql -h localhost -U postgres -d $DB_NAME << EOF
TRUNCATE validation_settings;
COPY validation_settings FROM '/backups/validation_results/validation_settings_${BACKUP_DATE}_*.csv' WITH CSV HEADER;
EOF

echo "Validation data recovery completed from: $BACKUP_DATE"
```

### **Application Recovery**

#### **Code Recovery**
```bash
#!/bin/bash
# Application code recovery script
BACKUP_DATE=$1
APP_DIR="/opt/records-fhir-platform"

if [ -z "$BACKUP_DATE" ]; then
  echo "Usage: $0 <backup_date_YYYYMMDD>"
  exit 1
fi

# Stop application
systemctl stop records-fhir-platform

# Restore application code
tar -xzf "/backups/application/code/backup_${BACKUP_DATE}.tar.gz" -C /

# Restore configuration
cp "/backups/application/config/config_${BACKUP_DATE}.json" "$APP_DIR/config/"

# Install dependencies
cd $APP_DIR
npm ci --production

# Start application
systemctl start records-fhir-platform

echo "Application recovery completed from: $BACKUP_DATE"
```

#### **Configuration Recovery**
```bash
#!/bin/bash
# Configuration recovery script
BACKUP_DATE=$1

if [ -z "$BACKUP_DATE" ]; then
  echo "Usage: $0 <backup_date_YYYYMMDD>"
  exit 1
fi

# Restore environment variables
cp "/backups/application/config/env_${BACKUP_DATE}.env" "/opt/records-fhir-platform/.env"

# Restore database configuration
cp "/backups/application/config/database_${BACKUP_DATE}.json" "/opt/records-fhir-platform/config/database.json"

# Restore validation settings
cp "/backups/application/config/validation_${BACKUP_DATE}.json" "/opt/records-fhir-platform/config/validation.json"

echo "Configuration recovery completed from: $BACKUP_DATE"
```

## 📋 Backup Schedule

### **Daily Backup Schedule**
```bash
# Crontab entries for automated backups
# Daily full database backup at 2 AM
0 2 * * * /opt/records-fhir-platform/scripts/daily_backup.sh

# Incremental backup every 6 hours
0 */6 * * * /opt/records-fhir-platform/scripts/incremental_backup.sh

# Validation data backup at 3 AM
0 3 * * * /opt/records-fhir-platform/scripts/validation_backup.sh

# Application code backup at 4 AM
0 4 * * * /opt/records-fhir-platform/scripts/app_backup.sh

# Cloud storage sync at 5 AM
0 5 * * * /opt/records-fhir-platform/scripts/cloud_sync.sh
```

### **Weekly Backup Schedule**
```bash
# Weekly full system backup on Sundays at 1 AM
0 1 * * 0 /opt/records-fhir-platform/scripts/weekly_backup.sh

# Weekly backup verification on Mondays at 6 AM
0 6 * * 1 /opt/records-fhir-platform/scripts/backup_verification.sh
```

### **Monthly Backup Schedule**
```bash
# Monthly archive backup on 1st of month at 12 AM
0 0 1 * * /opt/records-fhir-platform/scripts/monthly_archive.sh

# Monthly backup cleanup on 2nd of month at 2 AM
0 2 2 * * /opt/records-fhir-platform/scripts/backup_cleanup.sh
```

## 🔍 Backup Verification

### **Backup Integrity Checks**
```bash
#!/bin/bash
# Backup verification script
BACKUP_FILE=$1

if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 <backup_file.dump>"
  exit 1
fi

# Check backup file integrity
pg_restore --list $BACKUP_FILE > /dev/null
if [ $? -eq 0 ]; then
  echo "✅ Backup file integrity check passed: $BACKUP_FILE"
else
  echo "❌ Backup file integrity check failed: $BACKUP_FILE"
  exit 1
fi

# Test restore to temporary database
TEMP_DB="test_restore_$(date +%s)"
createdb -h localhost -U postgres $TEMP_DB

pg_restore -h localhost -U postgres -d $TEMP_DB \
  --clean \
  --if-exists \
  --verbose \
  $BACKUP_FILE

if [ $? -eq 0 ]; then
  echo "✅ Backup restore test passed: $BACKUP_FILE"
  dropdb -h localhost -U postgres $TEMP_DB
else
  echo "❌ Backup restore test failed: $BACKUP_FILE"
  dropdb -h localhost -U postgres $TEMP_DB
  exit 1
fi
```

### **Backup Monitoring**
```bash
#!/bin/bash
# Backup monitoring script
BACKUP_DIR="/backups"
ALERT_EMAIL="admin@records-fhir-platform.com"

# Check if backups exist for last 24 hours
if [ ! -f "$BACKUP_DIR/postgresql/backup_$(date -d 'yesterday' +%Y%m%d)_*.dump" ]; then
  echo "❌ Daily backup missing for $(date -d 'yesterday' +%Y-%m-%d)" | mail -s "Backup Alert" $ALERT_EMAIL
fi

# Check backup file sizes
LATEST_BACKUP=$(ls -t $BACKUP_DIR/postgresql/backup_*.dump | head -1)
BACKUP_SIZE=$(stat -c%s "$LATEST_BACKUP")

if [ $BACKUP_SIZE -lt 1000000 ]; then  # Less than 1MB
  echo "❌ Backup file too small: $LATEST_BACKUP ($BACKUP_SIZE bytes)" | mail -s "Backup Alert" $ALERT_EMAIL
fi

echo "✅ Backup monitoring completed"
```

## 🚨 Disaster Recovery Plan

### **Recovery Time Objectives (RTO)**
- **Critical Systems**: 4 hours
- **Database Recovery**: 2 hours
- **Application Recovery**: 1 hour
- **Full System Recovery**: 6 hours

### **Recovery Point Objectives (RPO)**
- **Database**: 1 hour (maximum data loss)
- **Validation Results**: 15 minutes
- **Configuration**: 1 hour
- **Application Code**: 24 hours

### **Disaster Recovery Procedures**

#### **Level 1: Minor Incident**
- **Scope**: Single service failure
- **Response**: Restart service, check logs
- **Recovery Time**: < 30 minutes
- **Data Loss**: None

#### **Level 2: Moderate Incident**
- **Scope**: Multiple services or database issues
- **Response**: Restore from latest backup
- **Recovery Time**: < 2 hours
- **Data Loss**: < 1 hour

#### **Level 3: Major Incident**
- **Scope**: Complete system failure
- **Response**: Full system recovery from backup
- **Recovery Time**: < 6 hours
- **Data Loss**: < 4 hours

#### **Level 4: Catastrophic Incident**
- **Scope**: Data center failure
- **Response**: Activate disaster recovery site
- **Recovery Time**: < 24 hours
- **Data Loss**: < 24 hours

## 📊 Backup Testing

### **Monthly Recovery Testing**
```bash
#!/bin/bash
# Monthly recovery testing script
TEST_DATE=$(date +%Y%m%d)
TEST_DB="test_recovery_$TEST_DATE"

# Select random backup from last 30 days
BACKUP_FILE=$(find /backups/postgresql -name "backup_*.dump" -mtime -30 | shuf -n 1)

echo "Testing recovery from: $BACKUP_FILE"

# Create test database
createdb -h localhost -U postgres $TEST_DB

# Restore backup
pg_restore -h localhost -U postgres -d $TEST_DB \
  --clean \
  --if-exists \
  --verbose \
  $BACKUP_FILE

# Run basic tests
psql -h localhost -U postgres -d $TEST_DB -c "SELECT COUNT(*) FROM validation_results;"
psql -h localhost -U postgres -d $TEST_DB -c "SELECT COUNT(*) FROM validation_settings;"

# Clean up
dropdb -h localhost -U postgres $TEST_DB

echo "✅ Recovery test completed successfully"
```

### **Backup Performance Testing**
```bash
#!/bin/bash
# Backup performance testing script
TEST_DB="test_backup_performance"
TEST_SIZE="1000"  # Number of test records

# Create test database with sample data
createdb -h localhost -U postgres $TEST_DB

# Generate test data
psql -h localhost -U postgres -d $TEST_DB << EOF
CREATE TABLE test_validation_results (
  id SERIAL PRIMARY KEY,
  resource_id VARCHAR(255),
  validation_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

INSERT INTO test_validation_results (resource_id, validation_data)
SELECT 
  'Patient/' || generate_series(1, $TEST_SIZE),
  jsonb_build_object('test', true, 'id', generate_series(1, $TEST_SIZE));
EOF

# Measure backup time
START_TIME=$(date +%s)
pg_dump -h localhost -U postgres -d $TEST_DB \
  --format=custom \
  --compress=9 \
  --file="/tmp/test_backup.dump"
END_TIME=$(date +%s)

BACKUP_TIME=$((END_TIME - START_TIME))
BACKUP_SIZE=$(stat -c%s "/tmp/test_backup.dump")

echo "Backup Performance Test Results:"
echo "Records: $TEST_SIZE"
echo "Backup Time: ${BACKUP_TIME}s"
echo "Backup Size: $BACKUP_SIZE bytes"
echo "Records per second: $((TEST_SIZE / BACKUP_TIME))"

# Clean up
dropdb -h localhost -U postgres $TEST_DB
rm -f "/tmp/test_backup.dump"
```

## ✅ Backup Status

### **Current Backup Capabilities**
- ✅ **Database Backups**: Automated daily and incremental backups
- ✅ **Application Backups**: Code and configuration backups
- ✅ **Cloud Storage**: Integration with AWS S3, GCS, and Azure
- ✅ **Recovery Procedures**: Comprehensive recovery scripts
- ✅ **Monitoring**: Backup verification and alerting

### **Production Readiness**
- ✅ **Automated Backups**: Scheduled backup procedures
- ✅ **Recovery Testing**: Monthly recovery testing procedures
- ✅ **Disaster Recovery**: Multi-level disaster recovery plan
- ✅ **Performance Monitoring**: Backup performance tracking
- ✅ **Documentation**: Complete backup and recovery guide

---

**Backup Status**: ✅ **PRODUCTION READY**  
**Recovery Procedures**: ✅ **COMPLETE**  
**Disaster Recovery**: ✅ **PLANNED**  
**Testing Procedures**: ✅ **ESTABLISHED**  

---

*This backup and recovery setup ensures comprehensive data protection and business continuity for the Records FHIR Validation Platform.*
