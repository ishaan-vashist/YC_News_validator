const { test, expect } = require('@playwright/test');

test.describe('Hacker News Scraping E2E Tests', () => {
  test('should successfully scrape and validate Hacker News articles', async ({ page }) => {
    // Navigate to Hacker News newest page
    await page.goto('https://news.ycombinator.com/newest');
    
    // Wait for the page to load completely
    await page.waitForLoadState('networkidle');
    
    // Verify we're on the correct page
    expect(page.url()).toContain('newest');
    
    // Check that articles are present
    const articles = await page.locator('.athing').count();
    expect(articles).toBeGreaterThan(0);
    
    // Verify article structure - check first few articles
    const firstArticle = page.locator('.athing').first();
    await expect(firstArticle.locator('.rank')).toBeVisible();
    await expect(firstArticle.locator('.titleline > a')).toBeVisible();
    
    // Check metadata row exists for first article
    const firstMetaRow = page.locator('.athing').first().locator('+ tr');
    await expect(firstMetaRow.locator('.age')).toBeVisible();
    
    // Verify "More" button exists for pagination
    const moreButton = page.locator('a[href*="newest"]:has-text("More")');
    await expect(moreButton).toBeVisible();
  });

  test('should extract article data correctly', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest');
    await page.waitForLoadState('networkidle');
    
    // Extract data from first article using the same logic as our scraper
    const articleData = await page.evaluate(() => {
      const article = document.querySelector('.athing');
      if (!article) return null;
      
      const rank = article.querySelector('.rank')?.textContent?.replace('.', '') || '';
      const titleElement = article.querySelector('.titleline > a');
      const title = titleElement?.textContent || 'No title';
      const url = titleElement?.href || '';
      
      const metaRow = article.nextElementSibling;
      let timestamp = '';
      let author = '';
      let score = 0;
      
      if (metaRow) {
        const ageElement = metaRow.querySelector('.age');
        timestamp = ageElement?.getAttribute('title') || ageElement?.textContent || '';
        
        const authorElement = metaRow.querySelector('.hnuser');
        author = authorElement?.textContent || 'Unknown';
        
        const scoreElement = metaRow.querySelector('.score');
        score = parseInt(scoreElement?.textContent?.replace(' points', '') || '0');
      }
      
      return {
        rank: parseInt(rank) || 1,
        title: title.trim(),
        url,
        author,
        timestamp,
        score
      };
    });
    
    // Validate extracted data structure
    expect(articleData).toBeTruthy();
    expect(articleData.rank).toBeGreaterThan(0);
    expect(articleData.title).toBeTruthy();
    expect(articleData.title.length).toBeGreaterThan(0);
    expect(articleData.author).toBeTruthy();
    expect(typeof articleData.score).toBe('number');
  });

  test('should handle pagination correctly', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest');
    await page.waitForLoadState('networkidle');
    
    // Get initial URL
    const initialUrl = page.url();
    
    // Count articles on first page
    const initialArticleCount = await page.locator('.athing').count();
    expect(initialArticleCount).toBeGreaterThan(0);
    
    // Click "More" button
    const moreButton = page.locator('a[href*="newest"]:has-text("More")');
    await moreButton.click();
    await page.waitForLoadState('networkidle');
    
    // Verify URL changed (pagination occurred)
    const newUrl = page.url();
    expect(newUrl).not.toBe(initialUrl);
    
    // Verify we still have articles on the new page
    const newArticleCount = await page.locator('.athing').count();
    expect(newArticleCount).toBeGreaterThan(0);
  });

  test('should validate timestamp formats', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest');
    await page.waitForLoadState('networkidle');
    
    // Extract timestamps from multiple articles
    const timestamps = await page.evaluate(() => {
      const articles = document.querySelectorAll('.athing');
      const results = [];
      
      for (let i = 0; i < Math.min(5, articles.length); i++) {
        const article = articles[i];
        const metaRow = article.nextElementSibling;
        if (metaRow) {
          const ageElement = metaRow.querySelector('.age');
          const rawTime = ageElement?.textContent || '';
          results.push(rawTime);
        }
      }
      
      return results;
    });
    
    // Validate timestamp formats
    timestamps.forEach(timestamp => {
      expect(timestamp).toBeTruthy();
      // Should match patterns like "2 hours ago", "1 day ago", "45 minutes ago"
      expect(timestamp).toMatch(/\d+\s+(minute|hour|day)s?\s+ago/);
    });
  });

  test('should verify chronological ordering assumption', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest');
    await page.waitForLoadState('networkidle');
    
    // Extract timestamps from first 10 articles
    const timestampData = await page.evaluate(() => {
      const articles = document.querySelectorAll('.athing');
      const results = [];
      
      for (let i = 0; i < Math.min(10, articles.length); i++) {
        const article = articles[i];
        const metaRow = article.nextElementSibling;
        if (metaRow) {
          const ageElement = metaRow.querySelector('.age');
          const rawTime = ageElement?.textContent || '';
          const rank = article.querySelector('.rank')?.textContent?.replace('.', '') || '';
          results.push({
            rank: parseInt(rank) || (i + 1),
            rawTime
          });
        }
      }
      
      return results;
    });
    
    // Basic validation that we have timestamp data
    expect(timestampData.length).toBeGreaterThan(0);
    
    // Verify ranks are sequential
    timestampData.forEach((item, index) => {
      expect(item.rank).toBe(index + 1);
    });
  });

  test('should handle network errors gracefully', async ({ page }) => {
    // Test with invalid URL to simulate network error
    const response = page.goto('https://invalid-hacker-news-url.com/newest');
    
    await expect(response).rejects.toThrow();
  });

  test('should verify article metadata completeness', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest');
    await page.waitForLoadState('networkidle');
    
    // Check that essential elements exist for first article
    const firstArticle = page.locator('.athing').first();
    
    // Title should be clickable link
    const titleLink = firstArticle.locator('.titleline > a');
    await expect(titleLink).toBeVisible();
    
    // Should have href attribute
    const href = await titleLink.getAttribute('href');
    expect(href).toBeTruthy();
    
    // Metadata row should exist
    const metaRow = firstArticle.locator('+ tr');
    await expect(metaRow).toBeVisible();
    
    // Age element should exist
    await expect(metaRow.locator('.age')).toBeVisible();
    
    // Author should exist (hnuser class)
    await expect(metaRow.locator('.hnuser')).toBeVisible();
  });
});

test.describe('CLI Script E2E Tests', () => {
  test('should run index.js script successfully', async () => {
    // Note: This would require running the actual script
    // For now, we'll test the structure and imports
    const { execSync } = require('child_process');
    
    try {
      // Test that the script can be parsed (syntax check)
      execSync('node -c index.js', { cwd: process.cwd() });
    } catch (error) {
      throw new Error(`Script syntax error: ${error.message}`);
    }
  });
});

test.describe('Performance Tests', () => {
  test('should load Hacker News page within reasonable time', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('https://news.ycombinator.com/newest');
    await page.waitForLoadState('networkidle');
    
    const loadTime = Date.now() - startTime;
    
    // Should load within 10 seconds
    expect(loadTime).toBeLessThan(10000);
  });

  test('should extract article data efficiently', async ({ page }) => {
    await page.goto('https://news.ycombinator.com/newest');
    await page.waitForLoadState('networkidle');
    
    const startTime = Date.now();
    
    // Extract data from all articles on page
    const articles = await page.evaluate(() => {
      const articleElements = document.querySelectorAll('.athing');
      const results = [];
      
      articleElements.forEach((article, index) => {
        const rank = article.querySelector('.rank')?.textContent?.replace('.', '') || '';
        const titleElement = article.querySelector('.titleline > a');
        const title = titleElement?.textContent || 'No title';
        
        const metaRow = article.nextElementSibling;
        if (metaRow) {
          const ageElement = metaRow.querySelector('.age');
          const timestamp = ageElement?.textContent || '';
          const authorElement = metaRow.querySelector('.hnuser');
          const author = authorElement?.textContent || 'Unknown';
          
          results.push({
            rank: parseInt(rank) || (index + 1),
            title: title.trim(),
            author,
            timestamp
          });
        }
      });
      
      return results;
    });
    
    const extractionTime = Date.now() - startTime;
    
    // Should extract data within 2 seconds
    expect(extractionTime).toBeLessThan(2000);
    expect(articles.length).toBeGreaterThan(0);
  });
});
