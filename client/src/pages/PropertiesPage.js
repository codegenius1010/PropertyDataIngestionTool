import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './PropertiesPage.css';

export default function PropertiesPage() {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncingId, setSyncingId] = useState(null);
  const [syncingAll, setSyncingAll] = useState(false);
  const [selectedProperty, setSelectedProperty] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editedProperty, setEditedProperty] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [analysisMode, setAnalysisMode] = useState(false);
  const [analysisInputMode, setAnalysisInputMode] = useState(false);
  const [propertyAnalysis, setPropertyAnalysis] = useState(null);
  const [analysisData, setAnalysisData] = useState({
    rental_income: '',
    mortgage_principal: '',
    mortgage_rate: '',
    mortgage_term: '',
    estimated_arv: '',
    estimated_repair_cost: ''
  });
  const [analyzingId, setAnalyzingId] = useState(null);
  const [analysisMap, setAnalysisMap] = useState({});
  const [filters, setFilters] = useState({
    syncStatus: 'all',
    searchTerm: '',
    city: 'all',
    state: 'all',
    analysisColor: 'all',
    priceMin: '',
    priceMax: '',
    dscrQualification: 'all',
    unitsMin: '',
    unitsMax: ''
  });
  const [deletingAll, setDeletingAll] = useState(false);
  const [editingExpenses, setEditingExpenses] = useState(false);
  const [customTaxAnnual, setCustomTaxAnnual] = useState(null);
  const [customInsuranceAnnual, setCustomInsuranceAnnual] = useState(null);
  const [customGrossMonthlyRent, setCustomGrossMonthlyRent] = useState(null);
  const [recalculating, setRecalculating] = useState(false);

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
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

  const handleShowAnalysis = async (property) => {
    try {
      setSelectedProperty(property);
      // Fetch fresh analysis data to ensure we have input_assumptions
      const response = await axios.get(`http://localhost:5000/api/analysis/${property.id}`);
      if (response.data.analysis) {
        setPropertyAnalysis(response.data.analysis);
        setAnalysisMode(true);
        // Initialize custom values from current assumptions
        const assumptions = response.data.analysis.financing_scenarios?.assumptions;
        if (assumptions) {
          setCustomTaxAnnual(assumptions.taxes?.annual_amount || null);
          setCustomInsuranceAnnual(assumptions.insurance?.annual_amount || null);
          // Convert rental_income (annual) to monthly
          const annualRental = assumptions.rental_income?.annual_amount || 0;
          setCustomGrossMonthlyRent(annualRental > 0 ? annualRental / 12 : null);
        }
      }
    } catch (err) {
      console.error('Error fetching analysis:', err);
      // Fallback to cached data
      if (analysisMap[property.id]) {
        setPropertyAnalysis(analysisMap[property.id]);
        setAnalysisMode(true);
      } else {
        alert('Could not load analysis data');
      }
    }
  };

  const handleRecalculateScenarios = async () => {
    if (!selectedProperty) return;

    try {
      setRecalculating(true);
      const response = await axios.post(
        `http://localhost:5000/api/analysis/${selectedProperty.id}/recalculate`,
        {
          customTaxAnnual: customTaxAnnual !== null ? customTaxAnnual : undefined,
          customInsuranceAnnual: customInsuranceAnnual !== null ? customInsuranceAnnual : undefined,
          customGrossMonthlyRent: customGrossMonthlyRent !== null ? customGrossMonthlyRent : undefined
        }
      );

      if (response.data.analysis) {
        setPropertyAnalysis(response.data.analysis);
        setEditingExpenses(false);
        alert('Scenarios recalculated successfully!');
      }
    } catch (err) {
      console.error('Error recalculating scenarios:', err);
      alert(`Failed to recalculate: ${err.response?.data?.error || err.message}`);
    } finally {
      setRecalculating(false);
    }
  };

  const handleDeleteProperty = async (propertyId, address) => {
    if (!window.confirm(`Are you sure you want to delete "${address}"? This cannot be undone.`)) {
      return;
    }

    try {
      await axios.delete(`http://localhost:5000/api/properties/${propertyId}`);
      setProperties(properties.filter(prop => prop.id !== propertyId));
      alert('Property deleted successfully');
    } catch (err) {
      console.error('Error deleting property:', err);
      alert(`Failed to delete property: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleDeleteAllProperties = async () => {
    if (properties.length === 0) {
      alert('No properties to delete');
      return;
    }

    if (!window.confirm(`Are you sure you want to DELETE ALL ${properties.length} properties? This cannot be undone.`)) {
      return;
    }

    if (!window.confirm('This is your final warning! All properties will be permanently deleted.')) {
      return;
    }

    try {
      setDeletingAll(true);
      let deletedCount = 0;
      let failedCount = 0;

      for (const property of properties) {
        try {
          await axios.delete(`http://localhost:5000/api/properties/${property.id}`);
          deletedCount++;
        } catch (err) {
          console.error(`Failed to delete property ${property.id}:`, err);
          failedCount++;
        }
      }

      setProperties([]);
      setFilters({
        syncStatus: 'all',
        searchTerm: '',
        city: 'all',
        state: 'all',
        analysisColor: 'all',
        priceMin: '',
        priceMax: ''
      });
      
      alert(`Deletion complete!\nDeleted: ${deletedCount}\nFailed: ${failedCount}`);
    } catch (err) {
      console.error('Error deleting all properties:', err);
      alert(`Failed to delete all properties: ${err.message}`);
    } finally {
      setDeletingAll(false);
    }
  };

  const handleSyncToGHL = async (propertyId, address) => {
    if (!window.confirm(`Push "${address}" to GoHighLevel?`)) {
      return;
    }

    try {
      setSyncingId(propertyId);
      const response = await axios.post(
        `http://localhost:5000/api/properties/${propertyId}/sync-ghl`
      );

      if (response.data.success) {
        setProperties(properties.map(prop =>
          prop.id === propertyId
            ? {
                ...prop,
                ghl_sync_status: 'synced',
                ghl_sync_date: new Date().toISOString()
              }
            : prop
        ));
        alert('Property successfully pushed to GoHighLevel!');
      }
    } catch (err) {
      console.error('Error syncing to GHL:', err);
      const errorMessage = err.response?.data?.error || err.message;
      alert(`Failed to sync property: ${errorMessage}`);
      
      setProperties(properties.map(prop =>
        prop.id === propertyId
          ? {
              ...prop,
              ghl_sync_status: 'failed',
              ghl_error_message: errorMessage
            }
          : prop
      ));
    } finally {
      setSyncingId(null);
    }
  };

  const handleSyncAllUnsynced = async () => {
    const unsyncedCount = properties.filter(p => p.ghl_sync_status === 'not_synced').length;
    
    if (unsyncedCount === 0) {
      alert('All properties have already been synced!');
      return;
    }

    if (!window.confirm(`Sync ${unsyncedCount} unsynced properties to GoHighLevel?`)) {
      return;
    }

    try {
      setSyncingAll(true);
      const unsyncedIds = properties
        .filter(p => p.ghl_sync_status === 'not_synced')
        .map(p => p.id);

      const response = await axios.post(
        'http://localhost:5000/api/properties/sync-all',
        { propertyIds: unsyncedIds }
      );

      if (response.data.success) {
        // Update properties with new sync status
        const updatedProperties = properties.map(prop => {
          if (response.data.results.success.includes(prop.id)) {
            return {
              ...prop,
              ghl_sync_status: 'synced',
              ghl_sync_date: new Date().toISOString()
            };
          } else if (response.data.results.failed.some(f => f.id === prop.id)) {
            const failedItem = response.data.results.failed.find(f => f.id === prop.id);
            return {
              ...prop,
              ghl_sync_status: 'failed',
              ghl_error_message: failedItem.error
            };
          }
          return prop;
        });
        
        setProperties(updatedProperties);
        alert(
          `Sync complete!\n` +
          `✓ Synced: ${response.data.results.success.length}\n` +
          `✗ Failed: ${response.data.results.failed.length}`
        );
      }
    } catch (err) {
      console.error('Error syncing all:', err);
      alert(`Failed to sync properties: ${err.response?.data?.error || err.message}`);
    } finally {
      setSyncingAll(false);
    }
  };

  const openGoogleSearch = (address, city, state) => {
    const searchQuery = `${address} ${city} ${state}`;
    const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
    window.open(googleUrl, '_blank');
  };

  const handleToggleSyncEnabled = async (propertyId, newSyncStatus) => {
    try {
      await axios.patch(`http://localhost:5000/api/properties/${propertyId}/sync-enabled`, {
        sync_enabled: newSyncStatus
      });

      setProperties(properties.map(prop =>
        prop.id === propertyId
          ? { ...prop, sync_enabled: newSyncStatus }
          : prop
      ));
    } catch (err) {
      console.error('Error updating sync status:', err);
      alert(`Failed to update sync status: ${err.response?.data?.error || err.message}`);
      // Revert the toggle on error
      fetchProperties();
    }
  };

  const handleEditClick = () => {
    setEditMode(true);
    setEditedProperty({ ...selectedProperty });
  };

  const handleEditCancel = () => {
    setEditMode(false);
    setEditedProperty(null);
  };

  const handleOpenAnalysisForm = () => {
    // Pre-populate analysis data from property fields
    setAnalysisData({
      rental_income: selectedProperty.rental_income || '',
      mortgage_principal: selectedProperty.mortgage_principal || '',
      mortgage_rate: selectedProperty.mortgage_rate || '',
      mortgage_term: selectedProperty.mortgage_term || '',
      estimated_arv: selectedProperty.estimated_arv || '',
      estimated_repair_cost: selectedProperty.estimated_repair_cost || ''
    });
    setAnalysisInputMode(true);
  };

  const handleEditFieldChange = (field, value) => {
    setEditedProperty({
      ...editedProperty,
      [field]: value
    });
  };

  const handleSaveEdit = async () => {
    try {
      setSavingEdit(true);
      
      // Build the update object with only changed fields
      const updateData = {};
      Object.keys(editedProperty).forEach(key => {
        if (editedProperty[key] !== selectedProperty[key]) {
          updateData[key] = editedProperty[key];
        }
      });

      if (Object.keys(updateData).length === 0) {
        alert('No changes to save.');
        setSavingEdit(false);
        return;
      }

      const response = await axios.patch(
        `http://localhost:5000/api/properties/${selectedProperty.id}`,
        updateData
      );

      // Update the properties list and selected property
      const updatedProperties = properties.map(prop =>
        prop.id === selectedProperty.id
          ? { ...prop, ...editedProperty }
          : prop
      );
      
      setProperties(updatedProperties);
      setSelectedProperty({ ...editedProperty });
      setEditMode(false);
      setEditedProperty(null);
      alert('Property updated successfully!');
    } catch (err) {
      console.error('Error updating property:', err);
      alert(`Failed to update property: ${err.response?.data?.error || err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const handleAnalyzeClick = async () => {
    try {
      setAnalyzingId(selectedProperty.id);
      
      // First, update property with analysis data
      if (analysisData.rental_income || analysisData.mortgage_principal) {
        const updateData = {};
        if (analysisData.rental_income) updateData.rental_income = parseFloat(analysisData.rental_income) || null;
        if (analysisData.mortgage_principal) updateData.mortgage_principal = parseFloat(analysisData.mortgage_principal) || null;
        if (analysisData.mortgage_rate) updateData.mortgage_rate = parseFloat(analysisData.mortgage_rate) || null;
        if (analysisData.mortgage_term) updateData.mortgage_term = parseInt(analysisData.mortgage_term) || null;
        if (analysisData.estimated_arv) updateData.estimated_arv = parseFloat(analysisData.estimated_arv) || null;
        if (analysisData.estimated_repair_cost) updateData.estimated_repair_cost = parseFloat(analysisData.estimated_repair_cost) || null;

        await axios.patch(
          `http://localhost:5000/api/properties/${selectedProperty.id}`,
          updateData
        );

        // Update selected property with new data
        setSelectedProperty({
          ...selectedProperty,
          ...updateData
        });
      }

      // Run analysis
      const response = await axios.post(
        `http://localhost:5000/api/analysis/${selectedProperty.id}`
      );

      setPropertyAnalysis(response.data.analysis);
      setAnalysisInputMode(false);
      setAnalysisMode(true);
      alert('Property analysis completed!');
    } catch (err) {
      console.error('Error analyzing property:', err);
      alert(`Failed to analyze property: ${err.response?.data?.error || err.message}`);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAnalysisDataChange = (field, value) => {
    setAnalysisData({
      ...analysisData,
      [field]: value
    });
  };

  const handleCloseAnalysis = () => {
    setAnalysisMode(false);
    setPropertyAnalysis(null);
  };

  // Function to check if property qualifies for DSCR
  const qualifiesForDSCR = (propertyId) => {
    const analysis = analysisMap[propertyId];
    if (analysis?.financing_scenarios?.dscr_loan?.dscr_ratio) {
      return analysis.financing_scenarios.dscr_loan.dscr_ratio >= 1.25;
    }
    return false;
  };

  // Get unique cities and states for filter dropdowns
  const uniqueCities = ['all', ...new Set(properties.map(p => p.city).filter(Boolean))].sort();
  const uniqueStates = ['all', ...new Set(properties.map(p => p.state).filter(Boolean))].sort();

  // Filter properties
  const filteredProperties = properties.filter(prop => {
    const matchesStatus = filters.syncStatus === 'all' || prop.ghl_sync_status === filters.syncStatus;
    const matchesSearch = 
      (prop.address?.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
      (prop.city?.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
      (prop.agent_name?.toLowerCase().includes(filters.searchTerm.toLowerCase()));
    const matchesCity = filters.city === 'all' || prop.city === filters.city;
    const matchesState = filters.state === 'all' || prop.state === filters.state;
    
    // Use green_light, yellow_light, red_light boolean fields for analysis color matching
    const analysis = analysisMap[prop.id];
    let matchesAnalysisColor = false;
    if (filters.analysisColor === 'all') {
      matchesAnalysisColor = true;
    } else if (filters.analysisColor === 'GREEN' && analysis?.green_light) {
      matchesAnalysisColor = true;
    } else if (filters.analysisColor === 'YELLOW' && analysis?.yellow_light) {
      matchesAnalysisColor = true;
    } else if (filters.analysisColor === 'RED' && analysis?.red_light) {
      matchesAnalysisColor = true;
    } else if (filters.analysisColor === 'none' && !analysis) {
      matchesAnalysisColor = true;
    }
    
    const price = parseFloat(prop.listing_price) || 0;
    const matchesPriceMin = !filters.priceMin || price >= parseFloat(filters.priceMin);
    const matchesPriceMax = !filters.priceMax || price <= parseFloat(filters.priceMax);
    
    const unitsCount = parseInt(prop.units_count) || 0;
    const minUnits = filters.unitsMin ? parseInt(filters.unitsMin) : 0;
    const maxUnits = filters.unitsMax ? parseInt(filters.unitsMax) : Infinity;
    const matchesUnitsMin = unitsCount >= minUnits;
    const matchesUnitsMax = unitsCount <= maxUnits;
    
    // Check DSCR qualification
    let matchesDSCR = false;
    if (filters.dscrQualification === 'all') {
      matchesDSCR = true;
    } else if (filters.dscrQualification === 'qualifies') {
      matchesDSCR = qualifiesForDSCR(prop.id);
    } else if (filters.dscrQualification === 'not_qualifies') {
      const analysis = analysisMap[prop.id];
      matchesDSCR = analysis && !qualifiesForDSCR(prop.id);
    } else if (filters.dscrQualification === 'not_analyzed') {
      matchesDSCR = !analysisMap[prop.id];
    }
    
    return matchesStatus && matchesSearch && matchesCity && matchesState && matchesAnalysisColor && matchesPriceMin && matchesPriceMax && matchesUnitsMin && matchesUnitsMax && matchesDSCR;
  });

  const getStatusColor = (status) => {
    switch (status) {
      case 'synced':
        return '#4caf50';
      case 'failed':
        return '#f44336';
      case 'not_synced':
      default:
        return '#ff9800';
    }
  };

  const getStatusLabel = (status) => {
    switch (status) {
      case 'synced':
        return 'Synced';
      case 'failed':
        return 'Failed';
      case 'not_synced':
      default:
        return 'Not Synced';
    }
  };

  const getAnalysisScoreColor = (score) => {
    switch (score) {
      case 'GREEN':
        return '#4caf50';
      case 'YELLOW':
        return '#ff9800';
      case 'RED':
        return '#f44336';
      default:
        return '#999999';
    }
  };

  const getAnalysisScoreLabel = (score) => {
    switch (score) {
      case 'GREEN':
        return '✓ GREEN';
      case 'YELLOW':
        return '⚠ YELLOW';
      case 'RED':
        return '✗ RED';
      default:
        return '- No Analysis';
    }
  };

  // Get color based on boolean light indicators
  const getAnalysisColorFromLights = (analysis) => {
    if (!analysis) return '#999999';
    if (analysis.green_light) return '#4caf50';
    if (analysis.yellow_light) return '#ff9800';
    if (analysis.red_light) return '#f44336';
    return '#999999';
  };

  // Get label based on boolean light indicators
  const getAnalysisLabelFromLights = (analysis) => {
    if (!analysis) return '- No Analysis';
    if (analysis.green_light) return '✓ GREEN';
    if (analysis.yellow_light) return '⚠ YELLOW';
    if (analysis.red_light) return '✗ RED';
    return '- No Analysis';
  };

  if (loading) {
    return (
      <div className="properties-container">
        <h1>Properties</h1>
        <div className="loading">Loading properties...</div>
      </div>
    );
  }

  return (
    <div className="properties-container">
      <div className="properties-header">
        <h1>Property Records</h1>
        <p className="total-count">
          Total: {properties.length} properties uploaded
          {filteredProperties.length !== properties.length && (
            <span style={{ marginLeft: '20px', color: '#0066cc', fontWeight: 'bold' }}>
              • Showing {filteredProperties.length} properties after filters
            </span>
          )}
        </p>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="filters-section">
        <input
          type="text"
          placeholder="Search by address, city, or agent..."
          value={filters.searchTerm}
          onChange={(e) => setFilters({ ...filters, searchTerm: e.target.value })}
          className="search-input"
        />

        <div className="filter-group">
          <label>Status:</label>
          <select
            value={filters.syncStatus}
            onChange={(e) => setFilters({ ...filters, syncStatus: e.target.value })}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="not_synced">Not Synced</option>
            <option value="synced">Synced</option>
            <option value="failed">Failed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>City:</label>
          <select
            value={filters.city}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            className="filter-select"
          >
            {uniqueCities.map(city => (
              <option key={city} value={city}>
                {city === 'all' ? 'All Cities' : city}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>State:</label>
          <select
            value={filters.state}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            className="filter-select"
          >
            {uniqueStates.map(state => (
              <option key={state} value={state}>
                {state === 'all' ? 'All States' : state}
              </option>
            ))}
          </select>
        </div>

        <div className="filter-group">
          <label>Analysis:</label>
          <select
            value={filters.analysisColor}
            onChange={(e) => setFilters({ ...filters, analysisColor: e.target.value })}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="GREEN">🟢 Green</option>
            <option value="YELLOW">🟡 Yellow</option>
            <option value="RED">🔴 Red</option>
            <option value="none">- Not Analyzed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>DSCR Qual:</label>
          <select
            value={filters.dscrQualification}
            onChange={(e) => setFilters({ ...filters, dscrQualification: e.target.value })}
            className="filter-select"
          >
            <option value="all">All</option>
            <option value="qualifies">✓ Qualifies (DSCR ≥ 1.25)</option>
            <option value="not_qualifies">✗ Does Not Qualify (DSCR &lt; 1.25)</option>
            <option value="not_analyzed">- Not Analyzed</option>
          </select>
        </div>

        <div className="filter-group">
          <label>Price Range:</label>
          <div className="price-range-inputs">
            <input
              type="number"
              placeholder="Min"
              value={filters.priceMin}
              onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })}
              className="price-input"
            />
            <span className="price-separator">-</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.priceMax}
              onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })}
              className="price-input"
            />
          </div>
        </div>

        <div className="filter-group">
          <label>Units:</label>
          <div className="price-range-inputs">
            <input
              type="number"
              placeholder="Min"
              value={filters.unitsMin}
              onChange={(e) => setFilters({ ...filters, unitsMin: e.target.value })}
              className="price-input"
            />
            <span className="price-separator">-</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.unitsMax}
              onChange={(e) => setFilters({ ...filters, unitsMax: e.target.value })}
              className="price-input"
            />
          </div>
        </div>
      </div>

      <div className="action-buttons-section">
        <button onClick={fetchProperties} className="refresh-btn">
          Refresh
        </button>

        <button 
          onClick={handleSyncAllUnsynced} 
          className="sync-all-btn"
          disabled={syncingAll || properties.filter(p => p.ghl_sync_status === 'not_synced').length === 0}
        >
          {syncingAll ? (
            <>
              <span className="spinner"></span>
              Syncing All...
            </>
          ) : (
            `Sync All (${properties.filter(p => p.ghl_sync_status === 'not_synced').length})`
          )}
        </button>

        <button 
          onClick={handleDeleteAllProperties} 
          className="delete-all-btn"
          disabled={deletingAll || properties.length === 0}
          title="Delete all properties (warning: cannot be undone)"
        >
          {deletingAll ? (
            <>
              <span className="spinner"></span>
              Deleting All...
            </>
          ) : (
            `🗑️ Delete All (${properties.length})`
          )}
        </button>
      </div>

      <div className="properties-table-wrapper">
        {filteredProperties.length === 0 ? (
          <div className="no-data">
            {properties.length === 0 
              ? 'No properties uploaded yet. Upload a CSV file to get started.' 
              : 'No properties match your filters.'}
          </div>
        ) : (
          <table className="properties-table">
            <thead>
              <tr>
                <th>Address</th>
                <th>City, State</th>
                <th>Price</th>
                <th>Beds / Baths</th>
                <th>Analysis</th>
                <th>Sync?</th>
                <th>GHL Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredProperties.map((property) => (
                <tr key={property.id} className="property-row">
                  <td className="address-cell">
                    <button
                      type="button"
                      className="address-link"
                      onClick={() => openGoogleSearch(property.address, property.city, property.state)}
                      style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
                    >
                      {property.address}
                    </button>
                    {property.mls_id && <div className="mls-id">MLS: {property.mls_id}</div>}
                  </td>
                  <td>
                    {property.city}, {property.state} {property.zip_code}
                  </td>
                  <td className="price-cell">
                    ${property.listing_price ? parseInt(property.listing_price).toLocaleString() : 'N/A'}
                  </td>
                  <td className="beds-baths-cell">
                    {property.bedrooms || 0} / {property.bathrooms || 0}
                  </td>
                  <td className="analysis-cell">
                    {analysisMap[property.id] ? (
                      <button
                        onClick={() => handleShowAnalysis(property)}
                        style={{
                          backgroundColor: getAnalysisColorFromLights(analysisMap[property.id]),
                          color: 'white',
                          padding: '6px 12px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 'bold',
                          border: 'none',
                          cursor: 'pointer',
                          minWidth: '100px'
                        }}
                        title="Click to view detailed analysis"
                      >
                        {getAnalysisLabelFromLights(analysisMap[property.id])}
                      </button>
                    ) : (
                      <span style={{ color: '#999', fontSize: '12px' }}>Not analyzed</span>
                    )}
                  </td>
                  <td>
                    <label className="sync-toggle" title="Toggle sync with GHL">
                      <input
                        type="checkbox"
                        checked={property.sync_enabled !== false}
                        onChange={(e) => handleToggleSyncEnabled(property.id, e.target.checked)}
                      />
                      <span className="toggle-switch"></span>
                    </label>
                  </td>
                  <td>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: getStatusColor(property.ghl_sync_status),
                        color: 'white',
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold'
                      }}
                    >
                      {getStatusLabel(property.ghl_sync_status)}
                    </span>
                    {property.ghl_sync_date && (
                      <div style={{ fontSize: '11px', marginTop: '4px', color: '#666' }}>
                        {new Date(property.ghl_sync_date).toLocaleDateString()}
                      </div>
                    )}
                  </td>
                  <td className="actions-cell">
                    <div className="action-buttons">
                      <button
                        onClick={() => setSelectedProperty(property)}
                        className="action-btn info-btn"
                        title="View all property details"
                      >
                        📋 Details
                      </button>
                      <button
                        onClick={() => handleSyncToGHL(property.id, property.address)}
                        disabled={syncingId === property.id}
                        className={`action-btn sync-btn ${property.ghl_sync_status === 'synced' ? 'synced' : ''}`}
                      >
                        {syncingId === property.id ? (
                          <>
                            <span className="spinner"></span>
                          </>
                        ) : property.ghl_sync_status === 'synced' ? (
                          '✓ Synced'
                        ) : (
                          '🔄 Sync'
                        )}
                      </button>
                      <button
                        onClick={() => handleDeleteProperty(property.id, property.address)}
                        className="action-btn delete-btn"
                        title="Delete this property"
                      >
                        🗑️ Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Details Modal */}
      {selectedProperty && (
        <div className="modal-overlay" onClick={() => {
          setSelectedProperty(null);
          setEditMode(false);
          setEditedProperty(null);
        }}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editMode && editedProperty ? editedProperty.address : selectedProperty.address}</h2>
              <button className="modal-close" onClick={() => {
                setSelectedProperty(null);
                setEditMode(false);
                setEditedProperty(null);
              }}>✕</button>
            </div>

            <div className="modal-body">
              {analysisInputMode ? (
                // Analysis Data Input View
                <div className="analysis-input-form">
                  <h3>Enter Deal Data for Analysis</h3>
                  <p style={{ color: '#666', fontSize: '14px' }}>Provide rental income and/or mortgage information to analyze this deal.</p>
                  
                  <div className="analysis-input-group">
                    <label>Monthly Rental Income (optional)</label>
                    <input
                      type="number"
                      placeholder="e.g., 2000"
                      value={analysisData.rental_income}
                      onChange={(e) => handleAnalysisDataChange('rental_income', e.target.value)}
                      className="analysis-input"
                    />
                  </div>

                  <div className="analysis-input-group">
                    <label>Mortgage Principal (optional)</label>
                    <input
                      type="number"
                      placeholder="e.g., 150000"
                      value={analysisData.mortgage_principal}
                      onChange={(e) => handleAnalysisDataChange('mortgage_principal', e.target.value)}
                      className="analysis-input"
                    />
                  </div>

                  <div className="analysis-input-row">
                    <div className="analysis-input-group">
                      <label>Interest Rate (%) (optional)</label>
                      <input
                        type="number"
                        placeholder="e.g., 6.5"
                        step="0.1"
                        value={analysisData.mortgage_rate}
                        onChange={(e) => handleAnalysisDataChange('mortgage_rate', e.target.value)}
                        className="analysis-input"
                      />
                    </div>
                    <div className="analysis-input-group">
                      <label>Mortgage Term (months) (optional)</label>
                      <input
                        type="number"
                        placeholder="e.g., 360"
                        value={analysisData.mortgage_term}
                        onChange={(e) => handleAnalysisDataChange('mortgage_term', e.target.value)}
                        className="analysis-input"
                      />
                    </div>
                  </div>

                  <div className="analysis-input-group">
                    <label>Estimated ARV (optional)</label>
                    <input
                      type="number"
                      placeholder="e.g., 250000"
                      value={analysisData.estimated_arv}
                      onChange={(e) => handleAnalysisDataChange('estimated_arv', e.target.value)}
                      className="analysis-input"
                    />
                  </div>

                  <div className="analysis-input-group">
                    <label>Estimated Repair Cost (optional)</label>
                    <input
                      type="number"
                      placeholder="e.g., 25000"
                      value={analysisData.estimated_repair_cost}
                      onChange={(e) => handleAnalysisDataChange('estimated_repair_cost', e.target.value)}
                      className="analysis-input"
                    />
                  </div>
                </div>
              ) : analysisMode && propertyAnalysis ? (
                // Analysis Results View
                <div className="analysis-results">
                  <div className="analysis-header">
                    <h3>Deal Analysis Results</h3>
                    <div className="overall-score" style={{
                      backgroundColor: propertyAnalysis.green_light ? '#4caf50' : 
                                     propertyAnalysis.yellow_light ? '#ff9800' : '#f44336'
                    }}>
                      {getAnalysisLabelFromLights(propertyAnalysis)}
                    </div>
                  </div>

                  <div className="analysis-section">
                    <h4>Investment Type: <span className="type-badge">{propertyAnalysis.analysis_type?.toUpperCase() || 'UNKNOWN'}</span></h4>
                    <p className="recommendation">{propertyAnalysis.recommendation}</p>
                  </div>

                  <div className="analysis-section">
                    <h4>State Compliance</h4>
                    <p style={{ color: propertyAnalysis.state_pass ? '#4caf50' : '#f44336' }}>
                      {propertyAnalysis.state_pass_reason}
                    </p>
                  </div>

                  {propertyAnalysis.criteria_breakdown && (
                    <div className="analysis-section">
                      <h4>Analysis Criteria Detail ({propertyAnalysis.criteria_breakdown.passed_count} Passed, {propertyAnalysis.criteria_breakdown.failed_count} Failed)</h4>
                      
                      {propertyAnalysis.criteria_breakdown.passed && propertyAnalysis.criteria_breakdown.passed.length > 0 && (
                        <div style={{ marginBottom: '15px' }}>
                          <h5 style={{ color: '#4caf50', marginBottom: '8px' }}>✓ PASSED Tests:</h5>
                          <ul className="criteria-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
                            {propertyAnalysis.criteria_breakdown.passed.map((item, idx) => (
                              <li key={idx} style={{ 
                                padding: '8px', 
                                marginBottom: '4px', 
                                backgroundColor: '#e8f5e9', 
                                border: '1px solid #4caf50',
                                borderRadius: '4px',
                                color: '#2e7d32'
                              }}>
                                <strong>✓ {item.criterion}</strong>
                                {item.value && <span> — {item.value}</span>}
                                {item.status && <span> ({item.status})</span>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {propertyAnalysis.criteria_breakdown.failed && propertyAnalysis.criteria_breakdown.failed.length > 0 && (
                        <div>
                          <h5 style={{ color: '#f44336', marginBottom: '8px' }}>✗ FAILED Tests:</h5>
                          <ul className="criteria-list" style={{ listStyle: 'none', paddingLeft: 0 }}>
                            {propertyAnalysis.criteria_breakdown.failed.map((item, idx) => (
                              <li key={idx} style={{ 
                                padding: '8px', 
                                marginBottom: '4px', 
                                backgroundColor: '#ffebee', 
                                border: '1px solid #f44336',
                                borderRadius: '4px',
                                color: '#c62828'
                              }}>
                                <strong>✗ {item.criterion}</strong>
                                {item.value && <span> — {item.value}</span>}
                                {item.reason && <div style={{ fontSize: '0.9em', marginTop: '4px' }}>Reason: {item.reason}</div>}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}

                  {propertyAnalysis.subto_criteria_met !== undefined && !propertyAnalysis.criteria_breakdown && (
                    <div className="analysis-section">
                      <h4>SubTo Criteria</h4>
                      <p style={{ color: propertyAnalysis.subto_criteria_met ? '#4caf50' : '#f44336' }}>
                        {propertyAnalysis.subto_criteria_met ? '✓ PASS' : '✗ FAIL'}
                      </p>
                      {propertyAnalysis.subto_failures && propertyAnalysis.subto_failures.length > 0 && (
                        <ul className="failures-list">
                          {propertyAnalysis.subto_failures.map((failure, idx) => (
                            <li key={idx} style={{ color: '#f44336' }}>• {failure}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {propertyAnalysis.owner_financing_criteria_met !== undefined && !propertyAnalysis.criteria_breakdown && (
                    <div className="analysis-section">
                      <h4>Owner Financing Criteria</h4>
                      <p style={{ color: propertyAnalysis.owner_financing_criteria_met ? '#4caf50' : '#f44336' }}>
                        {propertyAnalysis.owner_financing_criteria_met ? '✓ PASS' : '✗ FAIL'}
                      </p>
                      {propertyAnalysis.owner_financing_failures && propertyAnalysis.owner_financing_failures.length > 0 && (
                        <ul className="failures-list">
                          {propertyAnalysis.owner_financing_failures.map((failure, idx) => (
                            <li key={idx} style={{ color: '#f44336' }}>• {failure}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {propertyAnalysis.multi_family_criteria_met !== undefined && !propertyAnalysis.criteria_breakdown && (
                    <div className="analysis-section">
                      <h4>Multi-Family Criteria</h4>
                      <p style={{ color: propertyAnalysis.multi_family_criteria_met ? '#4caf50' : '#f44336' }}>
                        {propertyAnalysis.multi_family_criteria_met ? '✓ PASS' : '✗ FAIL'}
                      </p>
                      {propertyAnalysis.multi_family_failures && propertyAnalysis.multi_family_failures.length > 0 && (
                        <ul className="failures-list">
                          {propertyAnalysis.multi_family_failures.map((failure, idx) => (
                            <li key={idx} style={{ color: '#f44336' }}>• {failure}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {propertyAnalysis.financial_summary && (
                    <div className="analysis-section">
                      <h4>Financial Summary</h4>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '15px' }}>
                        {propertyAnalysis.financial_summary.monthly_noi !== undefined && (
                          <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9em' }}>Monthly NOI</p>
                            <p style={{ margin: 0, fontSize: '1.2em', fontWeight: 'bold', color: '#2196f3' }}>
                              ${(propertyAnalysis.financial_summary.monthly_noi || 0).toFixed(2)}
                            </p>
                          </div>
                        )}
                        {propertyAnalysis.financial_summary.annual_noi !== undefined && (
                          <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9em' }}>Annual NOI</p>
                            <p style={{ margin: 0, fontSize: '1.2em', fontWeight: 'bold', color: '#2196f3' }}>
                              ${(propertyAnalysis.financial_summary.annual_noi || 0).toFixed(2)}
                            </p>
                          </div>
                        )}
                        {propertyAnalysis.financial_summary.monthly_mortgage !== undefined && (
                          <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9em' }}>Monthly Payment</p>
                            <p style={{ margin: 0, fontSize: '1.2em', fontWeight: 'bold', color: '#2196f3' }}>
                              ${(propertyAnalysis.financial_summary.monthly_mortgage || 0).toFixed(2)}
                            </p>
                          </div>
                        )}
                        {propertyAnalysis.financial_summary.cash_on_cash !== undefined && (
                          <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9em' }}>Cash-on-Cash Return</p>
                            <p style={{ margin: 0, fontSize: '1.2em', fontWeight: 'bold', color: '#2196f3' }}>
                              {(propertyAnalysis.financial_summary.cash_on_cash || 0).toFixed(2)}%
                            </p>
                          </div>
                        )}
                        {propertyAnalysis.financial_summary.equity_percentage !== undefined && (
                          <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9em' }}>Equity</p>
                            <p style={{ margin: 0, fontSize: '1.2em', fontWeight: 'bold', color: '#2196f3' }}>
                              {(propertyAnalysis.financial_summary.equity_percentage || 0).toFixed(2)}%
                            </p>
                          </div>
                        )}
                        {propertyAnalysis.input_assumptions?.estimated_defaults?.rental_income?.value !== undefined && (
                          <div style={{ padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                            <p style={{ margin: '0 0 5px 0', color: '#666', fontSize: '0.9em' }}>Monthly Gross Income</p>
                            <p style={{ margin: 0, fontSize: '1.2em', fontWeight: 'bold', color: '#2196f3' }}>
                              ${(Number(propertyAnalysis.input_assumptions.estimated_defaults.rental_income.value || 0) / 12).toFixed(2)}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {propertyAnalysis.dscr_loan_qualified !== undefined && (
                    <div className="analysis-section">
                      <h4>DSCR Loan Qualification</h4>
                      <p style={{ color: propertyAnalysis.dscr_loan_qualified ? '#4caf50' : '#f44336' }}>
                        {propertyAnalysis.dscr_loan_qualified ? '✓ QUALIFIED' : '✗ NOT QUALIFIED'}
                      </p>
                      <p>Monthly Required: ${propertyAnalysis.dscr_monthly_required?.toFixed(2)}</p>
                    </div>
                  )}

                  {propertyAnalysis.input_assumptions && (
                    <div className="analysis-section">
                      <h4>Input Data & Estimated Defaults</h4>
                      
                      <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Rental Income Calculation</h5>
                        {propertyAnalysis.input_assumptions.estimated_defaults?.rental_income && (
                          <div>
                            <p><strong>Estimated Monthly Rental Income: ${(Number(propertyAnalysis.input_assumptions.estimated_defaults.rental_income.value || 0) / 12).toFixed(2)}</strong></p>
                            <p><strong>Method:</strong> {propertyAnalysis.input_assumptions.estimated_defaults.rental_income.method}</p>
                            {propertyAnalysis.input_assumptions.estimated_defaults.rental_income.details && (
                              <div style={{ fontSize: '0.85em', color: '#555', marginTop: '8px', paddingLeft: '10px', borderLeft: '3px solid #ddd' }}>
                                <p><strong>Calculation Details:</strong></p>
                                <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordWrap: 'break-word' }}>
                                  {typeof propertyAnalysis.input_assumptions.estimated_defaults.rental_income.details === 'string'
                                    ? propertyAnalysis.input_assumptions.estimated_defaults.rental_income.details
                                    : JSON.stringify(propertyAnalysis.input_assumptions.estimated_defaults.rental_income.details, null, 2)}
                                </pre>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Property Valuation</h5>
                        <div className="detail-row" style={{ marginBottom: '8px' }}>
                          <span><strong>Listing Price:</strong> ${propertyAnalysis.input_assumptions.valuation?.listing_price?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="detail-row" style={{ marginBottom: '8px' }}>
                          <span><strong>Estimated ARV:</strong> ${propertyAnalysis.input_assumptions.estimated_defaults?.estimated_arv?.value?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="detail-row" style={{ marginBottom: '8px' }}>
                          <span><strong>Estimated Repair Cost:</strong> ${propertyAnalysis.input_assumptions.estimated_defaults?.estimated_repair_cost?.value?.toLocaleString() || 'N/A'}</span>
                        </div>
                        <div className="detail-row" style={{ marginBottom: '8px' }}>
                          <span><strong>Market Value:</strong> ${propertyAnalysis.input_assumptions.valuation?.market_value?.toLocaleString() || 'N/A'}</span>
                        </div>
                      </div>

                      <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                        <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Property Characteristics</h5>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                          <div><strong>Bedrooms:</strong> {propertyAnalysis.input_assumptions.property_data?.bedrooms}</div>
                          <div><strong>Bathrooms:</strong> {propertyAnalysis.input_assumptions.property_data?.bathrooms}</div>
                          <div><strong>Units:</strong> {propertyAnalysis.input_assumptions.property_data?.units}</div>
                          <div><strong>Square Feet:</strong> {propertyAnalysis.input_assumptions.property_data?.sqft?.toLocaleString()}</div>
                          <div><strong>Year Built:</strong> {propertyAnalysis.input_assumptions.property_data?.year_built}</div>
                          <div><strong>Owner Occupied:</strong> {propertyAnalysis.input_assumptions.property_data?.owner_occupied ? 'Yes' : 'No'}</div>
                        </div>
                      </div>

                      {propertyAnalysis.input_assumptions.estimated_defaults?.mortgage_principal && (
                        <div style={{ marginBottom: '15px', padding: '10px', backgroundColor: '#f5f5f5', borderRadius: '4px' }}>
                          <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Mortgage Assumptions</h5>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div><strong>Principal:</strong> ${propertyAnalysis.input_assumptions.estimated_defaults.mortgage_principal?.toLocaleString()}</div>
                            <div><strong>Rate:</strong> {Number(propertyAnalysis.input_assumptions.estimated_defaults.mortgage_rate || 0).toFixed(2)}%</div>
                            <div><strong>Term (years):</strong> {propertyAnalysis.input_assumptions.estimated_defaults.mortgage_term}</div>
                          </div>
                        </div>
                      )}

                      <div style={{ fontSize: '0.8em', color: '#999', marginTop: '10px' }}>
                        <p>Analysis completed: {new Date(propertyAnalysis.input_assumptions.analysis_timestamp).toLocaleString()}</p>
                      </div>
                    </div>
                  )}

                  {propertyAnalysis.financing_scenarios && (
                    <div className="analysis-section">
                      <h4>💰 Financing Scenarios & Options</h4>

                      {/* ASSUMPTIONS SECTION */}
                      {propertyAnalysis.financing_scenarios.assumptions && (
                        <div style={{ marginBottom: '25px', padding: '15px', backgroundColor: '#f9f9f9', border: '1px solid #e0e0e0', borderRadius: '6px' }}>
                          <h5 style={{ marginTop: 0, marginBottom: '12px', color: '#333' }}>Investment Assumptions</h5>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px', fontSize: '0.9em' }}>
                            <div style={{ position: 'relative' }}>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#555' }}>
                                Monthly Gross Rent
                                {editingExpenses && <span style={{ marginLeft: '10px', fontSize: '0.8em', color: '#2196f3' }}>✎ Editable</span>}
                              </p>
                              {editingExpenses ? (
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.9em', color: '#666' }}>Monthly:</span>
                                  <input
                                    type="number"
                                    value={customGrossMonthlyRent}
                                    onChange={(e) => setCustomGrossMonthlyRent(e.target.value ? parseFloat(e.target.value) : null)}
                                    style={{ width: '100px', padding: '4px', fontSize: '0.9em', border: '1px solid #ccc', borderRadius: '3px' }}
                                  />
                                </div>
                              ) : (
                                <p style={{ margin: 0, color: '#2196f3', fontSize: '1.1em' }}>
                                  ${(propertyAnalysis.financing_scenarios.assumptions.gross_monthly_rent || 0).toFixed(2)}/mo
                                  <span style={{ marginLeft: '10px', fontSize: '0.85em', color: '#999' }}>
                                    (Annual: ${((propertyAnalysis.financing_scenarios.assumptions.gross_monthly_rent || 0) * 12).toLocaleString('en-US', { maximumFractionDigits: 0 })})
                                  </span>
                                </p>
                              )}
                            </div>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#555' }}>Vacancy (5%)</p>
                              <p style={{ margin: 0, color: '#e65100' }}>
                                -${(propertyAnalysis.financing_scenarios.assumptions.vacancy.monthly_amount || 0).toFixed(2)}/mo
                              </p>
                            </div>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#555' }}>Maintenance (10%)</p>
                              <p style={{ margin: 0, color: '#e65100' }}>
                                -${(propertyAnalysis.financing_scenarios.assumptions.maintenance.monthly_amount || 0).toFixed(2)}/mo
                              </p>
                            </div>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#555' }}>CapEx (5%)</p>
                              <p style={{ margin: 0, color: '#e65100' }}>
                                -${(propertyAnalysis.financing_scenarios.assumptions.capex.monthly_amount || 0).toFixed(2)}/mo
                              </p>
                            </div>
                            <div style={{ position: 'relative' }}>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#555' }}>
                                Taxes ({propertyAnalysis.financing_scenarios.assumptions.taxes.label})
                                {editingExpenses && <span style={{ marginLeft: '10px', fontSize: '0.8em', color: '#2196f3' }}>✎ Editable</span>}
                              </p>
                              {editingExpenses ? (
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.9em', color: '#666' }}>Annual:</span>
                                  <input
                                    type="number"
                                    value={customTaxAnnual}
                                    onChange={(e) => setCustomTaxAnnual(e.target.value ? parseFloat(e.target.value) : null)}
                                    style={{ width: '100px', padding: '4px', fontSize: '0.9em', border: '1px solid #ccc', borderRadius: '3px' }}
                                  />
                                </div>
                              ) : (
                                <p style={{ margin: 0, color: '#e65100' }}>
                                  -${(propertyAnalysis.financing_scenarios.assumptions.taxes.monthly_amount || 0).toFixed(2)}/mo
                                  <span style={{ marginLeft: '10px', fontSize: '0.85em', color: '#999' }}>
                                    (Annual: ${(propertyAnalysis.financing_scenarios.assumptions.taxes.annual_amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })})
                                  </span>
                                </p>
                              )}
                            </div>
                            <div style={{ position: 'relative' }}>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#555' }}>
                                Insurance ({propertyAnalysis.financing_scenarios.assumptions.insurance.label})
                                {editingExpenses && <span style={{ marginLeft: '10px', fontSize: '0.8em', color: '#2196f3' }}>✎ Editable</span>}
                              </p>
                              {editingExpenses ? (
                                <div style={{ display: 'flex', gap: '5px', alignItems: 'center' }}>
                                  <span style={{ fontSize: '0.9em', color: '#666' }}>Annual:</span>
                                  <input
                                    type="number"
                                    value={customInsuranceAnnual}
                                    onChange={(e) => setCustomInsuranceAnnual(e.target.value ? parseFloat(e.target.value) : null)}
                                    style={{ width: '100px', padding: '4px', fontSize: '0.9em', border: '1px solid #ccc', borderRadius: '3px' }}
                                  />
                                </div>
                              ) : (
                                <p style={{ margin: 0, color: '#e65100' }}>
                                  -${(propertyAnalysis.financing_scenarios.assumptions.insurance.monthly_amount || 0).toFixed(2)}/mo
                                  <span style={{ marginLeft: '10px', fontSize: '0.85em', color: '#999' }}>
                                    (Annual: ${(propertyAnalysis.financing_scenarios.assumptions.insurance.annual_amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })})
                                  </span>
                                </p>
                              )}
                            </div>
                            <div style={{ gridColumn: 'span 2', borderTop: '2px solid #ccc', paddingTop: '10px', marginTop: '5px' }}>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Monthly NOI</p>
                              <p style={{ margin: 0, color: '#4caf50', fontSize: '1.2em', fontWeight: 'bold' }}>
                                ${(propertyAnalysis.financing_scenarios.assumptions.monthly_noi || 0).toFixed(2)}/mo
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* EDIT / RECALCULATE BUTTONS */}
                      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px', justifyContent: 'center' }}>
                        {!editingExpenses ? (
                          <button
                            onClick={() => setEditingExpenses(true)}
                            style={{
                              padding: '10px 20px',
                              backgroundColor: '#2196f3',
                              color: 'white',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontSize: '0.95em',
                              fontWeight: 'bold'
                            }}
                          >
                            ✎ Edit Tax & Insurance
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={handleRecalculateScenarios}
                              disabled={recalculating}
                              style={{
                                padding: '10px 20px',
                                backgroundColor: '#4caf50',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: recalculating ? 'not-allowed' : 'pointer',
                                fontSize: '0.95em',
                                fontWeight: 'bold',
                                opacity: recalculating ? 0.7 : 1
                              }}
                            >
                              {recalculating ? 'Recalculating...' : '✓ Recalculate All Scenarios'}
                            </button>
                            <button
                              onClick={() => {
                                setEditingExpenses(false);
                                setCustomTaxAnnual(propertyAnalysis.financing_scenarios.assumptions.taxes.annual_amount);
                                setCustomInsuranceAnnual(propertyAnalysis.financing_scenarios.assumptions.insurance.annual_amount);
                              }}
                              style={{
                                padding: '10px 20px',
                                backgroundColor: '#f44336',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                fontSize: '0.95em',
                                fontWeight: 'bold'
                              }}
                            >
                              ✗ Cancel
                            </button>
                          </>
                        )}
                      </div>

                      {/* SCENARIOS TABLE */}
                      {propertyAnalysis.financing_scenarios.scenarios && propertyAnalysis.financing_scenarios.scenarios.length > 0 && (
                        <div style={{ marginBottom: '25px', overflowX: 'auto' }}>
                          <h5 style={{ marginTop: 0, marginBottom: '10px' }}>Seller Finance Scenarios</h5>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85em' }}>
                            <thead>
                              <tr style={{ backgroundColor: '#2196f3', color: 'white' }}>
                                <th style={{ padding: '10px', textAlign: 'left', fontWeight: 'bold' }}>Scenario</th>
                                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Offer Price</th>
                                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Down Payment</th>
                                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Terms</th>
                                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Monthly Payment</th>
                                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>Monthly Cash Flow</th>
                                <th style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>CoC Return</th>
                                <th style={{ padding: '10px', textAlign: 'center', fontWeight: 'bold' }}>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {propertyAnalysis.financing_scenarios.scenarios.map((scenario, idx) => {
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
                                    <td style={{ padding: '10px', textAlign: 'right' }}>${(scenario.offer_price || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}</td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                      ${(scenario.down_payment || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                      <div style={{ fontSize: '0.8em', color: '#999' }}>({scenario.down_payment_percent}%)</div>
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right' }}>
                                      {scenario.interest_rate}% @ {scenario.term_years}yr
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>${(scenario.monthly_payment || 0).toFixed(2)}</td>
                                    <td style={{ padding: '10px', textAlign: 'right', color: scenario.monthly_cash_flow > 0 ? '#4caf50' : '#f44336', fontWeight: 'bold' }}>
                                      ${(scenario.monthly_cash_flow || 0).toFixed(2)}
                                    </td>
                                    <td style={{ padding: '10px', textAlign: 'right', fontWeight: 'bold' }}>{(scenario.cash_on_cash || 0).toFixed(1)}%</td>
                                    <td style={{ padding: '10px', textAlign: 'center', backgroundColor: statusColor, color: 'white', fontWeight: 'bold', borderRadius: '4px' }}>
                                      {scenario.status}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          {propertyAnalysis.financing_scenarios.summary && (
                            <p style={{ fontSize: '0.8em', color: '#666', marginTop: '10px' }}>
                              <strong>Summary:</strong> {propertyAnalysis.financing_scenarios.summary.strong_scenarios} Strong • {propertyAnalysis.financing_scenarios.summary.acceptable_scenarios} Acceptable • {propertyAnalysis.financing_scenarios.summary.weak_scenarios} Weak scenarios
                            </p>
                          )}
                        </div>
                      )}

                      {/* DSCR LOAN COMPARISON */}
                      {propertyAnalysis.financing_scenarios.dscr_loan && (
                        <div style={{ marginBottom: '15px', padding: '15px', backgroundColor: '#e3f2fd', border: '1px solid #2196f3', borderRadius: '6px' }}>
                          <h5 style={{ marginTop: 0, marginBottom: '12px', color: '#1976d2' }}>💳 Traditional DSCR Loan Comparison</h5>
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px', fontSize: '0.9em' }}>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Down Payment (20%)</p>
                              <p style={{ margin: 0, color: '#2196f3', fontSize: '1.1em', fontWeight: 'bold' }}>
                                ${(propertyAnalysis.financing_scenarios.dscr_loan.down_payment || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                              </p>
                            </div>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Interest Rate</p>
                              <p style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>
                                {propertyAnalysis.financing_scenarios.dscr_loan.interest_rate}% ({propertyAnalysis.financing_scenarios.dscr_loan.term_years}yr)
                              </p>
                            </div>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Monthly Payment</p>
                              <p style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>
                                ${(propertyAnalysis.financing_scenarios.dscr_loan.monthly_payment || 0).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Monthly Cash Flow</p>
                              <p style={{ margin: 0, color: propertyAnalysis.financing_scenarios.dscr_loan.monthly_cash_flow > 0 ? '#4caf50' : '#f44336', fontSize: '1.1em', fontWeight: 'bold' }}>
                                ${(propertyAnalysis.financing_scenarios.dscr_loan.monthly_cash_flow || 0).toFixed(2)}
                              </p>
                            </div>
                            <div>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>Cash-on-Cash Return</p>
                              <p style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold' }}>
                                {(propertyAnalysis.financing_scenarios.dscr_loan.cash_on_cash || 0).toFixed(1)}%
                              </p>
                            </div>
                            <div style={{ gridColumn: 'span auto' }}>
                              <p style={{ margin: '0 0 5px 0', fontWeight: 'bold', color: '#333' }}>DSCR Ratio</p>
                              <p style={{ margin: 0, fontSize: '1.1em', fontWeight: 'bold', color: propertyAnalysis.financing_scenarios.dscr_loan.dscr_ratio >= 1.25 ? '#4caf50' : '#f44336' }}>
                                {(propertyAnalysis.financing_scenarios.dscr_loan.dscr_ratio || 0).toFixed(2)} {propertyAnalysis.financing_scenarios.dscr_loan.dscr_ratio >= 1.25 ? '✓' : '✗'}
                              </p>
                              <p style={{ margin: '3px 0 0 0', fontSize: '0.8em', color: '#666' }}>
                                (Req: {propertyAnalysis.financing_scenarios.dscr_loan.dscr_required})
                              </p>
                            </div>
                          </div>
                          <p style={{ margin: '12px 0 0 0', fontSize: '0.85em', fontStyle: 'italic', color: '#1976d2' }}>
                            {propertyAnalysis.financing_scenarios.dscr_loan.dscr_note}
                          </p>
                          
                          {/* QUALIFYING OFFER PRICE */}
                          {propertyAnalysis.financing_scenarios.dscr_loan.qualifying_offer_price !== undefined && (
                            <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#fff3e0', border: '2px solid #ff9800', borderRadius: '6px' }}>
                              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#f57c00' }}>
                                🎯 To Qualify for DSCR Loan (1.25 minimum):
                              </p>
                              {propertyAnalysis.financing_scenarios.dscr_loan.qualifying_offer_price !== null ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                                  <div>
                                    <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#e65100', fontWeight: 'bold' }}>Purchase Price</p>
                                    <p style={{ margin: '0', fontSize: '1.3em', fontWeight: 'bold', color: '#ff6f00' }}>
                                      ${(propertyAnalysis.financing_scenarios.dscr_loan.qualifying_offer_price || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </p>
                                  </div>
                                  <div>
                                    <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#e65100', fontWeight: 'bold' }}>Down Payment (20%)</p>
                                    <p style={{ margin: '0', fontSize: '1.1em', fontWeight: 'bold', color: '#ff6f00' }}>
                                      ${(propertyAnalysis.financing_scenarios.dscr_loan.qualifying_down_payment || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </p>
                                  </div>
                                  <div>
                                    <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#e65100', fontWeight: 'bold' }}>CoC Return</p>
                                    <p style={{ margin: '0', fontSize: '1.1em', fontWeight: 'bold', color: '#ff6f00' }}>
                                      {propertyAnalysis.financing_scenarios.dscr_loan.qualifying_coc_return !== null 
                                        ? `${(propertyAnalysis.financing_scenarios.dscr_loan.qualifying_coc_return || 0).toFixed(1)}%`
                                        : 'N/A'
                                      }
                                    </p>
                                  </div>
                                </div>
                              ) : null}
                              <p style={{ margin: '12px 0 0 0', fontSize: '0.9em', color: '#e65100', fontStyle: 'italic' }}>
                                {propertyAnalysis.financing_scenarios.dscr_loan.qualifying_price_note}
                              </p>
                            </div>
                          )}

                          {/* ALTERNATIVE: HIGHER DOWN PAYMENT AT ASKING PRICE */}
                          {propertyAnalysis.financing_scenarios.dscr_loan.required_down_payment_percent !== undefined && 
                           propertyAnalysis.financing_scenarios.dscr_loan.required_down_payment_percent !== null && (
                            <div style={{ marginTop: '15px', padding: '12px', backgroundColor: '#e8f5e9', border: '2px solid #4caf50', borderRadius: '6px' }}>
                              <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', color: '#2e7d32' }}>
                                💰 Alternative: Buy at Asking Price with Higher Down Payment
                              </p>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
                                <div>
                                  <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#1b5e20', fontWeight: 'bold' }}>Purchase Price (Asking)</p>
                                  <p style={{ margin: '0', fontSize: '1.3em', fontWeight: 'bold', color: '#2e7d32' }}>
                                    ${(propertyAnalysis.financing_scenarios.dscr_loan.offer_price || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                  </p>
                                </div>
                                <div>
                                  <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#1b5e20', fontWeight: 'bold' }}>Down Payment ({propertyAnalysis.financing_scenarios.dscr_loan.required_down_payment_percent?.toFixed(1)}%)</p>
                                  <p style={{ margin: '0', fontSize: '1.1em', fontWeight: 'bold', color: '#2e7d32' }}>
                                    ${(propertyAnalysis.financing_scenarios.dscr_loan.required_down_payment_amount || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                  </p>
                                </div>
                                <div>
                                  <p style={{ margin: '5px 0 3px 0', fontSize: '0.9em', color: '#1b5e20', fontWeight: 'bold' }}>CoC Return</p>
                                  <p style={{ margin: '0', fontSize: '1.1em', fontWeight: 'bold', color: '#2e7d32' }}>
                                    {propertyAnalysis.financing_scenarios.dscr_loan.required_down_payment_coc !== null 
                                      ? `${(propertyAnalysis.financing_scenarios.dscr_loan.required_down_payment_coc || 0).toFixed(1)}%`
                                      : 'N/A'
                                    }
                                  </p>
                                </div>
                              </div>
                              <p style={{ margin: '12px 0 0 0', fontSize: '0.9em', color: '#1b5e20', fontStyle: 'italic' }}>
                                This scenario lets you buy at asking price but requires {propertyAnalysis.financing_scenarios.dscr_loan.required_down_payment_percent?.toFixed(1)}% down to achieve DSCR 1.25
                              </p>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : editMode && editedProperty ? (
                // Edit Mode
                <div className="property-details-grid edit-mode">
                  <div className="details-section">
                    <h3>Basic Information</h3>
                    <div className="detail-row">
                      <span className="label">MLS ID:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.mls_id || ''}
                        onChange={(e) => handleEditFieldChange('mls_id', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Address:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.address || ''}
                        onChange={(e) => handleEditFieldChange('address', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">City:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.city || ''}
                        onChange={(e) => handleEditFieldChange('city', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">State:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.state || ''}
                        onChange={(e) => handleEditFieldChange('state', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Zip Code:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.zip_code || ''}
                        onChange={(e) => handleEditFieldChange('zip_code', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">County:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.county || ''}
                        onChange={(e) => handleEditFieldChange('county', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="details-section">
                    <h3>Property Details</h3>
                    <div className="detail-row">
                      <span className="label">Bedrooms:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.bedrooms || ''}
                        onChange={(e) => handleEditFieldChange('bedrooms', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Bathrooms:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.bathrooms || ''}
                        onChange={(e) => handleEditFieldChange('bathrooms', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Living Sq Ft:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.living_square_feet || ''}
                        onChange={(e) => handleEditFieldChange('living_square_feet', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Lot Acres:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.lot_acres || ''}
                        onChange={(e) => handleEditFieldChange('lot_acres', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Lot Sq Ft:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.lot_square_feet || ''}
                        onChange={(e) => handleEditFieldChange('lot_square_feet', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Year Built:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.year_built || ''}
                        onChange={(e) => handleEditFieldChange('year_built', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Property Type:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.property_type || ''}
                        onChange={(e) => handleEditFieldChange('property_type', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Stories:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.stories || ''}
                        onChange={(e) => handleEditFieldChange('stories', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="details-section">
                    <h3>Listing Information</h3>
                    <div className="detail-row">
                      <span className="label">Listing Price:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.listing_price || ''}
                        onChange={(e) => handleEditFieldChange('listing_price', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Status:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.listing_status || ''}
                        onChange={(e) => handleEditFieldChange('listing_status', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Days on Market:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.days_on_market || ''}
                        onChange={(e) => handleEditFieldChange('days_on_market', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Last Updated:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.last_updated || ''}
                        onChange={(e) => handleEditFieldChange('last_updated', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Market Value:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.market_value || ''}
                        onChange={(e) => handleEditFieldChange('market_value', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Estimated Equity:</span>
                      <input
                        type="number"
                        className="edit-input"
                        value={editedProperty.estimated_equity || ''}
                        onChange={(e) => handleEditFieldChange('estimated_equity', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="details-section">
                    <h3>Agent & Owner Information</h3>
                    <div className="detail-row">
                      <span className="label">Agent Name:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.agent_name || ''}
                        onChange={(e) => handleEditFieldChange('agent_name', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Agent Email:</span>
                      <input
                        type="email"
                        className="edit-input"
                        value={editedProperty.agent_email || ''}
                        onChange={(e) => handleEditFieldChange('agent_email', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Agent Phone:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.agent_phone || ''}
                        onChange={(e) => handleEditFieldChange('agent_phone', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Owner First Name:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.owner1_first_name || ''}
                        onChange={(e) => handleEditFieldChange('owner1_first_name', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Owner Last Name:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.owner1_last_name || ''}
                        onChange={(e) => handleEditFieldChange('owner1_last_name', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Owner Occupied:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.owner_occupied || ''}
                        onChange={(e) => handleEditFieldChange('owner_occupied', e.target.value)}
                      />
                    </div>
                    <div className="detail-row">
                      <span className="label">Brokerage:</span>
                      <input
                        type="text"
                        className="edit-input"
                        value={editedProperty.brokerage_name || ''}
                        onChange={(e) => handleEditFieldChange('brokerage_name', e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="property-details-grid">
                  <div className="details-section">
                    <h3>Basic Information</h3>
                    <div className="detail-row">
                      <span className="label">MLS ID:</span>
                      <span className="value">{selectedProperty.mls_id || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Address:</span>
                      <span className="value">{selectedProperty.address}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">City:</span>
                      <span className="value">{selectedProperty.city}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">State:</span>
                      <span className="value">{selectedProperty.state}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Zip Code:</span>
                      <span className="value">{selectedProperty.zip_code}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">County:</span>
                      <span className="value">{selectedProperty.county}</span>
                    </div>
                  </div>

                  <div className="details-section">
                    <h3>Property Details</h3>
                    <div className="detail-row">
                      <span className="label">Bedrooms:</span>
                      <span className="value">{selectedProperty.bedrooms || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Bathrooms:</span>
                      <span className="value">{selectedProperty.bathrooms || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Living Sq Ft:</span>
                      <span className="value">{selectedProperty.living_square_feet ? parseInt(selectedProperty.living_square_feet).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Lot Acres:</span>
                      <span className="value">{selectedProperty.lot_acres || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Lot Sq Ft:</span>
                      <span className="value">{selectedProperty.lot_square_feet ? parseInt(selectedProperty.lot_square_feet).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Year Built:</span>
                      <span className="value">{selectedProperty.year_built || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Property Type:</span>
                      <span className="value">{selectedProperty.property_type || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Stories:</span>
                      <span className="value">{selectedProperty.stories || 'N/A'}</span>
                    </div>
                  </div>

                  <div className="details-section">
                    <h3>Listing Information</h3>
                    <div className="detail-row">
                      <span className="label">Listing Price:</span>
                      <span className="value">${selectedProperty.listing_price ? parseInt(selectedProperty.listing_price).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Status:</span>
                      <span className="value">{selectedProperty.listing_status || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Days on Market:</span>
                      <span className="value">{selectedProperty.days_on_market || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Last Updated:</span>
                      <span className="value">{selectedProperty.last_updated || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Market Value:</span>
                      <span className="value">${selectedProperty.market_value ? parseInt(selectedProperty.market_value).toLocaleString() : 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Estimated Equity:</span>
                      <span className="value">${selectedProperty.estimated_equity ? parseInt(selectedProperty.estimated_equity).toLocaleString() : 'N/A'}</span>
                    </div>
                  </div>

                  <div className="details-section">
                    <h3>Agent & Owner Information</h3>
                    <div className="detail-row">
                      <span className="label">Agent Name:</span>
                      <span className="value">{selectedProperty.agent_name || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Agent Email:</span>
                      <span className="value">{selectedProperty.agent_email || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Agent Phone:</span>
                      <span className="value">{selectedProperty.agent_phone || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Owner Name:</span>
                      <span className="value">
                        {selectedProperty.owner1_first_name || selectedProperty.owner1_last_name
                          ? `${selectedProperty.owner1_first_name || ''} ${selectedProperty.owner1_last_name || ''}`.trim()
                          : 'N/A'}
                      </span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Owner Occupied:</span>
                      <span className="value">{selectedProperty.owner_occupied || 'N/A'}</span>
                    </div>
                    <div className="detail-row">
                      <span className="label">Brokerage:</span>
                      <span className="value">{selectedProperty.brokerage_name || 'N/A'}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              {analysisInputMode ? (
                <>
                  <button 
                    onClick={handleAnalyzeClick} 
                    className="modal-btn analyze-btn"
                    disabled={analyzingId === selectedProperty.id}
                  >
                    {analyzingId === selectedProperty.id ? (
                      <>
                        <span className="spinner"></span>
                        Analyzing...
                      </>
                    ) : (
                      '🔍 Analyze Deal'
                    )}
                  </button>
                  <button 
                    onClick={() => setAnalysisInputMode(false)} 
                    className="modal-btn cancel-btn"
                    disabled={analyzingId === selectedProperty.id}
                  >
                    Cancel
                  </button>
                </>
              ) : analysisMode ? (
                <>
                  <button 
                    onClick={handleCloseAnalysis} 
                    className="modal-btn"
                  >
                    Back to Details
                  </button>
                  <button 
                    onClick={() => setSelectedProperty(null)} 
                    className="modal-btn"
                  >
                    Close
                  </button>
                </>
              ) : editMode ? (
                <>
                  <button 
                    onClick={handleSaveEdit} 
                    className="modal-btn save-btn"
                    disabled={savingEdit}
                  >
                    {savingEdit ? (
                      <>
                        <span className="spinner"></span>
                        Saving...
                      </>
                    ) : (
                      '💾 Save Changes'
                    )}
                  </button>
                  <button 
                    onClick={handleEditCancel} 
                    className="modal-btn cancel-btn"
                    disabled={savingEdit}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <>
                  <button 
                    onClick={handleOpenAnalysisForm} 
                    className="modal-btn analyze-btn"
                  >
                    🔍 Analyze Deal
                  </button>
                  <button 
                    onClick={handleEditClick} 
                    className="modal-btn edit-btn"
                  >
                    ✏️ Edit
                  </button>
                  <button 
                    onClick={() => setSelectedProperty(null)} 
                    className="modal-btn"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="properties-footer">
        <p>Showing {filteredProperties.length} of {properties.length} properties</p>
      </div>
    </div>
  );
}
