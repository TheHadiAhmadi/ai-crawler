import { ExtractedContent } from '../extractor/index.js';
import { QueryOptions } from '../query/index.js';
import axios from 'axios';
import { marked } from 'marked';
import fs from 'fs';
import path from 'path';

/**
 * Configuration for OpenAI API
 */
interface OpenAIConfig {
  apiKey: string;
  model: string;
}

// OpenAI API configuration
// These would typically be loaded from environment variables
const OPENAI_CONFIG: OpenAIConfig = {
  apiKey: process.env.OPENAI_API_KEY || '',
  model: process.env.OPENAI_MODEL || 'gpt-3.5-turbo'
};

/**
 * Format extracted content into markdown
 * Organizes extracted information, formats results in markdown,
 * and ensures readability and consistency
 * 
 * @param extractedContents Array of extracted content
 * @param query Original query string
 * @param options Query options
 * @returns Formatted markdown string
 */
export async function formatResults(
  extractedContents: ExtractedContent[],
  query: string,
  options: QueryOptions
): Promise<{ markdown: string, html: string }> {
  if (options.verbose) {
    console.log('Formatting results...');
  }
  
  // If no content was extracted, return a message
  if (extractedContents.length === 0) {
    const errorMarkdown = `# No results found for: ${query}\n\nUnable to find relevant information for your query.`;
    const errorHtml = generateHtml(errorMarkdown, query);
    return { markdown: errorMarkdown, html: errorHtml };
  }
  
  // Format the results as markdown
  let markdown = `# Results for: ${query}\n\n`;
  
  try {
    // Add a summary section
    markdown += await formatSummary(extractedContents, query, options);
  } catch (error) {
    console.error('Error generating summary:', error);
    markdown += `## Summary\n\nError generating summary: ${error instanceof Error ? error.message : String(error)}\n\n`;
  }
  
  // Add metadata
  markdown += formatMetadata(extractedContents, query);
  
  // Generate HTML from markdown
  const html = generateHtml(markdown, query);
  
  // Save HTML to file if output option is provided
  if (options.output) {
    const htmlOutputPath = options.output.replace(/\.md$/, '.html');
    fs.writeFileSync(htmlOutputPath, html);
    if (options.verbose) {
      console.log(`HTML results saved to ${htmlOutputPath}`);
    }
  }
  
  return { markdown, html };
}

/**
 * Generate HTML from markdown
 * 
 * @param markdown Markdown content
 * @param query Original query string
 * @returns HTML string
 */
function generateHtml(markdown: string, query: string): string {
  // Convert markdown to HTML using marked
  const htmlContent = marked(markdown);
  
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
  
  // Check if OpenAI API key is available
  if (!OPENAI_CONFIG.apiKey) {
    throw new Error('OpenAI API key is required. Please set the OPENAI_API_KEY environment variable.');
  }
  
  if (options.verbose) {
    console.log('Generating AI summary...');
  }
  
  // Use OpenAI to generate a summary
  const aiSummary = await generateAISummary(extractedContents, query);
  summary += `${aiSummary}\n\n`;
  
  return summary;
}

/**
 * Generate a summary using OpenAI API
 * 
 * @param extractedContents Array of extracted content
 * @param query Original query string
 * @returns AI-generated summary
 */
async function generateAISummary(extractedContents: ExtractedContent[], query: string): Promise<string> {
  try {
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
    
    // Make the API request to OpenAI
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: OPENAI_CONFIG.model,
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
          'Authorization': `Bearer ${OPENAI_CONFIG.apiKey}`
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
    
    throw new Error('Unexpected response format from OpenAI API');
  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    throw error;
  }
}

/**
 * Format detailed results from each source
 * 
 * @param extractedContents Array of extracted content
 * @returns Formatted markdown string
 */
function formatDetailedResults(extractedContents: ExtractedContent[]): string {
  let details = '## Detailed Information\n\n';
  
  // Add each source's content
  extractedContents.forEach((content, index) => {
    details += `### ${index + 1}. ${content.title}\n\n`;
    
    // Limit content length for readability
    const maxContentLength = 2000;
    const displayContent = content.content.length > maxContentLength
      ? content.content.substring(0, maxContentLength) + '...'
      : content.content;
    
    details += `${displayContent}\n\n`;
    details += `*Source: [${content.source}](${content.url})*\n\n`;
  });
  
  return details;
}

/**
 * Format metadata about the search
 * 
 * @param extractedContents Array of extracted content
 * @param query Original query string
 * @returns Formatted markdown string
 */
function formatMetadata(extractedContents: ExtractedContent[], query: string): string {
  const timestamp = new Date().toISOString();
  const sourceCount = extractedContents.length;
  
  let metadata = '## Search Metadata\n\n';
  metadata += `- **Query**: ${query}\n`;
  metadata += `- **Sources**: ${sourceCount}\n`;
  metadata += `- **Timestamp**: ${timestamp}\n`;
  
  return metadata;
}

/**
 * Format a single piece of content
 * 
 * @param content Extracted content
 * @returns Formatted markdown string
 */
function formatContent(content: ExtractedContent): string {
  let formatted = `### ${content.title}\n\n`;
  formatted += `${content.content}\n\n`;
  formatted += `*Source: [${content.source}](${content.url})*\n\n`;
  
  return formatted;
}
