# Performance Budgets

This document defines the performance budgets for the Records FHIR Platform and provides guidance on monitoring and optimization.

## Performance Budgets

### List/Group Endpoints
- **Budget**: P95 < 500ms
- **Endpoints**: 
  - `GET /api/validation/issues/groups`
  - `GET /api/validation/results`
  - `GET /api/validation/issues`
- **Purpose**: These endpoints return lists or grouped data that users expect to load quickly

### Detail Endpoints
- **Budget**: P95 < 300ms
- **Endpoints**:
  - `GET /api/fhir/{resourceType}`
  - `GET /api/validation/results/{id}`
  - `GET /api/fhir/{resourceType}/{id}`
- **Purpose**: Individual resource details should load very quickly for good UX

### Dashboard Endpoints
- **Budget**: P95 < 400ms
- **Endpoints**:
  - `GET /api/dashboard/stats`
  - `GET /api/dashboard/cards`
  - `GET /api/dashboard/combined`
- **Purpose**: Dashboard data should load quickly to provide immediate insights

## Monitoring Performance

### Automated Checks

#### CI/CD Performance Tests
The CI pipeline automatically runs performance budget checks on every commit:

```bash
# Run performance budget checks
./scripts/performance-budget-check.sh [base_url]
```

#### Local Development Monitoring
Monitor performance during development:

```bash
# Continuous monitoring
./scripts/performance-monitor.sh [base_url] [interval_seconds] [log_file]

# Example: Monitor every 30 seconds
./scripts/performance-monitor.sh http://localhost:5000 30 performance.log
```

### Manual Testing

#### Quick Performance Check
```bash
# Test a single endpoint
curl -o /dev/null -s -w 'Response time: %{time_total}s\n' http://localhost:5000/api/dashboard/stats

# Test multiple endpoints
for endpoint in "validation/issues/groups" "validation/results" "dashboard/stats"; do
  echo "Testing /api/$endpoint..."
  curl -o /dev/null -s -w '%{time_total}\n' "http://localhost:5000/api/$endpoint"
done
```

## Performance Optimization Strategies

### Database Optimization

#### Query Optimization
- Use database indexes on frequently queried columns
- Implement query result caching for expensive operations
- Use pagination for large result sets
- Optimize JOIN operations

#### Connection Pooling
- Configure appropriate connection pool sizes
- Use connection pooling for database connections
- Implement connection health checks

### API Optimization

#### Caching
- Implement response caching for expensive operations
- Use Redis or in-memory caching for frequently accessed data
- Cache validation results and dashboard statistics
- Implement cache invalidation strategies

#### Response Compression
- Enable gzip compression for API responses
- Compress large JSON responses
- Use appropriate Content-Encoding headers

#### Pagination
- Implement cursor-based pagination for large datasets
- Use reasonable default page sizes (10-50 items)
- Provide total count only when necessary

### Validation Performance

#### Batch Processing
- Process validation requests in batches
- Use appropriate batch sizes (10-100 resources)
- Implement parallel processing where possible
- Cache validation results

#### Async Processing
- Use background jobs for long-running validations
- Implement progress tracking for validation operations
- Return validation status immediately

### Frontend Optimization

#### Data Fetching
- Use TanStack Query for efficient data fetching
- Implement proper loading states
- Use optimistic updates where appropriate
- Implement request deduplication

#### Component Optimization
- Use React.memo for expensive components
- Implement virtual scrolling for large lists
- Use code splitting for large components
- Optimize re-renders with proper dependency arrays

## Performance Budget Violations

### What Happens When Budgets Are Exceeded

1. **CI/CD Pipeline**: Performance budget violations will fail the CI pipeline
2. **Monitoring Alerts**: Production monitoring should alert on budget violations
3. **Performance Reviews**: Regular performance reviews should address violations

### Investigation Process

1. **Identify the Bottleneck**
   - Check database query performance
   - Analyze network latency
   - Review application server metrics
   - Check for memory leaks

2. **Optimize the Slow Component**
   - Add database indexes
   - Implement caching
   - Optimize queries
   - Add connection pooling

3. **Re-test Performance**
   - Run performance budget checks
   - Monitor in production
   - Validate improvements

## Performance Monitoring in Production

### Metrics to Track

- **Response Times**: P50, P95, P99 for each endpoint
- **Error Rates**: 4xx and 5xx error percentages
- **Throughput**: Requests per second
- **Resource Usage**: CPU, memory, database connections

### Alerting Thresholds

- **Warning**: P95 > 80% of budget (400ms for 500ms budget)
- **Critical**: P95 > 100% of budget (500ms for 500ms budget)
- **Error Rate**: > 1% error rate
- **Availability**: < 99.9% uptime

## Tools and Utilities

### Performance Testing Tools

- **Artillery**: Load testing framework
- **k6**: Modern load testing tool
- **Apache Bench**: Simple HTTP benchmarking
- **curl**: Basic response time testing

### Monitoring Tools

- **Application Performance Monitoring (APM)**: New Relic, DataDog, etc.
- **Database Monitoring**: pg_stat_statements, slow query logs
- **Server Monitoring**: Prometheus, Grafana
- **Custom Scripts**: performance-monitor.sh, performance-budget-check.sh

## Best Practices

### Development
- Run performance checks locally before committing
- Use performance monitoring during development
- Profile code for bottlenecks
- Implement caching early in development

### Code Review
- Review performance implications of database changes
- Check for N+1 query problems
- Verify proper indexing
- Review caching strategies

### Deployment
- Run performance tests in staging environment
- Monitor performance metrics after deployment
- Have rollback plan for performance regressions
- Document performance characteristics

## Performance Budget History

| Date | Budget | Change | Reason |
|------|--------|--------|--------|
| 2024-01-XX | Initial budgets | - | Initial performance requirements |
| | List/Group: 500ms | | |
| | Detail: 300ms | | |
| | Dashboard: 400ms | | |

## Resources

- [Performance Budgets - Web.dev](https://web.dev/performance-budgets-101/)
- [React Performance Optimization](https://react.dev/learn/render-and-commit)
- [Database Performance Tuning](https://www.postgresql.org/docs/current/performance-tips.html)
- [Node.js Performance Best Practices](https://nodejs.org/en/docs/guides/simple-profiling/)
