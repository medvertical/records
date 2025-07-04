import { pgTable, text, serial, integer, boolean, jsonb, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const fhirServers = pgTable("fhir_servers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  url: text("url").notNull(),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const fhirResources = pgTable("fhir_resources", {
  id: serial("id").primaryKey(),
  serverId: integer("server_id").references(() => fhirServers.id),
  resourceType: text("resource_type").notNull(),
  resourceId: text("resource_id").notNull(),
  versionId: text("version_id"),
  data: jsonb("data").notNull(),
  lastModified: timestamp("last_modified").defaultNow(),
});

export const validationProfiles = pgTable("validation_profiles", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  title: text("title"),
  description: text("description"),
  version: text("version"),
  url: text("url").notNull(),
  resourceType: text("resource_type").notNull(),
  packageId: text("package_id"),
  packageVersion: text("package_version"),
  status: text("status").default("active"),
  profileData: jsonb("profile_data"),
  config: jsonb("config"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

export const validationResults = pgTable("validation_results", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").references(() => fhirResources.id),
  profileId: integer("profile_id").references(() => validationProfiles.id),
  isValid: boolean("is_valid").notNull(),
  errors: jsonb("errors").default([]),
  warnings: jsonb("warnings").default([]),
  validatedAt: timestamp("validated_at").defaultNow(),
});

export const dashboardCards = pgTable("dashboard_cards", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  type: text("type").notNull(), // 'chart', 'table', 'stat'
  config: jsonb("config").notNull(),
  position: integer("position").notNull(),
  isVisible: boolean("is_visible").default(true),
});

// Insert schemas
export const insertFhirServerSchema = createInsertSchema(fhirServers).omit({
  id: true,
  createdAt: true,
});

export const insertFhirResourceSchema = createInsertSchema(fhirResources).omit({
  id: true,
  lastModified: true,
});

export const insertValidationProfileSchema = createInsertSchema(validationProfiles).omit({
  id: true,
  createdAt: true,
});

export const insertValidationResultSchema = createInsertSchema(validationResults).omit({
  id: true,
  validatedAt: true,
});

export const insertDashboardCardSchema = createInsertSchema(dashboardCards).omit({
  id: true,
});

// Types
export type FhirServer = typeof fhirServers.$inferSelect;
export type InsertFhirServer = z.infer<typeof insertFhirServerSchema>;

export type FhirResource = typeof fhirResources.$inferSelect;
export type InsertFhirResource = z.infer<typeof insertFhirResourceSchema>;

export type ValidationProfile = typeof validationProfiles.$inferSelect;
export type InsertValidationProfile = z.infer<typeof insertValidationProfileSchema>;

export type ValidationResult = typeof validationResults.$inferSelect;
export type InsertValidationResult = z.infer<typeof insertValidationResultSchema>;

export type DashboardCard = typeof dashboardCards.$inferSelect;
export type InsertDashboardCard = z.infer<typeof insertDashboardCardSchema>;

// Additional types for FHIR resources
export interface FhirResourceWithValidation extends FhirResource {
  validationResults?: ValidationResult[];
}

export interface ValidationError {
  severity: 'error' | 'warning' | 'information';
  message: string;
  path: string;
  expression?: string;
  code?: string;
}

export interface ResourceStats {
  totalResources: number;
  validResources: number;
  errorResources: number;
  activeProfiles: number;
  resourceBreakdown: Record<string, {
    total: number;
    valid: number;
    validPercent: number;
  }>;
}
