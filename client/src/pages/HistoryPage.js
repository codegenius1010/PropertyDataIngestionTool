import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './HistoryPage.css';

function HistoryPage() {
  const [loads, setLoads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedLoadId, setExpandedLoadId] = useState(null);
  const [selectedLoadDetails, setSelectedLoadDetails] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    fetchLoads();
    fetchStats();
  }, []);

  const fetchLoads = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/loads?limit=50&offset=0');
      setLoads(response.data.data);
      setError(null);
    } catch (err) {
      setError('Failed to fetch load history');
      console.error('Error fetching loads:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/loads/stats/overview');
      setStats(response.data);
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const handleExpandDetails = async (loadId) => {
    if (expandedLoadId === loadId) {
      setExpandedLoadId(null);
      setSelectedLoadDetails(null);
      return;
    }

    try {
      const [loadResponse, propertiesResponse, automationsResponse] = await Promise.all([
        axios.get(`/api/loads/${loadId}`),
        axios.get(`/api/loads/${loadId}/properties?limit=10&offset=0`),
        axios.get(`/api/loads/${loadId}/automations?limit=10&offset=0`)
      ]);

      setSelectedLoadDetails({
        load: loadResponse.data,
        properties: propertiesResponse.data.data,
        automations: automationsResponse.data.data,
        propertyCount: propertiesResponse.data.total,
        automationCount: automationsResponse.data.total
      });
      setExpandedLoadId(loadId);
    } catch (err) {
      setError('Failed to fetch load details');
      console.error('Error:', err);
    }
  };

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'processing':
        return 'badge-info';
      case 'failed':
        return 'badge-danger';
      case 'pending':
        return 'badge-warning';
      default:
        return 'badge-default';
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <div className="history-page">
      <div className="history-container">
        <h1>📋 Load History</h1>
        <p className="subtitle">View all CSV imports and their processing status</p>

        {stats && (
          <div className="stats-grid">
            <div className="stat-card">
              <h3>{stats.total_loads || 0}</h3>
              <p>Total Loads</p>
            </div>
            <div className="stat-card">
              <h3>{(stats.total_properties || 0).toLocaleString()}</h3>
              <p>Total Properties</p>
            </div>
            <div className="stat-card">
              <h3>{(stats.successful_properties || 0).toLocaleString()}</h3>
              <p>Successful Records</p>
            </div>
            <div className="stat-card">
              <h3>{(stats.failed_properties || 0).toLocaleString()}</h3>
              <p>Failed Records</p>
            </div>
          </div>
        )}

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading">Loading...</div>
        ) : loads.length === 0 ? (
          <div className="no-data">No loads found. Start by uploading a CSV file.</div>
        ) : (
          <div className="loads-list">
            {loads.map((load) => (
              <div key={load.id} className="load-item">
                <div 
                  className="load-header"
                  onClick={() => handleExpandDetails(load.id)}
                >
                  <div className="load-info">
                    <h3>{load.filename}</h3>
                    <p className="load-meta">
                      <span className={`badge ${getStatusBadgeClass(load.status)}`}>
                        {load.status.toUpperCase()}
                      </span>
                      <span className="meta-item">
                        📅 {formatDate(load.created_at)}
                      </span>
                      <span className="meta-item">
                        📊 {load.total_records || 0} records
                      </span>
                    </p>
                  </div>
                  <div className="load-stats">
                    <div className="stat-box success">
                      <span className="label">Success</span>
                      <span className="value">{load.successful_records || 0}</span>
                    </div>
                    <div className="stat-box error">
                      <span className="label">Failed</span>
                      <span className="value">{load.failed_records || 0}</span>
                    </div>
                  </div>
                  <div className="expand-icon">
                    {expandedLoadId === load.id ? '▼' : '▶'}
                  </div>
                </div>

                {expandedLoadId === load.id && selectedLoadDetails && (
                  <div className="load-details">
                    <div className="details-section">
                      <h4>📍 Sample Properties ({selectedLoadDetails.propertyCount} total)</h4>
                      {selectedLoadDetails.properties.length > 0 ? (
                        <table className="details-table">
                          <thead>
                            <tr>
                              <th>Address</th>
                              <th>City</th>
                              <th>Agent</th>
                              <th>Price</th>
                              <th>Beds/Baths</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedLoadDetails.properties.map((prop) => (
                              <tr key={prop.id}>
                                <td>{prop.address}</td>
                                <td>{prop.city}, {prop.state}</td>
                                <td>{prop.agent_name}</td>
                                <td>${prop.property_price?.toLocaleString() || 'N/A'}</td>
                                <td>{prop.bedrooms}/{prop.bathrooms}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="no-data">No properties found</p>
                      )}
                    </div>

                    <div className="details-section">
                      <h4>🤖 Automations ({selectedLoadDetails.automationCount} total)</h4>
                      {selectedLoadDetails.automations.length > 0 ? (
                        <table className="details-table">
                          <thead>
                            <tr>
                              <th>Agent Email</th>
                              <th>Type</th>
                              <th>Status</th>
                              <th>Sent At</th>
                            </tr>
                          </thead>
                          <tbody>
                            {selectedLoadDetails.automations.map((auto) => (
                              <tr key={auto.id}>
                                <td>{auto.agent_email}</td>
                                <td>{auto.automation_type}</td>
                                <td>
                                  <span className={`badge ${getStatusBadgeClass(auto.status)}`}>
                                    {auto.status}
                                  </span>
                                </td>
                                <td>{auto.sent_at ? formatDate(auto.sent_at) : 'Pending'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : (
                        <p className="no-data">No automations logged</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryPage;
