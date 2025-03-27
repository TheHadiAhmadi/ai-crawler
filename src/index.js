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
import { searchWeb } from './search/index.js';
import { crawlWebsites } from './crawler/index.js';
import { extractContent } from './extractor/index.js';
import { formatResults } from './formatter/index.js';
import { McpClientManager } from './mcp/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class AICrawlerMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'ai-crawler-mcp-server',
        version: '0.1.0'
      },
      {
        capabilities: {
          resources: {},
          tools: {}
        }
      }
    );

    // MCP client manager
    this.mcpManager = new McpClientManager();
    
    // Paths to MCP server scripts
    this.crawlerServerPath = path.resolve(__dirname, './mcp/crawler-server.js');
    this.browserServerPath = path.resolve(__dirname, './mcp/browser-server.js');

    this.setupHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.disconnectMcpClients();
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
          name: 'search_web',
          description: 'Search the web for information based on a query',
          inputSchema: {
            type: 'object',
            properties: {
              query: {
                type: 'string',
                description: 'The search query'
              },
              maxResults: {
                type: 'number',
                description: 'Maximum number of results to return',
                default: 5
              },
              enhanceWithAI: {
                type: 'boolean',
                description: 'Whether to enhance results with AI',
                default: true
              }
            },
            required: ['query']
          }
        },
        {
          name: 'crawl_page',
          description: 'Crawl a specific web page and extract information',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to crawl'
              },
              extractText: {
                type: 'boolean',
                description: 'Whether to extract text content',
                default: true
              },
              takeScreenshot: {
                type: 'boolean',
                description: 'Whether to take a screenshot',
                default: false
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
          case 'search_web':
            return await this.handleSearchWeb(request.params.arguments);
          case 'crawl_page':
            return await this.handleCrawlPage(request.params.arguments);
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

  /**
   * Connect to MCP clients
   */
  async connectMcpClients() {
    try {
      console.error('Connecting to MCP clients...');
      
      // Connect to crawler MCP server
      await this.mcpManager.connectToServer(
        'crawler',
        'node',
        [this.crawlerServerPath],
        {}
      );
      
      // Connect to browser MCP server
      await this.mcpManager.connectToServer(
        'browser',
        'node',
        [this.browserServerPath],
        {}
      );
      
      console.error('Connected to MCP clients');
    } catch (error) {
      console.error('Error connecting to MCP clients:', error);
      throw error;
    }
  }
  
  /**
   * Disconnect from MCP clients
   */
  async disconnectMcpClients() {
    try {
      await this.mcpManager.disconnectAll();
      console.error('Disconnected from MCP clients');
    } catch (error) {
      console.error('Error disconnecting from MCP clients:', error);
    }
  }

  /**
   * Handle search_web tool
   */
  async handleSearchWeb(args) {
    const { query, maxResults = 5, enhanceWithAI = true } = args;
    
    console.error(`Searching web for: "${query}"`);
    
    try {
      // Connect to MCP clients if not already connected
      await this.connectMcpClients();
      
      // Get crawler client
      const crawlerClient = this.mcpManager.getClient('crawler');
      if (!crawlerClient) {
        throw new Error('Crawler client not connected');
      }
      
      // Get browser client
      const browserClient = this.mcpManager.getClient('browser');
      if (!browserClient) {
        throw new Error('Browser client not connected');
      }
      
      // Step 1: Use crawler to search
      console.error('Searching with crawler...');
      const searchResponse = await crawlerClient.callTool('search', {
        query,
        maxResults
      });
      
      // Parse search results
      const searchResults = JSON.parse(searchResponse.content[0].text);
      
      // Step 2: Use browser to visit and extract content from top results
      console.error('Extracting content with browser...');
      const extractedContents = [];
      
      for (let i = 0; i < searchResults.urls.length; i++) {
        const url = searchResults.urls[i];
        const title = searchResults.titles[i];
        const description = searchResults.descriptions[i];
        
        try {
          // Visit and extract content
          const extractResponse = await browserClient.callTool('visit_and_extract', {
            url,
            selector: 'body'
          });
          
          // Parse extracted content
          const extractedData = JSON.parse(extractResponse.content[0].text);
          
          extractedContents.push({
            url,
            title: title || extractedData.title,
            content: extractedData.text,
            relevance: 1.0 - (i * 0.1), // Simple relevance score based on search position
            source: new URL(url).hostname,
            timestamp: new Date().toISOString()
          });
        } catch (error) {
          console.error(`Error extracting content from ${url}:`, error);
          // Continue with next URL
        }
      }
      
      // Step 3: Format the results in markdown
      console.error('Formatting results...');
      const formattedResults = await formatResults(extractedContents, query, {
        depth: 2,
        timeout: 30000,
        cache: true,
        verbose: true
      });
      
      return {
        content: [
          {
            type: 'text',
            text: formattedResults
          }
        ]
      };
    } catch (error) {
      console.error('Error in search_web:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error searching the web: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  /**
   * Handle crawl_page tool
   */
  async handleCrawlPage(args) {
    const { url, extractText = true, takeScreenshot = false } = args;
    
    console.error(`Crawling page: ${url}`);
    
    try {
      // Connect to MCP clients if not already connected
      await this.connectMcpClients();
      
      // Get browser client
      const browserClient = this.mcpManager.getClient('browser');
      if (!browserClient) {
        throw new Error('Browser client not connected');
      }
      
      let content = [];
      
      // Extract text content
      if (extractText) {
        const extractResponse = await browserClient.callTool('visit_and_extract', {
          url,
          selector: 'body'
        });
        
        // Parse extracted content
        const extractedData = JSON.parse(extractResponse.content[0].text);
        
        content.push({
          type: 'text',
          text: `# Content from ${url}\n\n${extractedData.text}`
        });
      }
      
      // Take screenshot
      if (takeScreenshot) {
        // Launch browser if not already launched
        await browserClient.callTool('launch_browser', {
          url,
          headless: true
        });
        
        // Take screenshot
        const screenshotPath = `screenshot-${Date.now()}.png`;
        await browserClient.callTool('take_screenshot', {
          path: screenshotPath
        });
        
        content.push({
          type: 'text',
          text: `Screenshot saved to: ${screenshotPath}`
        });
        
        // Close browser
        await browserClient.callTool('close_browser', {});
      }
      
      return {
        content: content.length > 0 ? content : [
          {
            type: 'text',
            text: `Successfully crawled ${url}, but no content was extracted.`
          }
        ]
      };
    } catch (error) {
      console.error('Error in crawl_page:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error crawling page: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }


  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('AI Crawler MCP server running on stdio');
  }
}

const server = new AICrawlerMcpServer();
server.run().catch(console.error);
