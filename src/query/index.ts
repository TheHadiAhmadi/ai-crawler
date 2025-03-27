import { searchWeb } from '../search/index.js';
import { crawlWebsites } from '../crawler/index.js';
import { extractContent } from '../extractor/index.js';
import { formatResults } from '../formatter/index.js';

/**
 * Options for query processing
 */
export interface QueryOptions {
  depth: number;
  timeout: number;
  cache: boolean;
  verbose: boolean;
  maxResults?: number;
  output?: string; // Output file path for results
}

/**
 * Process a natural language query
 * Analyzes the query, identifies key search terms and intent,
 * and determines the appropriate search strategy
 * 
 * @param query The natural language query
 * @param options Query processing options
 * @returns Formatted results in markdown and HTML
 */
export async function processQuery(query: string, options: QueryOptions): Promise<{ markdown: string, html: string }> {
  try {
    // For now, implement a simple version that returns a placeholder
    // This will be expanded in future iterations
    
    if (options.verbose) {
      console.log('Analyzing query...');
    }
    
    // Step 1: Analyze the query to determine search terms and intent
    const searchTerms = analyzeQuery(query);
    
    if (options.verbose) {
      console.log('Search terms:', searchTerms);
      console.log('Searching the web...');
    }
    
    // Step 2: Search for relevant websites
    const searchResults = await searchWeb(searchTerms, options);
    
    if (options.verbose) {
      console.log(`Found ${searchResults.length} relevant websites`);
      console.log('Crawling websites...');
    }
    
    // Step 3: Crawl the websites to gather information
    const crawlResults = await crawlWebsites(searchResults, options);
    
    if (options.verbose) {
      console.log('Extracting relevant content...');
    }
    
    // Step 4: Extract relevant content from the crawled pages
    const extractedContent = await extractContent(crawlResults, query, options);
    
    if (options.verbose) {
      console.log('Formatting results...');
    }
    
    // Step 5: Format the results in markdown and HTML
    const formattedResults = await formatResults(extractedContent, query, options);
    
    return formattedResults;
  } catch (error) {
    console.error('Error processing query:', error);
    const errorMessage = `Error processing query: ${error instanceof Error ? error.message : String(error)}`;
    return { 
      markdown: errorMessage, 
      html: `<html><body><h1>Error</h1><p>${errorMessage}</p></body></html>` 
    };
  }
}

/**
 * Analyze a natural language query to extract search terms and intent
 * This is a simple implementation that will be expanded in future iterations
 * 
 * @param query The natural language query
 * @returns Array of search terms
 */
function analyzeQuery(query: string): string[] {
  // Simple implementation: remove common words and split into terms
  const stopWords = ['what', 'is', 'the', 'a', 'an', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'like', 'through', 'over', 'before', 'between', 'after', 'since', 'without', 'under', 'within', 'along', 'following', 'across', 'behind', 'beyond', 'plus', 'except', 'but', 'up', 'out', 'around', 'down', 'off', 'above', 'near'];
  
  // Convert to lowercase and remove punctuation
  const cleanQuery = query.toLowerCase().replace(/[^\w\s]/g, '');
  
  // Split into words and filter out stop words
  const words = cleanQuery.split(/\s+/).filter(word => !stopWords.includes(word));
  
  // Return unique words
  return [...new Set(words)];
}
