import { CrawlResult } from '../crawler/index.js';
import { QueryOptions } from '../query/index.js';
import axios from 'axios';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Extracted content interface
 */
export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  relevance: number;
  source: string;
  timestamp: string;
  comparableData?: ComparableData; // Data that can be compared across websites
}

/**
 * Comparable data interface
 * Contains structured data that can be compared across websites
 */
export interface ComparableData {
  title: string; // Title of the item being compared
  properties: {
    [key: string]: string | number | null; // Properties that can be compared (e.g., price, specs)
  };
  source: string; // Source website
  url: string; // URL of the source
}

/**
 * OpenRouter API configuration
 */
interface OpenRouterConfig {
  apiKey: string;
  model: string;
}


/**
 * Extract relevant content from crawled pages
 * Parses HTML content, identifies and extracts relevant information,
 * filters out irrelevant content, and aggregates information from multiple sources
 * 
 * @param crawlResults Array of crawl results
 * @param query Original query string
 * @param options Query options
 * @returns Array of extracted content
 */
export async function extractContent(
  crawlResults: CrawlResult[],
  query: string,
  options: QueryOptions
): Promise<ExtractedContent[]> {
  try {
    if (options.verbose) {
      console.log(`Extracting content from ${crawlResults.length} pages...`);
    }
    
    // Process each crawl result to extract relevant content
    const extractedContents: ExtractedContent[] = [];
    
    for (const result of crawlResults) {
      // In a real implementation, this would use more sophisticated content extraction
      // For now, use a simple extraction method
      const extracted = extractFromHtml(result, query);
      
      if (extracted) {
        // If compare option is enabled, extract comparable data
        if (options.compare) {
          // Use OpenRouter API for extracting comparable data
          extracted.comparableData = await extractComparableData(result, query);
        }
        
        extractedContents.push(extracted);
      }
    }
    
    // Sort by relevance
    extractedContents.sort((a, b) => b.relevance - a.relevance);
    
    return extractedContents;
  } catch (error) {
    console.error('Error extracting content:', error);
    return [];
  }
}

/**
 * Extract content from HTML
 * This is a simple implementation that will be expanded in future iterations
 * 
 * @param crawlResult Crawl result
 * @param query Original query string
 * @returns Extracted content or null if no relevant content found
 */
function extractFromHtml(crawlResult: CrawlResult, query: string): ExtractedContent | null {
  try {
    // For now, use the mock content directly
    // In a real implementation, this would parse the HTML and extract relevant content
    
    // Calculate a simple relevance score based on keyword matching
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = crawlResult.content.toLowerCase();
    
    // Count how many query words appear in the content
    const matchCount = queryWords.filter(word => contentLower.includes(word)).length;
    const relevance = matchCount / queryWords.length;
    
    // Only include content that has some relevance
    if (relevance > 0) {
      return {
        url: crawlResult.url,
        title: crawlResult.title,
        content: crawlResult.content,
        relevance,
        source: new URL(crawlResult.url).hostname,
        timestamp: crawlResult.timestamp
      };
    }
    
    return null;
  } catch (error) {
    console.error(`Error extracting content from ${crawlResult.url}:`, error);
    return null;
  }
}

/**
 * Parse HTML content
 * This is a placeholder for future implementation
 * 
 * @param html HTML content
 * @returns Parsed content
 */
function parseHtml(html: string): string {
  // In a real implementation, this would use a library like cheerio to parse HTML
  // For now, return a simple text extraction
  return html
    .replace(/<[^>]*>/g, ' ') // Remove HTML tags
    .replace(/\s+/g, ' ')     // Normalize whitespace
    .trim();                  // Trim leading/trailing whitespace
}

/**
 * Calculate content relevance
 * This is a placeholder for future implementation
 * 
 * @param content Content to evaluate
 * @param query Original query string
 * @returns Relevance score (0-1)
 */
function calculateRelevance(content: string, query: string): number {
  // In a real implementation, this would use more sophisticated relevance calculation
  // For now, return a simple score based on keyword matching
  const queryWords = query.toLowerCase().split(/\s+/);
  const contentLower = content.toLowerCase();
  
  // Count how many query words appear in the content
  const matchCount = queryWords.filter(word => contentLower.includes(word)).length;
  
  return matchCount / queryWords.length;
}

// OpenRouter API configuration
// These would typically be loaded from environment variables
const OPENROUTER_CONFIG: OpenRouterConfig = {
  apiKey: process.env.OPENAI_API_KEY || '', // Reusing OpenAI API key for OpenRouter
  model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
};

/**
 * Extract comparable data from a crawl result using OpenRouter API
 * This function uses an LLM to extract structured data that can be compared across websites
 * 
 * @param crawlResult Crawl result
 * @param query Original query string
 * @returns Comparable data
 */
async function extractComparableData(crawlResult: CrawlResult, query: string): Promise<ComparableData> {
  try {
    const source = new URL(crawlResult.url).hostname;
    
    // If no API key is available, fall back to regex-based extraction
    if (!OPENROUTER_CONFIG.apiKey) {
      return extractComparableDataWithRegex(crawlResult, query);
    }
    
    // Prepare the content for the LLM
    // Truncate content if it's too long to avoid token limits
    const maxContentLength = 8000;
    const truncatedContent = crawlResult.content.length > maxContentLength
      ? crawlResult.content.substring(0, maxContentLength) + '...'
      : crawlResult.content;
    
    // Create a prompt for the LLM to extract structured data
    const prompt = `
Extract data from the following web page content about "${query}".
The data should be formatted as a JSON object with properties relevant to the query.
Focus on extracting factual information like specifications, prices, features, etc.

Web page title: ${crawlResult.title}
Web page URL: ${crawlResult.url}
Web page content:
${truncatedContent}

Return ONLY a valid JSON object with the following structure:
{
  "title": "Product or item title",
  "properties": {
    // list of features that this product has. more is better
  }
}
`;

    // Call the OpenRouter API
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: OPENROUTER_CONFIG.model,
        messages: [
          { role: 'system', content: 'You are a data extraction assistant. Extract structured data from web content into JSON format.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1, // Low temperature for more deterministic results
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENROUTER_CONFIG.apiKey}`,
          'HTTP-Referer': 'https://ai-crawler-cli-tool',
          'X-Title': 'AI Crawler CLI Tool'
        }
      }
    );
    
    // Extract the response content
    const responseContent = response.data.choices[0]?.message?.content;
    console.log(responseContent)
    
    if (!responseContent) {
      throw new Error('No response content from OpenRouter API');
    }
    
    // Extract the JSON object from the response
    // The LLM might include markdown code blocks or other text, so we need to extract just the JSON
    const jsonMatch = responseContent.match(/```json\n([\s\S]*?)\n```/) || 
                      responseContent.match(/```\n([\s\S]*?)\n```/) || 
                      responseContent.match(/{[\s\S]*?}/);
    
    let extractedData;
    if (jsonMatch) {
      // If we found a code block or JSON object, parse it
      const jsonString = jsonMatch[1] || jsonMatch[0];
      extractedData = JSON.parse(jsonString);
    } else {
      // If we couldn't find a JSON object, try to parse the entire response
      try {
        extractedData = JSON.parse(responseContent);
      } catch (e) {
        throw new Error(`Failed to parse JSON from response: ${responseContent}`);
      }
    }
    
    // Ensure the extracted data has the expected structure
    const title = extractedData.title || crawlResult.title;
    const properties = extractedData.properties || {};
    
    // Convert string numbers to actual numbers
    Object.keys(properties).forEach(key => {
      const value = properties[key];
      if (typeof value === 'string' && !isNaN(Number(value))) {
        properties[key] = Number(value);
      }
    });
    
    return {
      title,
      properties,
      source,
      url: crawlResult.url
    };
  } catch (error) {
    console.error(`Error extracting comparable data with OpenRouter from ${crawlResult.url}:`, error);
    // Fall back to regex-based extraction if API call fails
    return extractComparableDataWithRegex(crawlResult, query);
  }
}

/**
 * Extract comparable data from a crawl result using regex patterns
 * This is a fallback method when the OpenRouter API is not available
 * 
 * @param crawlResult Crawl result
 * @param query Original query string
 * @returns Comparable data
 */
function extractComparableDataWithRegex(crawlResult: CrawlResult, query: string): ComparableData {
  try {
    const source = new URL(crawlResult.url).hostname;
    const content = crawlResult.content.toLowerCase();
    
    // Extract product title
    const title = crawlResult.title;
    
    // Extract properties based on the query type
    const properties: { [key: string]: string | number | null } = {};
    
    // Check for price information
    const priceRegex = /\$\s*(\d+(?:\.\d{2})?)|(\d+(?:\.\d{2})?)\s*(?:USD|dollars)/gi;
    const priceMatches = content.match(priceRegex);
    if (priceMatches && priceMatches.length > 0) {
      // Extract the first price found
      const priceMatch = priceMatches[0].replace(/[^\d.]/g, '');
      properties['price'] = parseFloat(priceMatch);
    } else {
      properties['price'] = null;
    }
    
    // Check for specifications
    
    // Check for RAM
    const ramRegex = /(\d+)\s*(?:GB|G)\s*(?:RAM|memory)/i;
    const ramMatch = content.match(ramRegex);
    if (ramMatch && ramMatch.length > 1) {
      properties['ram'] = `${ramMatch[1]}GB`;
    }
    
    // Check for storage
    const storageRegex = /(\d+)\s*(?:GB|TB|G|T)\s*(?:storage|SSD|HDD|drive)/i;
    const storageMatch = content.match(storageRegex);
    if (storageMatch && storageMatch.length > 1) {
      properties['storage'] = `${storageMatch[1]}${storageMatch[0].includes('TB') || storageMatch[0].includes('T') ? 'TB' : 'GB'}`;
    }
    
    // Check for processor
    const processorRegex = /(?:intel|amd|apple)\s*([\w\d\s\-]+)(?:processor|cpu)/i;
    const processorMatch = content.match(processorRegex);
    if (processorMatch && processorMatch.length > 1) {
      properties['processor'] = processorMatch[1].trim();
    }
    
    // Check for screen size
    const screenRegex = /(\d+(?:\.\d+)?)\s*(?:inch|"|inches)/i;
    const screenMatch = content.match(screenRegex);
    if (screenMatch && screenMatch.length > 1) {
      properties['screen'] = `${screenMatch[1]}"`;
    }
    
    // Check for battery life
    const batteryRegex = /(\d+(?:\.\d+)?)\s*(?:hour|hr|hours)\s*(?:battery|battery life)/i;
    const batteryMatch = content.match(batteryRegex);
    if (batteryMatch && batteryMatch.length > 1) {
      properties['battery'] = `${batteryMatch[1]} hours`;
    }
    
    // Check for weight
    const weightRegex = /(\d+(?:\.\d+)?)\s*(?:kg|kilograms|pounds|lbs)/i;
    const weightMatch = content.match(weightRegex);
    if (weightMatch && weightMatch.length > 1) {
      properties['weight'] = weightMatch[0].trim();
    }
    
    // Check for availability
    if (content.includes('in stock') || content.includes('available')) {
      properties['availability'] = 'In Stock';
    } else if (content.includes('out of stock') || content.includes('unavailable')) {
      properties['availability'] = 'Out of Stock';
    } else if (content.includes('pre-order') || content.includes('preorder')) {
      properties['availability'] = 'Pre-order';
    }
    
    // Check for rating
    const ratingRegex = /(\d(?:\.\d+)?)\s*(?:\/|out of)\s*(\d+)\s*(?:stars|rating)/i;
    const ratingMatch = content.match(ratingRegex);
    if (ratingMatch && ratingMatch.length > 2) {
      const rating = parseFloat(ratingMatch[1]);
      const maxRating = parseFloat(ratingMatch[2]);
      properties['rating'] = `${rating}/${maxRating}`;
    }
    
    return {
      title,
      properties,
      source,
      url: crawlResult.url
    };
  } catch (error) {
    console.error(`Error extracting comparable data with regex from ${crawlResult.url}:`, error);
    // Return a minimal object with empty properties
    return {
      title: crawlResult.title,
      properties: {},
      source: new URL(crawlResult.url).hostname,
      url: crawlResult.url
    };
  }
}
