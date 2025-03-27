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

// Simple function to create a unique request ID
function generateRequestId() {
  return Math.random().toString(36).substring(2, 15);
}

/**
 * AI Web Crawler Test Script
 * 
 * This script tests the AI Web Crawler by:
 * 1. Starting the MCP server
 * 2. Listing available tools
 * 3. Performing a search
 * 4. Crawling a specific page
 * 
 * To use real search API and AI summarization, set the following environment variables:
 * - BRAVE_API_KEY: Your Brave Search API key
 * - OPENAI_API_KEY: Your OpenAI API key
 * - OPENAI_MODEL: (Optional) The OpenAI model to use (default: gpt-3.5-turbo)
 * 
 * Example usage:
 * BRAVE_API_KEY=your_key OPENAI_API_KEY=your_key node test-ai-search.js
 */
async function runAiSearchTest() {
  console.log('Starting AI search test...');
  
  // Check for API keys
  if (!process.env.BRAVE_API_KEY) {
    console.warn('\nWARNING: Brave Search API key not found. Will use mock search results.');
    console.warn('To use real search, set BRAVE_API_KEY environment variable.');
  }
  
  if (!process.env.OPENAI_API_KEY) {
    console.warn('\nWARNING: OpenAI API key not found. Will use basic summarization.');
    console.warn('To use AI summarization, set OPENAI_API_KEY environment variable.');
  }
  
  // Start the MCP server
  const serverProcess = spawn('node', ['build/index.js', "what is price of iphone 16"], {
    stdio: ['pipe', 'pipe', 'inherit'],
    env: {
      ...process.env,
      // Pass through API keys
      BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
      OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
      OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
    }
  });
  
  // Set up communication with the server
  const stdin = serverProcess.stdin;
  const stdout = serverProcess.stdout;
  
  // Create a promise-based function to send a request and wait for a response
  function sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = generateRequestId();
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };
      
      // Set up a listener for the response
      const onData = (data) => {
        const rawData = data.toString();
        try {
          // Try to parse as JSON
          const response = JSON.parse(rawData);
          if (response.id === id) {
            stdout.removeListener('data', onData);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          // If parsing fails, check if it's markdown content
          console.error('Error parsing response as JSON:', error.message);
          console.log('Raw content received:');
          console.log('----------------------------------------');
          console.log(rawData);
          console.log('----------------------------------------');
          console.log('This appears to be invalid JSON. Possibly markdown content.');
        }
      };
      
      stdout.on('data', onData);
      
      // Send the request
      stdin.write(JSON.stringify(request) + '\n');
    });
  }
  
  try {
    // List available tools
    console.log('Listing available tools...');
    const toolsResult = await sendRequest('tools/list', {});
    console.log('Available tools:', toolsResult.tools.map(t => t.name));
    
    // Perform a search
    const query = 'what is the price of Latitude 5480 in afghanistan?';
    console.log(`\nSearching for: "${query}"...`);
    
    const searchResult = await sendRequest('tools/call', {
      name: 'search_web',
      arguments: {
        query,
        maxResults: 3,
        enhanceWithAI: true
      }
    });
    
    // Display the search results
    console.log('\nSearch Results:');
    console.log(searchResult.content[0].text);
    
    // Save the search results as HTML and open in browser
    const searchHtmlContent = searchResult.content[0].text;
    const searchHtmlFilePath = path.join(__dirname, 'search-results.html');
    fs.writeFileSync(searchHtmlFilePath, searchHtmlContent);
    console.log(`\nSaved search results to ${searchHtmlFilePath}`);
    
    // Open the HTML file in the default browser
    openInBrowser(searchHtmlFilePath);
    
    // Crawl a specific page
    const url = 'https://www.apple.com';
    console.log(`\nCrawling page: ${url}...`);
    
    const crawlResult = await sendRequest('tools/call', {
      name: 'crawl_page',
      arguments: {
        url,
        extractText: true,
        takeScreenshot: true
      }
    });
    
    // Display the crawl results
    console.log('\nCrawl Results:');
    
    // Extract HTML content if available
    let crawlHtmlContent = '';
    crawlResult.content.forEach(item => {
      console.log(item.text);
      if (item.type === 'html') {
        crawlHtmlContent = item.text;
      }
    });
    
    // If HTML content is available, save and open in browser
    if (crawlHtmlContent) {
      const crawlHtmlFilePath = path.join(__dirname, 'crawl-results.html');
      fs.writeFileSync(crawlHtmlFilePath, crawlHtmlContent);
      console.log(`\nSaved crawl results to ${crawlHtmlFilePath}`);
      
      // Open the HTML file in the default browser
      openInBrowser(crawlHtmlFilePath);
    }
    
    console.log('\nTest completed successfully!');
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Close the server process
    serverProcess.kill();
    console.log('Server process terminated');
  }
}

runAiSearchTest().catch(console.error);

/**
 * Open a file in the default browser
 * 
 * @param {string} filePath Path to the file to open
 */
function openInBrowser(filePath) {
  const fileUrl = `file://${filePath}`;
  
  // Determine the platform-specific command to open a URL
  let command;
  switch (process.platform) {
    case 'darwin': // macOS
      command = `open "${fileUrl}"`;
      break;
    case 'win32': // Windows
      command = `start "" "${fileUrl}"`;
      break;
    default: // Linux and others
      command = `xdg-open "${fileUrl}"`;
      break;
  }
  
  // Execute the command
  exec(command, (error) => {
    if (error) {
      console.error(`Error opening browser: ${error.message}`);
    } else {
      console.log(`Opened ${filePath} in browser`);
    }
  });
}
