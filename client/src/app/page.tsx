'use client';

import { useState, useEffect } from 'react';

// Get API URL from environment or default to localhost
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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

interface DetailedIssue {
  type: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  position: number;
  description: string;
  context: {
    current: {
      rank: number;
      time: string;
      title: string;
      parsedTime: string;
      author: string;
      score: number;
    };
    next: {
      rank: number;
      time: string;
      title: string;
      parsedTime: string;
      author: string;
      score: number;
    };
    timeDifference?: {
      milliseconds: number;
      minutes: number;
      humanReadable: string;
    };
  };
  impact: string;
  recommendation: string;
}

interface ValidationResult {
  totalArticles: number;
  validTransitions: number;
  totalComparisons: number;
  successRate: number;
  parsingErrors: number;
  issues: ValidationIssue[];
  detailedIssues: DetailedIssue[];
  isValid: boolean;
  summary: {
    status: 'PASSED' | 'FAILED';
    totalIssues: number;
    severityBreakdown: {
      high: number;
      medium: number;
      low: number;
    };
    mainIssues: string[];
    recommendations: string[];
  };
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
      const response = await fetch(`${API_BASE_URL}/api/scrape`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Server error (${response.status}): ${errorText}`);
      }
      
      const result = await response.json();
      
      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error || 'Unknown error occurred');
      }
    } catch (err) {
      console.error('Scraping error:', err);
      setError(err instanceof Error ? err.message : 'Failed to connect to API');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingResults = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/results`);
      
      if (response.ok) {
        const result = await response.json();
        if (result.success) {
          setData(result.data);
        }
      } else if (response.status !== 404) {
        // Log non-404 errors
        console.warn('Failed to load existing results:', response.status);
      }
    } catch (error) {
      console.warn('Failed to load existing results:', error);
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
            <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
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
                  <span className="text-2xl mr-3">📈</span>
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Success Rate</p>
                    <p className="text-2xl font-bold text-blue-600">
                      {data.validation.successRate?.toFixed(1) || '0.0'}%
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
                      {data.validation.summary?.totalIssues || data.validation.issues.length}
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
                      {data.validation.summary?.status || (data.validation.isValid ? 'PASSED' : 'FAILED')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed Validation Report */}
            {data.validation.summary && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    🔍 Validation Analysis
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Detailed breakdown of chronological sorting validation
                  </p>
                </div>
                
                <div className="p-6">
                  {/* Severity Breakdown */}
                  {data.validation.summary.totalIssues > 0 && (
                    <div className="mb-6">
                      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                        Issue Severity Breakdown
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <div className="flex items-center">
                            <span className="text-red-500 text-xl mr-2">🔴</span>
                            <div>
                              <p className="text-sm text-red-600 dark:text-red-400">High Severity</p>
                              <p className="text-xl font-bold text-red-700 dark:text-red-300">
                                {data.validation.summary.severityBreakdown.high}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                          <div className="flex items-center">
                            <span className="text-yellow-500 text-xl mr-2">🟡</span>
                            <div>
                              <p className="text-sm text-yellow-600 dark:text-yellow-400">Medium Severity</p>
                              <p className="text-xl font-bold text-yellow-700 dark:text-yellow-300">
                                {data.validation.summary.severityBreakdown.medium}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                          <div className="flex items-center">
                            <span className="text-blue-500 text-xl mr-2">🔵</span>
                            <div>
                              <p className="text-sm text-blue-600 dark:text-blue-400">Low Severity</p>
                              <p className="text-xl font-bold text-blue-700 dark:text-blue-300">
                                {data.validation.summary.severityBreakdown.low}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Main Issues */}
                  <div className="mb-6">
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                      Key Findings
                    </h3>
                    <ul className="space-y-2">
                      {data.validation.summary.mainIssues.map((issue, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-gray-400 mr-2 mt-1">•</span>
                          <span className="text-gray-700 dark:text-gray-300">{issue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
                      Recommendations
                    </h3>
                    <ul className="space-y-2">
                      {data.validation.summary.recommendations.map((rec, index) => (
                        <li key={index} className="flex items-start">
                          <span className="text-blue-500 mr-2 mt-1">💡</span>
                          <span className="text-gray-700 dark:text-gray-300">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Detailed Issues */}
            {data.validation.detailedIssues && data.validation.detailedIssues.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow mb-8">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    🚨 Detailed Issues
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Comprehensive analysis of each validation issue found
                  </p>
                </div>
                
                <div className="divide-y divide-gray-200 dark:divide-gray-700">
                  {data.validation.detailedIssues.map((issue, index) => (
                    <div key={index} className="p-6">
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mr-3 ${
                            issue.severity === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' :
                            issue.severity === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                            'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {issue.severity}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Position {issue.position} • {issue.type.replace(/_/g, ' ')}
                          </span>
                        </div>
                      </div>
                      
                      <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                        {issue.description}
                      </h4>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2">Current Article</h5>
                          <div className="space-y-1 text-sm">
                            <p><span className="text-gray-500">Rank:</span> #{issue.context.current.rank}</p>
                            <p><span className="text-gray-500">Time:</span> {issue.context.current.time}</p>
                            <p><span className="text-gray-500">Author:</span> {issue.context.current.author}</p>
                            <p><span className="text-gray-500">Score:</span> {issue.context.current.score} pts</p>
                            <p className="text-gray-700 dark:text-gray-300 font-medium">{issue.context.current.title}</p>
                          </div>
                        </div>
                        
                        <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                          <h5 className="font-medium text-gray-900 dark:text-white mb-2">Next Article</h5>
                          <div className="space-y-1 text-sm">
                            <p><span className="text-gray-500">Rank:</span> #{issue.context.next.rank}</p>
                            <p><span className="text-gray-500">Time:</span> {issue.context.next.time}</p>
                            <p><span className="text-gray-500">Author:</span> {issue.context.next.author}</p>
                            <p><span className="text-gray-500">Score:</span> {issue.context.next.score} pts</p>
                            <p className="text-gray-700 dark:text-gray-300 font-medium">{issue.context.next.title}</p>
                          </div>
                        </div>
                      </div>
                      
                      {issue.context.timeDifference && (
                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg p-3 mb-4">
                          <p className="text-sm text-orange-800 dark:text-orange-200">
                            <span className="font-medium">Time Gap:</span> {issue.context.timeDifference.humanReadable} 
                            ({issue.context.timeDifference.minutes} minutes)
                          </p>
                        </div>
                      )}
                      
                      <div className="space-y-2">
                        <div className="flex items-start">
                          <span className="text-red-500 mr-2 mt-0.5">⚠️</span>
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Impact: </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{issue.impact}</span>
                          </div>
                        </div>
                        <div className="flex items-start">
                          <span className="text-blue-500 mr-2 mt-0.5">💡</span>
                          <div>
                            <span className="text-sm font-medium text-gray-900 dark:text-white">Recommendation: </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">{issue.recommendation}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
