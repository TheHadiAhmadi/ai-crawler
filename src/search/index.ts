import axios from 'axios';
import { QueryOptions } from '../query/index.js';

/**
 * Search result interface
 */
export interface SearchResult {
  url: string;
  title: string;
  description: string;
  relevance: number;
}

/**
 * Configuration for Brave Search API
 */
interface BraveSearchConfig {
  apiKey: string;
}

// Brave Search API configuration
// These would typically be loaded from environment variables
const BRAVE_SEARCH_CONFIG: BraveSearchConfig = {
  apiKey: process.env.BRAVE_API_KEY || ''
};

/**
 * Search the web for relevant websites based on search terms
 * Identifies relevant websites to crawl and prioritizes sources based on relevance
 * 
 * @param searchTerms Array of search terms
 * @param options Query options
 * @returns Array of search results
 */
export async function searchWeb(searchTerms: string[], options: QueryOptions): Promise<SearchResult[]> {
  try {
    const query = searchTerms.join(' ');
    
    if (options.verbose) {
      console.log(`Searching for: ${query}`);
    }
    
    // Check if Brave Search API key is available
    if (!BRAVE_SEARCH_CONFIG.apiKey) {
      throw new Error('Brave Search API key is required. Please set the BRAVE_API_KEY environment variable.');
    }
    
    // Use Brave Search API
    return await searchWithBraveAPI(query, options);
  } catch (error) {
    console.error('Error searching the web:', error);
    throw error; // Re-throw the error instead of falling back to mock results
  }
}

/**
 * Search the web using Brave Search API
 * 
 * @param query Search query
 * @param options Query options
 * @returns Array of search results
 */
async function searchWithBraveAPI(query: string, options: QueryOptions): Promise<SearchResult[]> {
  try {
    const maxResults = options.maxResults || 10;
    
    // Brave Search API endpoint
    const url = 'https://api.search.brave.com/res/v1/web/search';
    
    // Make the API request
    const response = await axios.get(url, {
      params: {
        q: query,
        count: maxResults,
        search_lang: 'en'
      },
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        'X-Subscription-Token': BRAVE_SEARCH_CONFIG.apiKey
      }
    });
    
    // Process the response
    if (response.data && response.data.web && response.data.web.results) {
      return response.data.web.results.map((item: any, index: number) => ({
        url: item.url,
        title: item.title,
        description: item.description,
        relevance: 1 - (index * 0.1) // Simple relevance score based on search position
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error using Brave Search API:', error);
    throw error;
  }
}
