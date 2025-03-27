# Technical Context: AI Web Crawler CLI Tool

## Technology Stack

### Core Technologies
- **Node.js**: Runtime environment for the application
- **TypeScript**: Programming language for type safety and better developer experience
- **Puppeteer**: Headless browser automation library for web crawling
- **Model Context Protocol (MCP)**: Framework for AI assistant integration

### Key Dependencies
- **@modelcontextprotocol/sdk**: SDK for implementing MCP servers
- **axios**: HTTP client for making requests to web services
- **puppeteer**: Browser automation library
- **commander**: Command-line interface framework
- **cheerio**: HTML parsing and manipulation library
- **markdown-it**: Markdown parsing and rendering

## Development Environment

### Requirements
- Node.js v14 or higher
- npm or yarn package manager
- Git for version control

### Setup Process
1. Clone the repository
2. Install dependencies with `npm install`
3. Build the project with `npm run build`
4. Run the CLI tool with `npm start`

### Development Workflow
1. Make changes to TypeScript files in the `src` directory
2. Rebuild the project with `npm run build`
3. Test changes with sample queries
4. Commit changes with descriptive messages

## Project Structure

```
ai-crawler/
├── build/                  # Compiled JavaScript files
├── memory-bank/            # Project documentation and context
├── src/                    # Source code
│   ├── cli/                # Command-line interface
│   ├── query/              # Query processing
│   ├── search/             # Search engine integration
│   ├── crawler/            # Web crawling functionality
│   ├── extractor/          # Content extraction
│   ├── formatter/          # Result formatting
│   └── index.ts            # Main entry point
├── test/                   # Test files
├── package.json            # Project configuration
└── tsconfig.json           # TypeScript configuration
```

## Technical Constraints

### Performance Considerations
- **Memory Usage**: Efficient handling of large web pages and search results
- **Response Time**: Quick response for simple queries
- **Concurrency**: Balanced approach to parallel crawling without overwhelming targets

### Security Considerations
- **User Data**: No collection or storage of user queries beyond session
- **Website Access**: Respect for robots.txt and site terms of service
- **Rate Limiting**: Intelligent handling of rate limits to avoid IP blocking

### Compatibility Requirements
- **Node.js Versions**: Support for Node.js LTS versions
- **Operating Systems**: Cross-platform support (Windows, macOS, Linux)
- **Terminal Environments**: Support for various terminal emulators

## Integration Points

### Search Engine Integration
- Integration with search APIs to find relevant pages
- Fallback mechanisms when APIs have usage limits

### Browser Automation
- Puppeteer for JavaScript-heavy websites
- Direct HTTP requests for simpler pages

### Natural Language Processing
- Query analysis to determine search intent
- Entity extraction from queries

## Deployment Strategy

### Distribution Methods
- npm package for global installation
- Docker container for isolated environments
- Standalone binaries for non-Node.js environments

### Configuration Management
- Environment variables for sensitive settings
- Configuration files for persistent preferences
- Command-line flags for one-time options

### Versioning Strategy
- Semantic versioning (MAJOR.MINOR.PATCH)
- Changelog maintenance for tracking changes
- Deprecation notices for breaking changes

## Testing Approach

### Test Types
- Unit tests for individual components
- Integration tests for component interactions
- End-to-end tests for complete workflows

### Test Coverage
- Core functionality: 90%+ coverage
- Edge cases: Comprehensive test suite
- Performance: Benchmarking for key operations

## Current Technical Debt

### Existing Foundation
- Basic MCP server implementation
- Browser automation capabilities
- Simple test HTML page

### Areas Needing Implementation
- CLI interface
- Query processing
- Search engine integration
- Content extraction
- Result formatting
- Error handling
- Rate limiting
- Caching
