const express = require('express');
const cors = require('cors');
const { chromium } = require('playwright');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Store the latest scraping results
let latestResults = null;
let scrapingInProgress = false;

// API endpoint to start scraping
app.post('/api/scrape', async (req, res) => {
  if (scrapingInProgress) {
    return res.status(409).json({ error: 'Scraping already in progress' });
  }

  scrapingInProgress = true;
  
  try {
    const results = await performScraping();
    latestResults = results;
    scrapingInProgress = false;
    
    res.json({
      success: true,
      data: results
    });
  } catch (error) {
    scrapingInProgress = false;
    res.status(500).json({
      success: false,
      error: error.message
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

async function performScraping() {
  console.log("🚀 Starting Hacker News Article Validation via API...\n");
  
  const browser = await chromium.launch({ 
    headless: true, // Run headless for API
    channel: 'chrome'
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
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
    
  } finally {
    await browser.close();
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
  let validCount = 0;
  
  for (let i = 0; i < articles.length - 1; i++) {
    const current = articles[i];
    const next = articles[i + 1];
    
    const currentTime = parseTimestamp(current.rawTime);
    const nextTime = parseTimestamp(next.rawTime);
    
    if (currentTime && nextTime) {
      if (currentTime < nextTime) {
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
      } else {
        validCount++;
      }
    }
  }
  
  return {
    totalArticles: articles.length,
    validTransitions: validCount,
    issues: issues,
    isValid: issues.length === 0
  };
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

app.listen(PORT, () => {
  console.log(`🚀 Hacker News Validator API running on http://localhost:${PORT}`);
  console.log(`📊 Dashboard will be available at http://localhost:3000`);
});
