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
import axios from 'axios';
import { searchWeb } from '../search/index.js';
import { crawlWebsites } from '../crawler/index.js';

class CrawlerMcpServer {
  constructor() {
    this.server = new Server(
      {
        name: 'crawler-mcp-server',
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
          name: 'search',
          description: 'Search for information on the web',
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
              }
            },
            required: ['query']
          }
        },
        {
          name: 'crawl',
          description: 'Crawl a specific URL and extract content',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to crawl'
              },
              selector: {
                type: 'string',
                description: 'CSS selector to extract content',
                default: 'body'
              }
            },
            required: ['url']
          }
        },
        {
          name: 'extract_links',
          description: 'Extract links from a webpage',
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'The URL to extract links from'
              },
              maxLinks: {
                type: 'number',
                description: 'Maximum number of links to return',
                default: 10
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
          case 'search':
            return await this.handleSearch(request.params.arguments);
          case 'crawl':
            return await this.handleCrawl(request.params.arguments);
          case 'extract_links':
            return await this.handleExtractLinks(request.params.arguments);
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

  async handleSearch(args) {
    const { query, maxResults = 5 } = args;
    
    console.error(`Searching for: "${query}"`);
    
    try {
      // Process the query to extract search terms
      const searchTerms = this.analyzeQuery(query);
      
      // Search for relevant websites
      const searchResults = await searchWeb(searchTerms, {
        depth: 3,
        timeout: 30000,
        cache: true,
        verbose: true
      });
      
      // Limit results
      const limitedResults = searchResults.slice(0, maxResults);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query,
              urls: limitedResults.map(result => result.url),
              titles: limitedResults.map(result => result.title),
              descriptions: limitedResults.map(result => result.description)
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('Error in search:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error searching: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async handleCrawl(args) {
    const { url, selector = 'body' } = args;
    
    console.error(`Crawling: ${url}`);
    
    try {
      // Initialize browser if needed
      await this.initBrowser();
      
      // Open a new page
      const page = await this.browser.newPage();
      
      try {
        // Navigate to the URL
        await page.goto(url, { waitUntil: 'DOMContentLoaded', timeout: 30000 });
        
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
                content: content.substring(0, 5000) // Limit content length
              }, null, 2)
            }
          ]
        };
      } finally {
        // Close the page
        await page.close();
      }
    } catch (error) {
      console.error(`Error crawling ${url}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error crawling ${url}: ${error.message || 'Unknown error'}`
          }
        ],
        isError: true
      };
    }
  }

  async handleExtractLinks(args) {
    const { url, maxLinks = 10 } = args;
    
    console.error(`Extracting links from: ${url}`);
    
    try {
      // Initialize browser if needed
      await this.initBrowser();
      
      // Open a new page
      const page = await this.browser.newPage();
      
      try {
        // Navigate to the URL
        await page.goto(url, { waitUntil: 'DOMContentLoaded', timeout: 30000 });
        
        // Extract links
        const links = await page.evaluate(() => {
          const anchors = Array.from(document.querySelectorAll('a[href]'));
          return anchors.map(anchor => {
            const href = anchor.href;
            const text = anchor.innerText.trim();
            return { href, text };
          });
        });
        
        // Filter out invalid links and limit the number
        const validLinks = links
          .filter(link => link.href && link.href.startsWith('http'))
          .slice(0, maxLinks);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                url,
                links: validLinks
              }, null, 2)
            }
          ]
        };
      } finally {
        // Close the page
        await page.close();
      }
    } catch (error) {
      console.error(`Error extracting links from ${url}:`, error);
      return {
        content: [
          {
            type: 'text',
            text: `Error extracting links from ${url}: ${error.message || 'Unknown error'}`
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

  analyzeQuery(query) {
    // Simple implementation: remove common words and split into terms
    const stopWords = ['what', 'is', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'like', 'through', 'over', 'before', 'between', 'after', 'since', 'without', 'under', 'within', 'along', 'following', 'across', 'behind', 'beyond', 'plus', 'except', 'but', 'up', 'out', 'around', 'down', 'off', 'above', 'near'];
    
    // Convert to lowercase and remove punctuation
    const cleanQuery = query.toLowerCase().replace(/[^\w\s]/g, '');
    
    // Split into words and filter out stop words
    const words = cleanQuery.split(/\s+/).filter(word => !stopWords.includes(word));
    
    // Return unique words
    return [...new Set(words)];
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Crawler MCP server running on stdio');
  }
}

const server = new CrawlerMcpServer();
server.run().catch(console.error);
