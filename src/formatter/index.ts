import { ExtractedContent, ComparableData } from '../extractor/index.js';
import { QueryOptions, OutputFormatType } from '../query/index.js';
import axios from 'axios';
import { marked } from 'marked';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

/**
 * Configuration for AI API (OpenAI or OpenRouter)
 */
interface AIConfig {
  apiKey: string;
  model: string;
  baseUrl: string;
}

// AI API configuration
// These would typically be loaded from environment variables
function getAIConfig(): AIConfig {
  // Check for OpenRouter API key first, then fall back to OpenAI API key
  const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
  const model = process.env.OPENROUTER_MODEL || process.env.OPENAI_MODEL || 'openai/gpt-3.5-turbo';
  const baseUrl = 'https://openrouter.ai/api/v1';
  
  if (!apiKey) {
    console.warn('Warning: No OpenRouter or OpenAI API key found in environment variables.');
  }
  
  return { apiKey, model, baseUrl };
}

/**
 * Format extracted content into the requested output format
 * Organizes extracted information, formats results in markdown, HTML, or JSON,
 * and ensures readability and consistency
 * 
 * @param extractedContents Array of extracted content
 * @param query Original query string
 * @param options Query options
 * @returns Formatted results in markdown, HTML, and JSON
 */
export async function formatResults(
  extractedContents: ExtractedContent[],
  query: string,
  options: QueryOptions
): Promise<{ markdown: string, html: string, json?: string }> {
  if (options.verbose) {
    console.log('Formatting results...');
  }
  
  // If no content was extracted, return a message
  if (extractedContents.length === 0) {
    const errorMarkdown = `# No results found for: ${query}\n\nUnable to find relevant information for your query.`;
    const errorHtml = generateHtml(errorMarkdown, query);
    const errorJson = JSON.stringify({
      query,
      timestamp: new Date().toISOString(),
      error: 'No results found',
      results: []
    }, null, 2);
    
    return { markdown: errorMarkdown, html: errorHtml, json: errorJson };
  }
  
  // Format the results as markdown
  let markdown = `# Results for: ${query}\n\n`;
  let summary = '';
  
  try {
    // Add a summary section
    summary = await formatSummary(extractedContents, query, options);
    markdown += summary;
  } catch (error) {
    console.error('Error generating summary:', error);
    summary = `## Summary\n\nError generating summary: ${error instanceof Error ? error.message : String(error)}\n\n`;
    markdown += summary;
  }
  
  // Generate JSON
  const json = generateJson(extractedContents, query, summary);
  
  // Generate HTML from markdown
  const html = generateHtml(markdown, query);
  
  // Save output to file if output option is provided
  if (options.output) {
    const outputType = options.outputType || 'markdown';
    
    // Save the primary output format
    if (outputType === 'markdown') {
      fs.writeFileSync(options.output, markdown);
      if (options.verbose) {
        console.log(`Markdown results saved to ${options.output}`);
      }
    } else if (outputType === 'html') {
      const htmlOutputPath = options.output.replace(/\.\w+$/, '.html');
      fs.writeFileSync(htmlOutputPath, html);
      if (options.verbose) {
        console.log(`HTML results saved to ${htmlOutputPath}`);
      }
    } else if (outputType === 'json') {
      const jsonOutputPath = options.output.replace(/\.\w+$/, '.json');
      fs.writeFileSync(jsonOutputPath, json);
      if (options.verbose) {
        console.log(`JSON results saved to ${jsonOutputPath}`);
      }
    }
    
    // Always save HTML as an additional format if not the primary
    if (outputType !== 'html') {
      const htmlOutputPath = options.output.replace(/\.\w+$/, '.html');
      fs.writeFileSync(htmlOutputPath, html);
      if (options.verbose) {
        console.log(`HTML results also saved to ${htmlOutputPath}`);
      }
    }
  }
  
  return { markdown, html, json };
}

/**
 * Generate JSON from extracted content
 * 
 * @param extractedContents Array of extracted content
 * @param query Original query string
 * @param summary Summary text
 * @returns JSON string
 */
function generateJson(extractedContents: ExtractedContent[], query: string, summary: string): string {
  // Create a JSON structure
  const jsonData: any = {
    query,
    timestamp: new Date().toISOString(),
    summary: summary.replace(/^## Summary\n\n/, '').trim(), // Remove the markdown heading
  };
  
  // Add comparison data if available
  const contentsWithComparableData = extractedContents.filter(
    content => content.comparableData && Object.keys(content.comparableData.properties).length > 0
  );
  
  if (contentsWithComparableData.length > 0) {
    jsonData.comparison = contentsWithComparableData.map(content => {
      if (!content.comparableData) return null;
      
      return {
        title: content.comparableData.title,
        source: content.comparableData.source,
        url: content.comparableData.url,
        properties: content.comparableData.properties
      };
    }).filter(Boolean);
  }
  
  // Convert to JSON string with pretty formatting
  return JSON.stringify(jsonData, null, 2);
}

/**
 * Generate HTML from markdown
 * 
 * @param markdown Markdown content
 * @param query Original query string
 * @returns HTML string
 */
function generateHtml(markdown: string, query: string): string {
  // Configure marked to properly handle tables
  marked.setOptions({
    gfm: true, // GitHub Flavored Markdown - enables tables
    breaks: true
  });
  
  // Convert markdown to HTML using marked
  const htmlContent = marked.parse(markdown);
  
  // Create a complete HTML document with styling
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Results for: ${query}</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 800px;
      margin: 0 auto;
      padding: 20px;
    }
    h1 {
      color: #2c3e50;
      border-bottom: 2px solid #eee;
      padding-bottom: 10px;
    }
    h2 {
      color: #3498db;
      margin-top: 30px;
    }
    h3 {
      color: #2980b9;
    }
    a {
      color: #3498db;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
    code {
      background-color: #f8f8f8;
      padding: 2px 5px;
      border-radius: 3px;
    }
    pre {
      background-color: #f8f8f8;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
    }
    blockquote {
      border-left: 4px solid #ccc;
      margin-left: 0;
      padding-left: 15px;
      color: #555;
    }
    img {
      max-width: 100%;
      height: auto;
    }
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 20px 0;
    }
    th, td {
      border: 1px solid #ddd;
      padding: 8px 12px;
      text-align: left;
    }
    th {
      background-color: #f2f2f2;
    }
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
  `;
  
  return html;
}

/**
 * Format a summary of the results using AI
 * 
 * @param extractedContents Array of extracted content
 * @param query Original query string
 * @param options Query options
 * @returns Formatted markdown string
 */
async function formatSummary(
  extractedContents: ExtractedContent[],
  query: string,
  options: QueryOptions
): Promise<string> {
  // Create a summary section
  let summary = '## Summary\n\n';
  
  // Get AI configuration
  const aiConfig = getAIConfig();
  
  // Check if AI API key is available
  if (!aiConfig.apiKey) {
    throw new Error('AI API key is required. Please set the OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.');
  }
  
  if (options.verbose) {
    console.log('Generating AI summary...');
  }
  
  // Use AI to generate a summary
  const aiSummary = await generateAISummary(extractedContents, query);
  summary += `${aiSummary}\n\n`;
  
  // If compare option is enabled, add comparison table
  if (options.compare) {
    if (options.verbose) {
      console.log('Generating comparison table...');
    }
    
    const comparisonTable = await formatComparisonTable(extractedContents);
    summary += `\n\n## Comparison Table\n\n${comparisonTable}\n\n`;
  }
  
  return summary;
}

/**
 * Format a comparison table from extracted content using AI
 * 
 * @param extractedContents Array of extracted content
 * @returns Formatted markdown table
 */
async function formatComparisonTable(extractedContents: ExtractedContent[]): Promise<string> {
  // Filter contents that have comparable data
  const contentsWithComparableData = extractedContents.filter(
    content => content.comparableData && Object.keys(content.comparableData.properties).length > 0
  );
  
  if (contentsWithComparableData.length === 0) {
    return 'No comparable data found across websites.';
  }
  
  // Get AI configuration
  const aiConfig = getAIConfig();
  
  // If no API key is available, fall back to basic comparison table
  if (!aiConfig.apiKey) {
    return formatBasicComparisonTable(contentsWithComparableData);
  }
  
  try {
    // Prepare the data for the AI
    const productsData = contentsWithComparableData.map(content => {
      if (!content.comparableData) return null;
      
      return {
        title: content.comparableData.title,
        source: content.comparableData.source,
        url: content.comparableData.url,
        properties: content.comparableData.properties
      };
    }).filter(Boolean);
    
    // Create a prompt for the AI to generate a product-focused comparison table
    const prompt = `
I need to create a markdown comparison table for the following products:

${JSON.stringify(productsData, null, 2)}

Please create a markdown table that compares these products by their features and specifications.
The table should:
1. Focus on comparing the products themselves, not the websites they come from
2. Have properties/features as rows and products as columns
3. Include all relevant properties found in the data
4. Format the table with proper markdown syntax
5. Put price first if available, then sort other properties logically
6. Include product names with links to their URLs
7. Format values appropriately (e.g., prices with $ symbol)
8. Use "N/A" for missing values
9. merge features if possible. each product may have different feature sets. rename some fields if relevant.

Return ONLY the markdown table, nothing else.
`;

    // Call the AI API
    const response = await axios.post(
      `${aiConfig.baseUrl}/chat/completions`,
      {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: 'You are a data formatting assistant that creates well-structured markdown comparison tables.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.1, // Low temperature for more deterministic results
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'HTTP-Referer': 'https://ai-crawler-cli-tool',
          'X-Title': 'AI Crawler CLI Tool'
        }
      }
    );
    
    // Extract the response content
    const responseContent = response.data.choices[0]?.message?.content;
    
    if (!responseContent) {
      throw new Error('No response content from AI API');
    }
    
    // Return the AI-generated comparison table
    return responseContent.trim();
  } catch (error) {
    console.error('Error generating AI comparison table:', error);
    // Fall back to basic comparison table if AI fails
    return formatBasicComparisonTable(contentsWithComparableData);
  }
}

/**
 * Format a basic comparison table without using AI
 * This is a fallback method when the AI API is not available
 * 
 * @param contentsWithComparableData Array of extracted content with comparable data
 * @returns Formatted markdown table
 */
function formatBasicComparisonTable(contentsWithComparableData: ExtractedContent[]): string {
  // Get all unique property keys across all comparable data
  const allPropertyKeys = new Set<string>();
  contentsWithComparableData.forEach(content => {
    if (content.comparableData) {
      Object.keys(content.comparableData.properties).forEach(key => {
        allPropertyKeys.add(key);
      });
    }
  });
  
  // Sort property keys for consistent display
  // Put price first if it exists, then sort the rest alphabetically
  const sortedPropertyKeys = Array.from(allPropertyKeys).sort((a, b) => {
    if (a === 'price') return -1;
    if (b === 'price') return 1;
    return a.localeCompare(b);
  });
  
  // Create table header
  let table = '| Feature | ';
  contentsWithComparableData.forEach(content => {
    if (content.comparableData) {
      table += `${content.comparableData.title} | `;
    }
  });
  table += '\n';
  
  // Add separator row
  table += '| --- | ';
  contentsWithComparableData.forEach(() => {
    table += '--- | ';
  });
  table += '\n';
  
  // Add source row
  table += '| Source | ';
  contentsWithComparableData.forEach(content => {
    if (content.comparableData) {
      table += `[${content.comparableData.source}](${content.comparableData.url}) | `;
    }
  });
  table += '\n';
  
  // Add rows for each property
  sortedPropertyKeys.forEach(propertyKey => {
    // Format the property name with title case
    const formattedPropertyName = propertyKey
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    table += `| ${formattedPropertyName} | `;
    
    contentsWithComparableData.forEach(content => {
      if (content.comparableData) {
        const value = content.comparableData.properties[propertyKey];
        
        // Format the value based on its type
        let formattedValue: string;
        if (value === null || value === undefined) {
          formattedValue = 'N/A';
        } else if (propertyKey === 'price' && typeof value === 'number') {
          formattedValue = `$${value.toFixed(2)}`;
        } else {
          formattedValue = String(value);
        }
        
        table += `${formattedValue} | `;
      }
    });
    
    table += '\n';
  });
  
  return table;
}

/**
 * Generate a summary using AI API
 * 
 * @param extractedContents Array of extracted content
 * @param query Original query string
 * @returns AI-generated summary
 */
async function generateAISummary(extractedContents: ExtractedContent[], query: string): Promise<string> {
  try {
    // Get AI configuration
    const aiConfig = getAIConfig();
    
    if (!aiConfig.apiKey) {
      throw new Error('AI API key is required. Please set the OPENROUTER_API_KEY or OPENAI_API_KEY environment variable.');
    }
    
    // Prepare content for the AI
    const contentTexts = extractedContents.map(content => 
      `Source: ${content.source}\nTitle: ${content.title}\nContent: ${content.content.substring(0, 1000)}`
    ).join('\n\n');
    
    // Prepare the prompt
    const prompt = `
      I need a comprehensive summary for the query: "${query}"
      
      Here is the content from various sources:
      
      ${contentTexts}
      
      Please provide a detailed, accurate summary that directly answers the query.
      The summary should be well-structured, factual, and about 3-5 paragraphs long.
      Include the most important information from the sources.
    `;
    
    // Make the API request
    const response = await axios.post(
      `${aiConfig.baseUrl}/chat/completions`,
      {
        model: aiConfig.model,
        messages: [
          { role: 'system', content: 'You are a helpful assistant that summarizes web content accurately and concisely.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 1000
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${aiConfig.apiKey}`,
          'HTTP-Referer': 'https://ai-crawler-cli-tool',
          'X-Title': 'AI Crawler CLI Tool'
        }
      }
    );
    
    // Extract and return the summary
    if (response.data && 
        response.data.choices && 
        response.data.choices.length > 0 && 
        response.data.choices[0].message) {
      return response.data.choices[0].message.content.trim();
    }
    
    throw new Error('Unexpected response format from AI API');
  } catch (error) {
    console.error('Error calling AI API:', error);
    throw error;
  }
}

// /**
//  * Format detailed results from each source
//  * 
//  * @param extractedContents Array of extracted content
//  * @returns Formatted markdown string
//  */
// function formatDetailedResults(extractedContents: ExtractedContent[]): string {
//   let details = '## Detailed Information\n\n';
  
//   // Add each source's content
//   extractedContents.forEach((content, index) => {
//     details += `### ${index + 1}. ${content.title}\n\n`;
    
//     // Limit content length for readability
//     const maxContentLength = 2000;
//     const displayContent = content.content.length > maxContentLength
//       ? content.content.substring(0, maxContentLength) + '...'
//       : content.content;
    
//     details += `${displayContent}\n\n`;
//     details += `*Source: [${content.source}](${content.url})*\n\n`;
//   });
  
//   return details;
// }

// /**
//  * Format metadata about the search
//  * 
//  * @param extractedContents Array of extracted content
//  * @param query Original query string
//  * @returns Formatted markdown string
//  */
// function formatMetadata(extractedContents: ExtractedContent[], query: string): string {
//   const timestamp = new Date().toISOString();
//   const sourceCount = extractedContents.length;
  
//   let metadata = '## Search Metadata\n\n';
//   metadata += `- **Query**: ${query}\n`;
//   metadata += `- **Sources**: ${sourceCount}\n`;
//   metadata += `- **Timestamp**: ${timestamp}\n`;
  
//   return metadata;
// }

// /**
//  * Format a single piece of content
//  * 
//  * @param content Extracted content
//  * @returns Formatted markdown string
//  */
// function formatContent(content: ExtractedContent): string {
//   let formatted = `### ${content.title}\n\n`;
//   formatted += `${content.content}\n\n`;
//   formatted += `*Source: [${content.source}](${content.url})*\n\n`;
  
//   return formatted;
// }
