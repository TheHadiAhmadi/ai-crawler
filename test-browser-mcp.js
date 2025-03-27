#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/dist/esm/client/index.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the HTML file (absolute path)
const htmlFilePath = path.resolve(__dirname, 'test-browser.html');
const fileUrl = `file://${htmlFilePath}`;

async function runBrowserTest() {
  console.log('Starting browser MCP test...');
  
  // Connect to the MCP server
  const serverProcess = spawn('node', ['build/index.js'], {
    stdio: ['pipe', 'pipe', 'pipe']
  });
  
  // Create a transport that uses the server process's stdio
  const transport = {
    send: (message) => {
      serverProcess.stdin.write(JSON.stringify(message) + '\n');
    },
    receive: () => {
      return new Promise((resolve) => {
        serverProcess.stdout.once('data', (data) => {
          const message = JSON.parse(data.toString());
          resolve(message);
        });
      });
    },
    close: async () => {
      serverProcess.kill();
    }
  };
  
  const client = new Client();
  
  try {
    // Custom connect function since we're not using a standard transport
    client.transport = transport;
    console.log('Connected to MCP server');
    
    // List available tools
    const tools = await client.listTools();
    console.log('Available tools:', tools.tools.map(t => t.name));
    
    // Launch browser and navigate to the test HTML file
    console.log(`Launching browser and navigating to ${fileUrl}`);
    const launchResult = await client.callTool('launch_browser', {
      url: fileUrl,
      headless: false
    });
    console.log('Browser launched');
    
    // Wait a bit for the page to fully load
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Type text in the input field
    console.log('Typing text in the input field');
    await client.callTool('type_text', {
      selector: '#textInput',
      text: 'Hello from MCP Browser Integration!'
    });
    
    // Click the submit button
    console.log('Clicking the submit button');
    await client.callTool('click_element', {
      selector: '#submitBtn'
    });
    
    // Wait a bit for the result to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Click Button 2
    console.log('Clicking Button 2');
    await client.callTool('click_element', {
      selector: '#btn2'
    });
    
    // Wait a bit for the result to update
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Navigate to Section 3
    console.log('Navigating to Section 3');
    await client.callTool('click_element', {
      selector: '#section3Btn'
    });
    
    // Wait a bit for the section to display
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Take a screenshot
    console.log('Taking a screenshot');
    await client.callTool('take_screenshot', {
      path: 'browser-test-screenshot.png'
    });
    
    // Close the browser
    console.log('Closing the browser');
    await client.callTool('close_browser', {});
    
    console.log('Browser test completed successfully!');
    console.log('Screenshot saved to browser-test-screenshot.png');
  } catch (error) {
    console.error('Error during browser test:', error);
  } finally {
    // Disconnect from the MCP server
    await client.disconnect();
    console.log('Disconnected from MCP server');
    process.exit(0);
  }
}

runBrowserTest().catch(console.error);
