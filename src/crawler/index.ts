import puppeteer from 'puppeteer';
import { SearchResult } from '../search/index.js';
import { QueryOptions } from '../query/index.js';
import axios from 'axios';

/**
 * Crawl result interface
 */
export interface CrawlResult {
  url: string;
  title: string;
  content: string;
  html: string;
  markdown: string; // Clean markdown generated from the content
  timestamp: string;
}

/**
 * Configuration for OpenRouter API
 */
interface OpenRouterConfig {
  apiKey: string;
  model: string;
}

// OpenRouter API configuration
// These would typically be loaded from environment variables
const OPENROUTER_CONFIG: OpenRouterConfig = {
  apiKey: process.env.OPENAI_API_KEY || '', // Reusing OpenAI API key for OpenRouter
  model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
};

/**
 * Crawl websites to gather information
 * Navigates to and retrieves web pages, handles HTTP requests and responses,
 * respects robots.txt and crawling policies, and manages rate limiting
 * 
 * @param searchResults Array of search results to crawl
 * @param options Query options
 * @returns Array of crawl results
 */
export async function crawlWebsites(searchResults: SearchResult[], options: QueryOptions): Promise<CrawlResult[]> {
  try {
    if (options.verbose) {
      console.log(`Crawling ${searchResults.length} websites...`);
    }
    
    // Create an array to store the crawl results
    const results: CrawlResult[] = [];
    
    // Limit the number of websites to crawl based on depth option
    const maxWebsites = Math.min(searchResults.length, options.depth || 3);
    
    // Crawl each website sequentially to avoid rate limiting issues
    for (let i = 0; i < maxWebsites; i++) {
      const searchResult = searchResults[i];
      
      if (options.verbose) {
        console.log(`Crawling website ${i + 1}/${maxWebsites}: ${searchResult.url}`);
      }
      
      // Crawl the website
      const result = await crawlWebsite(searchResult.url, options);
      
      // Add the result to the array if it's not null
      if (result) {
        results.push(result);
      }
      
      // Add a small delay between requests to avoid overwhelming servers
      if (i < maxWebsites - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    return results;
  } catch (error) {
    console.error('Error crawling websites:', error);
    return [];
  }
}

/**
 * Check if a website allows crawling based on robots.txt
 * This is a placeholder for future implementation
 * 
 * @param url URL to check
 * @returns Whether crawling is allowed
 */
async function isAllowedByRobotsTxt(url: string): Promise<boolean> {
  // In a real implementation, this would check the robots.txt file
  // For now, always return true
  return true;
}

/**
 * Crawl a single website using Puppeteer
 * 
 * @param url URL to crawl
 * @param options Query options
 * @returns Crawl result
 */
async function crawlWebsite(url: string, options: QueryOptions): Promise<CrawlResult | null> {
  try {
    // Check if crawling is allowed
    const isAllowed = await isAllowedByRobotsTxt(url);
    if (!isAllowed) {
      if (options.verbose) {
        console.log(`Crawling not allowed for ${url}`);
      }
      return null;
    }
    
    // Launch a new browser instance
    const browser = await puppeteer.launch({
      headless: true, // Run in headless mode
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      // Create a new page
      const page = await browser.newPage();
      
      // Set a timeout for navigation
      const timeout = (options.timeout || 30) * 1000;
      
      // Set user agent to avoid being blocked
      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
      
      try {
        // Set a more lenient waitUntil condition
        await page.goto(url, {
          waitUntil: 'domcontentloaded', // Less strict than 'networkidle2'
          timeout: timeout
        });
      } catch (navigationError) {
        console.warn(`Navigation timeout for ${url}, continuing with partial content`);
        // Continue with whatever content was loaded
      }
      
      try {
        // Wait for the content to load with a shorter timeout
        await page.waitForSelector('body', { timeout: Math.min(timeout, 5000) });
      } catch (selectorError) {
        console.warn(`Selector timeout for ${url}, continuing with available content`);
        // Continue with whatever content is available
      }
      
      // Get the page title (with fallback)
      let title = '';
      try {
        title = await page.title();
      } catch (error: any) {
        title = new URL(url).hostname;
        console.warn(`Error getting title for ${url}, using hostname instead: ${error.message || 'Unknown error'}`);
      }
      
      // Get the page content with error handling
      let content = '';
      try {
        content = await page.evaluate(() => {
        // Remove script and style elements
        const scripts = document.querySelectorAll('script, style');
        scripts.forEach(script => script.remove());
        
        // Get the main content
        const main = document.querySelector('main') || document.querySelector('article') || document.body;
        
        // Get all text nodes
        const textNodes = Array.from(main.querySelectorAll('p, h1, h2, h3, h4, h5, h6, li, span, div'))
          .map(el => el.textContent)
          .filter(text => text && text.trim().length > 0)
          .join('\n\n');
        
          return textNodes;
        });
      } catch (error: any) {
        console.warn(`Error extracting content from ${url}: ${error.message || 'Unknown error'}`);
        content = `Failed to extract content from ${url}. The page might be using advanced JavaScript or have anti-scraping measures.`;
      }
      
      // Get the page HTML with error handling
      let html = '';
      try {
        html = await page.content();
      } catch (error: any) {
        console.warn(`Error getting HTML from ${url}: ${error.message || 'Unknown error'}`);
        html = `<html><body><p>Failed to extract HTML from ${url}</p></body></html>`;
      }
      
      // Take a screenshot if verbose mode is enabled
      if (options.verbose) {
        try {
          await page.screenshot({ path: `screenshot-${new URL(url).hostname}.png` });
          console.log(`Screenshot saved for ${url}`);
        } catch (error: any) {
          console.warn(`Error taking screenshot of ${url}: ${error.message || 'Unknown error'}`);
        }
      }
      
      // Generate clean markdown from the content
      let markdown = '';
      try {
        markdown = await generateCleanMarkdown(content, title, url);
      } catch (error) {
        console.error(`Error generating markdown for ${url}:`, error);
        markdown = `# ${title}\n\n${content}\n\n[Source](${url})`;
      }
      
      // Create the crawl result
      const result: CrawlResult = {
        url,
        title,
        content,
        html,
        markdown,
        timestamp: new Date().toISOString()
      };
      
      return result;
    } finally {
      // Close the browser
      await browser.close();
    }
  } catch (error) {
    console.error(`Error crawling ${url}:`, error);
    return null;
  }
}

/**
 * Generate clean markdown from crawled content using OpenRouter API
 * 
 * @param content Raw content from the webpage
 * @param title Page title
 * @param url Page URL
 * @returns Clean markdown formatted content
 */
async function generateCleanMarkdown(content: string, title: string, url: string): Promise<string> {
  try {
    // Check if OpenRouter API key is available
    if (!OPENROUTER_CONFIG.apiKey) {
      throw new Error('OpenAI API key is required for OpenRouter. Please set the OPENAI_API_KEY environment variable.');
    }
    
    // Limit content length to avoid token limits
    const maxContentLength = 8000;
    const truncatedContent = content.length > maxContentLength
      ? content.substring(0, maxContentLength) + '...'
      : content;
    
    // Prepare the prompt
    const prompt = `
      I need you to convert the following web page content into clean, well-formatted markdown.
      
      Page Title: ${title}
      Page URL: ${url}
      
      Content:
      ${truncatedContent}
      
      Please format this into clean markdown that:
      1. Has a proper heading structure
      2. Preserves the important information
      3. Removes any noise or irrelevant content
      4. Is well-organized and easy to read
      5. Includes the source URL at the bottom
      
      Return ONLY the markdown content, nothing else.
    `;
    
    // Make the API request to OpenRouter
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: OPENROUTER_CONFIG.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that converts web content into clean, well-formatted markdown.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 2000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_CONFIG.apiKey}`,
          'HTTP-Referer': 'https://github.com/yourusername/ai-crawler', // Replace with your actual repo
          'X-Title': 'AI Web Crawler'
        }
      }
    );
    
    // Extract and return the markdown
    if (response.data && 
        response.data.choices && 
        response.data.choices.length > 0 && 
        response.data.choices[0].message) {
      return response.data.choices[0].message.content.trim();
    }
    
    throw new Error('Unexpected response format from OpenRouter API');
  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    throw error;
  }
}
