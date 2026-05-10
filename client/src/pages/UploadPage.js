import React, { useState } from 'react';
import axios from 'axios';
import './UploadPage.css';

function UploadPage() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const [triggerAutomations, setTriggerAutomations] = useState(true);
  const [bulkAnalyze, setBulkAnalyze] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.type === 'text/csv' || selectedFile.name.endsWith('.csv')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please select a valid CSV file');
        setFile(null);
      }
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!file) {
      setError('Please select a file to upload');
      return;
    }

    setUploading(true);
    setError(null);

    const formData = new FormData();
    formData.append('csvFile', file);
    formData.append('triggerAutomations', triggerAutomations);
    formData.append('bulkAnalyze', bulkAnalyze);

    try {
      const response = await axios.post('/api/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setUploadResult(response.data);
      setFile(null);
      setUploading(false);
    } catch (err) {
      setError(err.response?.data?.message || 'Upload failed. Please try again.');
      setUploading(false);
    }
  };

  return (
    <div className="upload-page">
      <div className="upload-container">
        <h1>📤 Upload Property Data</h1>
        <p className="subtitle">Upload a CSV file with property information to ingest into the database</p>

        {error && <div className="alert alert-error">{error}</div>}
        {uploadResult && (
          <div className="alert alert-success">
            <h3>✅ Upload Started Successfully!</h3>
            <p><strong>Load ID:</strong> {uploadResult.loadId}</p>
            <p><strong>File:</strong> {uploadResult.fileName}</p>
            <p>The file is being processed. {bulkAnalyze ? 'All properties will be analyzed. ' : ''}Automations will be triggered for each property.</p>
            <p>You can monitor progress in the <a href="/history">Load History</a> page.</p>
          </div>
        )}

        <form onSubmit={handleUpload} className="upload-form">
          <div className="form-group">
            <label htmlFor="csvFile" className="file-input-label">
              <span className="file-input-text">
                {file ? file.name : 'Choose CSV File...'}
              </span>
              <input
                id="csvFile"
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                disabled={uploading}
                className="file-input"
              />
            </label>
            <p className="file-help">Select a CSV file with columns: Address, City, State, ZipCode, Price, AgentName, AgentPhone, AgentEmail, PropertyType, Bedrooms, Bathrooms, SquareFeet, LotSize, YearBuilt, MLSID, DaysOnMarket, Status</p>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={triggerAutomations}
                onChange={(e) => setTriggerAutomations(e.target.checked)}
                disabled={uploading}
              />
              <span>Automatically trigger GoHighLevel automations (emails & SMS)</span>
            </label>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={bulkAnalyze}
                onChange={(e) => setBulkAnalyze(e.target.checked)}
                disabled={uploading}
              />
              <span>🔍 Analyze all properties on import (shows investment recommendations)</span>
            </label>
            <p className="checkbox-help">Automatically analyze each property against your wholesale criteria and show green/yellow/red light recommendations</p>
          </div>

          <button 
            type="submit" 
            className="submit-btn"
            disabled={!file || uploading}
          >
            {uploading ? 'Uploading...' : 'Upload & Process'}
          </button>
        </form>

        <div className="csv-template">
          <h3>📋 Expected CSV Format</h3>
          <p>Your CSV file should include these columns:</p>
          <table className="template-table">
            <thead>
              <tr>
                <th>Column Name</th>
                <th>Type</th>
                <th>Required</th>
                <th>Example</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Address</td>
                <td>String</td>
                <td>Yes</td>
                <td>123 Main St</td>
              </tr>
              <tr>
                <td>City</td>
                <td>String</td>
                <td>Yes</td>
                <td>Des Moines</td>
              </tr>
              <tr>
                <td>State</td>
                <td>String</td>
                <td>Yes</td>
                <td>IA</td>
              </tr>
              <tr>
                <td>ZipCode</td>
                <td>String</td>
                <td>No</td>
                <td>50309</td>
              </tr>
              <tr>
                <td>Price</td>
                <td>Number</td>
                <td>No</td>
                <td>250000</td>
              </tr>
              <tr>
                <td>AgentName</td>
                <td>String</td>
                <td>Yes</td>
                <td>John Doe</td>
              </tr>
              <tr>
                <td>AgentEmail</td>
                <td>String</td>
                <td>Yes</td>
                <td>john@example.com</td>
              </tr>
              <tr>
                <td>AgentPhone</td>
                <td>String</td>
                <td>No</td>
                <td>555-1234</td>
              </tr>
              <tr>
                <td>PropertyType</td>
                <td>String</td>
                <td>No</td>
                <td>Single Family</td>
              </tr>
              <tr>
                <td>Bedrooms</td>
                <td>Number</td>
                <td>No</td>
                <td>3</td>
              </tr>
              <tr>
                <td>Bathrooms</td>
                <td>Number</td>
                <td>No</td>
                <td>2.5</td>
              </tr>
              <tr>
                <td>SquareFeet</td>
                <td>Number</td>
                <td>No</td>
                <td>2500</td>
              </tr>
              <tr>
                <td>MLSID</td>
                <td>String</td>
                <td>No</td>
                <td>DM123456</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default UploadPage;
