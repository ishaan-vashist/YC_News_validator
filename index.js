// EDIT THIS FILE TO COMPLETE ASSIGNMENT QUESTION 1
const { chromium } = require("playwright");

async function sortHackerNewsArticles() {
  console.log("🚀 Starting Hacker News Article Validation...\n");
  
  // launch browser using system Chrome (bypasses Playwright browser download)
  const browser = await chromium.launch({ 
    headless: false,
    channel: 'chrome' // Use system Chrome instead of Playwright's Chromium
  });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // go to Hacker News
    console.log("📖 Navigating to Hacker News /newest...");
    await page.goto("https://news.ycombinator.com/newest");
    await page.waitForLoadState('networkidle');

    const articles = [];
    let currentPage = 1;

    // Collect exactly 100 articles across multiple pages
    while (articles.length < 100) {
      console.log(`📄 Scraping page ${currentPage}...`);
      
      // Get articles from current page
      const pageArticles = await scrapeArticlesFromPage(page);
      
      // Add articles until we reach 100
      const articlesNeeded = 100 - articles.length;
      const articlesToAdd = pageArticles.slice(0, articlesNeeded);
      articles.push(...articlesToAdd);
      
      console.log(`   Found ${pageArticles.length} articles, added ${articlesToAdd.length}`);
      console.log(`   Total articles collected: ${articles.length}/100`);

      // If we need more articles, click "More" to load next page
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
    
    // Display results
    displayResults(articles, validationResult);
    
  } catch (error) {
    console.error("❌ Error occurred:", error.message);
  } finally {
    await browser.close();
  }
}

async function scrapeArticlesFromPage(page) {
  // Wait for articles to load
  await page.waitForSelector('.athing');
  
  // Get all article rows on current page
  const articles = await page.evaluate(() => {
    const articleElements = document.querySelectorAll('.athing');
    const results = [];
    
    articleElements.forEach((article, index) => {
      try {
        // Get article number and title
        const rank = article.querySelector('.rank')?.textContent?.replace('.', '') || '';
        const titleElement = article.querySelector('.titleline > a');
        const title = titleElement?.textContent || 'No title';
        
        // Get the next sibling row which contains metadata
        const metaRow = article.nextElementSibling;
        if (metaRow) {
          // Extract timestamp
          const ageElement = metaRow.querySelector('.age');
          const timestamp = ageElement?.getAttribute('title') || ageElement?.textContent || '';
          
          // Extract author
          const authorElement = metaRow.querySelector('.hnuser');
          const author = authorElement?.textContent || 'Unknown';
          
          results.push({
            rank: parseInt(rank) || (index + 1),
            title: title.trim(),
            author: author,
            timestamp: timestamp,
            rawTime: ageElement?.textContent || ''
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
    
    // Parse timestamps for comparison
    const currentTime = parseTimestamp(current.rawTime);
    const nextTime = parseTimestamp(next.rawTime);
    
    if (currentTime && nextTime) {
      // Current article should be newer (higher timestamp) than next
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
  
  // Parse relative time strings like "2 hours ago", "1 day ago"
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
  
  // If no pattern matches, return current time (assume very recent)
  return now;
}

function displayResults(articles, validation) {
  console.log("\n" + "=".repeat(60));
  console.log("📊 HACKER NEWS ARTICLE VALIDATION RESULTS");
  console.log("=".repeat(60));
  
  console.log(`📈 Total Articles Analyzed: ${validation.totalArticles}`);
  console.log(`✅ Valid Chronological Transitions: ${validation.validTransitions}`);
  console.log(`❌ Sorting Issues Found: ${validation.issues.length}`);
  
  if (validation.isValid) {
    console.log("\n🎉 SUCCESS: All articles are properly sorted from newest to oldest!");
  } else {
    console.log("\n⚠️  ISSUES DETECTED:");
    validation.issues.forEach((issue, index) => {
      console.log(`\n${index + 1}. Position ${issue.position}:`);
      console.log(`   Current: #${issue.current.rank} - ${issue.current.time} - ${issue.current.title}`);
      console.log(`   Next:    #${issue.next.rank} - ${issue.next.time} - ${issue.next.title}`);
      console.log(`   Problem: Next article is newer than current article`);
    });
  }
  
  console.log("\n" + "=".repeat(60));
  console.log("🔗 First 10 Articles Preview:");
  console.log("=".repeat(60));
  
  articles.slice(0, 10).forEach((article, index) => {
    console.log(`${index + 1}. [${article.rawTime}] ${article.title.substring(0, 60)}...`);
  });
  
  console.log("\n✨ Validation Complete!");
}

(async () => {
  await sortHackerNewsArticles();
})();
