#!/usr/bin/env node
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the HTML file (absolute path)
const htmlFilePath = path.resolve(__dirname, 'test-browser.html');
const fileUrl = `file://${htmlFilePath}`;

// Simple function to create a unique request ID
function generateRequestId() {
  return Math.random().toString(36).substring(2, 15);
}

async function runSimpleTest() {
  console.log('Starting simple browser MCP test...');
  
  // Start the MCP server
  const serverProcess = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'inherit']
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
        try {
          const response = JSON.parse(data.toString());
          console.log('Response:', JSON.stringify(response, null, 2));
          if (response.id === id) {
            stdout.removeListener('data', onData);
            if (response.error) {
              reject(new Error(response.error.message));
            } else {
              resolve(response.result);
            }
          }
        } catch (error) {
          console.error('Error parsing response:', error);
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
    
    // Launch browser and navigate to the test HTML file
    console.log(`Launching browser and navigating to ${fileUrl}...`);
    const launchResult = await sendRequest('tools/call', {
      name: 'launch_browser',
      arguments: {
        url: fileUrl,
        headless: false
      }
    });
    console.log('Browser launched');
    
    // Wait a bit for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Type text in the input field
    console.log('Typing text in the input field...');
    await sendRequest('tools/call', {
      name: 'type_text',
      arguments: {
        selector: '#textInput',
        text: 'Hello from MCP Browser Integration!'
      }
    });
    
    // Click the submit button
    console.log('Clicking the submit button...');
    await sendRequest('tools/call', {
      name: 'click_element',
      arguments: {
        selector: '#submitBtn'
      }
    });
    
    // Wait a bit for the result to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take a screenshot
    console.log('Taking a screenshot...');
    const screenshotResult = await sendRequest('tools/call', {
      name: 'take_screenshot',
      arguments: {
        path: 'browser-test-screenshot.png'
      }
    });
    
    // Close the browser
    console.log('Closing the browser...');
    await sendRequest('tools/call', {
      name: 'close_browser',
      arguments: {}
    });
    
    console.log('Test completed successfully!');
    console.log('Screenshot saved to browser-test-screenshot.png');
  } catch (error) {
    console.error('Error during test:', error);
  } finally {
    // Close the server process
    serverProcess.kill();
    console.log('Server process terminated');
  }
}

runSimpleTest().catch(console.error);
