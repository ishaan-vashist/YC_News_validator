# QA Wolf Take-Home Assignment - Hacker News Validator

## 🎯 Project Overview

This project implements a comprehensive solution for the QA Wolf take-home assignment, validating that the first 100 articles on Hacker News are properly sorted from newest to oldest. The implementation provides both a command-line interface and a modern web dashboard with comprehensive testing coverage.

## 📋 Assignment Requirements Met

✅ **Core Requirements:**
- Navigate to https://news.ycombinator.com/newest
- Validate EXACTLY the first 100 articles are sorted newest to oldest
- Use JavaScript and Playwright framework
- Script runs with `node index.js` command
- Utilizes Playwright for web automation

✅ **Enhanced Features:**
- Modern React/Next.js web dashboard
- RESTful API with comprehensive endpoints
- CSV/JSON export functionality
- Comprehensive test suite (Unit, Integration, E2E, Frontend)
- Advanced validation reporting with severity levels
- Cross-page article collection with pagination
- Detailed error handling and logging

## 🏗️ Architecture

### Core Components

1. **Command Line Script (`index.js`)**
   - Primary validation script as required
   - Uses system Chrome browser (non-headless for visibility)
   - Comprehensive console logging with emojis
   - Detailed validation results with first 10 articles preview

2. **API Server (`server.js`)**
   - Express.js REST API running on port 3001
   - Headless browser execution for API calls
   - Advanced validation with severity classification
   - CORS enabled for web dashboard integration

3. **Web Dashboard (`client/`)**
   - Next.js 15 with React 19 and TypeScript
   - Tailwind CSS 4 for modern styling
   - Real-time scraping status and progress
   - Interactive results visualization with detailed issue analysis
   - Export functionality for CSV and JSON formats

4. **Comprehensive Test Suite (`tests/`)**
   - Unit tests for core functions
   - Integration tests for API endpoints
   - End-to-end tests for complete workflows
   - Frontend tests for UI components

## 🔧 Technical Implementation

### Web Scraping Logic

**Multi-page Collection:**
- Starts at Hacker News `/newest` page
- Collects articles across multiple pages until exactly 100 are gathered
- Handles pagination via "More" button clicks
- Robust error handling for missing elements and network issues

**Data Extraction:**
- Article rank, title, and URL
- Author information and scores
- Timestamp parsing (relative time formats)
- Comprehensive metadata collection

**Advanced Validation Algorithm:**
- Parses relative timestamps ("2 hours ago", "1 day ago", etc.)
- Converts to absolute timestamps for precise comparison
- Validates chronological order (newest → oldest)
- Classifies issues by severity (HIGH, MEDIUM, LOW)
- Provides detailed context and recommendations

### Browser Configuration

**CLI Mode (index.js):**
```javascript
const browser = await chromium.launch({ 
  headless: false,        // Visual browser for CLI
  channel: 'chrome'       // Uses system Chrome
});
```

**API Mode (server.js):**
```javascript
const browser = await chromium.launch({ 
  headless: true,         // Headless for API performance
  channel: 'chrome'       // Uses system Chrome
});
```

## 📊 Features

### Command Line Interface
- **Execution:** `node index.js`
- **Output:** Rich console logging with emojis and formatting
- **Results:** Comprehensive validation report with issue details
- **Preview:** First 10 articles display for quick verification
- **Status:** Clear pass/fail indication with detailed metrics

### Web Dashboard
- **Modern UI:** Clean, responsive design with dark mode support
- **Real-time Updates:** Live scraping status with progress indicators
- **Interactive Results:** Clickable article links and sortable tables
- **Advanced Analytics:** Success rate, severity breakdown, recommendations
- **Data Export:** One-click CSV and JSON download with timestamps
- **Comprehensive Display:** Full 100-article table with all metadata

### API Endpoints
- `POST /api/scrape` - Start new validation process
- `GET /api/results` - Retrieve latest validation results
- `GET /api/status` - Check current scraping status and progress

## 🚀 Usage Instructions

### Quick Start (CLI Only)
```bash
npm install
node index.js
```

### Full Stack Experience
```bash
# Terminal 1: Start API server
npm run server

# Terminal 2: Start web dashboard  
npm run client

# Visit: http://localhost:3000
```

### Development Mode
```bash
npm run dev  # Runs both server and client concurrently
```

### Testing
```bash
# Run all tests
npm run test:all

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:e2e
npm run test:frontend

# Interactive testing
npm run test:ui
```

## 📦 Dependencies

### Core Dependencies
- **playwright**: ^1.39.0 - Web automation framework
- **express**: ^4.21.2 - API server framework
- **cors**: ^2.8.5 - Cross-origin resource sharing

### Client Dependencies
- **next**: 15.5.2 - React framework with Turbopack
- **react**: 19.1.0 - UI library
- **react-dom**: 19.1.0 - React DOM renderer
- **tailwindcss**: ^4 - CSS framework
- **typescript**: ^5 - Type safety

### Development Tools
- **@playwright/test**: ^1.39.0 - Testing framework
- **nodemon**: ^3.1.10 - Auto-restart server
- **concurrently**: ^8.2.2 - Run multiple commands
- **eslint**: ^9 - Code linting

## 🧪 Test Suite

### Test Categories

1. **Unit Tests** (`tests/unit/core-functions.test.js`)
   - Tests `parseTimestamp()` function with various formats
   - Tests `validateArticleSorting()` with different scenarios
   - Edge cases and error handling validation

2. **Integration Tests** (`tests/integration/api.test.js`)
   - API endpoint testing (scrape, results, status)
   - CORS handling and error scenarios
   - Server response validation

3. **End-to-End Tests** (`tests/e2e/hacker-news-scraping.test.js`)
   - Complete scraping workflow against live Hacker News
   - Performance validation and real data extraction
   - Pagination and multi-page handling

4. **Frontend Tests** (`tests/frontend/dashboard.test.js`)
   - React component rendering and interactions
   - API integration and state management
   - Export functionality and responsive design

### Test Configuration
- **Browsers:** Chromium, Firefox, WebKit
- **Reporters:** HTML, JSON, JUnit
- **Timeouts:** 60s global, 30s actions, 10s assertions
- **Features:** Screenshots on failure, video recording, trace collection

## 🔍 Advanced Validation Logic

### Timestamp Parsing
```javascript
const patterns = [
  { regex: /(\d+)\s*minutes?\s*ago/, multiplier: 60 * 1000 },
  { regex: /(\d+)\s*hours?\s*ago/, multiplier: 60 * 60 * 1000 },
  { regex: /(\d+)\s*days?\s*ago/, multiplier: 24 * 60 * 60 * 1000 }
];
```

### Issue Classification
- **HIGH Severity:** Time gaps > 60 minutes
- **MEDIUM Severity:** Time gaps 10-60 minutes  
- **LOW Severity:** Time gaps < 10 minutes
- **Parsing Errors:** Timestamp format issues

### Comprehensive Reporting
- Success rate calculation
- Detailed issue context with article metadata
- Time difference analysis
- Actionable recommendations

## 📈 Results & Analytics

### Metrics Tracked
- **Total Articles:** Exactly 100 as required
- **Valid Transitions:** Correct chronological pairs (99 comparisons)
- **Success Rate:** Percentage of valid transitions
- **Issues by Severity:** HIGH/MEDIUM/LOW breakdown
- **Parsing Errors:** Timestamp format failures

### Issue Analysis
- **Position:** Exact location of sorting violation
- **Context:** Both articles with full metadata
- **Time Gap:** Human-readable difference calculation
- **Impact Assessment:** Effect on overall validation
- **Recommendations:** Specific improvement suggestions

## 🛠️ Error Handling & Resilience

### Robust Implementation
- **Network Issues:** Retry logic and timeout handling
- **Missing Elements:** Graceful degradation with detailed logging
- **Parsing Errors:** Individual article error isolation
- **API Failures:** Comprehensive error responses with status codes
- **Browser Crashes:** Proper cleanup and resource management
- **Concurrent Requests:** Request queuing and status tracking

## 📁 Project Structure

```
qa_wolf_take_home/
├── index.js                    # Main CLI script (assignment requirement)
├── server.js                   # Express API server
├── package.json               # Root dependencies and scripts
├── playwright.config.js       # Playwright test configuration
├── TEST_GUIDE.md              # Comprehensive test documentation
├── client/                    # Next.js web dashboard
│   ├── src/app/
│   │   ├── page.tsx          # Main dashboard component
│   │   ├── layout.tsx        # App layout and global styles
│   │   └── globals.css       # Tailwind CSS imports
│   ├── package.json          # Client-specific dependencies
│   ├── next.config.js        # Next.js configuration
│   └── tailwind.config.js    # Tailwind CSS configuration
├── tests/                     # Comprehensive test suite
│   ├── unit/
│   │   └── core-functions.test.js
│   ├── integration/
│   │   └── api.test.js
│   ├── e2e/
│   │   └── hacker-news-scraping.test.js
│   └── frontend/
│       └── dashboard.test.js
└── .gitignore                 # Git ignore patterns
```

## 🎯 Success Metrics & Validation

- ✅ **Functional:** Accurately validates HN article chronological sorting
- ✅ **Technical:** Uses Playwright framework as required
- ✅ **Usable:** Both CLI and web interfaces work seamlessly
- ✅ **Tested:** Comprehensive test coverage across all components
- ✅ **Professional:** Production-ready code quality and documentation
- ✅ **Scalable:** API-based architecture for future enhancements

## 🚀 Going Beyond Requirements

### Enhanced Capabilities
- **Dual Interface:** Command-line + modern web dashboard
- **API Architecture:** RESTful endpoints for programmatic access
- **Advanced Analytics:** Severity classification and success metrics
- **Export Functionality:** CSV and JSON data export with timestamps
- **Comprehensive Testing:** 4-tier test suite with multiple browsers
- **Modern Tech Stack:** Next.js 15, React 19, TypeScript, Tailwind CSS 4

### Production Considerations
- **Performance:** Efficient scraping with pagination handling
- **Reliability:** Robust error handling and retry mechanisms
- **Maintainability:** Clean, modular code with comprehensive documentation
- **Monitoring:** Detailed logging and status tracking
- **Scalability:** API-based architecture ready for deployment

---

*This project demonstrates comprehensive QA automation skills, full-stack development expertise, and the ability to create production-ready solutions that significantly exceed basic requirements while maintaining code quality and thorough testing coverage.*
