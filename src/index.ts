#!/usr/bin/env node
import 'dotenv/config';
import { runCLI } from './cli/index.js';

/**
 * Main entry point for the AI Web Crawler CLI tool
 */
async function main() {
  try {
    await runCLI();
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

main();
