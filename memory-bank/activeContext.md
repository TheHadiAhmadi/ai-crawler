# Active Context: AI Web Crawler CLI Tool

## Current Focus
The project has progressed from the MCP integration phase to implementing real search API and AI summarization capabilities. We are currently focused on:

1. Using real search APIs (Brave Search) for web search
2. Implementing AI-powered summarization with OpenAI
3. Enhancing error handling and fallback mechanisms
4. Improving documentation and user experience

## Recent Changes
- Replaced Google Custom Search with Brave Search API for web search results
- Maintained OpenAI API integration for AI-powered summarization
- Updated environment variable support for API keys (BRAVE_API_KEY instead of GOOGLE_API_KEY/GOOGLE_CX)
- Updated the MCP client manager to pass API keys to MCP servers
- Fixed hardcoded paths to MCP server scripts
- Removed mock data fallbacks to rely only on real API data
- Added dotenv package for loading environment variables from .env file
- Updated documentation with API key setup instructions
- Improved the test script with API key checking and warnings

## Current State
The project now has:
- Real search API integration (Brave Search) with required API key
- AI-powered summarization (OpenAI) with required API key
- MCP server architecture with specialized servers
- Browser automation capabilities
- Content extraction and formatting
- Proper error handling for missing API keys
- Environment variable loading from .env file
- Comprehensive documentation

## Next Steps

### Immediate Tasks
1. **Enhance error handling**
   - Implement more robust error recovery mechanisms
   - Add retry logic for API failures
   - Improve error reporting and user feedback

2. **Implement caching**
   - Add caching for search results
   - Implement intelligent cache invalidation
   - Optimize for repeated queries

3. **Improve content extraction**
   - Develop site-specific extractors
   - Enhance content relevance scoring
   - Add support for multimedia content

### Short-term Goals
1. **Extend search capabilities**
   - Add support for additional search APIs
   - Implement more sophisticated search strategies
   - Add support for specialized search domains

2. **Enhance AI capabilities**
   - Support different AI models
   - Implement context-aware summarization
   - Add support for different types of queries

3. **Improve user experience**
   - Add progress indicators
   - Implement interactive mode
   - Enhance result visualization

## Active Decisions

### Architecture Decisions
- **API Integration**: We're using Brave Search API for web search and OpenAI API for summarization
- **Environment Variables**: API keys are passed through environment variables for security and loaded from .env file
- **Error Handling**: The system provides clear error messages when API keys are missing or invalid
- **MCP Server Architecture**: We're using a multi-server architecture with specialized servers for different tasks

### Open Questions
1. **API Rate Limiting**:
   - How do we handle API rate limits effectively?
   - What strategies should we implement for high-volume usage?
   - How do we balance API costs with functionality?

2. **Content Extraction Optimization**:
   - How can we improve content extraction for different types of websites?
   - Should we implement site-specific extractors for popular domains?
   - How do we handle JavaScript-heavy websites efficiently?

3. **Caching Strategy**:
   - What's the optimal caching strategy for different types of queries?
   - How do we handle cache invalidation for time-sensitive information?
   - What storage mechanism should we use for the cache?

## Current Challenges
1. **API Costs and Limits**: Managing API usage within rate limits and budget constraints
2. **Content Relevance**: Ensuring extracted content is relevant to the query
3. **Browser Automation Reliability**: Handling browser crashes and timeouts
4. **Performance Optimization**: Balancing thoroughness with response time
5. **Error Handling**: Gracefully handling API failures and network issues

## Implementation Strategy
We are following an incremental development approach:

1. **Phase 1**: Basic CLI with simple query processing and direct web requests (Completed)
2. **Phase 2**: MCP server architecture with specialized servers (Completed)
3. **Phase 3**: Real API integration for search and AI summarization (Current/Completed)
4. **Phase 4**: Advanced features, optimization, and error handling (Next)
5. **Phase 5**: Polishing, documentation, and distribution (Future)
