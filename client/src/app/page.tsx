'use client';

import { useState, useEffect } from 'react';

interface Article {
  rank: number;
  title: string;
  url: string;
  author: string;
  timestamp: string;
  rawTime: string;
  score: number;
}

interface ValidationIssue {
  position: number;
  current: {
    rank: number;
    time: string;
    title: string;
  };
  next: {
    rank: number;
    time: string;
    title: string;
  };
}

interface ValidationResult {
  totalArticles: number;
  validTransitions: number;
  issues: ValidationIssue[];
  isValid: boolean;
}

interface ScrapingData {
  articles: Article[];
  validation: ValidationResult;
  scrapedAt: string;
  totalPages: number;
}

export default function Dashboard() {
  const [data, setData] = useState<ScrapingData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startScraping = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:3001/api/scrape', {
        method: 'POST',
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingResults = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/results');
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      }
    } catch {
      // Silently fail - no existing results
    }
  };

  const exportToCSV = () => {
    if (!data) return;
    
    const headers = ['Rank', 'Title', 'Author', 'Time', 'Score', 'URL'];
    const csvContent = [
      headers.join(','),
      ...data.articles.map(article => [
        article.rank,
        `"${article.title.replace(/"/g, '""')}"`, // Escape quotes in title
        article.author,
        `"${article.rawTime}"`,
        article.score,
        `"${article.url}"`
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `hacker-news-articles-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const exportToJSON = () => {
    if (!data) return;
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      scrapedAt: data.scrapedAt,
      totalPages: data.totalPages,
      validation: data.validation,
      articles: data.articles
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `hacker-news-data-${new Date().toISOString().split('T')[0]}.json`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  useEffect(() => {
    loadExistingResults();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                🐺 QA Wolf - YC Hacker News Validator
              </h1>
              <p className="text-gray-600 dark:text-gray-300 mt-2">
                Validating chronological sorting of the first 100 articles from Hacker News
              </p>
            </div>
            <div className="flex items-center gap-3">
              {data && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={exportToCSV}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <span>📊</span>
                    CSV
                  </button>
                  <button
                    onClick={exportToJSON}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2"
                  >
                    <span>📄</span>
                    JSON
                  </button>
                </div>
              )}
              <button
                onClick={startScraping}
                disabled={loading}
                className="bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white px-6 py-3 rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                    Scraping...
                  </>
                ) : (
                  <>
                    <span>🚀</span>
                    Start Validation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
            <div className="flex items-center">
              <span className="text-red-500 text-xl mr-3">❌</span>
              <div>
                <h3 className="text-red-800 dark:text-red-200 font-medium">Error</h3>
                <p className="text-red-700 dark:text-red-300 text-sm mt-1">{error}</p>
              </div>
            </div>
          </div>
        )}

        {data && (
          <>
            {/* Results Summary */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">📊</span>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Total Articles</p>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {data.validation.totalArticles}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">✅</span>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Valid Transitions</p>
                    <p className="text-2xl font-bold text-green-600">
                      {data.validation.validTransitions}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">⚠️</span>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Issues Found</p>
                    <p className="text-2xl font-bold text-red-600">
                      {data.validation.issues.length}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
                <div className="flex items-center">
                  <span className="text-2xl mr-3">
                    {data.validation.isValid ? '🎉' : '❌'}
                  </span>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                    <p className={`text-lg font-bold ${
                      data.validation.isValid ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {data.validation.isValid ? 'PASSED' : 'FAILED'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Articles Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  First 100 Hacker News Articles
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Scraped on {new Date(data.scrapedAt).toLocaleString()} from {data.totalPages} pages
                </p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Title
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Author
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Score
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {data.articles.map((article, index) => (
                      <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          #{article.rank}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          <a
                            href={article.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="hover:text-orange-600 dark:hover:text-orange-400 line-clamp-2"
                            title={article.title}
                          >
                            {article.title}
                          </a>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {article.author}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {article.rawTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                          {article.score} pts
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!data && !loading && (
          <div className="text-center py-12">
            <span className="text-6xl mb-4 block">🚀</span>
            <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
              Ready to Validate Hacker News
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">
              Click &quot;Start Validation&quot; to scrape and analyze the first 100 articles
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
