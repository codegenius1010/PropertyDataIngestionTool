import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link } from 'react-router-dom';
import UploadPage from './pages/UploadPage';
import HistoryPage from './pages/HistoryPage';
import PropertiesPage from './pages/PropertiesPage';
import AnalysisResultsPage from './pages/AnalysisResultsPage';
import DetailedAnalysisPage from './pages/DetailedAnalysisPage';
import './App.css';

function App() {
  return (
    <Router>
      <div className="app">
        <nav className="navbar">
          <div className="nav-container">
            <Link to="/" className="nav-brand">
              📊 Property Data Ingestion Tool
            </Link>
            <ul className="nav-menu">
              <li className="nav-item">
                <Link to="/" className="nav-link">Upload CSV</Link>
              </li>
              <li className="nav-item">
                <Link to="/properties" className="nav-link">Properties</Link>
              </li>
              <li className="nav-item">
                <Link to="/analysis" className="nav-link">Analysis</Link>
              </li>
              <li className="nav-item">
                <Link to="/history" className="nav-link">Load History</Link>
              </li>
            </ul>
          </div>
        </nav>

        <main className="main-content">
          <Routes>
            <Route path="/" element={<UploadPage />} />
            <Route path="/properties" element={<PropertiesPage />} />
            <Route path="/analysis" element={<AnalysisResultsPage />} />
            <Route path="/analysis/:propertyId" element={<DetailedAnalysisPage />} />
            <Route path="/history" element={<HistoryPage />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
