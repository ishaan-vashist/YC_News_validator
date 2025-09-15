const { test, expect } = require('@playwright/test');

// Import functions to test - we'll need to extract them to a separate module
// For now, we'll copy the functions here for testing
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

function validateArticleSorting(articles) {
  const issues = [];
  const detailedIssues = [];
  let validCount = 0;
  let parsingErrors = 0;
  
  for (let i = 0; i < articles.length - 1; i++) {
    const current = articles[i];
    const next = articles[i + 1];
    
    const currentTime = parseTimestamp(current.rawTime);
    const nextTime = parseTimestamp(next.rawTime);
    
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
        }
      });
      continue;
    }
    
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
            author: current.author || 'Unknown',
            score: current.score || 0
          },
          next: {
            rank: next.rank,
            time: next.rawTime,
            title: next.title.substring(0, 60),
            parsedTime: new Date(nextTime).toISOString(),
            author: next.author || 'Unknown',
            score: next.score || 0
          },
          timeDifference: {
            milliseconds: timeDiff,
            minutes: timeDiffMinutes
          }
        }
      });
    } else {
      validCount++;
    }
  }
  
  const totalComparisons = articles.length - 1;
  const successRate = ((validCount / totalComparisons) * 100).toFixed(1);
  
  return {
    totalArticles: articles.length,
    validTransitions: validCount,
    totalComparisons,
    successRate: parseFloat(successRate),
    parsingErrors,
    issues,
    detailedIssues,
    isValid: issues.length === 0 && parsingErrors === 0
  };
}

test.describe('parseTimestamp function', () => {
  test('should parse minutes correctly', () => {
    const result = parseTimestamp('5 minutes ago');
    const expected = Date.now() - (5 * 60 * 1000);
    expect(result).toBeCloseTo(expected, -3); // Within 1 second
  });

  test('should parse hours correctly', () => {
    const result = parseTimestamp('2 hours ago');
    const expected = Date.now() - (2 * 60 * 60 * 1000);
    expect(result).toBeCloseTo(expected, -3);
  });

  test('should parse days correctly', () => {
    const result = parseTimestamp('1 day ago');
    const expected = Date.now() - (1 * 24 * 60 * 60 * 1000);
    expect(result).toBeCloseTo(expected, -3);
  });

  test('should handle singular forms', () => {
    const minuteResult = parseTimestamp('1 minute ago');
    const hourResult = parseTimestamp('1 hour ago');
    
    expect(minuteResult).toBeCloseTo(Date.now() - (1 * 60 * 1000), -3);
    expect(hourResult).toBeCloseTo(Date.now() - (1 * 60 * 60 * 1000), -3);
  });

  test('should handle extra whitespace', () => {
    const result = parseTimestamp('  3   hours   ago  ');
    const expected = Date.now() - (3 * 60 * 60 * 1000);
    expect(result).toBeCloseTo(expected, -3);
  });

  test('should return null for empty or null input', () => {
    expect(parseTimestamp('')).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
    expect(parseTimestamp(undefined)).toBeNull();
  });

  test('should return current time for unparseable strings', () => {
    const result = parseTimestamp('invalid time string');
    expect(result).toBeCloseTo(Date.now(), -3);
  });

  test('should handle case insensitive input', () => {
    const result = parseTimestamp('2 HOURS AGO');
    const expected = Date.now() - (2 * 60 * 60 * 1000);
    expect(result).toBeCloseTo(expected, -3);
  });
});

test.describe('validateArticleSorting function', () => {
  test('should validate correctly sorted articles', () => {
    const articles = [
      { rank: 1, title: 'Article 1', rawTime: '1 hour ago', author: 'user1', score: 10 },
      { rank: 2, title: 'Article 2', rawTime: '2 hours ago', author: 'user2', score: 5 },
      { rank: 3, title: 'Article 3', rawTime: '3 hours ago', author: 'user3', score: 8 }
    ];

    const result = validateArticleSorting(articles);

    expect(result.isValid).toBe(true);
    expect(result.totalArticles).toBe(3);
    expect(result.validTransitions).toBe(2);
    expect(result.issues).toHaveLength(0);
    expect(result.successRate).toBe(100);
  });

  test('should detect chronological order violations', () => {
    const articles = [
      { rank: 1, title: 'Article 1', rawTime: '3 hours ago', author: 'user1', score: 10 },
      { rank: 2, title: 'Article 2', rawTime: '1 hour ago', author: 'user2', score: 5 },
      { rank: 3, title: 'Article 3', rawTime: '2 hours ago', author: 'user3', score: 8 }
    ];

    const result = validateArticleSorting(articles);

    expect(result.isValid).toBe(false);
    expect(result.issues).toHaveLength(1);
    expect(result.detailedIssues).toHaveLength(1);
    expect(result.detailedIssues[0].type).toBe('CHRONOLOGICAL_ORDER_VIOLATION');
    expect(result.validTransitions).toBe(1);
  });

  test('should handle parsing errors', () => {
    const articles = [
      { rank: 1, title: 'Article 1', rawTime: 'invalid time', author: 'user1', score: 10 },
      { rank: 2, title: 'Article 2', rawTime: '1 hour ago', author: 'user2', score: 5 }
    ];

    const result = validateArticleSorting(articles);

    expect(result.parsingErrors).toBe(0); // parseTimestamp returns current time for invalid strings
    expect(result.detailedIssues.some(issue => issue.type === 'PARSING_ERROR')).toBe(false);
  });

  test('should calculate success rate correctly', () => {
    const articles = [
      { rank: 1, title: 'Article 1', rawTime: '1 hour ago', author: 'user1', score: 10 },
      { rank: 2, title: 'Article 2', rawTime: '3 hours ago', author: 'user2', score: 5 }, // Wrong order
      { rank: 3, title: 'Article 3', rawTime: '4 hours ago', author: 'user3', score: 8 },
      { rank: 4, title: 'Article 4', rawTime: '5 hours ago', author: 'user4', score: 12 }
    ];

    const result = validateArticleSorting(articles);

    expect(result.totalComparisons).toBe(3);
    expect(result.validTransitions).toBe(2);
    expect(result.successRate).toBe(66.7);
  });

  test('should assign correct severity levels', () => {
    const now = Date.now();
    const articles = [
      { 
        rank: 1, 
        title: 'Article 1', 
        rawTime: '1 hour ago', 
        author: 'user1', 
        score: 10 
      },
      { 
        rank: 2, 
        title: 'Article 2', 
        rawTime: '5 minutes ago', // 55 minute gap - should be HIGH severity
        author: 'user2', 
        score: 5 
      }
    ];

    const result = validateArticleSorting(articles);

    expect(result.detailedIssues).toHaveLength(1);
    expect(result.detailedIssues[0].severity).toBe('HIGH');
  });

  test('should handle empty articles array', () => {
    const result = validateArticleSorting([]);

    expect(result.totalArticles).toBe(0);
    expect(result.validTransitions).toBe(0);
    expect(result.issues).toHaveLength(0);
    expect(result.isValid).toBe(true);
  });

  test('should handle single article', () => {
    const articles = [
      { rank: 1, title: 'Article 1', rawTime: '1 hour ago', author: 'user1', score: 10 }
    ];

    const result = validateArticleSorting(articles);

    expect(result.totalArticles).toBe(1);
    expect(result.validTransitions).toBe(0);
    expect(result.totalComparisons).toBe(0);
    expect(result.isValid).toBe(true);
  });
});
