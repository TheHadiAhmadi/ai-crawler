import { CrawlResult } from '../crawler/index.js';
import { QueryOptions } from '../query/index.js';

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
