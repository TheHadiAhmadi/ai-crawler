#!/usr/bin/env node
import { Command } from 'commander';
// Import version from package.json manually to avoid ESM import issues
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { processQuery } from '../query/index.js';

// Get the current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read package.json
const packageJsonPath = path.resolve(__dirname, '../../package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const { version } = packageJson;

/**
 * CLI interface for the AI Web Crawler
 * Handles user input and output, parses command-line arguments,
 * and displays results to the user
 */
export class CLI {
  private program: Command;

  /**
   * Initialize the CLI interface
   */
  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  /**
   * Set up the CLI commands and options
   */
  private setupCommands(): void {
    this.program
      .name('ai-crawler')
      .description('AI-powered web crawler CLI tool')
      .version(version);

    this.program
      .argument('<query>', 'Natural language query to search for')
      .option('-o, --output <path>', 'Output file path for the results')
      .option('-v, --verbose', 'Enable verbose output')
      .option('-d, --depth <number>', 'Maximum crawling depth', '3')
      .option('-t, --timeout <seconds>', 'Request timeout in seconds', '30')
      .option('-c, --cache', 'Enable result caching')
      .action(this.handleQuery.bind(this));

    this.program.addHelpText('after', `
Examples:
  $ ai-crawler "what is the price of iPhone 16"
  $ ai-crawler "what are the differences between Python and JavaScript" --output results.md
  $ ai-crawler "what is the weather in New York today" --verbose
    `);
  }

  /**
   * Handle the query command
   * @param query The natural language query
   * @param options Command options
   */
  private async handleQuery(query: string, options: any): Promise<void> {
    try {
      if (options.verbose) {
        console.log(`Processing query: "${query}"`);
        console.log('Options:', JSON.stringify(options, null, 2));
      }

      // Process the query and get results
      const results = await processQuery(query, {
        depth: parseInt(options.depth, 10),
        timeout: parseInt(options.timeout, 10),
        cache: !!options.cache,
        verbose: !!options.verbose,
        output: options.output
      });

      // Display results
      console.log(results.markdown);

      // Save to file if output option is provided
      if (options.output) {
        // Save markdown to the specified output file
        fs.writeFileSync(options.output, results.markdown);
        
        // Save HTML to a file with the same name but .html extension
        const htmlOutputPath = options.output.replace(/\.md$/, '.html');
        fs.writeFileSync(htmlOutputPath, results.html);
        
        if (options.verbose) {
          console.log(`Markdown results saved to ${options.output}`);
          console.log(`HTML results saved to ${htmlOutputPath}`);
        }
        
        // Open the HTML file in the default browser
        this.openInBrowser(htmlOutputPath);
      }
    } catch (error) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  }

  /**
   * Open a file in the default browser
   * 
   * @param filePath Path to the file to open
   */
  private openInBrowser(filePath: string): void {
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
      } else if (this.program.opts().verbose) {
        console.log(`Opened ${filePath} in browser`);
      }
    });
  }

  /**
   * Parse command line arguments and execute the appropriate command
   */
  public async parse(): Promise<void> {
    await this.program.parseAsync(process.argv);
  }
}

/**
 * Run the CLI application
 */
export async function runCLI(): Promise<void> {
  const cli = new CLI();
  await cli.parse();
}
