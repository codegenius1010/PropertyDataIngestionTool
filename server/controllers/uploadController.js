const fs = require('fs');
const path = require('path');
const csvProcessor = require('../services/csvProcessor');
const loadService = require('../services/loadService');
const goHighLevel = require('../services/goHighLevel');
const { analyzeProperty } = require('../services/dealAnalyzer');
const { estimatePropertyDefaults, updatePropertyWithEstimates } = require('../services/rentalEstimator');

class UploadController {
  /**
   * Handle CSV file upload and processing
   */
  async handleUpload(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({
          error: 'No file uploaded'
        });
      }

      // Create load record
      const loadId = await loadService.createLoad(
        req.file.originalname,
        req.file.path,
        req.body.uploadedBy || 'system'
      );

      // Process CSV asynchronously
      this.processCSVAsync(loadId, req.file.path, req.body);

      return res.json({
        success: true,
        loadId,
        message: 'File upload received and processing started',
        fileName: req.file.originalname
      });
    } catch (error) {
      console.error('Upload error:', error);
      res.status(500).json({
        error: 'Upload failed',
        message: error.message
      });
    }
  }

  /**
   * Process CSV file asynchronously (non-blocking)
   */
  async processCSVAsync(loadId, filePath, options = {}) {
    try {
      // Process CSV
      const results = await csvProcessor.processCSVFile(filePath, loadId);

      // Get the inserted properties to trigger automations
      const properties = await this.getLoadPropertiesForAutomations(loadId);

      // Estimate rental income and fill in property defaults
      console.log(`Estimating rental income and defaults for ${properties.length} properties in load ${loadId}`);
      await this.estimatePropertyDefaults(properties);

      // Run bulk analysis if requested
      if (options.bulkAnalyze === 'true' || options.bulkAnalyze === true) {
        console.log(`Starting bulk analysis for ${properties.length} properties in load ${loadId}`);
        await this.bulkAnalyzeProperties(properties);
      }

      // Trigger automations for each property
      if (options.triggerAutomations !== false) {
        await this.triggerPropertiesAutomations(properties, loadId, options);
      }

      // Update load with results
      await loadService.updateLoadResults(
        loadId,
        results.successCount,
        results.failureCount,
        'completed',
        results.errors.length > 0 ? JSON.stringify(results.errors.slice(0, 10)) : null
      );

      console.log(`Load ${loadId} completed: ${results.successCount} successful, ${results.failureCount} failed`);
    } catch (error) {
      console.error(`Error processing load ${loadId}:`, error);
      await loadService.updateLoadResults(
        loadId,
        0,
        0,
        'failed',
        error.message
      );
    }
  }

  /**
   * Estimate rental income and fill defaults for properties
   */
  async estimatePropertyDefaults(properties) {
    const pool = require('../config/database');
    let estimatedCount = 0;

    for (const property of properties) {
      try {
        const connection = await pool.getConnection();
        try {
          await updatePropertyWithEstimates(property, connection);
          estimatedCount++;
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error(`Failed to estimate defaults for property ${property.id}:`, error.message);
      }
    }

    console.log(`Property estimation complete: ${estimatedCount} properties updated with estimates`);
  }

  /**
   * Bulk analyze properties
   */
  async bulkAnalyzeProperties(properties) {
    const pool = require('../config/database');
    let analyzedCount = 0;
    let skippedCount = 0;

    for (const property of properties) {
      try {
        const analysis = analyzeProperty(property);

        // Skip incomplete analyses
        if (analysis.overall_score === 'INCOMPLETE') {
          skippedCount++;
          continue;
        }

        // Save analysis to database
        const connection = await pool.getConnection();
        try {
          const insertQuery = `
            INSERT INTO property_analysis (
              property_id,
              analysis_type,
              overall_score,
              state_pass,
              state_pass_reason,
              cashflow_positive,
              cashflow_amount,
              subto_criteria_met,
              subto_failures,
              owner_financing_criteria_met,
              owner_financing_failures,
              multi_family_criteria_met,
              multi_family_failures,
              dscr_loan_qualified,
              dscr_monthly_required,
              financing_option_asking,
              financing_option_asking_rate,
              financing_option_above_asking,
              financing_option_above_asking_rate,
              green_light,
              yellow_light,
              red_light,
              analysis_notes,
              recommendation
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
              overall_score = VALUES(overall_score),
              updated_at = NOW()
          `;

          const financingOpts = analysis.financing_options || {};
          const dscrAnalysis = analysis.dscr_analysis || {};

          await connection.execute(insertQuery, [
            property.id,
            analysis.analysis_type || 'unknown',
            analysis.overall_score || 'YELLOW',
            analysis.state_pass !== false ? true : false,
            analysis.state_pass_reason || '',
            analysis.cashflow_positive || false,
            analysis.cashflow_amount || 0,
            analysis.subto_criteria_met || false,
            analysis.subto_failures ? JSON.stringify(analysis.subto_failures) : '[]',
            analysis.owner_financing_criteria_met || false,
            analysis.owner_financing_failures ? JSON.stringify(analysis.owner_financing_failures) : '[]',
            analysis.multi_family_criteria_met || false,
            analysis.multi_family_failures ? JSON.stringify(analysis.multi_family_failures) : '[]',
            dscrAnalysis.qualified || false,
            dscrAnalysis.monthly_payment || 0,
            financingOpts.option_asking_4pct?.monthly_payment || 0,
            financingOpts.option_asking_4pct?.interest_rate || 4,
            financingOpts.option_above_asking_0pct?.monthly_payment || 0,
            financingOpts.option_above_asking_0pct?.interest_rate || 0,
            analysis.green_light || false,
            analysis.yellow_light || false,
            analysis.red_light || false,
            analysis.analysis_notes || '',
            analysis.recommendation || ''
          ]);

          analyzedCount++;
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error(`Failed to analyze property ${property.id}:`, error.message);
      }
    }

    console.log(`Bulk analysis complete: ${analyzedCount} analyzed, ${skippedCount} skipped`);
  }

  /**
   * Get upload status
   */
  async getUploadStatus(req, res) {
    try {
      const { uploadId } = req.params;
      const load = await loadService.getLoadById(uploadId);

      if (!load) {
        return res.status(404).json({
          error: 'Upload not found'
        });
      }

      res.json(load);
    } catch (error) {
      res.status(500).json({
        error: 'Failed to get upload status',
        message: error.message
      });
    }
  }

  /**
   * Get properties for a load to trigger automations
   */
  async getLoadPropertiesForAutomations(loadId) {
    const pool = require('../config/database');
    const connection = await pool.getConnection();
    try {
      const [properties] = await connection.execute(
        'SELECT * FROM properties WHERE load_id = ?',
        [loadId]
      );
      return properties;
    } finally {
      connection.release();
    }
  }

  /**
   * Trigger automations for all properties in a load
   */
  async triggerPropertiesAutomations(properties, loadId, options = {}) {
    const automationTypes = options.automationTypes || ['email', 'sms'];

    for (const property of properties) {
      for (const type of automationTypes) {
        try {
          await goHighLevel.triggerAutomation(property, loadId, type);
          console.log(`Triggered ${type} automation for property ${property.id}`);
        } catch (error) {
          console.error(`Failed to trigger ${type} automation for property ${property.id}:`, error);
        }
      }
    }
  }
}

module.exports = new UploadController();
