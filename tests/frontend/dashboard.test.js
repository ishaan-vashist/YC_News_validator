const { test, expect } = require('@playwright/test');

test.describe('Dashboard Frontend Tests', () => {
  let server;
  let baseURL;

  test.beforeAll(async () => {
    // Start the server for frontend tests
    const { spawn } = require('child_process');
    server = spawn('node', ['server.js'], { 
      cwd: process.cwd(),
      detached: false 
    });
    
    // Wait for server to start
    await new Promise(resolve => setTimeout(resolve, 3000));
    baseURL = 'http://localhost:3001';
  });

  test.afterAll(async () => {
    if (server) {
      server.kill();
    }
  });

  test('should display dashboard header correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check main heading
    await expect(page.locator('h1')).toContainText('QA Wolf - YC Hacker News Validator');
    
    // Check description
    await expect(page.getByText('Validating chronological sorting')).toBeVisible();
    
    // Check start validation button
    await expect(page.getByRole('button', { name: /Start Validation/i })).toBeVisible();
  });

  test('should show initial state correctly', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Should show ready state
    await expect(page.getByText('Ready to Validate Hacker News')).toBeVisible();
    await expect(page.getByText('Click "Start Validation" to scrape')).toBeVisible();
    
    // Export buttons should not be visible initially
    await expect(page.getByRole('button', { name: /CSV/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /JSON/i })).not.toBeVisible();
  });

  test('should handle loading state during scraping', async ({ page }) => {
    // Mock the API to simulate slow response
    await page.route('**/api/scrape', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            articles: [],
            validation: { isValid: true, totalArticles: 0 },
            scrapedAt: new Date().toISOString(),
            totalPages: 1
          }
        })
      });
    });

    await page.goto('http://localhost:3000');
    
    // Click start validation
    await page.getByRole('button', { name: /Start Validation/i }).click();
    
    // Should show loading state
    await expect(page.getByText('Scraping...')).toBeVisible();
    await expect(page.locator('.animate-spin')).toBeVisible();
    
    // Button should be disabled
    await expect(page.getByRole('button', { name: /Scraping/i })).toBeDisabled();
  });

  test('should display results after successful scraping', async ({ page }) => {
    // Mock successful API response
    await page.route('**/api/scrape', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            articles: [
              {
                rank: 1,
                title: 'Test Article 1',
                url: 'https://example.com/1',
                author: 'testuser1',
                rawTime: '1 hour ago',
                score: 100
              },
              {
                rank: 2,
                title: 'Test Article 2',
                url: 'https://example.com/2',
                author: 'testuser2',
                rawTime: '2 hours ago',
                score: 85
              }
            ],
            validation: {
              totalArticles: 2,
              validTransitions: 1,
              successRate: 100.0,
              isValid: true,
              issues: [],
              summary: {
                status: 'PASSED',
                totalIssues: 0,
                severityBreakdown: { high: 0, medium: 0, low: 0 },
                mainIssues: ['All articles are in correct chronological order'],
                recommendations: ['All articles are properly sorted in chronological order']
              }
            },
            scrapedAt: new Date().toISOString(),
            totalPages: 1
          }
        })
      });
    });

    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: /Start Validation/i }).click();
    
    // Wait for results to appear
    await expect(page.getByText('Total Articles')).toBeVisible();
    
    // Check summary cards
    await expect(page.getByText('2')).toBeVisible(); // Total articles
    await expect(page.getByText('1')).toBeVisible(); // Valid transitions
    await expect(page.getByText('100.0%')).toBeVisible(); // Success rate
    await expect(page.getByText('PASSED')).toBeVisible(); // Status
    
    // Check export buttons are now visible
    await expect(page.getByRole('button', { name: /CSV/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /JSON/i })).toBeVisible();
    
    // Check articles table
    await expect(page.getByText('First 100 Hacker News Articles')).toBeVisible();
    await expect(page.getByText('Test Article 1')).toBeVisible();
    await expect(page.getByText('Test Article 2')).toBeVisible();
  });

  test('should display error state correctly', async ({ page }) => {
    // Mock API error
    await page.route('**/api/scrape', async route => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          success: false,
          error: 'Network error occurred'
        })
      });
    });

    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: /Start Validation/i }).click();
    
    // Should show error message
    await expect(page.getByText('Error')).toBeVisible();
    await expect(page.getByText('HTTP error! status: 500')).toBeVisible();
  });

  test('should handle validation issues display', async ({ page }) => {
    // Mock response with validation issues
    await page.route('**/api/scrape', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            articles: [
              {
                rank: 1,
                title: 'Newer Article',
                url: 'https://example.com/1',
                author: 'user1',
                rawTime: '1 hour ago',
                score: 100
              },
              {
                rank: 2,
                title: 'Older Article',
                url: 'https://example.com/2',
                author: 'user2',
                rawTime: '30 minutes ago',
                score: 85
              }
            ],
            validation: {
              totalArticles: 2,
              validTransitions: 0,
              successRate: 0.0,
              isValid: false,
              issues: [
                {
                  position: 1,
                  current: { rank: 1, time: '1 hour ago', title: 'Newer Article...' },
                  next: { rank: 2, time: '30 minutes ago', title: 'Older Article...' }
                }
              ],
              detailedIssues: [
                {
                  type: 'CHRONOLOGICAL_ORDER_VIOLATION',
                  severity: 'HIGH',
                  position: 1,
                  description: 'Article at position 1 is older than article at position 2',
                  context: {
                    current: {
                      rank: 1,
                      time: '1 hour ago',
                      title: 'Newer Article',
                      author: 'user1',
                      score: 100
                    },
                    next: {
                      rank: 2,
                      time: '30 minutes ago',
                      title: 'Older Article',
                      author: 'user2',
                      score: 85
                    },
                    timeDifference: {
                      minutes: 30,
                      humanReadable: '30 minutes'
                    }
                  },
                  impact: 'Articles are out of chronological order',
                  recommendation: 'Verify Hacker News sorting algorithm'
                }
              ],
              summary: {
                status: 'FAILED',
                totalIssues: 1,
                severityBreakdown: { high: 1, medium: 0, low: 0 },
                mainIssues: ['Chronological order violation detected'],
                recommendations: ['Investigate sorting algorithm']
              }
            },
            scrapedAt: new Date().toISOString(),
            totalPages: 1
          }
        })
      });
    });

    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: /Start Validation/i }).click();
    
    // Wait for results
    await expect(page.getByText('FAILED')).toBeVisible();
    
    // Check issue severity breakdown
    await expect(page.getByText('High Severity')).toBeVisible();
    await expect(page.getByText('1')).toBeVisible(); // High severity count
    
    // Check detailed issues section
    await expect(page.getByText('Detailed Issues')).toBeVisible();
    await expect(page.getByText('HIGH')).toBeVisible(); // Severity badge
    await expect(page.getByText('Article at position 1 is older')).toBeVisible();
    
    // Check recommendations
    await expect(page.getByText('Recommendations')).toBeVisible();
    await expect(page.getByText('Investigate sorting algorithm')).toBeVisible();
  });

  test('should handle CSV export functionality', async ({ page }) => {
    // Mock successful API response
    await page.route('**/api/scrape', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            articles: [
              {
                rank: 1,
                title: 'Test Article',
                url: 'https://example.com',
                author: 'testuser',
                rawTime: '1 hour ago',
                score: 100
              }
            ],
            validation: { isValid: true },
            scrapedAt: new Date().toISOString(),
            totalPages: 1
          }
        })
      });
    });

    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: /Start Validation/i }).click();
    
    // Wait for results
    await expect(page.getByRole('button', { name: /CSV/i })).toBeVisible();
    
    // Set up download handler
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /CSV/i }).click();
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/hacker-news-articles-\d{4}-\d{2}-\d{2}\.csv/);
  });

  test('should handle JSON export functionality', async ({ page }) => {
    // Mock successful API response
    await page.route('**/api/scrape', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            articles: [
              {
                rank: 1,
                title: 'Test Article',
                url: 'https://example.com',
                author: 'testuser',
                rawTime: '1 hour ago',
                score: 100
              }
            ],
            validation: { isValid: true },
            scrapedAt: new Date().toISOString(),
            totalPages: 1
          }
        })
      });
    });

    await page.goto('http://localhost:3000');
    await page.getByRole('button', { name: /Start Validation/i }).click();
    
    // Wait for results
    await expect(page.getByRole('button', { name: /JSON/i })).toBeVisible();
    
    // Set up download handler
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: /JSON/i }).click();
    const download = await downloadPromise;
    
    // Verify download
    expect(download.suggestedFilename()).toMatch(/hacker-news-data-\d{4}-\d{2}-\d{2}\.json/);
  });

  test('should load existing results on page load', async ({ page }) => {
    // Mock existing results API
    await page.route('**/api/results', async route => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            articles: [
              {
                rank: 1,
                title: 'Existing Article',
                url: 'https://example.com',
                author: 'existinguser',
                rawTime: '2 hours ago',
                score: 75
              }
            ],
            validation: {
              totalArticles: 1,
              isValid: true,
              summary: { status: 'PASSED' }
            },
            scrapedAt: new Date().toISOString(),
            totalPages: 1
          }
        })
      });
    });

    await page.goto('http://localhost:3000');
    
    // Should automatically load existing results
    await expect(page.getByText('Existing Article')).toBeVisible();
    await expect(page.getByText('PASSED')).toBeVisible();
  });

  test('should handle responsive design', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Test mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });
    
    // Header should still be visible
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('button', { name: /Start Validation/i })).toBeVisible();
    
    // Test tablet viewport
    await page.setViewportSize({ width: 768, height: 1024 });
    
    // Should maintain layout
    await expect(page.locator('h1')).toBeVisible();
    
    // Test desktop viewport
    await page.setViewportSize({ width: 1920, height: 1080 });
    
    // Should display properly
    await expect(page.locator('h1')).toBeVisible();
  });

  test('should handle dark mode toggle (if implemented)', async ({ page }) => {
    await page.goto('http://localhost:3000');
    
    // Check if dark mode classes are applied correctly
    const body = page.locator('body');
    
    // The component uses dark: classes, so we can test for proper class application
    // This would need actual dark mode toggle implementation to test fully
    await expect(page.locator('.dark\\:bg-gray-900, .bg-gray-50')).toBeVisible();
  });
});
