#!/usr/bin/env node

// Load .env file
require("dotenv").config();

console.log("🔧 Environment variables loaded from .env");
console.log("📍 AWS Region:", process.env.AWS_REGION);
console.log("📊 DynamoDB Table:", process.env.DYNAMODB_TABLE_NAME);

// Start Remix server
const path = require("path");
const serverBuild = path.join(process.cwd(), "build", "server", "index.js");

console.log("🚀 Starting Remix server...\n");

// Import and run the Remix CLI
require("@remix-run/serve/dist/cli.js");
