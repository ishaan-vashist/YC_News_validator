const { test, expect } = require('@playwright/test');
const express = require('express');
const cors = require('cors');

// Mock the chromium module to avoid actual browser launches during testing
const mockChromium = {
  launch: async () => ({
    newContext: async () => ({
      newPage: async () => ({
        goto: async () => {},
        waitForLoadState: async () => {},
        waitForSelector: async () => {},
        $: async () => ({ click: async () => {} }),
        evaluate: async () => [
          {
            rank: 1,
            title: 'Test Article 1',
            url: 'https://example.com/1',
            author: 'testuser1',
            timestamp: '2023-01-01T10:00:00Z',
            rawTime: '1 hour ago',
            score: 100
          },
          {
            rank: 2,
            title: 'Test Article 2',
            url: 'https://example.com/2',
            author: 'testuser2',
            timestamp: '2023-01-01T09:00:00Z',
            rawTime: '2 hours ago',
            score: 85
          }
        ]
      })
    }),
    close: async () => {}
  })
};

// Create a test server instance
function createTestServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  let latestResults = null;
  let scrapingInProgress = false;

  // Mock scraping function
  async function performScraping() {
    // Simulate scraping delay
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const mockArticles = [
      {
        rank: 1,
        title: 'Test Article 1',
        url: 'https://example.com/1',
        author: 'testuser1',
        timestamp: '2023-01-01T10:00:00Z',
        rawTime: '1 hour ago',
        score: 100
      },
      {
        rank: 2,
        title: 'Test Article 2',
        url: 'https://example.com/2',
        author: 'testuser2',
        timestamp: '2023-01-01T09:00:00Z',
        rawTime: '2 hours ago',
        score: 85
      },
      {
        rank: 3,
        title: 'Test Article 3',
        url: 'https://example.com/3',
        author: 'testuser3',
        timestamp: '2023-01-01T08:00:00Z',
        rawTime: '3 hours ago',
        score: 70
      }
    ];

    const validation = {
      totalArticles: 3,
      validTransitions: 2,
      totalComparisons: 2,
      successRate: 100.0,
      parsingErrors: 0,
      issues: [],
      detailedIssues: [],
      isValid: true,
      summary: {
        status: 'PASSED',
        totalIssues: 0,
        severityBreakdown: { high: 0, medium: 0, low: 0 },
        mainIssues: ['All articles are in correct chronological order'],
        recommendations: ['All articles are properly sorted in chronological order']
      }
    };

    return {
      articles: mockArticles,
      validation,
      scrapedAt: new Date().toISOString(),
      totalPages: 1
    };
  }

  // API endpoints
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

  app.get('/api/results', (req, res) => {
    if (!latestResults) {
      return res.status(404).json({ error: 'No results available. Run scraping first.' });
    }
    
    res.json({
      success: true,
      data: latestResults
    });
  });

  app.get('/api/status', (req, res) => {
    res.json({
      scrapingInProgress,
      hasResults: !!latestResults
    });
  });

  return { app, getLatestResults: () => latestResults, setScrapingInProgress: (value) => { scrapingInProgress = value; } };
}

test.describe('API Integration Tests', () => {
  let server;
  let baseURL;

  test.beforeAll(async () => {
    const { app } = createTestServer();
    server = app.listen(0); // Use random available port
    const port = server.address().port;
    baseURL = `http://localhost:${port}`;
  });

  test.afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  test.describe('POST /api/scrape', () => {
    test('should successfully start scraping and return results', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/scrape`);
      const data = await response.json();

      expect(response.status()).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.articles).toHaveLength(3);
      expect(data.data.validation).toBeDefined();
      expect(data.data.scrapedAt).toBeDefined();
      expect(data.data.totalPages).toBe(1);
    });

    test('should return 409 when scraping is already in progress', async ({ request }) => {
      // Start first scraping request
      const firstRequest = request.post(`${baseURL}/api/scrape`);
      
      // Immediately start second request
      const secondResponse = await request.post(`${baseURL}/api/scrape`);
      const secondData = await secondResponse.json();

      expect(secondResponse.status()).toBe(409);
      expect(secondData.error).toBe('Scraping already in progress');

      // Wait for first request to complete
      await firstRequest;
    });

    test('should validate article structure in response', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/scrape`);
      const data = await response.json();

      expect(response.status()).toBe(200);
      
      const article = data.data.articles[0];
      expect(article).toHaveProperty('rank');
      expect(article).toHaveProperty('title');
      expect(article).toHaveProperty('url');
      expect(article).toHaveProperty('author');
      expect(article).toHaveProperty('timestamp');
      expect(article).toHaveProperty('rawTime');
      expect(article).toHaveProperty('score');
    });

    test('should validate validation result structure', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/scrape`);
      const data = await response.json();

      const validation = data.data.validation;
      expect(validation).toHaveProperty('totalArticles');
      expect(validation).toHaveProperty('validTransitions');
      expect(validation).toHaveProperty('successRate');
      expect(validation).toHaveProperty('isValid');
      expect(validation).toHaveProperty('summary');
      expect(validation.summary).toHaveProperty('status');
      expect(validation.summary).toHaveProperty('recommendations');
    });
  });

  test.describe('GET /api/results', () => {
    test('should return 404 when no results available', async ({ request }) => {
      // Create a fresh server instance with no results
      const { app } = createTestServer();
      const freshServer = app.listen(0);
      const freshPort = freshServer.address().port;
      const freshBaseURL = `http://localhost:${freshPort}`;

      const response = await request.get(`${freshBaseURL}/api/results`);
      const data = await response.json();

      expect(response.status()).toBe(404);
      expect(data.error).toBe('No results available. Run scraping first.');

      freshServer.close();
    });

    test('should return latest results after scraping', async ({ request }) => {
      // First, perform scraping
      await request.post(`${baseURL}/api/scrape`);

      // Then get results
      const response = await request.get(`${baseURL}/api/results`);
      const data = await response.json();

      expect(response.status()).toBe(200);
      expect(data.success).toBe(true);
      expect(data.data).toBeDefined();
      expect(data.data.articles).toHaveLength(3);
    });

    test('should return same data as scrape endpoint', async ({ request }) => {
      // Perform scraping
      const scrapeResponse = await request.post(`${baseURL}/api/scrape`);
      const scrapeData = await scrapeResponse.json();

      // Get results
      const resultsResponse = await request.get(`${baseURL}/api/results`);
      const resultsData = await resultsResponse.json();

      expect(resultsData.data.articles).toEqual(scrapeData.data.articles);
      expect(resultsData.data.validation).toEqual(scrapeData.data.validation);
    });
  });

  test.describe('GET /api/status', () => {
    test('should return correct status when no scraping has occurred', async ({ request }) => {
      // Create fresh server
      const { app } = createTestServer();
      const freshServer = app.listen(0);
      const freshPort = freshServer.address().port;
      const freshBaseURL = `http://localhost:${freshPort}`;

      const response = await request.get(`${freshBaseURL}/api/status`);
      const data = await response.json();

      expect(response.status()).toBe(200);
      expect(data.scrapingInProgress).toBe(false);
      expect(data.hasResults).toBe(false);

      freshServer.close();
    });

    test('should return correct status after scraping', async ({ request }) => {
      // Perform scraping
      await request.post(`${baseURL}/api/scrape`);

      const response = await request.get(`${baseURL}/api/status`);
      const data = await response.json();

      expect(response.status()).toBe(200);
      expect(data.scrapingInProgress).toBe(false);
      expect(data.hasResults).toBe(true);
    });

    test('should always return JSON with required fields', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/status`);
      const data = await response.json();

      expect(response.status()).toBe(200);
      expect(data).toHaveProperty('scrapingInProgress');
      expect(data).toHaveProperty('hasResults');
      expect(typeof data.scrapingInProgress).toBe('boolean');
      expect(typeof data.hasResults).toBe('boolean');
    });
  });

  test.describe('CORS and Headers', () => {
    test('should include CORS headers', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/status`);
      
      expect(response.headers()['access-control-allow-origin']).toBeDefined();
    });

    test('should handle OPTIONS requests', async ({ request }) => {
      const response = await request.fetch(`${baseURL}/api/status`, {
        method: 'OPTIONS'
      });
      
      expect(response.status()).toBeLessThan(400);
    });
  });

  test.describe('Error Handling', () => {
    test('should handle invalid JSON in POST requests', async ({ request }) => {
      const response = await request.post(`${baseURL}/api/scrape`, {
        data: 'invalid json',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      // Should still work since our endpoint doesn't require JSON body
      expect(response.status()).toBeLessThan(500);
    });

    test('should return 404 for non-existent endpoints', async ({ request }) => {
      const response = await request.get(`${baseURL}/api/nonexistent`);
      
      expect(response.status()).toBe(404);
    });
  });
});
