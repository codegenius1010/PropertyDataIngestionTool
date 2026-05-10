/**
 * Rental Income Estimator Service
 * Uses AI and market data to estimate rental income for properties
 * Provides intelligent default values for analysis
 */

const axios = require('axios');

/**
 * Estimate rental income and fill defaults for property analysis
 * @param {Object} property - Property object with address, bedrooms, bathrooms, sqft, etc.
 * @returns {Object} Estimated values including rental_income, estimated_arv, estimated_repair_cost, and calculation_details
 */
async function estimatePropertyDefaults(property) {
  try {
    const rentalIncomeValue = Number(property.rental_income) || 0;
    const estimates = {
      rental_income: rentalIncomeValue, // Will be overridden if empty
      estimated_arv: property.estimated_arv || property.estimated_value || property.market_value || property.listing_price,
      estimated_repair_cost: property.estimated_repair_cost || 0,
      mortgage_principal: property.mortgage_principal || 0,
      mortgage_rate: property.mortgage_rate || 7.0,
      mortgage_term: property.mortgage_term || 30,
      estimation_method: 'system',
      estimation_timestamp: new Date(),
      calculation_details: {}
    };

    // If rental income is not set or is 0, estimate it
    if (!rentalIncomeValue || rentalIncomeValue === 0) {
      const rentalResult = await estimateRentalIncome(property);
      // Rental estimator returns MONTHLY income, but database stores ANNUAL
      // So multiply by 12 to convert monthly to annual for storage
      estimates.rental_income = (rentalResult.estimate || 0) * 12;
      estimates.estimation_method = rentalResult.method;
      estimates.calculation_details = rentalResult.details;
    }

    // Fill in estimated_arv if not present
    if (!estimates.estimated_arv && property.living_square_feet) {
      // Use a formula based on square footage and market value
      const pricePerSqft = calculatePricePerSqft(property);
      estimates.estimated_arv = Math.round(property.living_square_feet * pricePerSqft);
    }

    // Estimate repair cost if not set (defaults to 0 for now, can be improved)
    if (!estimates.estimated_repair_cost) {
      const repairResult = estimateRepairCost(property);
      estimates.estimated_repair_cost = repairResult.cost;
      estimates.repair_calculation = repairResult.details;
    }

    return estimates;
  } catch (error) {
    console.error('Error estimating property defaults:', error.message);
    // Return safe defaults on error
    const rentalIncomeValue = Number(property.rental_income) || 0;
    return {
      rental_income: rentalIncomeValue,
      estimated_arv: property.estimated_value || property.market_value || property.listing_price,
      estimated_repair_cost: property.estimated_repair_cost || 0,
      mortgage_principal: property.mortgage_principal || 0,
      mortgage_rate: property.mortgage_rate || 7.0,
      mortgage_term: property.mortgage_term || 30,
      estimation_method: 'defaults',
      error: error.message,
      calculation_details: {}
    };
  }
}

/**
 * Estimate rental income using AI and market rules
 * @param {Object} property - Property object
 * @returns {Object} Object with estimate, method, and calculation details
 */
async function estimateRentalIncome(property) {
  try {
    // First, try AI estimation if OpenAI key is available
    if (process.env.OPENAI_API_KEY) {
      const aiEstimate = await getAIRentalEstimate(property);
      if (aiEstimate && aiEstimate > 0) {
        return {
          estimate: aiEstimate,
          method: 'ai_estimated',
          details: {
            method: 'OpenAI GPT-3.5 AI Estimation',
            description: 'AI-powered analysis based on property characteristics, market conditions, and comparable properties'
          }
        };
      }
    }

    // Fallback to formula-based estimation
    const formulaResult = calculateRentalIncomeFromFormula(property);
    return {
      estimate: formulaResult.estimate,
      method: 'formula_calculated',
      details: formulaResult.details
    };
  } catch (error) {
    console.error('Error in rental income estimation:', error.message);
    // Return formula-based estimate as fallback
    const formulaResult = calculateRentalIncomeFromFormula(property);
    return {
      estimate: formulaResult.estimate,
      method: 'formula_calculated',
      details: formulaResult.details
    };
  }
}

/**
 * Use OpenAI GPT to estimate rental income based on property characteristics
 * @param {Object} property - Property object
 * @returns {Promise<Number>} Estimated monthly rental income
 */
async function getAIRentalEstimate(property) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return null;
    }

    const propertyDescription = formatPropertyForAI(property);

    const response = await axios.post(
      'https://api.openai.com/v1/chat/completions',
      {
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a real estate market expert. Based on property characteristics, estimate the monthly rental income. 
Consider market rates for the region, property condition, and comparable properties. 
Respond with ONLY a single number representing the estimated monthly rent in dollars (no currency symbol, no text).
If you cannot estimate, respond with 0.`
          },
          {
            role: 'user',
            content: `Estimate monthly rental income for this property:
${propertyDescription}

Provide only the numeric value in dollars.`
          }
        ],
        temperature: 0.7,
        max_tokens: 50
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000
      }
    );

    if (response.data && response.data.choices && response.data.choices[0]) {
      const content = response.data.choices[0].message.content.trim();
      const estimate = parseFloat(content);
      
      if (!isNaN(estimate) && estimate > 0) {
        console.log(`AI Rental Estimate for ${property.address}: $${estimate}/month`);
        return estimate;
      }
    }

    return null;
  } catch (error) {
    console.warn('OpenAI API call failed, using formula fallback:', error.message);
    return null;
  }
}

/**
 * Format property data for AI prompt
 * @param {Object} property - Property object
 * @returns {String} Formatted property description
 */
function formatPropertyForAI(property) {
  const parts = [
    `Address: ${property.address}, ${property.city}, ${property.state} ${property.zip_code}`,
    `Bedrooms: ${property.bedrooms || 'Unknown'}`,
    `Bathrooms: ${property.bathrooms || 'Unknown'}`,
    `Living Square Feet: ${property.living_square_feet || 'Unknown'}`,
    `Year Built: ${property.year_built || 'Unknown'}`,
    `Property Type: ${property.property_type || 'Single Family'}`,
    `Listing Price: $${property.listing_price || 'Unknown'}`,
    `Estimated Value: $${property.estimated_value || 'Unknown'}`,
    `Owner Occupied: ${property.owner_occupied === 'YES' ? 'Yes' : 'No'}`,
    `Property Condition: ${estimatePropertyCondition(property)}`,
    `Market: ${property.city}, ${property.state}`
  ];

  return parts.join('\n');
}

/**
 * Estimate property condition based on year built and other factors
 * @param {Object} property - Property object
 * @returns {String} Condition estimate
 */
function estimatePropertyCondition(property) {
  const currentYear = new Date().getFullYear();
  const age = currentYear - (property.year_built || 2000);

  if (age < 10) return 'Excellent (New)';
  if (age < 20) return 'Very Good';
  if (age < 40) return 'Good';
  if (age < 60) return 'Fair';
  return 'Needs Updates';
}

/**
 * Calculate rental income using market formulas (1% rule, 0.8% rule, etc.)
 * @param {Object} property - Property object
 * @returns {Object} Object with estimate, calculation details explaining formula used
 */
function calculateRentalIncomeFromFormula(property) {
  // Start with a base calculation
  let estimatedMonthly = 0;
  const details = {
    method: 'Market-Based Formula Calculation',
    inputs: {},
    adjustments: []
  };

  // Use listing price as primary valuation
  const propertyValue = property.listing_price || 
                       property.estimated_value || 
                       property.market_value || 
                       0;

  details.inputs.property_value = propertyValue;

  if (!propertyValue) {
    return { estimate: 0, details: { error: 'No property valuation available' } };
  }

  // Apply market-specific rules
  const state = property.state || '';
  
  // Regional adjustments - different markets have different rent-to-value ratios
  let rentalRatio = 0.008; // Default 0.8% rule
  let marketName = 'National Average';

  // High-demand markets with better rental yields
  if (['TX', 'FL', 'GA', 'NC', 'TN', 'SC', 'AZ', 'NV'].includes(state)) {
    rentalRatio = 0.010; // 1% rule
    marketName = 'High-Demand Market (TX, FL, GA, NC, TN, SC, AZ, NV)';
  }
  // Medium markets
  else if (['CA', 'NY', 'IL', 'PA', 'MA', 'NJ', 'CT'].includes(state)) {
    rentalRatio = 0.006; // 0.6% rule
    marketName = 'High-Cost Market (CA, NY, IL, PA, MA, NJ, CT)';
  }
  // Midwest and secondary markets
  else if (['IA', 'MO', 'KS', 'OK', 'AR', 'LA', 'MS', 'AL'].includes(state)) {
    rentalRatio = 0.009; // 0.9% rule
    marketName = 'Midwest/Secondary Market (IA, MO, KS, OK, AR, LA, MS, AL)';
  }

  details.inputs.market = marketName;
  details.inputs.rental_ratio = `${(rentalRatio * 100).toFixed(1)}%`;

  // Base calculation
  estimatedMonthly = propertyValue * rentalRatio;
  details.adjustments.push(`Base calculation: $${propertyValue.toLocaleString()} × ${(rentalRatio * 100).toFixed(1)}% = $${Math.round(estimatedMonthly)}`);

  // Adjust based on multi-unit count
  const units = property.units_count || 1;
  if (units > 1) {
    // Multi-family: increase rental potential proportionally
    const unitBoost = Math.min((units - 1) * 0.05, 0.25); // Up to 25% boost for many units
    const oldEstimate = estimatedMonthly;
    estimatedMonthly *= (1 + unitBoost);
    details.adjustments.push(`Multi-unit adjustment (${units} units): +${(unitBoost * 100).toFixed(1)}% = $${Math.round(estimatedMonthly)}`);
    details.inputs.units = units;
  }

  // Adjust based on bedroom count (more bedrooms = higher rent potential)
  const bedrooms = property.bedrooms || 2;
  let bedroomAdjustment = 0;
  
  if (bedrooms >= 5) {
    bedroomAdjustment = 0.20; // 20% boost for 5+ BR
  } else if (bedrooms === 4) {
    bedroomAdjustment = 0.15; // 15% boost for 4 BR
  } else if (bedrooms === 3) {
    bedroomAdjustment = 0.08; // 8% boost for 3 BR
  } else if (bedrooms === 2) {
    bedroomAdjustment = 0.02; // 2% boost for 2 BR
  }
  
  if (bedroomAdjustment > 0) {
    const oldEstimate = estimatedMonthly;
    estimatedMonthly *= (1 + bedroomAdjustment);
    details.adjustments.push(`Bedroom adjustment (${bedrooms} BR): +${(bedroomAdjustment * 100).toFixed(1)}% = $${Math.round(estimatedMonthly)}`);
  }
  details.inputs.bedrooms = bedrooms;

  // Adjust based on bathroom count
  const bathrooms = property.bathrooms || 1;
  let bathroomAdjustment = 0;
  
  if (bathrooms >= 3) {
    bathroomAdjustment = 0.08; // 8% boost for 3+ BA
  } else if (bathrooms === 2.5 || bathrooms === 2) {
    bathroomAdjustment = 0.05; // 5% boost for 2-2.5 BA
  }
  
  if (bathroomAdjustment > 0) {
    const oldEstimate = estimatedMonthly;
    estimatedMonthly *= (1 + bathroomAdjustment);
    details.adjustments.push(`Bathroom adjustment (${bathrooms} BA): +${(bathroomAdjustment * 100).toFixed(1)}% = $${Math.round(estimatedMonthly)}`);
  }
  details.inputs.bathrooms = bathrooms;

  // Adjust based on square footage efficiency
  const sqft = property.living_square_feet || 1000;
  const pricePerSqft = propertyValue / sqft;
  let sqftAdjustment = 0;
  
  if (pricePerSqft < 100) {
    sqftAdjustment = 0.10; // 10% boost for Lower price per sqft = higher rental ratio
  } else if (pricePerSqft > 250) {
    sqftAdjustment = -0.10; // -10% for Higher price per sqft = lower rental ratio
  }
  
  if (sqftAdjustment !== 0) {
    const oldEstimate = estimatedMonthly;
    estimatedMonthly *= (1 + sqftAdjustment);
    details.adjustments.push(`Price/sqft adjustment ($${pricePerSqft.toFixed(0)}/sqft, ${sqft} sqft): ${sqftAdjustment > 0 ? '+' : ''}${(sqftAdjustment * 100).toFixed(1)}% = $${Math.round(estimatedMonthly)}`);
  }
  details.inputs.sqft = sqft;
  details.inputs.price_per_sqft = pricePerSqft.toFixed(2);

  // Owner occupied properties typically wouldn't be rented, but we estimate anyway
  // Adjust down slightly if owner occupied (likely not for rent)
  if (property.owner_occupied === 'YES') {
    const oldEstimate = estimatedMonthly;
    estimatedMonthly *= 0.95;
    details.adjustments.push(`Owner-occupied adjustment: -5% = $${Math.round(estimatedMonthly)}`);
    details.inputs.owner_occupied = true;
  }

  return {
    estimate: Math.round(estimatedMonthly),
    details: {
      method: 'Market-Based Formula Calculation',
      ...details
    }
  };
}

/**
 * Calculate price per square foot
 * @param {Object} property - Property object
 * @returns {Number} Price per square foot
 */
function calculatePricePerSqft(property) {
  const propertyValue = property.listing_price || 
                       property.estimated_value || 
                       property.market_value || 
                       100000;
  const sqft = property.living_square_feet || 1000;
  
  return propertyValue / sqft;
}

/**
 * Estimate repair costs based on property condition and age
 * @param {Object} property - Property object
 * @returns {Object} Object with cost and calculation details
 */
function estimateRepairCost(property) {
  const currentYear = new Date().getFullYear();
  const age = currentYear - (property.year_built || 2000);
  
  const propertyValue = property.listing_price || 
                       property.estimated_value || 
                       property.market_value || 
                       100000;

  let repairPercentage = 0;
  let ageCondition = '';

  // Estimate repairs needed based on age
  if (age < 10) {
    repairPercentage = 0.02; // 2% for new homes
    ageCondition = 'Excellent (New, < 10 years)';
  } else if (age < 20) {
    repairPercentage = 0.05; // 5% for homes 10-20 years
    ageCondition = 'Very Good (10-20 years)';
  } else if (age < 40) {
    repairPercentage = 0.08; // 8% for homes 20-40 years
    ageCondition = 'Good (20-40 years)';
  } else if (age < 60) {
    repairPercentage = 0.12; // 12% for homes 40-60 years
    ageCondition = 'Fair (40-60 years)';
  } else {
    repairPercentage = 0.15; // 15% for very old homes
    ageCondition = 'Needs Updates (60+ years)';
  }

  const cost = Math.round(propertyValue * repairPercentage);

  return {
    cost,
    details: {
      method: 'Age-Based Repair Cost Estimation',
      year_built: property.year_built,
      property_age: `${age} years`,
      age_condition: ageCondition,
      repair_percentage: `${(repairPercentage * 100).toFixed(1)}%`,
      property_value: propertyValue,
      estimated_cost: cost
    }
  };
}

/**
 * Update property with estimated values
 * @param {Object} property - Property object
 * @param {Object} poolOrConnection - Database connection pool or specific connection
 * @returns {Promise<Boolean>} Success status
 */
async function updatePropertyWithEstimates(property, poolOrConnection) {
  try {
    const estimates = await estimatePropertyDefaults(property);

    const query = `
      UPDATE properties 
      SET 
        rental_income = ?,
        estimated_arv = ?,
        estimated_repair_cost = ?,
        mortgage_principal = ?,
        mortgage_rate = ?,
        mortgage_term = ?
      WHERE id = ?
    `;

    const values = [
      estimates.rental_income || 0,
      estimates.estimated_arv || 0,
      estimates.estimated_repair_cost || 0,
      estimates.mortgage_principal || 0,
      estimates.mortgage_rate || 7.0,
      estimates.mortgage_term || 30,
      property.id
    ];

    // Use the provided connection/pool for execution
    await poolOrConnection.execute(query, values);
    console.log(`Updated estimates for property ${property.id}: rental_income=${estimates.rental_income}`);
    return true;
  } catch (error) {
    console.error(`Error updating property estimates for ID ${property.id}:`, error.message);
    return false;
  }
}

module.exports = {
  estimatePropertyDefaults,
  estimateRentalIncome,
  updatePropertyWithEstimates,
  calculateRentalIncomeFromFormula,
  estimateRepairCost
};
