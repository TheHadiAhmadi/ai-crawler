import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { ChildProcessTransport } from '@modelcontextprotocol/sdk/client/child-process.js';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * MCP Client Manager
 * Manages connections to external MCP servers
 */
export class McpClientManager {
  constructor() {
    this.clients = new Map();
  }

  /**
   * Connect to an MCP server
   * @param {string} name - Name of the server
   * @param {string} command - Command to start the server
   * @param {string[]} args - Arguments for the command
   * @param {Object} env - Environment variables
   * @returns {Promise<Client>} - Connected client
   */
  async connectToServer(name, command, args = [], env = {}) {
    if (this.clients.has(name)) {
      return this.clients.get(name).client;
    }

    try {
      console.error(`Connecting to MCP server: ${name}`);
      
      // Add API keys to environment variables
      const serverEnv = {
        ...process.env,
        ...env,
        // Add API keys for real services
        BRAVE_API_KEY: process.env.BRAVE_API_KEY || '',
        OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
        OPENAI_MODEL: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
      };
      
      // Spawn the server process
      const serverProcess = spawn(command, args, {
        env: serverEnv,
        stdio: ['pipe', 'pipe', 'pipe']
      });
      
      // Create a transport that uses the server process's stdio
      const transport = new ChildProcessTransport(serverProcess);
      
      // Create and connect the client
      const client = new Client();
      await client.connect(transport);
      
      // Store the client
      this.clients.set(name, {
        client,
        process: serverProcess
      });
      
      console.error(`Connected to MCP server: ${name}`);
      
      return client;
    } catch (error) {
      console.error(`Error connecting to MCP server ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get a connected client
   * @param {string} name - Name of the server
   * @returns {Client|null} - Connected client or null if not connected
   */
  getClient(name) {
    const clientInfo = this.clients.get(name);
    return clientInfo ? clientInfo.client : null;
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll() {
    for (const [name, { client, process }] of this.clients.entries()) {
      try {
        await client.disconnect();
        process.kill();
        console.error(`Disconnected from MCP server: ${name}`);
      } catch (error) {
        console.error(`Error disconnecting from MCP server ${name}:`, error);
      }
    }
    
    this.clients.clear();
  }

  /**
   * Disconnect from a specific server
   * @param {string} name - Name of the server
   */
  async disconnect(name) {
    const clientInfo = this.clients.get(name);
    if (clientInfo) {
      try {
        await clientInfo.client.disconnect();
        clientInfo.process.kill();
        this.clients.delete(name);
        console.error(`Disconnected from MCP server: ${name}`);
      } catch (error) {
        console.error(`Error disconnecting from MCP server ${name}:`, error);
      }
    }
  }
}

/**
 * Create a crawler client
 * @returns {Promise<Client>} - Connected crawler client
 */
export async function createCrawlerClient() {
  const manager = new McpClientManager();
  const crawlerServerPath = path.resolve(__dirname, 'crawler-server.js');
  
  return await manager.connectToServer(
    'crawler',
    'node',
    [crawlerServerPath],
    {}
  );
}

/**
 * Create a browser client
 * @returns {Promise<Client>} - Connected browser client
 */
export async function createBrowserClient() {
  const manager = new McpClientManager();
  const browserServerPath = path.resolve(__dirname, 'browser-server.js');
  
  return await manager.connectToServer(
    'browser',
    'node',
    [browserServerPath],
    {}
  );
}

/**
 * AI-enhanced search using MCP clients
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Object>} - Search results
 */
export async function aiEnhancedSearch(query, options = {}) {
  const manager = new McpClientManager();
  
  try {
    // Get paths to server scripts
    const crawlerServerPath = path.resolve(__dirname, 'crawler-server.js');
    const browserServerPath = path.resolve(__dirname, 'browser-server.js');
    
    // Connect to crawler client
    const crawlerClient = await manager.connectToServer(
      'crawler',
      'node',
      [crawlerServerPath],
      {}
    );
    
    // Connect to browser client
    const browserClient = await manager.connectToServer(
      'browser',
      'node',
      [browserServerPath],
      {}
    );
    
    // Use crawler to search
    const searchResults = await crawlerClient.callTool('search', {
      query,
      maxResults: options.maxResults || 5
    });
    
    // Use browser to visit and extract content from top results
    const enhancedResults = [];
    
    for (const result of searchResults.urls) {
      const pageContent = await browserClient.callTool('visit_and_extract', {
        url: result,
        selector: 'body'
      });
      
      enhancedResults.push({
        url: result,
        content: pageContent.text
      });
    }
    
    // Disconnect from clients
    await manager.disconnectAll();
    
    return {
      query,
      results: enhancedResults
    };
  } catch (error) {
    console.error('Error in AI-enhanced search:', error);
    
    // Ensure clients are disconnected
    await manager.disconnectAll();
    
    throw error;
  }
}
