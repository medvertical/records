/**
 * Test Database Setup Utilities
 * 
 * This module provides utilities for setting up and tearing down test databases
 * for integration tests.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db } from './index';

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/records_test';

let testClient: postgres.Sql;
let testDb: ReturnType<typeof drizzle>;

export async function setupTestDatabase(): Promise<void> {
  try {
    // Create test database connection
    testClient = postgres(TEST_DATABASE_URL, { max: 1 });
    testDb = drizzle(testClient);

    // Run migrations
    await migrate(testDb, { migrationsFolder: './migrations' });

    console.log('Test database setup completed');
  } catch (error) {
    console.error('Failed to setup test database:', error);
    throw error;
  }
}

export async function teardownTestDatabase(): Promise<void> {
  try {
    if (testClient) {
      await testClient.end();
    }
    console.log('Test database teardown completed');
  } catch (error) {
    console.error('Failed to teardown test database:', error);
    throw error;
  }
}

export function getTestDatabase() {
  if (!testDb) {
    throw new Error('Test database not initialized. Call setupTestDatabase() first.');
  }
  return testDb;
}

export function getTestClient() {
  if (!testClient) {
    throw new Error('Test client not initialized. Call setupTestDatabase() first.');
  }
  return testClient;
}

