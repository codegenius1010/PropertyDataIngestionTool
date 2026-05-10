import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useParams, useNavigate } from 'react-router-dom';
import './DetailedAnalysisPage.css';

export default function DetailedAnalysisPage() {
  const { propertyId } = useParams();
  const navigate = useNavigate();
  const [property, setProperty] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchPropertyAndAnalysis();
  }, [propertyId]);

  const fetchPropertyAndAnalysis = async () => {
    try {
      setLoading(true);

      // Fetch property
      const propertyRes = await axios.get(
        `http://localhost:5000/api/properties/${propertyId}`
      );
      setProperty(propertyRes.data);

      // Fetch analysis
      const analysisRes = await axios.get(
        `http://localhost:5000/api/analysis/${propertyId}`
      );
      setAnalysis(analysisRes.data.analysis);

      setError(null);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load property analysis');
    } finally {
      setLoading(false);
    }
  };

  const getTrafficLightInfo = (analysis) => {
    if (analysis?.green_light) {
      return { color: 'green', label: 'GREEN - PURSUE', emoji: '🟢' };
    }
    if (analysis?.yellow_light) {
      return { color: 'yellow', label: 'YELLOW - REVIEW', emoji: '🟡' };
    }
    if (analysis?.red_light) {
      return { color: 'red', label: 'RED - PASS', emoji: '🔴' };
    }
    return { color: 'gray', label: 'NOT ANALYZED', emoji: '⚪' };
  };

  if (loading) {
    return (
      <div className="detailed-analysis-page">
        <div className="loading">Loading analysis...</div>
      </div>
    );
  }

  if (error || !property || !analysis) {
    return (
      <div className="detailed-analysis-page">
        <div className="error-state">
          <p>{error || 'Property or analysis not found'}</p>
          <button onClick={() => navigate('/analysis')} className="btn-back">
            ← Back to Results
          </button>
        </div>
      </div>
    );
  }

  const trafficInfo = getTrafficLightInfo(analysis);

  return (
    <div className="detailed-analysis-page">
      <button onClick={() => navigate('/analysis')} className="btn-back-top">
        ← Back to Results
      </button>

      {/* Header */}
      <div className="analysis-header">
        <div className="header-title">
          <h1>{property.address}</h1>
          <p className="location">
            {property.city}, {property.state} {property.zip_code}
          </p>
        </div>
        <div className={`traffic-light-display ${trafficInfo.color}`}>
          <div className="light-circle"></div>
          <span className="light-text">{trafficInfo.label}</span>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="quick-stats">
        <div className="stat">
          <span className="label">Listing Price</span>
          <span className="value">${property.listing_price?.toLocaleString() || 'N/A'}</span>
        </div>
        <div className="stat">
          <span className="label">Analysis Type</span>
          <span className="value">{analysis.analysis_type}</span>
        </div>
        <div className="stat">
          <span className="label">Monthly Cashflow</span>
          <span className={`value ${analysis.cashflow_positive ? 'positive' : 'negative'}`}>
            ${Number(analysis.cashflow_amount || 0).toFixed(2)}/mo
          </span>
        </div>
        <div className="stat">
          <span className="label">Recommendation</span>
          <span className="value">{analysis.recommendation}</span>
        </div>
      </div>

      {/* Input Assumptions & Property Data */}
      {analysis.input_assumptions && (
        <div className="input-assumptions-section">
          <h2>📋 Input Data & Estimated Defaults Used in Analysis</h2>
          
          {/* Property Input Data */}
          {analysis.input_assumptions.property_data && (
            <div className="assumptions-detail">
              <h3>🏠 Property Input Data</h3>
              <div className="data-grid">
                <div className="data-item">
                  <span className="label">Bedrooms:</span>
                  <span className="value">{analysis.input_assumptions.property_data.bedrooms || 'N/A'}</span>
                </div>
                <div className="data-item">
                  <span className="label">Bathrooms:</span>
                  <span className="value">{analysis.input_assumptions.property_data.bathrooms || 'N/A'}</span>
                </div>
                <div className="data-item">
                  <span className="label">Units:</span>
                  <span className="value">{analysis.input_assumptions.property_data.units || 1}</span>
                </div>
                <div className="data-item">
                  <span className="label">Square Feet:</span>
                  <span className="value">{analysis.input_assumptions.property_data.sqft?.toLocaleString() || 'N/A'}</span>
                </div>
                <div className="data-item">
                  <span className="label">Year Built:</span>
                  <span className="value">{analysis.input_assumptions.property_data.year_built || 'N/A'}</span>
                </div>
                <div className="data-item">
                  <span className="label">Property Type:</span>
                  <span className="value">{analysis.input_assumptions.property_data.property_type || 'N/A'}</span>
                </div>
                <div className="data-item">
                  <span className="label">Owner Occupied:</span>
                  <span className="value">{analysis.input_assumptions.property_data.owner_occupied || 'No'}</span>
                </div>
              </div>
            </div>
          )}

          {/* Estimated Defaults */}
          {analysis.input_assumptions.estimated_defaults && (
            <div className="assumptions-detail">
              <h3>💡 Estimated Defaults & Calculations</h3>
              
              {/* Rental Income */}
              <div className="default-item">
                <div className="default-header">
                  <span className="label">Estimated Monthly Rental Income:</span>
                  <span className="value">${(Number(analysis.input_assumptions.estimated_defaults.rental_income?.value || 0) / 12).toFixed(2)}</span>
                </div>
                <div className="default-method">
                  <strong>Method:</strong> {analysis.input_assumptions.estimated_defaults.rental_income?.method === 'ai_estimated' 
                    ? '🤖 AI-Powered Estimation' 
                    : '📊 Market Formula Calculation'}
                </div>
                {analysis.input_assumptions.estimated_defaults.rental_income?.details?.adjustments && (
                  <div className="calculation-details">
                    <p><strong>Calculation Breakdown:</strong></p>
                    <ul>
                      {analysis.input_assumptions.estimated_defaults.rental_income.details.adjustments.map((adj, idx) => (
                        <li key={idx}>{adj}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* ARV */}
              <div className="default-item">
                <div className="default-header">
                  <span className="label">Estimated After-Repair Value (ARV):</span>
                  <span className="value">${analysis.input_assumptions.estimated_defaults.estimated_arv?.value?.toLocaleString() || '0'}</span>
                </div>
                <div className="default-method">
                  <strong>Method:</strong> Market-based valuation
                </div>
              </div>

              {/* Repair Cost */}
              <div className="default-item">
                <div className="default-header">
                  <span className="label">Estimated Repair Cost:</span>
                  <span className="value">${analysis.input_assumptions.estimated_defaults.estimated_repair_cost?.value?.toLocaleString() || '0'}</span>
                </div>
                {analysis.input_assumptions.estimated_defaults.estimated_repair_cost?.details && (
                  <div className="calculation-details">
                    <p><strong>Repair Estimation Details:</strong></p>
                    <ul>
                      <li>Property Age: {analysis.input_assumptions.estimated_defaults.estimated_repair_cost.details.property_age}</li>
                      <li>Condition: {analysis.input_assumptions.estimated_defaults.estimated_repair_cost.details.age_condition}</li>
                      <li>Repair Percentage: {analysis.input_assumptions.estimated_defaults.estimated_repair_cost.details.repair_percentage} of property value</li>
                    </ul>
                  </div>
                )}
              </div>

              {/* Mortgage Assumptions */}
              <div className="default-item">
                <div className="default-header">
                  <span className="label">Mortgage Assumptions:</span>
                </div>
                <div className="mortgage-details">
                  <div className="mort-item">
                    <span>Interest Rate:</span>
                    <strong>{analysis.input_assumptions.estimated_defaults.mortgage_rate}%</strong>
                  </div>
                  <div className="mort-item">
                    <span>Loan Term:</span>
                    <strong>{analysis.input_assumptions.estimated_defaults.mortgage_term} years</strong>
                  </div>
                  <div className="mort-item">
                    <span>Loan Amount (if needed):</span>
                    <strong>${analysis.input_assumptions.estimated_defaults.mortgage_principal?.toLocaleString() || 'Varies'}</strong>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Valuation Sources */}
          {analysis.input_assumptions.valuation && (
            <div className="assumptions-detail">
              <h3>💰 Valuation Data Used</h3>
              <div className="data-grid">
                <div className="data-item">
                  <span className="label">Listing Price:</span>
                  <span className="value">${analysis.input_assumptions.valuation.listing_price?.toLocaleString() || 'N/A'}</span>
                </div>
                <div className="data-item">
                  <span className="label">Estimated Value:</span>
                  <span className="value">${analysis.input_assumptions.valuation.estimated_value?.toLocaleString() || 'N/A'}</span>
                </div>
                <div className="data-item">
                  <span className="label">Market Value:</span>
                  <span className="value">${analysis.input_assumptions.valuation.market_value?.toLocaleString() || 'N/A'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content Tabs */}
      <div className="analysis-content">
        {/* Analysis Details */}
        <section className="section-analysis-details">
          <h2>📋 Analysis Summary</h2>

          {analysis.state_pass === false && (
            <div className="alert alert-red">
              <strong>State Restriction:</strong> {analysis.state_pass_reason}
            </div>
          )}

          <div className="details-grid">
            {analysis.analysis_type === 'subto' && analysis.subto_criteria_met !== undefined && (
              <div className="detail-block">
                <h3>Subject To (SubTo) Analysis</h3>
                <div className="criteria-list">
                  <div className="criteria-header">
                    <span className={analysis.subto_criteria_met ? 'status-pass' : 'status-fail'}>
                      {analysis.subto_criteria_met ? '✓ PASSES' : '✗ FAILS'}
                    </span>
                  </div>

                  {analysis.subto_passes && analysis.subto_passes.length > 0 && (
                    <div className="passes">
                      <h4>✓ Passing Criteria ({analysis.subto_passes.length})</h4>
                      {analysis.subto_passes.map((criterion, idx) => (
                        <p key={idx} className="pass-item">✓ {criterion}</p>
                      ))}
                    </div>
                  )}

                  {analysis.subto_failures && analysis.subto_failures.length > 0 && (
                    <div className="failures">
                      <h4>✗ Failing Criteria ({analysis.subto_failures.length})</h4>
                      {analysis.subto_failures.map((criterion, idx) => (
                        <p key={idx} className="fail-item">✗ {criterion}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {analysis.analysis_type === 'owner_financing' && analysis.owner_financing_criteria_met !== undefined && (
              <div className="detail-block">
                <h3>Owner Financing Analysis</h3>
                <div className="criteria-list">
                  <div className="criteria-header">
                    <span className={analysis.owner_financing_criteria_met ? 'status-pass' : 'status-fail'}>
                      {analysis.owner_financing_criteria_met ? '✓ PASSES' : '✗ FAILS'}
                    </span>
                  </div>

                  {analysis.owner_financing_passes && analysis.owner_financing_passes.length > 0 && (
                    <div className="passes">
                      <h4>✓ Passing Criteria ({analysis.owner_financing_passes.length})</h4>
                      {analysis.owner_financing_passes.map((criterion, idx) => (
                        <p key={idx} className="pass-item">✓ {criterion}</p>
                      ))}
                    </div>
                  )}

                  {analysis.owner_financing_failures && analysis.owner_financing_failures.length > 0 && (
                    <div className="failures">
                      <h4>✗ Failing Criteria ({analysis.owner_financing_failures.length})</h4>
                      {analysis.owner_financing_failures.map((criterion, idx) => (
                        <p key={idx} className="fail-item">✗ {criterion}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {analysis.analysis_type === 'multi_family' && analysis.multi_family_criteria_met !== undefined && (
              <div className="detail-block">
                <h3>Multi-Family Analysis</h3>
                <div className="criteria-list">
                  <div className="criteria-header">
                    <span className={analysis.multi_family_criteria_met ? 'status-pass' : 'status-fail'}>
                      {analysis.multi_family_criteria_met ? '✓ PASSES' : '✗ FAILS'}
                    </span>
                  </div>

                  {analysis.multi_family_passes && analysis.multi_family_passes.length > 0 && (
                    <div className="passes">
                      <h4>✓ Passing Criteria ({analysis.multi_family_passes.length})</h4>
                      {analysis.multi_family_passes.map((criterion, idx) => (
                        <p key={idx} className="pass-item">✓ {criterion}</p>
                      ))}
                    </div>
                  )}

                  {analysis.multi_family_failures && analysis.multi_family_failures.length > 0 && (
                    <div className="failures">
                      <h4>✗ Failing Criteria ({analysis.multi_family_failures.length})</h4>
                      {analysis.multi_family_failures.map((criterion, idx) => (
                        <p key={idx} className="fail-item">✗ {criterion}</p>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Financing Scenarios & Options */}
        {analysis.financing_scenarios?.scenarios && analysis.financing_scenarios.scenarios.length > 0 && (
          <section className="section-financing-scenarios">
            <h2>💰 Financing Scenarios & Options</h2>

            {/* Assumptions */}
            {analysis.financing_scenarios.assumptions && (
              <div className="assumptions-box">
                <h3>📌 Investment Assumptions</h3>
                <div className="assumptions-grid">
                  <div className="assumption">
                    <span className="label">Monthly Gross Rent:</span>
                    <span className="value">${Number(analysis.financing_scenarios.assumptions.gross_monthly_rent || 0).toFixed(2)}</span>
                  </div>
                  <div className="assumption">
                    <span className="label">Vacancy (5%):</span>
                    <span className="value">-${Number(analysis.financing_scenarios.assumptions.vacancy?.monthly_amount || 0).toFixed(2)}/mo</span>
                  </div>
                  <div className="assumption">
                    <span className="label">Maintenance (10%):</span>
                    <span className="value">-${Number(analysis.financing_scenarios.assumptions.maintenance?.monthly_amount || 0).toFixed(2)}/mo</span>
                  </div>
                  <div className="assumption">
                    <span className="label">CapEx (5%):</span>
                    <span className="value">-${Number(analysis.financing_scenarios.assumptions.capex?.monthly_amount || 0).toFixed(2)}/mo</span>
                  </div>
                  <div className="assumption">
                    <span className="label">Taxes ({analysis.financing_scenarios.assumptions.taxes?.label}):</span>
                    <span className="value">-${Number(analysis.financing_scenarios.assumptions.taxes?.monthly_amount || 0).toFixed(2)}/mo</span>
                  </div>
                  <div className="assumption">
                    <span className="label">Insurance ({analysis.financing_scenarios.assumptions.insurance?.label}):</span>
                    <span className="value">-${Number(analysis.financing_scenarios.assumptions.insurance?.monthly_amount || 0).toFixed(2)}/mo</span>
                  </div>
                  <div className="assumption highlighted">
                    <span className="label">Monthly NOI:</span>
                    <span className="value">${Number(analysis.financing_scenarios.assumptions.monthly_noi || 0).toFixed(2)}/mo</span>
                  </div>
                </div>
              </div>
            )}

            {/* Seller Finance Scenarios Table */}
            <div className="scenarios-container">
              <h3>🎯 Seller Financing Scenarios</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#2196f3', color: 'white' }}>
                      <th style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Scenario</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Offer Price</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Down Payment</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Terms & Interest</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Monthly Payment</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Monthly Cash Flow</th>
                      <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>CoC Return</th>
                      <th style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.financing_scenarios.scenarios.map((scenario, idx) => {
                      const statusColor = scenario.status === 'Strong' ? '#4caf50' : scenario.status === 'Acceptable' ? '#ff9800' : '#f44336';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #ddd', backgroundColor: idx % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                          <td style={{ padding: '10px', textAlign: 'left' }}>
                            <strong>{scenario.name}</strong>
                            {scenario.tags && scenario.tags.length > 0 && (
                              <div style={{ fontSize: '0.75em', color: '#999', marginTop: '3px' }}>
                                {scenario.tags.join(' • ')}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>${Number(scenario.offer_price || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            ${Number(scenario.down_payment || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                            <div style={{ fontSize: '0.8em', color: '#999' }}>({scenario.down_payment_percent}%)</div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right' }}>
                            <div><strong>{scenario.interest_rate}%</strong> interest</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>Amort: {scenario.amortization_years || 7}yr</div>
                            <div style={{ fontSize: '0.8em', color: '#d32f2f', fontWeight: 'bold' }}>Balloon: {scenario.balloon_term_years || 6}yr</div>
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>
                            <div>${Number(scenario.monthly_payment || 0).toFixed(2)}/mo</div>
                            <div style={{ fontSize: '0.8em', color: '#666' }}>({Number(scenario.payment_percentage_of_income || 0).toFixed(1)}% income)</div>
                            {scenario.balloon_payment > 0 && (
                              <div style={{ fontSize: '0.8em', color: '#d32f2f', marginTop: '4px' }}>Balloon: ${Number(scenario.balloon_payment || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</div>
                            )}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', color: Number(scenario.monthly_cash_flow || 0) > 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
                            ${Number(scenario.monthly_cash_flow || 0).toFixed(2)}
                          </td>
                          <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{Number(scenario.cash_on_cash || 0).toFixed(1)}%</td>
                          <td style={{ padding: '10px', textAlign: 'center', backgroundColor: statusColor, color: 'white', fontWeight: 'bold', borderRadius: '4px' }}>
                            {scenario.status}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {analysis.financing_scenarios.summary && (
                <p style={{ fontSize: '0.8em', color: '#666', marginTop: '10px' }}>
                  <strong>Summary:</strong> {analysis.financing_scenarios.summary.strong_scenarios} Strong • {analysis.financing_scenarios.summary.acceptable_scenarios} Acceptable • {analysis.financing_scenarios.summary.weak_scenarios} Weak scenarios
                </p>
              )}
            </div>

            {/* DSCR Loan Comparison */}
            {analysis.financing_scenarios.dscr_loan && (
              <div className="dscr-comparison-box" style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3', borderRadius: '6px' }}>
                <h3 style={{ marginTop: 0, marginBottom: '12px', color: '#1976d2' }}>💳 Traditional DSCR Loan Comparison</h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', fontSize: '0.9em' }}>
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Down Payment (20%)</p>
                    <p style={{ margin: 0, color: '#2196f3', fontSize: '1.1em', fontWeight: 'bold' }}>
                      ${Number(analysis.financing_scenarios.dscr_loan.down_payment || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Interest Rate</p>
                    <p style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>
                      {analysis.financing_scenarios.dscr_loan.interest_rate}% ({analysis.financing_scenarios.dscr_loan.term_years}yr)
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Monthly Payment</p>
                    <p style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>
                      ${Number(analysis.financing_scenarios.dscr_loan.monthly_payment || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Monthly Cash Flow</p>
                    <p style={{ margin: 0, color: Number(analysis.financing_scenarios.dscr_loan.monthly_cash_flow || 0) > 0 ? '#4caf50' : '#f44336', fontSize: '1.1em', fontWeight: 'bold' }}>
                      ${Number(analysis.financing_scenarios.dscr_loan.monthly_cash_flow || 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Cash-on-Cash Return</p>
                    <p style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>
                      {Number(analysis.financing_scenarios.dscr_loan.cash_on_cash || 0).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>DSCR Ratio</p>
                    <p style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold', color: Number(analysis.financing_scenarios.dscr_loan.dscr_ratio || 0) >= 1.25 ? '#4caf50' : '#f44336' }}>
                      {Number(analysis.financing_scenarios.dscr_loan.dscr_ratio || 0).toFixed(2)} {Number(analysis.financing_scenarios.dscr_loan.dscr_ratio || 0) >= 1.25 ? '✓' : '✗'}
                    </p>
                    <p style={{ margin: '3px 0 0 0', fontSize: '0.8em', color: '#666' }}>
                      (Req: {analysis.financing_scenarios.dscr_loan.dscr_required})
                    </p>
                  </div>
                </div>
                <p style={{ margin: '12px 0 0 0', fontSize: '0.85em', fontStyle: 'italic', color: '#1976d2' }}>
                  {analysis.financing_scenarios.dscr_loan.dscr_note}
                </p>

                {/* QUALIFYING OFFER PRICE */}
                {analysis.financing_scenarios.dscr_loan.qualifying_offer_price !== undefined && (
                  <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#fff3e0', border: '2px solid #ff9800', borderRadius: '6px' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#f57c00' }}>
                      🎯 To Qualify for DSCR Loan (1.25 minimum):
                    </p>
                    {analysis.financing_scenarios.dscr_loan.qualifying_offer_price !== null ? (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                        <div>
                          <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#e65100', fontWeight: 'bold' }}>Purchase Price</p>
                          <p style={{ margin: '0', fontSize: '1.3em', fontWeight: 'bold', color: '#ff6f00' }}>
                            ${Number(analysis.financing_scenarios.dscr_loan.qualifying_offer_price || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#e65100', fontWeight: 'bold' }}>Down Payment (20%)</p>
                          <p style={{ margin: '0', fontSize: '1.1em', fontWeight: 'bold', color: '#ff6f00' }}>
                            ${Number(analysis.financing_scenarios.dscr_loan.qualifying_down_payment || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#e65100', fontWeight: 'bold' }}>CoC Return</p>
                          <p style={{ margin: '0', fontSize: '1.1em', fontWeight: 'bold', color: '#ff6f00' }}>
                            {analysis.financing_scenarios.dscr_loan.qualifying_coc_return !== null 
                              ? `${Number(analysis.financing_scenarios.dscr_loan.qualifying_coc_return || 0).toFixed(1)}%`
                              : 'N/A'
                            }
                          </p>
                        </div>
                      </div>
                    ) : null}
                    <p style={{ margin: '12px 0 0 0', fontSize: '0.9em', color: '#e65100', fontStyle: 'italic' }}>
                      {analysis.financing_scenarios.dscr_loan.qualifying_price_note}
                    </p>
                  </div>
                )}

                {/* ALTERNATIVE: HIGHER DOWN PAYMENT AT ASKING PRICE */}
                {analysis.financing_scenarios.dscr_loan.required_down_payment_percent !== undefined && 
                 analysis.financing_scenarios.dscr_loan.required_down_payment_percent !== null && (
                  <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#e8f5e9', border: '2px solid #4caf50', borderRadius: '6px' }}>
                    <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#2e7d32' }}>
                      💰 Alternative: Buy at Asking Price with Higher Down Payment
                    </p>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                      <div>
                        <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#1b5e20', fontWeight: 'bold' }}>Purchase Price (Asking)</p>
                        <p style={{ margin: '0', fontSize: '1.3em', fontWeight: 'bold', color: '#2e7d32' }}>
                          ${Number(analysis.financing_scenarios.dscr_loan.offer_price || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#1b5e20', fontWeight: 'bold' }}>Down Payment ({analysis.financing_scenarios.dscr_loan.required_down_payment_percent?.toFixed(1)}%)</p>
                        <p style={{ margin: '0', fontSize: '1.1em', fontWeight: 'bold', color: '#2e7d32' }}>
                          ${Number(analysis.financing_scenarios.dscr_loan.required_down_payment_amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </p>
                      </div>
                      <div>
                        <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#1b5e20', fontWeight: 'bold' }}>CoC Return</p>
                        <p style={{ margin: '0', fontSize: '1.1em', fontWeight: 'bold', color: '#2e7d32' }}>
                          {analysis.financing_scenarios.dscr_loan.required_down_payment_coc !== null 
                            ? `${Number(analysis.financing_scenarios.dscr_loan.required_down_payment_coc || 0).toFixed(1)}%`
                            : 'N/A'
                          }
                        </p>
                      </div>
                    </div>
                    <p style={{ margin: '12px 0 0 0', fontSize: '0.9em', color: '#1b5e20', fontStyle: 'italic' }}>
                      This scenario lets you buy at asking price but requires {analysis.financing_scenarios.dscr_loan.required_down_payment_percent?.toFixed(1)}% down to achieve DSCR 1.25
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* Deal Interpretation */}
        <section className="section-interpretation">
          <h2>📖 Deal Interpretation</h2>
          <div className="interpretation-box">
            <p>{analysis.analysis_notes}</p>
          </div>
        </section>

        {/* Recommended Next Offer */}
        <section className="section-recommendation">
          <h2>🎯 Recommended Next Steps</h2>
          <div className={`recommendation-box ${trafficInfo.color}`}>
            <h3>{trafficInfo.emoji} {analysis.recommendation}</h3>
            {analysis.financing_scenarios?.scenarios && analysis.financing_scenarios.scenarios.length > 0 && (
              <>
                <p>
                  <strong>Multiple Options Available:</strong> Review the financing scenarios above to see which structure works best for your investment strategy.
                </p>
                <p>
                  <strong>Recommendation:</strong> The best financing scenario is "<strong>{analysis.financing_scenarios.summary?.best_scenario?.name || 'Evaluate based on your specific requirements'}</strong>" with {analysis.financing_scenarios.summary?.best_scenario?.cash_on_cash.toFixed(1)}% Cash-on-Cash return.
                </p>
              </>
            )}
          </div>
        </section>

        {/* Risks */}
        <section className="section-risks">
          <h2>⚠️ Risk Assessment</h2>
          <div className="risks-list">
            {analysis.state_pass === false && (
              <div className="risk-item high">
                <span className="risk-level">HIGH</span>
                <span className="risk-text">State restrictions apply - verify legal compliance</span>
              </div>
            )}
            {!analysis.cashflow_positive && (
              <div className="risk-item medium">
                <span className="risk-level">MEDIUM</span>
                <span className="risk-text">Negative cashflow - property may struggle to break even</span>
              </div>
            )}
            {analysis.financing_scenarios?.dscr_loan?.dscr_ratio && Number(analysis.financing_scenarios.dscr_loan.dscr_ratio) < 1.25 && (
              <div className="risk-item medium">
                <span className="risk-level">MEDIUM</span>
                <span className="risk-text">Does not qualify for traditional DSCR financing (ratio {Number(analysis.financing_scenarios.dscr_loan.dscr_ratio).toFixed(2)} &lt; 1.25) - seller financing required</span>
              </div>
            )}
            {!analysis.green_light && (
              <div className="risk-item medium">
                <span className="risk-level">MEDIUM</span>
                <span className="risk-text">Property does not meet primary investment criteria - requires additional due diligence</span>
              </div>
            )}
            <div className="risk-item low">
              <span className="risk-level">LOW</span>
              <span className="risk-text">Always conduct site inspection and verify tenant quality before proceeding</span>
            </div>
          </div>
        </section>
      </div>

      <div className="page-footer">
        <button onClick={() => navigate('/analysis')} className="btn-back-bottom">
          ← Back to Results
        </button>
      </div>
    </div>
  );
}
