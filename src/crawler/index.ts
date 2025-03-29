import puppeteer from 'puppeteer';
import { SearchResult } from '../search/index.js';
import { QueryOptions } from '../query/index.js';
import axios from 'axios';
import { URL } from 'url';
import os from 'os';

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
  cluster?: string; // The cluster this result belongs to
}

/**
 * Cluster configuration interface
 */
interface ClusterConfig {
  enabled: boolean;
  maxClusters: number;
  clusterBy: 'domain' | 'tld' | 'custom';
  customClusterFn?: (url: string) => string;
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
    const limitedResults = searchResults.slice(0, maxWebsites);
    
    // Determine concurrency level (default to 3 if not specified)
    const concurrency = options.concurrency || 3;
    
    // Configure clustering with default values
    const clusterConfig: ClusterConfig = {
      enabled: true,
      maxClusters: Math.min(os.cpus().length, 4),
      clusterBy: 'domain'
    };
    
    if (options.verbose) {
      console.log(`Using concurrency level: ${concurrency}`);
    }
    
    // Always use clustering approach with default configuration
    return await crawlWithClustering(limitedResults, options, clusterConfig);
  } catch (error) {
    console.error('Error crawling websites:', error);
    return [];
  }
}

/**
 * Crawl websites using clustering approach
 * 
 * @param searchResults Array of search results to crawl
 * @param options Query options
 * @param clusterConfig Clustering configuration
 * @returns Array of crawl results
 */
async function crawlWithClustering(
  searchResults: SearchResult[], 
  options: QueryOptions, 
  clusterConfig: ClusterConfig
): Promise<CrawlResult[]> {
  // Group URLs by cluster
  const clusters = groupUrlsByClusters(searchResults, clusterConfig);
  
  if (options.verbose) {
    console.log(`Grouped URLs into ${Object.keys(clusters).length} clusters`);
    Object.entries(clusters).forEach(([clusterName, urls]) => {
      console.log(`Cluster "${clusterName}": ${urls.length} URLs`);
    });
  }
  
  const results: CrawlResult[] = [];
  const concurrencyPerCluster = options.concurrency || 3;
  
  // Process each cluster in parallel
  const clusterPromises = Object.entries(clusters).map(async ([clusterName, clusterUrls]) => {
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    try {
      if (options.verbose) {
        console.log(`Processing cluster "${clusterName}" with ${clusterUrls.length} URLs`);
      }
      
      const clusterResults: CrawlResult[] = [];
      
      // Process URLs in this cluster with concurrency
      for (let i = 0; i < clusterUrls.length; i += concurrencyPerCluster) {
        const batch = clusterUrls.slice(i, i + concurrencyPerCluster);
        
        if (options.verbose) {
          console.log(`Cluster "${clusterName}": Crawling batch ${Math.floor(i / concurrencyPerCluster) + 1}/${Math.ceil(clusterUrls.length / concurrencyPerCluster)}`);
        }
        
        const promises = batch.map(async (url) => {
          const result = await crawlWebsite(url, options, browser);
          if (result) {
            result.cluster = clusterName;
          }
          return result;
        });
        
        const batchResults = await Promise.all(promises);
        batchResults.forEach(result => {
          if (result) clusterResults.push(result);
        });
        
        // Add delay between batches within a cluster
        if (i + concurrencyPerCluster < clusterUrls.length) {
          // Use cluster-specific delay based on domain policies
          const delayMs = getClusterSpecificDelay(clusterName);
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
      
      return clusterResults;
    } finally {
      await browser.close();
    }
  });
  
  // Wait for all clusters to complete
  const clusterResults = await Promise.all(clusterPromises);
  
  // Flatten results from all clusters
  return clusterResults.flat();
}

/**
 * Group URLs by clusters based on the clustering configuration
 * 
 * @param searchResults Array of search results
 * @param clusterConfig Clustering configuration
 * @returns Object mapping cluster names to arrays of URLs
 */
function groupUrlsByClusters(
  searchResults: SearchResult[], 
  clusterConfig: ClusterConfig
): Record<string, string[]> {
  const clusters: Record<string, string[]> = {};
  
  searchResults.forEach(result => {
    let clusterName: string;
    
    try {
      const urlObj = new URL(result.url);
      
      switch (clusterConfig.clusterBy) {
        case 'domain':
          clusterName = urlObj.hostname;
          break;
        case 'tld':
          // Extract the TLD (e.g., .com, .org)
          const domainParts = urlObj.hostname.split('.');
          clusterName = domainParts.length > 1 ? 
            domainParts[domainParts.length - 1] : 
            urlObj.hostname;
          break;
        case 'custom':
          if (clusterConfig.customClusterFn) {
            clusterName = clusterConfig.customClusterFn(result.url);
          } else {
            clusterName = 'default';
          }
          break;
        default:
          clusterName = 'default';
      }
    } catch (error) {
      // If URL parsing fails, use a default cluster
      clusterName = 'invalid-urls';
    }
    
    // Initialize the cluster array if it doesn't exist
    if (!clusters[clusterName]) {
      clusters[clusterName] = [];
    }
    
    // Add the URL to the cluster
    clusters[clusterName].push(result.url);
  });
  
  // If we have too many clusters, merge smaller ones
  const maxClusters = clusterConfig.maxClusters;
  if (Object.keys(clusters).length > maxClusters) {
    return mergeSmallClusters(clusters, maxClusters);
  }
  
  return clusters;
}

/**
 * Merge smaller clusters to reduce the total number of clusters
 * 
 * @param clusters Object mapping cluster names to arrays of URLs
 * @param maxClusters Maximum number of clusters to have
 * @returns Merged clusters
 */
function mergeSmallClusters(
  clusters: Record<string, string[]>, 
  maxClusters: number
): Record<string, string[]> {
  // If we already have fewer clusters than the maximum, return as is
  if (Object.keys(clusters).length <= maxClusters) {
    return clusters;
  }
  
  // Sort clusters by size (number of URLs)
  const sortedClusters = Object.entries(clusters).sort((a, b) => b[1].length - a[1].length);
  
  // Keep the largest clusters up to maxClusters-1
  const largestClusters = sortedClusters.slice(0, maxClusters - 1);
  
  // Merge all remaining small clusters
  const smallClusters = sortedClusters.slice(maxClusters - 1);
  
  const result: Record<string, string[]> = {};
  
  // Add the largest clusters to the result
  largestClusters.forEach(([name, urls]) => {
    result[name] = urls;
  });
  
  // Create a merged cluster for all small clusters
  const mergedUrls = smallClusters.flatMap(([_, urls]) => urls);
  if (mergedUrls.length > 0) {
    result['merged-small-clusters'] = mergedUrls;
  }
  
  return result;
}

/**
 * Get a cluster-specific delay for rate limiting
 * This can be customized based on domain-specific policies
 * 
 * @param clusterName Name of the cluster (usually domain name)
 * @returns Delay in milliseconds
 */
function getClusterSpecificDelay(clusterName: string): number {
  // Default delay
  let delay = 2000;
  
  // Example: Add longer delays for specific domains known to have strict rate limiting
  const strictDomains = [
    'wikipedia.org',
    'amazon.com',
    'linkedin.com',
    'facebook.com',
    'twitter.com'
  ];
  
  // Check if the cluster name contains any of the strict domains
  for (const domain of strictDomains) {
    if (clusterName.includes(domain)) {
      return 5000; // 5 seconds for strict domains
    }
  }
  
  return delay;
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
async function crawlWebsite(url: string, options: QueryOptions, browser: any): Promise<CrawlResult | null> {
  try {
    // Check if crawling is allowed
    const isAllowed = await isAllowedByRobotsTxt(url);
    if (!isAllowed) {
      if (options.verbose) {
        console.log(`Crawling not allowed for ${url}`);
      }
      return null;
    }
    
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
      // 
      // page.close()
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
