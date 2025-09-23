# Technical Documentation

This directory contains technical documentation for developers and system administrators working with the Records FHIR Validation Platform.

## 📁 Directory Structure

### 🔍 [Validation System](./validation/)
Documentation for the validation engine and related systems:
- **Validation Result Interfaces** - Interface documentation and formats
- **Validation Aspects Mapping** - 6-aspect validation system mapping
- **Validation Engine Analysis** - Engine usage and implementation analysis
- **Validation Engine Migration Plan** - Migration documentation
- **Foundation Engine Analysis** - Foundation system analysis

### 🏗️ [Architecture](./architecture/)
System architecture and design documentation:
- **Validation Pipeline Operations** - Pipeline system documentation

## 🔧 Validation System Documentation

### Core Components

#### **Validation Result Interfaces**
- Complete interface documentation for all validation engines
- Format specifications and data structures
- Performance tracking and retry information
- Settings integration documentation

#### **Validation Aspects Mapping**
- 6-aspect validation system overview
- Implementation mapping by engine
- Settings integration for each aspect
- Feature comparison and status

#### **Validation Engine Analysis**
- Current engine usage analysis
- Active vs legacy engine identification
- Migration recommendations
- Performance considerations

## 🏗️ Architecture Documentation

### System Design
- Validation pipeline operations
- Service architecture
- Data flow documentation
- Performance optimization strategies

## 📊 Technical Specifications

### Validation Engine
- **Primary Engine**: RockSolidValidationEngine (consolidated)
- **Validation Aspects**: 6 comprehensive aspects
- **Performance**: Optimized for enterprise scale
- **Integration**: Full settings and pipeline integration

### System Architecture
- **Frontend**: React 18 with TypeScript
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Real-time**: Server-Sent Events (SSE)

## 🚀 Getting Started

1. **Understanding the System**: Start with [Validation Aspects Mapping](./validation/validation-aspects-mapping.md)
2. **Interface Reference**: Check [Validation Result Interfaces](./validation/validation-result-interfaces-documentation.md)
3. **Implementation Details**: Review [Validation Engine Analysis](./validation/validation-engine-usage-analysis.md)
4. **Architecture Overview**: See [Validation Pipeline Operations](./architecture/validation-pipeline-operations.md)

## 📞 Support

For technical questions:
1. Review the relevant technical documentation
2. Check the main [Troubleshooting Guide](../core/TROUBLESHOOTING.md)
3. Create an issue in the project repository
