#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { exec } from 'child_process';
import 'dotenv/config';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Test script for clustering functionality in the AI Web Crawler
 * 
 * This script tests the clustering functionality by:
 * 1. Running a query with clustering enabled
 * 2. Running the same query with clustering disabled
 * 3. Comparing the results
 * 
 * To use real search API and AI summarization, set the following environment variables:
 * - BRAVE_API_KEY: Your Brave Search API key
 * - OPENAI_API_KEY: Your OpenAI API key
 * 
 * Example usage:
 * BRAVE_API_KEY=your_key OPENAI_API_KEY=your_key node test-clustering.js
 */
async function runClusteringTest() {
  console.log('Starting clustering test...');
  
  // Check for API keys
  if (!process.env.BRAVE_API_KEY) {
    console.warn('\nWARNING: Brave Search API key not found. Will use mock search results.');
    console.warn('To use real search, set BRAVE_API_KEY environment variable.');
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('\nWARNING: OpenAI API key not found. Will use basic summarization.');
    console.warn('To use AI summarization, set OPENAI_API_KEY environment variable.');
  }
  
  // Define the query to test
  const query = 'compare top laptop brands';
  
  // Test with clustering enabled
  console.log('\n=== Testing with clustering enabled ===');
  await runTest(query, true, 'domain', 4);
  
  // Test with clustering disabled
  console.log('\n=== Testing with clustering disabled ===');
  await runTest(query, false, 'domain', 4);
  
  // Test with different clustering methods
  console.log('\n=== Testing with TLD clustering ===');
  await runTest(query, true, 'tld', 4);
  
  console.log('\nClustering tests completed!');
}

/**
 * Run a test with specific clustering configuration
 * 
 * @param {string} query The query to search for
 * @param {boolean} clusterEnabled Whether clustering is enabled
 * @param {string} clusterBy How to cluster URLs (domain, tld)
 * @param {number} maxClusters Maximum number of clusters
 */
async function runTest(query, clusterEnabled, clusterBy, maxClusters) {
  return new Promise((resolve, reject) => {
    console.log(`Running query: "${query}"`);
    console.log(`Clustering: ${clusterEnabled ? 'Enabled' : 'Disabled'}`);
    if (clusterEnabled) {
      console.log(`Cluster by: ${clusterBy}`);
      console.log(`Max clusters: ${maxClusters}`);
    }
    
    // Build the command arguments
    const args = [
      'build/index.js',
      query,
      '--verbose',
      '--depth', '5',
      '--concurrency', '3',
      '--cluster-enabled', clusterEnabled.toString(),
      '--max-clusters', maxClusters.toString(),
      '--cluster-by', clusterBy
    ];
    
    // Start the CLI process
    const cliProcess = spawn('node', args, {
      stdio: 'pipe',
      env: {
        ...process.env,
        // Pass through API keys
        BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
      }
    });
    
    // Collect output
    let output = '';
    cliProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      process.stdout.write(chunk);
    });
    
    cliProcess.stderr.on('data', (data) => {
      const chunk = data.toString();
      // Only log verbose output that contains clustering information
      if (chunk.includes('cluster') || chunk.includes('Cluster')) {
        process.stderr.write(chunk);
      }
    });
    
    // Handle process completion
    cliProcess.on('close', (code) => {
      if (code === 0) {
        // Save the output to a file
        const filename = `clustering-test-${clusterEnabled ? 'enabled' : 'disabled'}-${clusterBy}.md`;
        const outputPath = path.join(__dirname, filename);
        fs.writeFileSync(outputPath, output);
        console.log(`\nSaved output to ${outputPath}`);
        resolve();
      } else {
        console.error(`\nProcess exited with code ${code}`);
        reject(new Error(`Process exited with code ${code}`));
      }
    });
  });
}

runClusteringTest().catch(console.error);
