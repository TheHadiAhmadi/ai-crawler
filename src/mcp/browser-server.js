#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import puppeteer from 'puppeteer';
import fs from 'fs';
import path from 'path';

class BrowserMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'browser-mcp-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          resources: {},
          tools: {}
        }
      }
    );

    this.browser = null;
    this.setupHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.closeBrowser();
      await this.server.close();
      process.exit(0);
    });
  }

  setupHandlers() {
    // Resource handlers
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => ({
      resources: []
    }));

    this.server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
      resourceTemplates: []
    }));

    this.server.setRequestHandler(ReadResourceRequestSchema, async () => ({
      contents: []
    }));

    // Tool handlers
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'launch_browser',
          description: 'Launch a browser and navigate to a URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to navigate to'
              },
              headless: {
                type: 'boolean',
                description: 'Whether to run the browser in headless mode',
                default: true
              }
            },
            required: ['url']
          }
        },
        {
          name: 'close_browser',
          description: 'Close the browser',
          inputSchema: {
            type: 'object',
            properties: {}
          }
        },
        {
          name: 'navigate_to',
          description: 'Navigate to a URL',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to navigate to'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'click_element',
          description: 'Click an element on the page',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the element to click'
              }
            },
            required: ['selector']
          }
        },
        {
          name: 'type_text',
          description: 'Type text into an input field',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the input field'
              },
              text: {
                type: 'string',
                description: 'Text to type'
              }
            },
            required: ['selector', 'text']
          }
        },
        {
          name: 'take_screenshot',
          description: 'Take a screenshot of the current page',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to save the screenshot'
              }
            },
            required: ['path']
          }
        },
        {
          name: 'extract_content',
          description: 'Extract content from the current page',
          inputSchema: {
            type: 'object',
            properties: {
              selector: {
                type: 'string',
                description: 'CSS selector for the content to extract',
                default: 'body'
              }
            }
          }
        },
        {
          name: 'visit_and_extract',
          description: 'Visit a URL and extract content',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to visit'
              },
              selector: {
                type: 'string',
                description: 'CSS selector for the content to extract',
                default: 'body'
              }
            },
            required: ['url']
          }
        }
      ]
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'launch_browser':
            return await this.handleLaunchBrowser(request.params.arguments);
          case 'close_browser':
            return await this.handleCloseBrowser();
          case 'navigate_to':
            return await this.handleNavigateTo(request.params.arguments);
          case 'click_element':
            return await this.handleClickElement(request.params.arguments);
          case 'type_text':
            return await this.handleTypeText(request.params.arguments);
          case 'take_screenshot':
            return await this.handleTakeScreenshot(request.params.arguments);
          case 'extract_content':
            return await this.handleExtractContent(request.params.arguments);
          case 'visit_and_extract':
            return await this.handleVisitAndExtract(request.params.arguments);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        console.error(`Error handling tool call ${request.params.name}:`, error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message || 'Unknown error'}`
            }
          ],
          isError: true
        };
      }
    });
  }

  async handleLaunchBrowser(args) {
    const { url, headless = true } = args;
    
    console.error(`Launching browser and navigating to: ${url}`);
    
    try {
      // Close existing browser if any
      await this.closeBrowser();
      
      // Launch a new browser
      this.browser = await puppeteer.launch({
        headless: headless ? 'new' : false,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      
      // Open a new page
      const page = await this.browser.newPage();
      
      // Navigate to the URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      return {
        content: [
          {
            type: 'text',
            text: `Browser launched and navigated to ${url}`
          }
        ]
      };
    } catch (error) {
      console.error('Error launching browser:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error launching browser: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async handleCloseBrowser() {
    console.error('Closing browser');
    
    try {
      await this.closeBrowser();
      
      return {
        content: [
          {
            type: 'text',
            text: 'Browser closed'
          }
        ]
      };
    } catch (error) {
      console.error('Error closing browser:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error closing browser: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async handleNavigateTo(args) {
    const { url } = args;
    
    console.error(`Navigating to: ${url}`);
    
    try {
      // Check if browser is initialized
      if (!this.browser) {
        throw new Error('Browser not initialized. Call launch_browser first.');
      }
      
      // Get the first page
      const pages = await this.browser.pages();
      const page = pages[0];
      
      // Navigate to the URL
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
      
      return {
        content: [
          {
            type: 'text',
            text: `Navigated to ${url}`
          }
        ]
      };
    } catch (error) {
      console.error(`Error navigating to ${url}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error navigating to ${url}: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async handleClickElement(args) {
    const { selector } = args;
    
    console.error(`Clicking element: ${selector}`);
    
    try {
      // Check if browser is initialized
      if (!this.browser) {
        throw new Error('Browser not initialized. Call launch_browser first.');
      }
      
      // Get the first page
      const pages = await this.browser.pages();
      const page = pages[0];
      
      // Wait for the selector to be available
      await page.waitForSelector(selector, { timeout: 10000 });
      
      // Click the element
      await page.click(selector);
      
      return {
        content: [
          {
            type: 'text',
            text: `Clicked element: ${selector}`
          }
        ]
      };
    } catch (error) {
      console.error(`Error clicking element ${selector}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error clicking element ${selector}: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async handleTypeText(args) {
    const { selector, text } = args;
    
    console.error(`Typing text into element: ${selector}`);
    
    try {
      // Check if browser is initialized
      if (!this.browser) {
        throw new Error('Browser not initialized. Call launch_browser first.');
      }
      
      // Get the first page
      const pages = await this.browser.pages();
      const page = pages[0];
      
      // Wait for the selector to be available
      await page.waitForSelector(selector, { timeout: 10000 });
      
      // Clear the input field
      await page.evaluate((sel) => {
        document.querySelector(sel).value = '';
      }, selector);
      
      // Type the text
      await page.type(selector, text);
      
      return {
        content: [
          {
            type: 'text',
            text: `Typed text into element: ${selector}`
          }
        ]
      };
    } catch (error) {
      console.error(`Error typing text into element ${selector}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error typing text into element ${selector}: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async handleTakeScreenshot(args) {
    const { path: screenshotPath } = args;
    
    console.error(`Taking screenshot and saving to: ${screenshotPath}`);
    
    try {
      // Check if browser is initialized
      if (!this.browser) {
        throw new Error('Browser not initialized. Call launch_browser first.');
      }
      
      // Get the first page
      const pages = await this.browser.pages();
      const page = pages[0];
      
      // Create directory if it doesn't exist
      const directory = path.dirname(screenshotPath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }
      
      // Take the screenshot
      await page.screenshot({ path: screenshotPath });
      
      return {
        content: [
          {
            type: 'text',
            text: `Screenshot saved to: ${screenshotPath}`
          }
        ]
      };
    } catch (error) {
      console.error(`Error taking screenshot:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error taking screenshot: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async handleExtractContent(args) {
    const { selector = 'body' } = args;
    
    console.error(`Extracting content from element: ${selector}`);
    
    try {
      // Check if browser is initialized
      if (!this.browser) {
        throw new Error('Browser not initialized. Call launch_browser first.');
      }
      
      // Get the first page
      const pages = await this.browser.pages();
      const page = pages[0];
      
      // Wait for the selector to be available
      await page.waitForSelector(selector, { timeout: 10000 });
      
      // Extract content
      const content = await page.evaluate((sel) => {
        const element = document.querySelector(sel);
        return element ? element.innerText : '';
      }, selector);
      
      // Get the current URL
      const url = page.url();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              url,
              text: content
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error(`Error extracting content:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error extracting content: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async handleVisitAndExtract(args) {
    const { url, selector = 'body' } = args;
    
    console.error(`Visiting ${url} and extracting content from element: ${selector}`);
    
    try {
      // Initialize browser if needed
      await this.initBrowser();
      
      // Open a new page
      const page = await this.browser.newPage();
      
      try {
        // Navigate to the URL
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        
        // Wait for the selector to be available
        await page.waitForSelector(selector, { timeout: 10000 });
        
        // Extract content
        const content = await page.evaluate((sel) => {
          const element = document.querySelector(sel);
          return element ? element.innerText : '';
        }, selector);
        
        // Extract title
        const title = await page.title();
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                url,
                title,
                text: content
              }, null, 2)
            }
          ]
        };
      } finally {
        // Close the page
        await page.close();
      }
    } catch (error) {
      console.error(`Error visiting and extracting content from ${url}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error visiting and extracting content from ${url}: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async initBrowser() {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
    }
    return this.browser;
  }

  async closeBrowser() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Browser MCP server running on stdio');
  }
}

const server = new BrowserMcpServer();
server.run().catch(console.error);
