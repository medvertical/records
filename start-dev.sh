#!/bin/bash
# Start development server with Java in PATH for HAPI validator

export PATH="/opt/homebrew/opt/openjdk@17/bin:$PATH"
export NODE_ENV=development

exec npx tsx server/dev-server.ts

