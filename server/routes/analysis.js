const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { analyzeProperty, generateComprehensiveScenarios, syncAnalysisWithBaselineScenario } = require('../services/dealAnalyzer');
const { estimatePropertyDefaults, updatePropertyWithEstimates } = require('../services/rentalEstimator');

/**
 * POST /api/analysis/:propertyId
 * Analyze a single property and save results
 * First estimates and fills in property defaults (rental income, ARV, repairs)
 * Saves all input assumptions used in the analysis
 */
router.post('/:propertyId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // Fetch the property
    const [properties] = await connection.execute(
      'SELECT * FROM properties WHERE id = ?',
      [req.params.propertyId]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    let property = properties[0];

    // Estimate and update property with defaults
    const estimates = await estimatePropertyDefaults(property);
    await updatePropertyWithEstimates(property, connection);
    
    // Refresh property with updated estimates
    const [updatedProperties] = await connection.execute(
      'SELECT * FROM properties WHERE id = ?',
      [req.params.propertyId]
    );
    if (updatedProperties.length > 0) {
      property = updatedProperties[0];
    }

    // Run analysis with filled-in estimates
    const analysis = analyzeProperty(property);

    // Generate comprehensive scenarios for syncing
    const comprehensiveScenarios = generateComprehensiveScenarios(property, 0);
    
    // Sync analysis with baseline scenario (5% Down, 40% Income) so financial summary and criteria are consistent
    const syncedAnalysis = syncAnalysisWithBaselineScenario(analysis, comprehensiveScenarios, property);

    // Build comprehensive input_assumptions object
    const inputAssumptions = {
      property_data: {
        address: property.address,
        city: property.city,
        state: property.state,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        units: property.units_count,
        sqft: property.living_square_feet,
        year_built: property.year_built,
        property_type: property.property_type,
        owner_occupied: property.owner_occupied
      },
      estimated_defaults: {
        rental_income: {
          value: property.rental_income,
          method: estimates.estimation_method,
          details: estimates.calculation_details
        },
        estimated_arv: {
          value: property.estimated_arv,
          method: 'Market-based calculation'
        },
        estimated_repair_cost: {
          value: property.estimated_repair_cost,
          details: estimates.repair_calculation
        },
        mortgage_principal: property.mortgage_principal,
        mortgage_rate: property.mortgage_rate,
        mortgage_term: property.mortgage_term
      },
      valuation: {
        listing_price: property.listing_price,
        estimated_value: property.estimated_value,
        market_value: property.market_value
      },
      analysis_timestamp: new Date().toISOString()
    };

    // Save/update analysis results
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
        analysis_type = VALUES(analysis_type),
        overall_score = VALUES(overall_score),
        state_pass = VALUES(state_pass),
        state_pass_reason = VALUES(state_pass_reason),
        cashflow_positive = VALUES(cashflow_positive),
        cashflow_amount = VALUES(cashflow_amount),
        subto_criteria_met = VALUES(subto_criteria_met),
        subto_failures = VALUES(subto_failures),
        owner_financing_criteria_met = VALUES(owner_financing_criteria_met),
        owner_financing_failures = VALUES(owner_financing_failures),
        multi_family_criteria_met = VALUES(multi_family_criteria_met),
        multi_family_failures = VALUES(multi_family_failures),
        dscr_loan_qualified = VALUES(dscr_loan_qualified),
        dscr_monthly_required = VALUES(dscr_monthly_required),
        financing_option_asking = VALUES(financing_option_asking),
        financing_option_asking_rate = VALUES(financing_option_asking_rate),
        financing_option_above_asking = VALUES(financing_option_above_asking),
        financing_option_above_asking_rate = VALUES(financing_option_above_asking_rate),
        green_light = VALUES(green_light),
        yellow_light = VALUES(yellow_light),
        red_light = VALUES(red_light),
        analysis_notes = VALUES(analysis_notes),
        recommendation = VALUES(recommendation),
        updated_at = NOW()
    `;

    const financingOpts = syncedAnalysis.financing_options || {};
    const dscrAnalysis = syncedAnalysis.dscr_analysis || {};

    await connection.execute(insertQuery, [
      req.params.propertyId,
      syncedAnalysis.analysis_type || 'unknown',
      syncedAnalysis.overall_score || 'YELLOW',
      syncedAnalysis.state_pass !== false ? true : false,
      syncedAnalysis.state_pass_reason || '',
      syncedAnalysis.cashflow_positive || false,
      syncedAnalysis.cashflow_amount || 0,
      syncedAnalysis.subto_criteria_met || false,
      syncedAnalysis.subto_failures ? JSON.stringify(syncedAnalysis.subto_failures) : '[]',
      syncedAnalysis.owner_financing_criteria_met || false,
      syncedAnalysis.owner_financing_failures ? JSON.stringify(syncedAnalysis.owner_financing_failures) : '[]',
      syncedAnalysis.multi_family_criteria_met || false,
      syncedAnalysis.multi_family_failures ? JSON.stringify(syncedAnalysis.multi_family_failures) : '[]',
      dscrAnalysis.qualified || false,
      dscrAnalysis.monthly_payment || 0,
      financingOpts.option_asking_4pct?.monthly_payment || 0,
      financingOpts.option_asking_4pct?.interest_rate || 4,
      financingOpts.option_above_asking_0pct?.monthly_payment || 0,
      financingOpts.option_above_asking_0pct?.interest_rate || 0,
      syncedAnalysis.green_light || false,
      syncedAnalysis.yellow_light || false,
      syncedAnalysis.red_light || false,
      syncedAnalysis.analysis_notes || '',
      syncedAnalysis.recommendation || ''
    ]);

    res.json({
      success: true,
      message: 'Property analysis completed and saved',
      analysis: {
        ...syncedAnalysis,
        saved: true,
        input_assumptions: inputAssumptions
      }
    });
  } catch (error) {
    console.error('Error analyzing property:', error);
    res.status(500).json({ error: 'Failed to analyze property', details: error.message });
  } finally {
    connection.release();
  }
});

/**
 * GET /api/analysis/:propertyId
 * Retrieve existing analysis for a property
 * Returns full analysis data including DSCR scenario matrix and input assumptions
 * First estimates and fills in any missing property defaults
 */
router.get('/:propertyId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    // Fetch the property
    const [properties] = await connection.execute(
      'SELECT * FROM properties WHERE id = ?',
      [req.params.propertyId]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    let property = properties[0];

    // Always estimate and update property with defaults (especially rental income)
    const estimates = await estimatePropertyDefaults(property);
    await updatePropertyWithEstimates(property, connection);
    
    // Refresh property with updated estimates
    const [updatedProperties] = await connection.execute(
      'SELECT * FROM properties WHERE id = ?',
      [req.params.propertyId]
    );
    if (updatedProperties.length > 0) {
      property = updatedProperties[0];
    }

    // Fetch stored analysis results including input assumptions
    const [existingAnalysis] = await connection.execute(
      'SELECT * FROM property_analysis WHERE property_id = ?',
      [req.params.propertyId]
    );

    // Run fresh analysis to get full data including DSCR scenarios
    const analysis = analyzeProperty(property);

    // Build input assumptions with current property data
    const inputAssumptions = {
      property_data: {
        address: property.address,
        city: property.city,
        state: property.state,
        bedrooms: property.bedrooms,
        bathrooms: property.bathrooms,
        units: property.units_count,
        sqft: property.living_square_feet,
        year_built: property.year_built,
        property_type: property.property_type,
        owner_occupied: property.owner_occupied
      },
      estimated_defaults: {
        rental_income: {
          value: property.rental_income,
          method: 'AI + Formula Estimation',
          details: 'Estimated based on property characteristics, location, and market rates'
        },
        estimated_arv: {
          value: property.estimated_arv,
          method: 'Market-based calculation'
        },
        estimated_repair_cost: {
          value: property.estimated_repair_cost,
          details: 'Based on property condition and market assessment'
        },
        mortgage_principal: property.mortgage_principal,
        mortgage_rate: property.mortgage_rate,
        mortgage_term: property.mortgage_term
      },
      valuation: {
        listing_price: property.listing_price,
        estimated_value: property.estimated_value,
        market_value: property.market_value
      },
      analysis_timestamp: new Date().toISOString()
    };

    // Try to get stored input assumptions and merge with current ones
    if (existingAnalysis.length > 0 && existingAnalysis[0].input_assumptions) {
      try {
        const storedAssumptions = JSON.parse(existingAnalysis[0].input_assumptions);
        // Merge stored with current, preferring stored for historical accuracy
        Object.assign(inputAssumptions, storedAssumptions);
      } catch (e) {
        console.warn(`Could not parse stored input_assumptions for property ${req.params.propertyId}:`, e.message);
        // Continue with current assumptions
      }
    }

    // Generate comprehensive scenarios (multiple seller-finance options, DSCR comparison)
    const comprehensiveScenarios = generateComprehensiveScenarios(property, 0);

    // Sync analysis with baseline scenario (5% Down, 40% Income) so financial summary and criteria are consistent
    const syncedAnalysis = syncAnalysisWithBaselineScenario(analysis, comprehensiveScenarios, property);

    res.json({
      analysis: {
        ...syncedAnalysis,
        property_id: req.params.propertyId,
        rental_income: property.rental_income,
        estimated_arv: property.estimated_arv,
        estimated_repair_cost: property.estimated_repair_cost,
        mortgage_principal: property.mortgage_principal,
        mortgage_rate: property.mortgage_rate,
        mortgage_term: property.mortgage_term,
        input_assumptions: inputAssumptions,
        financing_scenarios: comprehensiveScenarios
      }
    });
  } catch (error) {
    console.error('Error fetching analysis:', error);
    res.status(500).json({ error: 'Failed to fetch analysis' });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/analysis/:propertyId/recalculate
 * Recalculate scenarios with custom tax, insurance, and gross monthly rent
 */
router.post('/:propertyId/recalculate', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { customTaxAnnual, customInsuranceAnnual, customGrossMonthlyRent } = req.body;

    // Fetch the property
    const [properties] = await connection.execute(
      'SELECT * FROM properties WHERE id = ?',
      [req.params.propertyId]
    );

    if (properties.length === 0) {
      return res.status(404).json({ error: 'Property not found' });
    }

    let property = properties[0];
    
    // Override tax and insurance if provided
    if (customTaxAnnual !== undefined) {
      property.tax_amount = customTaxAnnual;
    }
    if (customInsuranceAnnual !== undefined) {
      property.insurance_amount = customInsuranceAnnual;
    }
    // Override rental income if provided (convert monthly to annual)
    if (customGrossMonthlyRent !== undefined) {
      property.rental_income = customGrossMonthlyRent * 12;
    }

    // Run fresh analysis with custom values
    const analysis = analyzeProperty(property);

    // Generate comprehensive scenarios with custom expenses
    const comprehensiveScenarios = generateComprehensiveScenarios(property, 0);

    // Sync analysis with baseline scenario
    const syncedAnalysis = syncAnalysisWithBaselineScenario(analysis, comprehensiveScenarios, property);

    res.json({
      analysis: {
        ...syncedAnalysis,
        property_id: req.params.propertyId,
        rental_income: property.rental_income,
        estimated_arv: property.estimated_arv,
        estimated_repair_cost: property.estimated_repair_cost,
        mortgage_principal: property.mortgage_principal,
        mortgage_rate: property.mortgage_rate,
        mortgage_term: property.mortgage_term,
        financing_scenarios: comprehensiveScenarios
      }
    });
  } catch (error) {
    console.error('Error recalculating analysis:', error);
    res.status(500).json({ error: 'Failed to recalculate analysis' });
  } finally {
    connection.release();
  }
});

/**
 * POST /api/analysis/bulk
 * Analyze multiple properties at once
 */
router.post('/bulk/analyze', async (req, res) => {
  const { propertyIds } = req.body;
  const connection = await pool.getConnection();

  if (!Array.isArray(propertyIds) || propertyIds.length === 0) {
    return res.status(400).json({ error: 'propertyIds must be a non-empty array' });
  }

  try {
    const results = {
      analyzed: [],
      failed: [],
      skipped: []
    };

    for (const propertyId of propertyIds) {
      try {
        // Fetch property
        const [properties] = await connection.execute(
          'SELECT * FROM properties WHERE id = ?',
          [propertyId]
        );

        if (properties.length === 0) {
          results.failed.push({
            id: propertyId,
            error: 'Property not found'
          });
          continue;
        }

        let property = properties[0];

        // Estimate and update property with defaults
        const estimates = await estimatePropertyDefaults(property);
        await updatePropertyWithEstimates(property, connection);
        
        // Refresh property with updated estimates
        const [updatedProperties] = await connection.execute(
          'SELECT * FROM properties WHERE id = ?',
          [propertyId]
        );
        if (updatedProperties.length > 0) {
          property = updatedProperties[0];
        }

        // Run analysis
        const analysis = analyzeProperty(property);

        // Check if analysis is incomplete
        if (analysis.overall_score === 'INCOMPLETE') {
          results.skipped.push({
            id: propertyId,
            reason: analysis.analysis_notes
          });
          continue;
        }

        // Save analysis
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
          propertyId,
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

        results.analyzed.push({
          id: propertyId,
          score: analysis.overall_score,
          recommendation: analysis.recommendation
        });
      } catch (error) {
        results.failed.push({
          id: propertyId,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: `Bulk analysis complete: ${results.analyzed.length} analyzed, ${results.failed.length} failed, ${results.skipped.length} skipped`,
      results
    });
  } catch (error) {
    console.error('Error in bulk analysis:', error);
    res.status(500).json({ error: 'Bulk analysis failed', details: error.message });
  } finally {
    connection.release();
  }
});

/**
 * DELETE /api/analysis/:propertyId
 * Delete analysis for a property
 */
router.delete('/:propertyId', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const result = await connection.execute(
      'DELETE FROM property_analysis WHERE property_id = ?',
      [req.params.propertyId]
    );

    if (result[0].affectedRows === 0) {
      return res.status(404).json({ error: 'No analysis found for this property' });
    }

    res.json({
      success: true,
      message: 'Analysis deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting analysis:', error);
    res.status(500).json({ error: 'Failed to delete analysis' });
  } finally {
    connection.release();
  }
});

module.exports = router;
