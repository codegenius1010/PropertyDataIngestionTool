import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './AnalysisResultsPage.css';

export default function AnalysisResultsPage() {
  const [properties, setProperties] = useState([]);
  const [analysisMap, setAnalysisMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState({
    status: 'all', // all, green, yellow, red
    searchTerm: ''
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchDataAndAnalyze();
  }, []);

  const fetchDataAndAnalyze = async () => {
    try {
      setLoading(true);
      const response = await axios.get('http://localhost:5000/api/properties');
      setProperties(response.data);
      
      // Fetch analysis data for all properties
      const analysisDataMap = {};
      for (const property of response.data) {
        try {
          const analysisResponse = await axios.get(`http://localhost:5000/api/analysis/${property.id}`);
          if (analysisResponse.data.analysis) {
            analysisDataMap[property.id] = analysisResponse.data.analysis;
          }
        } catch (err) {
          // No analysis for this property yet
        }
      }
      setAnalysisMap(analysisDataMap);
      setError(null);
    } catch (err) {
      console.error('Error fetching properties:', err);
      setError('Failed to fetch properties. Make sure the backend is running.');
      setProperties([]);
    } finally {
      setLoading(false);
    }
  };

  const analyzeAllProperties = async () => {
    try {
      setAnalyzing(true);
      setProgressText('Starting analysis of all properties...');
      const updatedAnalysisMap = { ...analysisMap };
      let completed = 0;
      let failed = 0;

      for (const property of properties) {
        // Always analyze/re-analyze all properties (allows updating with new AI estimates)
        try {
          const progress = `Analyzing property ${completed + failed + 1} of ${properties.length}...`;
          setProgressText(progress);
          console.log(progress);

          const response = await axios.post(
            `http://localhost:5000/api/analysis/${property.id}`
          );
          
          if (response.data.analysis) {
            updatedAnalysisMap[property.id] = response.data.analysis;
            completed++;
            console.log(`✓ Analyzed: ${property.address || `Property ${property.id}`}`);
          }
          
          // Small delay to allow processing and show progress
          await new Promise(resolve => setTimeout(resolve, 200));
        } catch (err) {
          failed++;
          console.error(`✗ Failed to analyze property ${property.id}:`, err.message);
        }
      }

      setAnalysisMap(updatedAnalysisMap);
      setProgressText(`Analysis complete! ${completed} properties analyzed, ${failed} failed.`);
      console.log(`Analysis Summary: ${completed} completed, ${failed} failed out of ${properties.length} total`);
      
      // Show completion alert
      alert(`✓ Analysis Complete!\n\n${completed} properties successfully analyzed\n${failed} properties failed\n\nResults have been updated.`);
    } catch (err) {
      console.error('Error analyzing properties:', err);
      setError('Failed to analyze properties');
    } finally {
      setAnalyzing(false);
      setProgressText('');
    }
  };

  const getTrafficLightColor = (analysis) => {
    if (!analysis) return 'gray';
    if (analysis.green_light) return 'green';
    if (analysis.yellow_light) return 'yellow';
    if (analysis.red_light) return 'red';
    return 'gray';
  };

  const getTrafficLightLabel = (analysis) => {
    if (!analysis) return 'NOT ANALYZED';
    if (analysis.green_light) return 'GREEN - PURSUE';
    if (analysis.yellow_light) return 'YELLOW - REVIEW';
    if (analysis.red_light) return 'RED - PASS';
    return 'UNKNOWN';
  };

  const filteredProperties = properties.filter(property => {
    const analysis = analysisMap[property.id];
    const color = getTrafficLightColor(analysis);

    // Apply status filter
    if (filters.status !== 'all' && color !== filters.status) {
      return false;
    }

    // Apply search filter
    if (filters.searchTerm) {
      const term = filters.searchTerm.toLowerCase();
      return (
        (property.address && property.address.toLowerCase().includes(term)) ||
        (property.city && property.city.toLowerCase().includes(term)) ||
        (property.state && property.state.toLowerCase().includes(term))
      );
    }

    return true;
  });

  const stats = {
    total: properties.length,
    analyzed: Object.keys(analysisMap).length,
    green: properties.filter(p => analysisMap[p.id]?.green_light).length,
    yellow: properties.filter(p => analysisMap[p.id]?.yellow_light).length,
    red: properties.filter(p => analysisMap[p.id]?.red_light).length
  };

  if (loading) {
    return <div className="analysis-results-page"><p>Loading properties...</p></div>;
  }

  return (
    <div className="analysis-results-page">
      <div className="page-header">
        <h1>📊 Property Analysis Results</h1>
        <p>Visual overview of all analyzed properties - See at a glance which deals to pursue</p>
      </div>

      {error && (
        <div className="error-banner">
          {error}
        </div>
      )}

      <div className="analysis-controls">
        <button
          className="btn-analyze-all"
          onClick={analyzeAllProperties}
          disabled={analyzing}
        >
          {analyzing ? '⏳ Analyzing...' : '🔍 Analyze All Properties'}
        </button>
        {progressText && (
          <div style={{
            marginTop: '15px',
            padding: '12px',
            backgroundColor: analyzing ? '#e3f2fd' : '#f0f7f0',
            borderLeft: analyzing ? '4px solid #2196F3' : '4px solid #4caf50',
            borderRadius: '4px',
            color: analyzing ? '#1565c0' : '#2e7d32',
            fontSize: '0.95em',
            fontWeight: '500'
          }}>
            {progressText}
          </div>
        )}
      </div>

      <div className="stats-section">
        <div className="stat-box">
          <h3>{stats.total}</h3>
          <p>Total Properties</p>
        </div>
        <div className="stat-box">
          <h3>{stats.analyzed}</h3>
          <p>Analyzed</p>
        </div>
        <div className="stat-box green">
          <h3>{stats.green}</h3>
          <p>Green - Pursue</p>
        </div>
        <div className="stat-box yellow">
          <h3>{stats.yellow}</h3>
          <p>Yellow - Review</p>
        </div>
        <div className="stat-box red">
          <h3>{stats.red}</h3>
          <p>Red - Pass</p>
        </div>
      </div>

      <div className="filters-section">
        <div className="filter-group">
          <label>Status Filter:</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
          >
            <option value="all">All Status</option>
            <option value="green">🟢 Green - Pursue</option>
            <option value="yellow">🟡 Yellow - Review</option>
            <option value="red">🔴 Red - Pass</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Search:</label>
          <input
            type="text"
            placeholder="Search by address, city, or state..."
            value={filters.searchTerm}
            onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
          />
        </div>
      </div>

      <div className="properties-grid">
        {filteredProperties.length === 0 ? (
          <div className="empty-state">
            <p>No properties match your filters</p>
          </div>
        ) : (
          filteredProperties.map((property) => {
            const analysis = analysisMap[property.id];
            const color = getTrafficLightColor(analysis);

            return (
              <div
                key={property.id}
                className={`property-card traffic-light-${color}`}
                onClick={() => navigate(`/analysis/${property.id}`)}
              >
                <div className="traffic-light-indicator">
                  <div className={`light ${color}`}></div>
                  <span className="light-label">{getTrafficLightLabel(analysis)}</span>
                </div>

                <div className="property-info">
                  <h3>{property.address}</h3>
                  <p className="property-location">
                    {property.city}, {property.state}
                  </p>

                  {analysis && (
                    <>
                      <div className="analysis-details">
                        <div className="detail-item">
                          <span className="label">Type:</span>
                          <span className="value">{analysis.analysis_type}</span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Listing Price:</span>
                          <span className="value">
                            ${property.listing_price?.toLocaleString() || 'N/A'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="label">Cashflow:</span>
                          <span className={`value ${analysis.cashflow_positive ? 'positive' : 'negative'}`}>
                            ${analysis.cashflow_amount?.toFixed(2) || '0.00'}/mo
                          </span>
                        </div>
                        {analysis.dscr_analysis?.qualified !== undefined && (
                          <div className="detail-item">
                            <span className="label">DSCR:</span>
                            <span className={`value ${analysis.dscr_analysis?.qualified ? 'positive' : 'negative'}`}>
                              {analysis.dscr_analysis?.qualified ? '✓ Qualified' : '✗ Not Qualified'}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="recommendations">
                        <span className="recommendation-text">
                          {analysis.recommendation}
                        </span>
                      </div>
                    </>
                  )}
                </div>

                <div className="card-footer">
                  {analysis ? (
                    <button
                      className="btn-view-details"
                      onClick={(e) => {
                        e.stopPropagation();
                        navigate(`/analysis/${property.id}`);
                      }}
                    >
                      View Full Analysis
                    </button>
                  ) : (
                    <span className="not-analyzed">Not Analyzed</span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
