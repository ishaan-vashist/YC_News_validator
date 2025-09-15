const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
const PORT = process.env.PORT || 3001;
const MAX_CACHE_AGE = 5 * 60 * 1000; // 5 minutes cache
const REQUEST_TIMEOUT = 60000; // 60 second timeout

// Enhanced CORS configuration for production
const corsOptions = {
  origin: [
    'http://localhost:3000', // Local development
    'https://yc-news-validator.vercel.app', // Production frontend
    /^https:\/\/.*\.vercel\.app$/, // Any Vercel preview deployments
  ],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200 // for legacy browser support
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));

// Request timeout middleware
app.use((req, res, next) => {
  req.setTimeout(REQUEST_TIMEOUT, () => {
    res.status(408).json({ error: 'Request timeout' });
  });
  next();
});

// Store the latest scraping results with timestamp
let latestResults = null;
let scrapingInProgress = false;
let lastScrapedAt = null;

// Simple rate limiting
const requestCounts = new Map();
const RATE_LIMIT = 10; // requests per minute
const RATE_WINDOW = 60 * 1000; // 1 minute

const rateLimit = (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + RATE_WINDOW });
  } else {
    const data = requestCounts.get(ip);
    if (now > data.resetTime) {
      data.count = 1;
      data.resetTime = now + RATE_WINDOW;
    } else {
      data.count++;
      if (data.count > RATE_LIMIT) {
        return res.status(429).json({ error: 'Too many requests' });
      }
    }
  }
  next();
};

// API endpoint to start scraping with rate limiting
app.post('/api/scrape', rateLimit, async (req, res) => {
  // Check cache first
  if (latestResults && lastScrapedAt && (Date.now() - lastScrapedAt < MAX_CACHE_AGE)) {
    return res.json({
      success: true,
      data: latestResults,
      cached: true
    });
  }

  if (scrapingInProgress) {
    return res.status(409).json({ error: 'Scraping already in progress' });
  }

  scrapingInProgress = true;
  
  try {
    const results = await performScraping();
    latestResults = results;
    lastScrapedAt = Date.now();
    scrapingInProgress = false;
    
    res.json({
      success: true,
      data: results,
      cached: false
    });
  } catch (error) {
    scrapingInProgress = false;
    console.error('Scraping error:', error);
    res.status(500).json({
      success: false,
      error: process.env.NODE_ENV === 'production' ? 'Internal server error' : error.message
    });
  }
});

// API endpoint to get latest results
app.get('/api/results', (req, res) => {
  if (!latestResults) {
    return res.status(404).json({ error: 'No results available. Run scraping first.' });
  }
  
  res.json({
    success: true,
    data: latestResults
  });
});

// API endpoint to check scraping status
app.get('/api/status', (req, res) => {
  res.json({
    scrapingInProgress,
    hasResults: !!latestResults
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    memory: process.memoryUsage(),
    uptime: process.uptime()
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'Hacker News Validator API',
    endpoints: {
      scrape: '/api/scrape',
      results: '/api/results', 
      status: '/api/status',
      health: '/health'
    }
  });
});

async function performScraping() {
  console.log("🚀 Starting Hacker News Article Validation via API...\n");
  
  let browser;
  try {
    // Try to launch browser, if it fails, attempt to install first
    try {
      browser = await chromium.launch({ 
        headless: true, // Always run headless for API
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process', // Required for some cloud environments
          '--disable-gpu',
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor'
        ],
        timeout: 30000 // 30 second timeout for browser launch
      });
    } catch (launchError) {
      console.log("Browser launch failed, attempting to install Chromium...");
      const { execSync } = require('child_process');
      try {
        execSync('npx playwright install chromium', { stdio: 'inherit' });
        console.log("Chromium installed, retrying browser launch...");
        browser = await chromium.launch({ 
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process',
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
          ],
          timeout: 30000
        });
      } catch (installError) {
        console.error("Failed to install Chromium:", installError);
        throw launchError; // Throw original launch error
      }
    }
    
    const context = await browser.newContext();
    const page = await context.newPage();

    console.log("📖 Navigating to Hacker News /newest...");
    await page.goto("https://news.ycombinator.com/newest");
    await page.waitForLoadState('networkidle');

    const articles = [];
    let currentPage = 1;

    // Collect exactly 100 articles across multiple pages
    while (articles.length < 100) {
      console.log(`📄 Scraping page ${currentPage}...`);
      
      const pageArticles = await scrapeArticlesFromPage(page);
      
      const articlesNeeded = 100 - articles.length;
      const articlesToAdd = pageArticles.slice(0, articlesNeeded);
      articles.push(...articlesToAdd);
      
      console.log(`   Found ${pageArticles.length} articles, added ${articlesToAdd.length}`);
      console.log(`   Total articles collected: ${articles.length}/100`);

      if (articles.length < 100) {
        const moreButton = await page.$('a[href*="newest"]:has-text("More")');
        if (moreButton) {
          console.log("   Clicking 'More' to load next page...");
          await moreButton.click();
          await page.waitForLoadState('networkidle');
          currentPage++;
        } else {
          console.log("   No 'More' button found - reached end of articles");
          break;
        }
      }
    }

    // Validate sorting
    console.log("\n🔍 Validating article sorting...");
    const validationResult = validateArticleSorting(articles);
    
    return {
      articles,
      validation: validationResult,
      scrapedAt: new Date().toISOString(),
      totalPages: currentPage
    };
    
  } catch (error) {
    console.error('Error during scraping:', error);
    throw error;
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

async function scrapeArticlesFromPage(page) {
  await page.waitForSelector('.athing');
  
  const articles = await page.evaluate(() => {
    const articleElements = document.querySelectorAll('.athing');
    const results = [];
    
    articleElements.forEach((article, index) => {
      try {
        const rank = article.querySelector('.rank')?.textContent?.replace('.', '') || '';
        const titleElement = article.querySelector('.titleline > a');
        const title = titleElement?.textContent || 'No title';
        const url = titleElement?.href || '';
        
        const metaRow = article.nextElementSibling;
        if (metaRow) {
          const ageElement = metaRow.querySelector('.age');
          const timestamp = ageElement?.getAttribute('title') || ageElement?.textContent || '';
          
          const authorElement = metaRow.querySelector('.hnuser');
          const author = authorElement?.textContent || 'Unknown';
          
          const scoreElement = metaRow.querySelector('.score');
          const score = scoreElement?.textContent?.replace(' points', '') || '0';
          
          results.push({
            rank: parseInt(rank) || (index + 1),
            title: title.trim(),
            url: url,
            author: author,
            timestamp: timestamp,
            rawTime: ageElement?.textContent || '',
            score: parseInt(score) || 0
          });
        }
      } catch (err) {
        console.log(`Error parsing article ${index + 1}:`, err.message);
      }
    });
    
    return results;
  });
  
  return articles;
}

function validateArticleSorting(articles) {
  console.log(`Validating ${articles.length} articles for chronological order...`);
  
  const issues = [];
  const detailedIssues = [];
  let validCount = 0;
  let parsingErrors = 0;
  
  for (let i = 0; i < articles.length - 1; i++) {
    const current = articles[i];
    const next = articles[i + 1];
    
    const currentTime = parseTimestamp(current.rawTime);
    const nextTime = parseTimestamp(next.rawTime);
    
    // Check for parsing errors
    if (!currentTime || !nextTime) {
      parsingErrors++;
      const errorType = !currentTime && !nextTime ? 'both' : (!currentTime ? 'current' : 'next');
      detailedIssues.push({
        type: 'PARSING_ERROR',
        severity: 'HIGH',
        position: i + 1,
        description: `Unable to parse timestamp for ${errorType} article(s)`,
        context: {
          current: {
            rank: current.rank,
            time: current.rawTime,
            title: current.title.substring(0, 60),
            parsedTime: currentTime ? new Date(currentTime).toISOString() : 'FAILED_TO_PARSE'
          },
          next: {
            rank: next.rank,
            time: next.rawTime,
            title: next.title.substring(0, 60),
            parsedTime: nextTime ? new Date(nextTime).toISOString() : 'FAILED_TO_PARSE'
          }
        },
        impact: 'Cannot validate chronological order for this pair',
        recommendation: 'Check timestamp format and parsing logic'
      });
      continue;
    }
    
    // Check chronological order
    if (currentTime < nextTime) {
      const timeDiff = nextTime - currentTime;
      const timeDiffMinutes = Math.round(timeDiff / (1000 * 60));
      
      issues.push({
        position: i + 1,
        current: {
          rank: current.rank,
          time: current.rawTime,
          title: current.title.substring(0, 50) + '...'
        },
        next: {
          rank: next.rank,
          time: next.rawTime,
          title: next.title.substring(0, 50) + '...'
        }
      });
      
      detailedIssues.push({
        type: 'CHRONOLOGICAL_ORDER_VIOLATION',
        severity: timeDiffMinutes > 60 ? 'HIGH' : (timeDiffMinutes > 10 ? 'MEDIUM' : 'LOW'),
        position: i + 1,
        description: `Article at position ${i + 1} is older than article at position ${i + 2}`,
        context: {
          current: {
            rank: current.rank,
            time: current.rawTime,
            title: current.title.substring(0, 60),
            parsedTime: new Date(currentTime).toISOString(),
            author: current.author,
            score: current.score
          },
          next: {
            rank: next.rank,
            time: next.rawTime,
            title: next.title.substring(0, 60),
            parsedTime: new Date(nextTime).toISOString(),
            author: next.author,
            score: next.score
          },
          timeDifference: {
            milliseconds: timeDiff,
            minutes: timeDiffMinutes,
            humanReadable: formatTimeDifference(timeDiff)
          }
        },
        impact: `Articles are out of chronological order by ${formatTimeDifference(timeDiff)}`,
        recommendation: 'Verify Hacker News sorting algorithm or check for data inconsistencies'
      });
    } else {
      validCount++;
    }
  }
  
  // Generate summary insights
  const totalComparisons = articles.length - 1;
  const successRate = ((validCount / totalComparisons) * 100).toFixed(1);
  const highSeverityIssues = detailedIssues.filter(issue => issue.severity === 'HIGH').length;
  const mediumSeverityIssues = detailedIssues.filter(issue => issue.severity === 'MEDIUM').length;
  const lowSeverityIssues = detailedIssues.filter(issue => issue.severity === 'LOW').length;
  
  return {
    totalArticles: articles.length,
    validTransitions: validCount,
    totalComparisons,
    successRate: parseFloat(successRate),
    parsingErrors,
    issues: issues, // Keep for backward compatibility
    detailedIssues,
    isValid: issues.length === 0 && parsingErrors === 0,
    summary: {
      status: issues.length === 0 && parsingErrors === 0 ? 'PASSED' : 'FAILED',
      totalIssues: detailedIssues.length,
      severityBreakdown: {
        high: highSeverityIssues,
        medium: mediumSeverityIssues,
        low: lowSeverityIssues
      },
      mainIssues: detailedIssues.length > 0 ? 
        detailedIssues.slice(0, 3).map(issue => issue.description) : 
        ['All articles are in correct chronological order'],
      recommendations: generateRecommendations(detailedIssues, parsingErrors, successRate)
    }
  };
}

function formatTimeDifference(milliseconds) {
  const minutes = Math.floor(milliseconds / (1000 * 60));
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days} day${days > 1 ? 's' : ''} ${hours % 24} hour${(hours % 24) !== 1 ? 's' : ''}`;
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ${minutes % 60} minute${(minutes % 60) !== 1 ? 's' : ''}`;
  return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
}

function generateRecommendations(detailedIssues, parsingErrors, successRate) {
  const recommendations = [];
  
  if (parsingErrors > 0) {
    recommendations.push(`Fix ${parsingErrors} timestamp parsing error${parsingErrors > 1 ? 's' : ''} to improve validation accuracy`);
  }
  
  if (successRate < 90) {
    recommendations.push('Investigate Hacker News sorting algorithm - significant chronological inconsistencies detected');
  } else if (successRate < 95) {
    recommendations.push('Minor sorting inconsistencies detected - may be due to submission timing edge cases');
  }
  
  const highSeverityCount = detailedIssues.filter(issue => issue.severity === 'HIGH').length;
  if (highSeverityCount > 0) {
    recommendations.push(`Address ${highSeverityCount} high-severity issue${highSeverityCount > 1 ? 's' : ''} with significant time gaps`);
  }
  
  if (recommendations.length === 0) {
    recommendations.push('All articles are properly sorted in chronological order');
  }
  
  return recommendations;
}

function parseTimestamp(timeString) {
  if (!timeString) return null;
  
  const now = Date.now();
  const timeStr = timeString.toLowerCase().trim();
  
  const patterns = [
    { regex: /(\d+)\s*minutes?\s*ago/, multiplier: 60 * 1000 },
    { regex: /(\d+)\s*hours?\s*ago/, multiplier: 60 * 60 * 1000 },
    { regex: /(\d+)\s*days?\s*ago/, multiplier: 24 * 60 * 60 * 1000 }
  ];
  
  for (const pattern of patterns) {
    const match = timeStr.match(pattern.regex);
    if (match) {
      const value = parseInt(match[1]);
      return now - (value * pattern.multiplier);
    }
  }
  
  return now;
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Hacker News Validator API running on port ${PORT}`);
  console.log(`📊 Health check available at /health`);
  console.log(`🔗 Environment: ${process.env.NODE_ENV || 'development'}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully...');
  process.exit(0);
});
