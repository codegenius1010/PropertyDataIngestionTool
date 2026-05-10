const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ limit: '50mb', extended: true }));

// Routes
const uploadRoutes = require('./routes/upload');
const loadsRoutes = require('./routes/loads');
const propertiesRoutes = require('./routes/properties');
const analysisRoutes = require('./routes/analysis');
const setupRoutes = require('./routes/setup');
const healthRoutes = require('./routes/health');

app.use('/api/upload', uploadRoutes);
app.use('/api/loads', loadsRoutes);
app.use('/api/properties', propertiesRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/setup', setupRoutes);
app.use('/api/health', healthRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
