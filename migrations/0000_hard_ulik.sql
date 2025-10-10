CREATE TABLE "dashboard_cards" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"type" text NOT NULL,
	"config" jsonb NOT NULL,
	"position" integer NOT NULL,
	"is_visible" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "dashboard_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"settings" jsonb DEFAULT '{"autoRefresh":true,"refreshInterval":30,"showResourceStats":true,"showValidationProgress":true,"showErrorSummary":true,"showPerformanceMetrics":false,"cardLayout":"grid","theme":"system","autoValidateEnabled":false}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "edit_audit_trail" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"resource_type" text NOT NULL,
	"fhir_id" text NOT NULL,
	"before_hash" text NOT NULL,
	"after_hash" text NOT NULL,
	"fhir_version" text,
	"edited_at" timestamp DEFAULT now() NOT NULL,
	"edited_by" text DEFAULT 'system',
	"operation" text NOT NULL,
	"result" text NOT NULL,
	"error_message" text,
	"version_before" text,
	"version_after" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fhir_resources" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer,
	"resource_type" text NOT NULL,
	"resource_id" text NOT NULL,
	"version_id" text,
	"data" jsonb NOT NULL,
	"resource_hash" text,
	"last_validated" timestamp,
	"last_modified" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "fhir_servers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"url" text NOT NULL,
	"is_active" boolean DEFAULT false,
	"auth_config" jsonb,
	"fhir_version" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "system_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"settings" jsonb DEFAULT '{"logLevel":"info","enableAnalytics":false,"enableCrashReporting":true,"enableSSE":true,"dataRetentionDays":30,"maxLogFileSize":100,"enableAutoUpdates":true}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "validation_profiles" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text,
	"description" text,
	"version" text,
	"url" text NOT NULL,
	"resource_type" text NOT NULL,
	"package_id" text,
	"package_version" text,
	"status" text DEFAULT 'active',
	"profile_data" jsonb,
	"config" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "validation_progress_state" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_id" text NOT NULL,
	"server_id" integer NOT NULL,
	"state_data" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"expires_at" timestamp DEFAULT now(),
	CONSTRAINT "validation_progress_state_job_id_unique" UNIQUE("job_id")
);
--> statement-breakpoint
CREATE TABLE "validation_results" (
	"id" serial PRIMARY KEY NOT NULL,
	"resource_id" integer,
	"server_id" integer,
	"resource_type" text NOT NULL,
	"fhir_resource_id" text NOT NULL,
	"profile_id" integer,
	"is_valid" boolean NOT NULL,
	"errors" jsonb DEFAULT '[]'::jsonb,
	"warnings" jsonb DEFAULT '[]'::jsonb,
	"issues" jsonb DEFAULT '[]'::jsonb,
	"profile_url" text,
	"error_count" integer DEFAULT 0,
	"warning_count" integer DEFAULT 0,
	"validation_score" integer DEFAULT 0,
	"validated_at" timestamp DEFAULT now(),
	"settings_hash" text,
	"settings_version" integer DEFAULT 1,
	"resource_hash" text,
	"validation_engine_version" text DEFAULT '1.0.0',
	"performance_metrics" jsonb DEFAULT '{}'::jsonb,
	"aspect_breakdown" jsonb DEFAULT '{}'::jsonb,
	"validation_duration_ms" integer DEFAULT 0,
	"retry_attempt_count" integer DEFAULT 0,
	"max_retry_attempts" integer DEFAULT 1,
	"is_retry" boolean DEFAULT false,
	"retry_info" jsonb DEFAULT '{}'::jsonb,
	"can_retry" boolean DEFAULT true,
	"retry_reason" text,
	"total_retry_duration_ms" integer DEFAULT 0,
	"confidence_score" integer DEFAULT 0,
	"confidence_factors" jsonb DEFAULT '{}'::jsonb,
	"confidence_level" text DEFAULT 'unknown',
	"confidence_issues" jsonb DEFAULT '[]'::jsonb,
	"validation_certainty" integer DEFAULT 0,
	"completeness_score" integer DEFAULT 0,
	"completeness_factors" jsonb DEFAULT '{}'::jsonb,
	"coverage_metrics" jsonb DEFAULT '{}'::jsonb,
	"missing_validation_areas" jsonb DEFAULT '[]'::jsonb,
	"validation_gaps" jsonb DEFAULT '[]'::jsonb,
	"validation_request_id" text,
	"validation_batch_id" text,
	"validation_priority" text DEFAULT 'normal',
	"validation_status" text DEFAULT 'completed',
	"validation_started_at" timestamp,
	"validation_completed_at" timestamp,
	"validation_cancelled_at" timestamp,
	"validation_error_message" text,
	"validation_error_details" jsonb DEFAULT '{}'::jsonb,
	"structural_validation_result" jsonb DEFAULT '{}'::jsonb,
	"profile_validation_result" jsonb DEFAULT '{}'::jsonb,
	"terminology_validation_result" jsonb DEFAULT '{}'::jsonb,
	"reference_validation_result" jsonb DEFAULT '{}'::jsonb,
	"business_rule_validation_result" jsonb DEFAULT '{}'::jsonb,
	"metadata_validation_result" jsonb DEFAULT '{}'::jsonb,
	"validation_settings_id" integer,
	"validation_settings_snapshot" jsonb DEFAULT '{}'::jsonb,
	"resource_version" text,
	"resource_size_bytes" integer,
	"resource_complexity_score" integer DEFAULT 0,
	"fhir_version" text,
	"validation_context" jsonb DEFAULT '{}'::jsonb,
	"validation_environment" text DEFAULT 'production',
	"validation_source" text DEFAULT 'api',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "validation_settings" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer,
	"aspects" jsonb DEFAULT '{"structural":{"enabled":true,"severity":"error"},"profile":{"enabled":true,"severity":"warning"},"terminology":{"enabled":true,"severity":"warning"},"reference":{"enabled":true,"severity":"error"},"businessRules":{"enabled":true,"severity":"error"},"metadata":{"enabled":true,"severity":"error"}}'::jsonb NOT NULL,
	"performance" jsonb DEFAULT '{"maxConcurrent":5,"batchSize":50}'::jsonb NOT NULL,
	"resource_types" jsonb DEFAULT '{"enabled":true,"includedTypes":[],"excludedTypes":[]}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"created_by" text,
	"updated_by" text
);
--> statement-breakpoint
CREATE TABLE "validation_message_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"signature" varchar(64) NOT NULL,
	"signature_version" integer DEFAULT 1 NOT NULL,
	"aspect" varchar(50) NOT NULL,
	"severity" varchar(20) NOT NULL,
	"code" varchar(100),
	"canonical_path" varchar(256) NOT NULL,
	"sample_text" text NOT NULL,
	"total_resources" integer DEFAULT 0 NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"validation_result_id" integer NOT NULL,
	"server_id" integer NOT NULL,
	"resource_type" text NOT NULL,
	"fhir_id" text NOT NULL,
	"aspect" varchar(50) NOT NULL,
	"fhir_version" varchar(10) DEFAULT 'R4' NOT NULL,
	"severity" varchar(20) NOT NULL,
	"code" varchar(100),
	"canonical_path" varchar(256) NOT NULL,
	"text" text NOT NULL,
	"normalized_text" varchar(512) NOT NULL,
	"rule_id" varchar(100),
	"signature" varchar(64) NOT NULL,
	"signature_version" integer DEFAULT 1 NOT NULL,
	"path_truncated" boolean DEFAULT false,
	"text_truncated" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "validation_results_per_aspect" (
	"id" serial PRIMARY KEY NOT NULL,
	"server_id" integer NOT NULL,
	"resource_type" text NOT NULL,
	"fhir_id" text NOT NULL,
	"aspect" varchar(50) NOT NULL,
	"fhir_version" varchar(10) DEFAULT 'R4' NOT NULL,
	"is_valid" boolean NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"warning_count" integer DEFAULT 0 NOT NULL,
	"information_count" integer DEFAULT 0 NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"settings_snapshot_hash" varchar(64) NOT NULL,
	"validated_at" timestamp DEFAULT now() NOT NULL,
	"duration_ms" integer DEFAULT 0,
	"validation_engine_version" varchar(20) DEFAULT '1.0.0',
	"detailed_result" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "edit_audit_trail" ADD CONSTRAINT "edit_audit_trail_server_id_fhir_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."fhir_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "fhir_resources" ADD CONSTRAINT "fhir_resources_server_id_fhir_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."fhir_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_progress_state" ADD CONSTRAINT "validation_progress_state_server_id_fhir_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."fhir_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_resource_id_fhir_resources_id_fk" FOREIGN KEY ("resource_id") REFERENCES "public"."fhir_resources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_server_id_fhir_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."fhir_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_profile_id_validation_profiles_id_fk" FOREIGN KEY ("profile_id") REFERENCES "public"."validation_profiles"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results" ADD CONSTRAINT "validation_results_validation_settings_id_validation_settings_id_fk" FOREIGN KEY ("validation_settings_id") REFERENCES "public"."validation_settings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_settings" ADD CONSTRAINT "validation_settings_server_id_fhir_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."fhir_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_message_groups" ADD CONSTRAINT "validation_message_groups_server_id_fhir_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."fhir_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_messages" ADD CONSTRAINT "validation_messages_validation_result_id_validation_results_per_aspect_id_fk" FOREIGN KEY ("validation_result_id") REFERENCES "public"."validation_results_per_aspect"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_messages" ADD CONSTRAINT "validation_messages_server_id_fhir_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."fhir_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "validation_results_per_aspect" ADD CONSTRAINT "validation_results_per_aspect_server_id_fhir_servers_id_fk" FOREIGN KEY ("server_id") REFERENCES "public"."fhir_servers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "validation_message_groups_unique_server_signature" ON "validation_message_groups" USING btree ("server_id","signature");--> statement-breakpoint
CREATE INDEX "validation_message_groups_aspect_severity_idx" ON "validation_message_groups" USING btree ("server_id","aspect","severity");--> statement-breakpoint
CREATE INDEX "validation_messages_signature_idx" ON "validation_messages" USING btree ("server_id","signature");--> statement-breakpoint
CREATE INDEX "validation_messages_aspect_severity_idx" ON "validation_messages" USING btree ("server_id","aspect","severity");--> statement-breakpoint
CREATE INDEX "validation_messages_resource_idx" ON "validation_messages" USING btree ("server_id","resource_type","fhir_id");--> statement-breakpoint
CREATE INDEX "idx_validation_messages_version" ON "validation_messages" USING btree ("fhir_version");--> statement-breakpoint
CREATE INDEX "validation_results_resource_aspect_idx" ON "validation_results_per_aspect" USING btree ("server_id","resource_type","fhir_id","aspect");--> statement-breakpoint
CREATE INDEX "validation_results_aspect_severity_idx" ON "validation_results_per_aspect" USING btree ("server_id","aspect","error_count","warning_count");--> statement-breakpoint
CREATE INDEX "validation_results_validated_at_idx" ON "validation_results_per_aspect" USING btree ("validated_at");--> statement-breakpoint
CREATE INDEX "idx_validation_results_per_aspect_version_aspect" ON "validation_results_per_aspect" USING btree ("fhir_version","aspect");--> statement-breakpoint
CREATE INDEX "idx_validation_results_per_aspect_server_version" ON "validation_results_per_aspect" USING btree ("server_id","fhir_version");--> statement-breakpoint
CREATE UNIQUE INDEX "validation_results_unique_resource_aspect" ON "validation_results_per_aspect" USING btree ("server_id","resource_type","fhir_id","aspect","settings_snapshot_hash");