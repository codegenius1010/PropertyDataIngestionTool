/**
 * Deal Analyzer Service
 * Analyzes wholesale opportunities against specific investment criteria
 * Provides scoring, green/yellow/red light recommendations
 */

// States where we DON'T wholesale
const AVOID_STATES = ['IL', 'OR', 'WA', 'SC', 'NJ', 'ND', 'SD', 'WY', 'AK'];

/**
 * Main deal analysis function
 * @param {Object} property - Property object from database
 * @returns {Object} Analysis results with scores and recommendations
 */
function analyzeProperty(property) {
  // Check if we have minimum required data
  const hasRequiredData = validatePropertyData(property);
  
  if (!hasRequiredData.valid) {
    return {
      overall_score: 'INCOMPLETE',
      error: hasRequiredData.reason,
      red_light: true,
      yellow_light: false,
      green_light: false,
      analysis_notes: `Cannot analyze: ${hasRequiredData.reason}`
    };
  }

  // Check state-level criteria first
  const stateAnalysis = analyzeState(property.state);
  
  // If state is blocked, return immediately
  if (!stateAnalysis.pass) {
    return {
      overall_score: 'RED',
      state_pass: false,
      state_pass_reason: stateAnalysis.reason,
      red_light: true,
      yellow_light: false,
      green_light: false,
      recommendation: stateAnalysis.recommendation,
      analysis_notes: `State analysis failed: ${stateAnalysis.reason}`
    };
  }

  // Determine property type and analyze accordingly
  const analysisType = determineAnalysisType(property);
  let analysis = {};

  switch (analysisType) {
    case 'subto':
      analysis = analyzeSubTo(property);
      break;
    case 'owner_financing':
      analysis = analyzeOwnerFinancing(property);
      break;
    case 'multi_family':
      analysis = analyzeMultiFamily(property);
      break;
    default:
      analysis = analyzeGeneric(property);
  }

  // Calculate financing options
  analysis.financing_options = calculateFinancingOptions(property);

  // Calculate DSCR requirements
  analysis.dscr_analysis = calculateDSCRRequirements(property);

  return {
    analysis_type: analysisType,
    ...analysis
  };
}

/**
 * Validate that property has minimum required data for analysis
 */
function validatePropertyData(property) {
  if (!property.state) {
    return { valid: false, reason: 'State is required' };
  }
  
  if (!property.listing_price || property.listing_price <= 0) {
    return { valid: false, reason: 'Valid listing price is required' };
  }

  return { valid: true };
}

/**
 * Analyze state compliance
 */
function analyzeState(state) {
  const stateCode = state ? state.toUpperCase() : '';
  
  if (AVOID_STATES.includes(stateCode)) {
    return {
      pass: false,
      reason: `Cannot wholesale in ${stateCode} - state restrictions apply`,
      recommendation: 'PASS - Do not pursue this deal'
    };
  }

  return {
    pass: true,
    reason: `${stateCode} is approved for wholesaling`
  };
}

/**
 * Determine property type based on characteristics
 */
function determineAnalysisType(property) {
  // If property has existing mortgage, could be SubTo
  if (property.mortgage_principal && property.mortgage_principal > 0) {
    return 'subto';
  }

  // If has rental income and is multi-unit, likely owner financing multi-family
  if (property.units_count && property.units_count > 1 && property.rental_income) {
    return 'multi_family';
  }

  // If has rental income, likely owner financing deal
  if (property.rental_income && property.rental_income > 0) {
    return 'owner_financing';
  }

  return 'owner_financing';
}

/**
 * Analyze SubTo (Subject To existing mortgage) criteria
 * Criteria:
 * 1. $150 Positive Cashflow Minimum
 * 2. Mortgage under 150k up to 8% interest
 * 3. Mortgage over 150k up to 5% interest
 * 4. Property value < $500,000
 * 5. Max 15% equity in the property
 * 6. Only Fixed Rate Interest
 * 7. Max Down Payment 15%
 * 8. Max Entry/Offer 15%
 * 9. Minimum Balloon 5 Years
 * 10. Minimum Cash on Cash negative 10%+
 */
function analyzeSubTo(property) {
  const results = { passed: [], failed: [] };
  const propertyValue = property.estimated_value || property.market_value || property.listing_price;
  const monthlyRent = (property.rental_income || 0) / 12;
  const mortgagePrincipal = property.mortgage_principal || 0;
  const mortgageRate = property.mortgage_rate || 0;

  // Criteria 1: Positive cashflow minimum $150/month
  const monthlyMortgage = calculateMonthlyPayment(mortgagePrincipal, mortgageRate, (property.mortgage_term || 30) * 12);
  const grossNOI = calculateGrossNOI(monthlyRent);
  const monthlyNOI = grossNOI - (monthlyMortgage || 0);
  
  if (monthlyNOI >= 150) {
    results.passed.push({ criterion: 'Monthly Cashflow ≥ $150', value: `$${monthlyNOI.toFixed(2)}/mo`, status: 'PASS' });
  } else {
    results.failed.push({ criterion: 'Monthly Cashflow ≥ $150', value: `$${monthlyNOI.toFixed(2)}/mo`, reason: 'Below $150 minimum' });
  }

  // Criteria 2 & 3: Interest rate based on mortgage amount
  if (mortgagePrincipal <= 150000) {
    if (mortgageRate <= 8) {
      results.passed.push({ criterion: 'Interest Rate (under $150k) ≤ 8%', value: `${mortgageRate}%`, status: 'PASS' });
    } else {
      results.failed.push({ criterion: 'Interest Rate (under $150k) ≤ 8%', value: `${mortgageRate}%`, reason: 'Rate exceeds 8%' });
    }
  } else if (mortgagePrincipal > 150000) {
    if (mortgageRate <= 5) {
      results.passed.push({ criterion: 'Interest Rate (over $150k) ≤ 5%', value: `${mortgageRate}%`, status: 'PASS' });
    } else {
      results.failed.push({ criterion: 'Interest Rate (over $150k) ≤ 5%', value: `${mortgageRate}%`, reason: 'Rate exceeds 5%' });
    }
  }

  // Criteria 4: Property value < $500k
  if (propertyValue < 500000) {
    results.passed.push({ criterion: 'Property Value < $500k', value: `$${propertyValue.toLocaleString()}`, status: 'PASS' });
  } else {
    results.failed.push({ criterion: 'Property Value < $500k', value: `$${propertyValue.toLocaleString()}`, reason: 'Exceeds $500k' });
  }

  // Criteria 5: Max 15% equity
  const equity = ((propertyValue - mortgagePrincipal) / propertyValue) * 100;
  if (equity <= 15) {
    results.passed.push({ criterion: 'Max Equity 15%', value: `${equity.toFixed(1)}%`, status: 'PASS' });
  } else {
    results.failed.push({ criterion: 'Max Equity 15%', value: `${equity.toFixed(1)}%`, reason: 'Equity exceeds 15%' });
  }

  // Calculate overall score
  const meetsSubToCriteria = results.failed.length === 0;
  let overallScore = 'RED';
  if (meetsSubToCriteria) {
    overallScore = 'GREEN';
  } else if (results.failed.length <= 2) {
    overallScore = 'YELLOW';
  }

  const annualCashFlow = monthlyNOI * 12;
  const cashOnCash = ((annualCashFlow) / (mortgagePrincipal * 0.15)) * 100; // Assuming 15% down

  return {
    subto_criteria_met: meetsSubToCriteria,
    criteria_breakdown: {
      passed: results.passed,
      failed: results.failed,
      total_tests: results.passed.length + results.failed.length,
      passed_count: results.passed.length,
      failed_count: results.failed.length
    },
    financial_summary: {
      monthly_noi: monthlyNOI,
      annual_noi: annualCashFlow,
      monthly_mortgage: monthlyMortgage,
      equity_percentage: equity,
      cash_on_cash: cashOnCash
    },
    cashflow_amount: monthlyNOI,
    cashflow_positive: monthlyNOI >= 150,
    overall_score: overallScore,
    green_light: meetsSubToCriteria,
    yellow_light: !meetsSubToCriteria && results.failed.length <= 2,
    red_light: results.failed.length > 2,
    recommendation: meetsSubToCriteria 
      ? 'PURSUE - Meets all SubTo criteria'
      : `REVIEW - ${results.failed.length} criteria not met`,
    analysis_notes: `SubTo: ${results.passed.length} passed, ${results.failed.length} failed`
  };
}

/**
 * Analyze Owner Financing criteria (no existing mortgage)
 * Criteria:
 * 1. $200 Positive Cashflow Minimum
 * 2. Property value < $500,000
 * 3. 13% Cash on Cash return with 10% down (minimum)
 * 4. Max interest 4%, ideally offer 0% with above asking
 * 5. Minimum balloon 5 years, ideally 6 years
 * 6. Max down 15%, ideally under 10%
 */
function analyzeOwnerFinancing(property) {
  const results = { passed: [], failed: [] };
  const propertyValue = property.estimated_value || property.market_value || property.listing_price;
  const monthlyRent = (property.rental_income || 0) / 12;
  const downPaymentPercent = 0.10; // 10% down
  const downPaymentAmount = propertyValue * downPaymentPercent;
  const financedAmount = propertyValue - downPaymentAmount;

  // Calculate annual cash flow and CoC
  const monthlyNOI = calculateGrossNOI(monthlyRent);
  const annualCashFlow = monthlyNOI * 12;
  const cashOnCash = (annualCashFlow / downPaymentAmount) * 100;

  // Criteria 1: Positive cashflow minimum $200/month
  if (monthlyNOI >= 200) {
    results.passed.push({ criterion: 'Monthly Cashflow ≥ $200', value: `$${monthlyNOI.toFixed(2)}/mo`, status: 'PASS' });
  } else {
    results.failed.push({ criterion: 'Monthly Cashflow ≥ $200', value: `$${monthlyNOI.toFixed(2)}/mo`, reason: 'Below $200 minimum' });
  }

  // Criteria 2: Property value < $500k
  if (propertyValue < 500000) {
    results.passed.push({ criterion: 'Property Value < $500k', value: `$${propertyValue.toLocaleString()}`, status: 'PASS' });
  } else {
    results.failed.push({ criterion: 'Property Value < $500k', value: `$${propertyValue.toLocaleString()}`, reason: 'Exceeds $500k' });
  }

  // Criteria 3: Cash on Cash ≥ 13% with 10% down
  if (cashOnCash >= 13) {
    results.passed.push({ criterion: 'Cash-on-Cash ≥ 13% (10% down)', value: `${cashOnCash.toFixed(1)}%`, status: 'PASS' });
  } else {
    results.failed.push({ criterion: 'Cash-on-Cash ≥ 13% (10% down)', value: `${cashOnCash.toFixed(1)}%`, reason: 'Below 13% threshold' });
  }

  // Criteria 4: Interest rate ≤ 4% (ideal: 0% above asking)
  if (true) { // Seller finance scenarios handled in financing options
    results.passed.push({ criterion: 'Financing Terms Viable', value: '0-4% rates available', status: 'PASS' });
  }

  // Calculate overall score
  const meetsOwnerFinancingCriteria = results.failed.length === 0;
  let overallScore = 'RED';
  if (meetsOwnerFinancingCriteria) {
    overallScore = 'GREEN';
  } else if (results.failed.length <= 2) {
    overallScore = 'YELLOW';
  }

  return {
    owner_financing_criteria_met: meetsOwnerFinancingCriteria,
    criteria_breakdown: {
      passed: results.passed,
      failed: results.failed,
      total_tests: results.passed.length + results.failed.length,
      passed_count: results.passed.length,
      failed_count: results.failed.length
    },
    financial_summary: {
      monthly_noi: monthlyNOI,
      annual_noi: annualCashFlow,
      down_payment: downPaymentAmount,
      cash_on_cash: cashOnCash,
      financed_amount: financedAmount
    },
    cashflow_amount: monthlyNOI,
    cashflow_positive: monthlyNOI >= 200,
    overall_score: overallScore,
    green_light: meetsOwnerFinancingCriteria,
    yellow_light: !meetsOwnerFinancingCriteria && results.failed.length <= 2,
    red_light: results.failed.length > 2,
    recommendation: meetsOwnerFinancingCriteria
      ? 'PURSUE - Meets owner financing criteria'
      : `REVIEW - ${results.failed.length} criteria not met`,
    analysis_notes: `Owner Financing: ${results.passed.length} passed, ${results.failed.length} failed`
  };
}

/**
 * Analyze Multi-Family Owner Financing
 * Criteria:
 * 10% Down, 10% above asking, 40% monthly payment vs rent, balloon after 6 years, max $3M
 */
function analyzeMultiFamily(property) {
  const failures = [];
  const passes = [];

  // Units check
  const units = property.units_count || 0;
  if (units < 2) {
    failures.push(`Not multi-family: ${units} unit(s) (need 2+)`);
  } else {
    passes.push(`Multi-family property: ${units} units`);
  }

  // Property value < $3M
  const propertyValue = property.estimated_value || property.market_value || property.listing_price;
  if (propertyValue >= 3000000) {
    failures.push(`Property value too high: $${propertyValue.toLocaleString()} (max $3,000,000)`);
  } else {
    passes.push(`Property value acceptable: $${propertyValue.toLocaleString()}`);
  }

  // Rental income check
  const monthlyRent = (property.rental_income || 0) / 12;
  if (monthlyRent <= 0) {
    failures.push(`No rental income data provided`);
  } else {
    passes.push(`Rental income: $${monthlyRent.toFixed(2)}/month`);
  }

  // 10% down, check payment-to-rent ratio
  const downPayment = propertyValue * 0.10;
  const financedAmount = propertyValue - downPayment;
  const monthlyPayment = calculateMonthlyPayment(financedAmount, 0, 72); // 6 years at 0%
  const paymentRatio = (monthlyPayment / monthlyRent) * 100;

  if (paymentRatio > 40) {
    failures.push(`Payment-to-rent ratio too high: ${paymentRatio.toFixed(1)}% (need ≤ 40%)`);
  } else {
    passes.push(`Payment-to-rent ratio acceptable: ${paymentRatio.toFixed(1)}%`);
  }

  const meetsMFCriteria = failures.length === 0;
  let overallScore = 'RED';
  if (meetsMFCriteria) {
    overallScore = 'GREEN';
  } else if (failures.length <= 2) {
    overallScore = 'YELLOW';
  }

  return {
    multi_family_criteria_met: meetsMFCriteria,
    multi_family_failures: failures,
    multi_family_passes: passes,
    cashflow_amount: monthlyRent - monthlyPayment,
    cashflow_positive: (monthlyRent - monthlyPayment) >= 0,
    overall_score: overallScore,
    green_light: meetsMFCriteria,
    yellow_light: !meetsMFCriteria && failures.length <= 2,
    red_light: failures.length > 2,
    recommendation: meetsMFCriteria
      ? 'PURSUE - Meets multi-family criteria'
      : `REVIEW - ${failures.length} criteria not met`,
    analysis_notes: `Multi-Family Analysis: ${passes.length} criteria met, ${failures.length} failed`
  };
}

/**
 * Generic analysis for properties that don't fit specific categories
 */
function analyzeGeneric(property) {
  const propertyValue = property.estimated_value || property.market_value || property.listing_price;
  const monthlyRent = (property.rental_income || 0) / 12;

  return {
    overall_score: 'YELLOW',
    green_light: false,
    yellow_light: true,
    red_light: false,
    recommendation: 'REVIEW - Incomplete data for full analysis',
    analysis_notes: 'Property does not fit standard criteria categories. Requires manual review.'
  };
}

/**
 * Calculate monthly payment for a loan
 * @param {number} principal - Loan amount
 * @param {number} rate - Annual interest rate (%)
 * @param {number} months - Loan term in months
 * @returns {number} Monthly payment
 */
function calculateMonthlyPayment(principal, rate, months) {
  if (!principal || principal <= 0 || !months || months <= 0) {
    return 0;
  }

  const monthlyRate = rate / 100 / 12;
  
  if (monthlyRate === 0) {
    return principal / months;
  }

  return principal * (monthlyRate * Math.pow(1 + monthlyRate, months)) / 
         (Math.pow(1 + monthlyRate, months) - 1);
}

/**
 * Calculate financing options: asking @ 4% vs above asking @ 0%
 */
function calculateFinancingOptions(property) {
  const askingPrice = property.listing_price || property.estimated_value || property.market_value || 0;
  const monthlyRent = (property.rental_income || 0) / 12;

  if (!askingPrice || !monthlyRent) {
    return null;
  }

  // Option 1: Asking price with 4% interest, 6 year balloon
  const financedAmount1 = askingPrice * 0.90; // 10% down
  const monthlyPayment1 = calculateMonthlyPayment(financedAmount1, 4, 72);
  const affordsOption1 = monthlyPayment1 <= (monthlyRent * 0.40);

  // Option 2: 10% above asking with 0% interest, 6 year balloon
  const offerPrice2 = askingPrice * 1.10;
  const financedAmount2 = offerPrice2 * 0.90; // 10% down
  const monthlyPayment2 = calculateMonthlyPayment(financedAmount2, 0, 72);
  const affordsOption2 = monthlyPayment2 <= (monthlyRent * 0.40);

  return {
    option_asking_4pct: {
      offer_price: askingPrice,
      down_payment: askingPrice * 0.10,
      financed_amount: financedAmount1,
      interest_rate: 4,
      monthly_payment: monthlyPayment1,
      affordable: affordsOption1
    },
    option_above_asking_0pct: {
      offer_price: offerPrice2,
      down_payment: offerPrice2 * 0.10,
      financed_amount: financedAmount2,
      interest_rate: 0,
      monthly_payment: monthlyPayment2,
      affordable: affordsOption2
    }
  };
}

/**
 * Calculate DSCR (Debt Service Coverage Ratio) requirements with scenario matrix
 * DSCR = Annual Net Operating Income / Annual Debt Service
 * Lenders typically require DSCR of 1.25 or higher
 * 
 * Standard DSCR Terms:
 * - 20% down
 * - 7% interest
 * - Incoming rents need to cover mortgage including debt service, insurance, and taxes
 */
function calculateDSCRRequirements(property) {
  const askingPrice = property.listing_price || property.estimated_value || property.market_value || 0;
  const monthlyRent = (property.rental_income || 0) / 12;
  const annualRent = monthlyRent * 12;

  if (!askingPrice || !annualRent || annualRent <= 0) {
    return { 
      qualified: false, 
      reason: 'Insufficient data for DSCR calculation',
      scenarios: []
    };
  }

  // Calculate operating expenses
  const grossMonthlyRent = monthlyRent;
  const vacancy = grossMonthlyRent * 0.05; // 5% vacancy
  const maintenance = grossMonthlyRent * 0.10; // 10% maintenance
  const capex = grossMonthlyRent * 0.05; // 5% CapEx
  
  const taxAmount = property.tax_amount || (askingPrice * 0.01); // Estimate 1% if not provided
  const monthlyTax = taxAmount / 12;
  
  const estimatedInsurance = askingPrice * 0.007; // Estimate 0.7% annually
  const monthlyInsurance = estimatedInsurance / 12;

  const monthlyOperatingExpenses = vacancy + maintenance + capex + monthlyTax + monthlyInsurance;
  const monthlyNOI = grossMonthlyRent - monthlyOperatingExpenses;
  const annualNOI = monthlyNOI * 12;

  // Generate scenario matrix with 3+ seller finance scenarios
  const scenarios = [];

  // Scenario 1: Seller Finance - Asking Price, 4% interest, 6 years
  const scenario1 = {
    name: 'Seller Finance - Asking Price',
    offer_price: askingPrice,
    down_payment: askingPrice * 0.10,
    financed_amount: askingPrice * 0.90,
    interest_rate: 4,
    term_years: 6,
    term_months: 72,
    monthly_payment: calculateMonthlyPayment(askingPrice * 0.90, 4, 72),
    monthly_noi: monthlyNOI,
    monthly_cash_flow: monthlyNOI - calculateMonthlyPayment(askingPrice * 0.90, 4, 72),
    annual_cash_flow: (monthlyNOI - calculateMonthlyPayment(askingPrice * 0.90, 4, 72)) * 12,
    cash_on_cash: ((monthlyNOI - calculateMonthlyPayment(askingPrice * 0.90, 4, 72)) * 12) / (askingPrice * 0.10) * 100,
    label: 'Acceptable'
  };
  scenario1.status = scenario1.cash_on_cash >= 13 ? 'Strong' : scenario1.monthly_cash_flow > 0 ? 'Acceptable' : 'Weak';
  scenarios.push(scenario1);

  // Scenario 2: Seller Finance - 10% Above Asking, 0% interest, 6 years
  const aboveAskingPrice = askingPrice * 1.10;
  const scenario2 = {
    name: 'Seller Finance - 10% Above Asking, 0% Interest',
    offer_price: aboveAskingPrice,
    down_payment: aboveAskingPrice * 0.10,
    financed_amount: aboveAskingPrice * 0.90,
    interest_rate: 0,
    term_years: 6,
    term_months: 72,
    monthly_payment: calculateMonthlyPayment(aboveAskingPrice * 0.90, 0, 72),
    monthly_noi: monthlyNOI,
    monthly_cash_flow: monthlyNOI - calculateMonthlyPayment(aboveAskingPrice * 0.90, 0, 72),
    annual_cash_flow: (monthlyNOI - calculateMonthlyPayment(aboveAskingPrice * 0.90, 0, 72)) * 12,
    cash_on_cash: ((monthlyNOI - calculateMonthlyPayment(aboveAskingPrice * 0.90, 0, 72)) * 12) / (aboveAskingPrice * 0.10) * 100,
    label: 'Strong'
  };
  scenario2.status = scenario2.cash_on_cash >= 13 ? 'Strong' : scenario2.monthly_cash_flow > 0 ? 'Acceptable' : 'Weak';
  scenarios.push(scenario2);

  // Scenario 3: Seller Finance - 5% Above Asking, 2% interest, 6 years
  const moderateAskingPrice = askingPrice * 1.05;
  const scenario3 = {
    name: 'Seller Finance - 5% Above Asking, 2% Interest',
    offer_price: moderateAskingPrice,
    down_payment: moderateAskingPrice * 0.10,
    financed_amount: moderateAskingPrice * 0.90,
    interest_rate: 2,
    term_years: 6,
    term_months: 72,
    monthly_payment: calculateMonthlyPayment(moderateAskingPrice * 0.90, 2, 72),
    monthly_noi: monthlyNOI,
    monthly_cash_flow: monthlyNOI - calculateMonthlyPayment(moderateAskingPrice * 0.90, 2, 72),
    annual_cash_flow: (monthlyNOI - calculateMonthlyPayment(moderateAskingPrice * 0.90, 2, 72)) * 12,
    cash_on_cash: ((monthlyNOI - calculateMonthlyPayment(moderateAskingPrice * 0.90, 2, 72)) * 12) / (moderateAskingPrice * 0.10) * 100,
    label: 'Acceptable'
  };
  scenario3.status = scenario3.cash_on_cash >= 13 ? 'Strong' : scenario3.monthly_cash_flow > 0 ? 'Acceptable' : 'Weak';
  scenarios.push(scenario3);

  // Standard DSCR loan: 20% down, 7% interest, 30 year term
  const downPaymentDSCR = askingPrice * 0.20;
  const loanAmount = askingPrice - downPaymentDSCR;
  const monthlyPaymentDSCR = calculateMonthlyPayment(loanAmount, 7, 360);
  const annualDebtService = monthlyPaymentDSCR * 12;

  const dscr = annualNOI / annualDebtService;

  return {
    assumptions: {
      vacancy_percentage: 5,
      maintenance_percentage: 10,
      capex_percentage: 5,
      tax_amount: taxAmount,
      insurance_annual: estimatedInsurance
    },
    monthly_breakdown: {
      gross_monthly_rent: grossMonthlyRent,
      vacancy: vacancy,
      maintenance: maintenance,
      capex: capex,
      monthly_tax: monthlyTax,
      monthly_insurance: monthlyInsurance,
      total_monthly_expenses: monthlyOperatingExpenses,
      monthly_noi: monthlyNOI
    },
    scenarios: scenarios,
    dscr_loan_comparison: {
      down_payment: downPaymentDSCR,
      loan_amount: loanAmount,
      interest_rate: 7,
      term_years: 30,
      monthly_payment: monthlyPaymentDSCR,
      annual_debt_service: annualDebtService,
      annual_noi: annualNOI,
      dscr_ratio: dscr,
      dscr_required: 1.25,
      qualified: dscr >= 1.25
    },
    qualified: dscr >= 1.25,
    reason: dscr >= 1.25 
      ? `DSCR ${dscr.toFixed(2)} meets lender requirement of 1.25+`
      : `DSCR ${dscr.toFixed(2)} below lender requirement of 1.25 - property does not qualify for traditional DSCR loan`
  };
}

/**
 * Calculate Gross NOI (Net Operating Income)
 * Monthly Rental Income minus operating expenses
 * Expenses: Vacancy (5%), Maintenance (10%), CapEx (5%), Taxes, Insurance
 */
function calculateGrossNOI(monthlyRent) {
  const vacancy = monthlyRent * 0.05;
  const maintenance = monthlyRent * 0.10;
  const capex = monthlyRent * 0.05;
  const estimatedTax = monthlyRent * 0.01; // Estimate 1% monthly
  const estimatedInsurance = monthlyRent * 0.007; // Estimate 0.7% monthly

  return monthlyRent - vacancy - maintenance - capex - estimatedTax - estimatedInsurance;
}

/**
 * Generate comprehensive scenario matrix with all deal criteria
 * Includes assumptions, multiple seller-finance scenarios, and DSCR comparison
 * @param {Object} property - Property object
 * @param {number} assignmentFee - Optional assignment fee for buyer CoC calculation
 * @returns {Object} Comprehensive scenario matrix with assumptions and all scenarios
 */
function generateComprehensiveScenarios(property, assignmentFee = 0) {
  const askingPrice = property.listing_price || property.estimated_value || property.market_value || 0;
  const monthlyRent = (property.rental_income || 0) / 12;
  const annualRent = monthlyRent * 12;

  if (!askingPrice || !annualRent || annualRent <= 0) {
    return null;
  }

  // === ASSUMPTIONS SECTION ===
  const grossMonthlyRent = monthlyRent;
  const vacancy = grossMonthlyRent * 0.05; // 5% default
  const maintenance = grossMonthlyRent * 0.10; // 10% default
  const capex = grossMonthlyRent * 0.05; // 5% default
  
  const taxAmount = property.tax_amount || (askingPrice * 0.01); // Estimate 1% if not provided
  const monthlyTax = taxAmount / 12;
  const taxLabel = property.tax_amount ? 'Actual' : 'Estimated (1% annually)';
  
  const estimatedInsurance = askingPrice * 0.007; // Estimate 0.7% annually
  const monthlyInsurance = estimatedInsurance / 12;
  const insuranceLabel = property.insurance_amount ? 'Actual' : 'Estimated (0.7% annually)';

  const monthlyOperatingExpenses = vacancy + maintenance + capex + monthlyTax + monthlyInsurance;
  const monthlyNOI = grossMonthlyRent - monthlyOperatingExpenses;
  const annualNOI = monthlyNOI * 12;

  const assumptions = {
    gross_monthly_rent: grossMonthlyRent,
    vacancy: { percentage: 5, monthly_amount: vacancy },
    maintenance: { percentage: 10, monthly_amount: maintenance },
    capex: { percentage: 5, monthly_amount: capex },
    taxes: { monthly_amount: monthlyTax, label: taxLabel, annual_amount: taxAmount },
    insurance: { monthly_amount: monthlyInsurance, label: insuranceLabel, annual_amount: estimatedInsurance },
    total_monthly_expenses: monthlyOperatingExpenses,
    monthly_noi: monthlyNOI,
    annual_noi: annualNOI
  };

  // === SCENARIO GENERATION BASED ON 40-50% MONTHLY PAYMENT RULE ===
  // Monthly payments should be 40-50% of rental income, balloon at 6 years
  const balloonTermMonths = 72; // 6 years
  const baseAmortizationMonths = 240; // 20 years base amortization for lower payments
  const targetPaymentLow = monthlyRent * 0.40;  // 40% minimum
  const targetPaymentMid = monthlyRent * 0.45;  // 45% target
  const targetPaymentHigh = monthlyRent * 0.50; // 50% maximum

  // Helper function to find interest rate that achieves target monthly payment
  // Searches from 0% to 8% to find rate that produces payment closest to target
  function findInterestRateForPayment(principal, targetPayment, termMonths) {
    if (principal <= 0 || targetPayment <= 0) return 0;
    
    let bestRate = 0;
    let bestDifference = Math.abs(calculateMonthlyPayment(principal, 0, termMonths) - targetPayment);
    
    // Try rates from 0% to 8% in 0.25% increments
    for (let rate = 0; rate <= 8; rate += 0.25) {
      const payment = calculateMonthlyPayment(principal, rate, termMonths);
      const difference = Math.abs(payment - targetPayment);
      
      // Track the rate that gets closest to target
      if (difference < bestDifference) {
        bestDifference = difference;
        bestRate = rate;
      }
      
      // Stop early if we found exact match or close enough
      if (difference < targetPayment * 0.01) {
        // Within 1% of target, good enough
        return Math.round(bestRate * 100) / 100;
      }
    }
    
    return Math.round(bestRate * 100) / 100;
  }

  // Helper function to find amortization period needed to achieve target payment at 0% interest
  function findAmortizationForPayment(principal, targetPayment, maxMonths = 360) {
    if (principal <= 0 || targetPayment <= 0) return maxMonths;
    
    // At 0% interest, payment = principal / months
    // Solving for months: months = principal / targetPayment
    const neededMonths = principal / targetPayment;
    
    // Return the needed months, but cap at maxMonths
    return Math.min(Math.max(neededMonths, 72), maxMonths);
  }

  // Helper to create scenarios based on different down payment and payment percentage options
  // Scenarios use different offer prices: +5% or +10% above asking
  function createRentalIncomeScenario(name, downPaymentPercent, paymentPercentage, offerMultiplier = 1.0, tags = []) {
    const offerPrice = askingPrice * offerMultiplier; // Use offer multiplier (1.05 or 1.10 for above asking)
    const downPayment = offerPrice * (downPaymentPercent / 100);
    const financedAmount = offerPrice - downPayment;
    const amortizationMonths = 300; // Fixed 25-year amortization for all scenarios
    const interestRate = 0; // 0% seller financing
    
    // Calculate monthly payment based on payment percentage of rental income
    const targetMonthlyPayment = monthlyRent * (paymentPercentage / 100);
    
    // At 0% interest, payment = principal / months
    // This ensures payment aligns with rental income percentage
    const actualMonthlyPayment = financedAmount / amortizationMonths;
    
    // Use the target payment to calculate actual amortization period needed
    const amortizationMonthsForPayment = Math.min(300, Math.max(72, financedAmount / targetMonthlyPayment));
    const monthlyPayment = calculateMonthlyPayment(financedAmount, interestRate, Math.round(amortizationMonthsForPayment));
    
    // Calculate balloon balance (what's left after 6 years of payments)
    const monthsUntilBalloon = balloonTermMonths;
    let remainingBalance = financedAmount;
    for (let i = 0; i < monthsUntilBalloon; i++) {
      const interestPayment = remainingBalance * (interestRate / 100 / 12);
      const principalPayment = monthlyPayment - interestPayment;
      remainingBalance -= principalPayment;
    }
    const balloonPayment = Math.max(0, remainingBalance);
    
    const monthlyCashFlow = monthlyNOI - monthlyPayment;
    const annualCashFlow = monthlyCashFlow * 12;
    const totalCashInvested = downPayment + assignmentFee;
    const cashOnCash = totalCashInvested > 0 ? (annualCashFlow / totalCashInvested) * 100 : 0;

    let status = 'Not Viable';
    if (cashOnCash >= 20) {
      status = 'Strong';
    } else if (cashOnCash >= 13) {
      status = 'Strong';
    } else if (cashOnCash >= 8) {
      status = 'Acceptable';
    } else if (monthlyCashFlow > 0) {
      status = 'Weak';
    }

    return {
      name,
      tags,
      offer_price: offerPrice,
      down_payment_percent: downPaymentPercent,
      down_payment: downPayment,
      financed_amount: financedAmount,
      interest_rate: interestRate,
      balloon_term_months: balloonTermMonths,
      balloon_term_years: 6,
      amortization_months: Math.round(amortizationMonthsForPayment),
      amortization_years: Math.round(amortizationMonthsForPayment / 12 * 10) / 10,
      monthly_payment: monthlyPayment,
      balloon_payment: balloonPayment,
      annual_debt_service: monthlyPayment * 12,
      monthly_noi: monthlyNOI,
      monthly_cash_flow: monthlyCashFlow,
      annual_cash_flow: annualCashFlow,
      cash_on_cash: cashOnCash,
      assignment_fee: assignmentFee,
      total_cash_invested: totalCashInvested,
      payment_percentage_of_income: paymentPercentage,
      status,
      recommendation: status === 'Strong' ? 'PURSUE' : status === 'Acceptable' ? 'REVIEW' : status === 'Weak' ? 'NEGOTIATE' : 'PASS'
    };
  }

  // === SCENARIO CREATION ===
  const scenarios = [];

  // Create 12 scenarios: 3 down payment levels (5%, 7.5%, 10%) × 2 payment percentages (40%, 50%) × 2 offer levels (+5%, +10%)
  
  // === SCENARIOS AT +5% ABOVE ASKING PRICE ===
  
  // 5% Down Payment - 40% of Rental Income - 5% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '5% Down, 40% Income (+5% Offer)',
    5,
    40,
    1.05,
    ['Seller Finance', '6yr Balloon', '5% Down', '40% Income', '+5% Offer']
  ));

  // 5% Down Payment - 50% of Rental Income - 5% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '5% Down, 50% Income (+5% Offer)',
    5,
    50,
    1.05,
    ['Seller Finance', '6yr Balloon', '5% Down', '50% Income', '+5% Offer']
  ));

  // 7.5% Down Payment - 40% of Rental Income - 5% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '7.5% Down, 40% Income (+5% Offer)',
    7.5,
    40,
    1.05,
    ['Seller Finance', '6yr Balloon', '7.5% Down', '40% Income', '+5% Offer']
  ));

  // 7.5% Down Payment - 50% of Rental Income - 5% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '7.5% Down, 50% Income (+5% Offer)',
    7.5,
    50,
    1.05,
    ['Seller Finance', '6yr Balloon', '7.5% Down', '50% Income', '+5% Offer']
  ));

  // 10% Down Payment - 40% of Rental Income - 5% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '10% Down, 40% Income (+5% Offer)',
    10,
    40,
    1.05,
    ['Seller Finance', '6yr Balloon', '10% Down', '40% Income', '+5% Offer']
  ));

  // 10% Down Payment - 50% of Rental Income - 5% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '10% Down, 50% Income (+5% Offer)',
    10,
    50,
    1.05,
    ['Seller Finance', '6yr Balloon', '10% Down', '50% Income', '+5% Offer']
  ));

  // === SCENARIOS AT +10% ABOVE ASKING PRICE ===
  
  // 5% Down Payment - 40% of Rental Income - 10% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '5% Down, 40% Income (+10% Offer)',
    5,
    40,
    1.10,
    ['Seller Finance', '6yr Balloon', '5% Down', '40% Income', '+10% Offer']
  ));

  // 5% Down Payment - 50% of Rental Income - 10% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '5% Down, 50% Income (+10% Offer)',
    5,
    50,
    1.10,
    ['Seller Finance', '6yr Balloon', '5% Down', '50% Income', '+10% Offer']
  ));

  // 7.5% Down Payment - 40% of Rental Income - 10% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '7.5% Down, 40% Income (+10% Offer)',
    7.5,
    40,
    1.10,
    ['Seller Finance', '6yr Balloon', '7.5% Down', '40% Income', '+10% Offer']
  ));

  // 7.5% Down Payment - 50% of Rental Income - 10% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '7.5% Down, 50% Income (+10% Offer)',
    7.5,
    50,
    1.10,
    ['Seller Finance', '6yr Balloon', '7.5% Down', '50% Income', '+10% Offer']
  ));

  // 10% Down Payment - 40% of Rental Income - 10% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '10% Down, 40% Income (+10% Offer)',
    10,
    40,
    1.10,
    ['Seller Finance', '6yr Balloon', '10% Down', '40% Income', '+10% Offer']
  ));

  // 10% Down Payment - 50% of Rental Income - 10% Above Asking
  scenarios.push(createRentalIncomeScenario(
    '10% Down, 50% Income (+10% Offer)',
    10,
    50,
    1.10,
    ['Seller Finance', '6yr Balloon', '10% Down', '50% Income', '+10% Offer']
  ));

  // === DSCR LOAN COMPARISON ===
  // Use asking price only for DSCR analysis
  const dscrOfferPrice = askingPrice;
  const downPaymentDSCR = dscrOfferPrice * 0.20; // Standard 20% down
  const loanAmount = dscrOfferPrice - downPaymentDSCR;
  const monthlyPaymentDSCR = calculateMonthlyPayment(loanAmount, 7, 360);
  const annualDebtService = monthlyPaymentDSCR * 12;
  const dscr = annualNOI / annualDebtService;

  // Find offer price below asking that would allow DSCR to qualify (>= 1.25)
  let qualifyingOfferPrice = null;
  let qualifyingMonthlyPayment = null;
  let qualifyingDownPayment = null;
  let qualifyingLoanAmount = null;
  let qualifyingDSCR = null;
  
  if (dscr < 1.25) {
    // Need to find a lower price point that qualifies
    // Target DSCR = annualNOI / targetDebtService = 1.25
    // So targetDebtService = annualNOI / 1.25
    const targetDebtService = annualNOI / 1.25;
    const targetMonthlyPayment = targetDebtService / 12;
    
    // Binary search for qualifying price (price where monthly payment = target)
    let low = askingPrice * 0.3;  // Start lower
    let high = askingPrice;
    let bestPrice = null;
    let bestDiff = Infinity;
    
    for (let i = 0; i < 30; i++) {
      const mid = (low + high) / 2;
      const testDownPayment = mid * 0.20;
      const testLoanAmount = mid - testDownPayment;
      const testMonthlyPayment = calculateMonthlyPayment(testLoanAmount, 7, 360);
      const diff = Math.abs(testMonthlyPayment - targetMonthlyPayment);
      
      // Track closest match that qualifies
      if (testMonthlyPayment <= targetMonthlyPayment && diff < bestDiff) {
        bestPrice = mid;
        bestDiff = diff;
      }
      
      // Adjust search range
      if (testMonthlyPayment > targetMonthlyPayment) {
        high = mid;
      } else {
        low = mid;
      }
    }
    
    // Only use qualifying price if it's meaningfully below asking (at least 5% discount)
    if (bestPrice && bestPrice < askingPrice * 0.95) {
      qualifyingOfferPrice = bestPrice;
      qualifyingDownPayment = bestPrice * 0.20;
      qualifyingLoanAmount = bestPrice - qualifyingDownPayment;
      qualifyingMonthlyPayment = calculateMonthlyPayment(qualifyingLoanAmount, 7, 360);
      qualifyingDSCR = annualNOI / (qualifyingMonthlyPayment * 12);
    }
  }

  // Calculate CoC return at qualifying offer price (if available)
  let qualifyingCoC = null;
  if (qualifyingOfferPrice) {
    const qualifyingCoCMonthly = monthlyNOI - qualifyingMonthlyPayment;
    qualifyingCoC = ((qualifyingCoCMonthly * 12) / qualifyingDownPayment) * 100;
  }

  // Calculate required down payment % at asking price for DSCR 1.25
  let requiredDownPaymentPercent = null;
  let requiredDownPaymentAmount = null;
  let requiredDownPaymentCoC = null;
  if (dscr < 1.25) {
    // Find down payment % where DSCR = 1.25 at asking price
    for (let dpPercent = 20; dpPercent <= 50; dpPercent += 0.5) {
      const testDownPayment = askingPrice * (dpPercent / 100);
      const testLoanAmount = askingPrice - testDownPayment;
      const testMonthlyPayment = calculateMonthlyPayment(testLoanAmount, 7, 360);
      const testDSCR = annualNOI / (testMonthlyPayment * 12);
      
      if (testDSCR >= 1.25) {
        requiredDownPaymentPercent = dpPercent;
        requiredDownPaymentAmount = testDownPayment;
        const testCoCMonthly = monthlyNOI - testMonthlyPayment;
        requiredDownPaymentCoC = ((testCoCMonthly * 12) / testDownPayment) * 100;
        break;
      }
    }
  }

  const dscrLoan = {
    name: 'Traditional DSCR Loan',
    tags: ['Bank Loan', 'Conforming'],
    offer_price: dscrOfferPrice,
    down_payment_percent: 20,
    down_payment: downPaymentDSCR,
    financed_amount: loanAmount,
    interest_rate: 7,
    term_months: 360,
    term_years: 30,
    monthly_payment: monthlyPaymentDSCR,
    annual_debt_service: annualDebtService,
    monthly_noi: monthlyNOI,
    monthly_cash_flow: monthlyNOI - monthlyPaymentDSCR,
    annual_cash_flow: (monthlyNOI - monthlyPaymentDSCR) * 12,
    dscr_ratio: dscr,
    dscr_required: 1.25,
    cash_on_cash: (((monthlyNOI - monthlyPaymentDSCR) * 12) / downPaymentDSCR) * 100,
    status: dscr >= 1.25 ? 'Strong' : 'Not Viable',
    recommendation: dscr >= 1.25 ? 'QUALIFY' : 'NOT QUALIFIED',
    dscr_note: `DSCR ${dscr.toFixed(2)} ${dscr >= 1.25 ? '✓ MEETS' : '✗ FAILS'} lender requirement (1.25 min)`,
    qualifying_offer_price: qualifyingOfferPrice,
    qualifying_down_payment: qualifyingDownPayment,
    qualifying_coc_return: qualifyingCoC,
    qualifying_price_note: dscr >= 1.25 
      ? 'Already qualifies at asking price ✓'
      : qualifyingOfferPrice 
        ? `Offer at $${qualifyingOfferPrice.toLocaleString('en-US', { maximumFractionDigits: 0 })} achieves DSCR ${qualifyingDSCR.toFixed(2)} ✓`
        : `Need offer significantly below asking price to achieve DSCR 1.25`,
    required_down_payment_percent: requiredDownPaymentPercent,
    required_down_payment_amount: requiredDownPaymentAmount,
    required_down_payment_coc: requiredDownPaymentCoC
  };

  return {
    property_id: property.id,
    address: property.address,
    city: property.city,
    state: property.state,
    assumptions,
    scenarios,
    dscr_loan: dscrLoan,
    assignment_fee: assignmentFee,
    summary: {
      best_scenario: scenarios.reduce((best, current) => 
        current.cash_on_cash > best.cash_on_cash ? current : best
      ),
      scenarios_count: scenarios.length,
      strong_scenarios: scenarios.filter(s => s.status === 'Strong').length,
      acceptable_scenarios: scenarios.filter(s => s.status === 'Acceptable').length,
      weak_scenarios: scenarios.filter(s => s.status === 'Weak').length
    }
  };
}

/**
 * Sync analysis financial summary and criteria with baseline scenario (5% Down, 40% Income)
 * This ensures all displayed metrics are based on the first/baseline scenario
 * @param {Object} analysis - Original analysis object
 * @param {Object} comprehensiveScenarios - Scenarios object from generateComprehensiveScenarios
 * @returns {Object} Updated analysis object with synced financial summary and criteria
 */
function syncAnalysisWithBaselineScenario(analysis, comprehensiveScenarios, property) {
  if (!comprehensiveScenarios || !comprehensiveScenarios.scenarios || comprehensiveScenarios.scenarios.length === 0) {
    return analysis;
  }

  // Get baseline scenario (5% Down, 40% Income) - always first scenario
  const baselineScenario = comprehensiveScenarios.scenarios[0];

  if (!baselineScenario) {
    return analysis;
  }

  // Get property value from baseline scenario offer price (with fallback)
  const propertyValue = baselineScenario.offer_price || 0;

  // Generate fresh criteria based ONLY on baseline scenario
  const passedCriteria = [];
  const failedCriteria = [];

  // Criteria 0: State Compliance Check (FIRST CHECK - if this fails, deal is blocked)
  const stateCode = (property && property.state) ? property.state.toUpperCase() : 'UNKNOWN';
  if (!AVOID_STATES.includes(stateCode)) {
    passedCriteria.push({ 
      criterion: 'State Compliance', 
      value: stateCode, 
      status: 'PASS' 
    });
  } else {
    failedCriteria.push({ 
      criterion: 'State Compliance', 
      value: stateCode, 
      reason: `Wholesaling restricted in ${stateCode}` 
    });
  }

  // Criteria 1: Monthly Cashflow ≥ $200
  if (baselineScenario.monthly_cash_flow >= 200) {
    passedCriteria.push({ 
      criterion: 'Monthly Cashflow ≥ $200', 
      value: `$${baselineScenario.monthly_cash_flow.toFixed(2)}/mo`, 
      status: 'PASS' 
    });
  } else {
    failedCriteria.push({ 
      criterion: 'Monthly Cashflow ≥ $200', 
      value: `$${baselineScenario.monthly_cash_flow.toFixed(2)}/mo`, 
      reason: 'Below $200 minimum' 
    });
  }

  // Criteria 2: Property Value < $500k
  if (propertyValue < 500000) {
    passedCriteria.push({ 
      criterion: 'Property Value < $500k', 
      value: `$${propertyValue.toLocaleString()}`, 
      status: 'PASS' 
    });
  } else {
    failedCriteria.push({ 
      criterion: 'Property Value < $500k', 
      value: `$${propertyValue.toLocaleString()}`, 
      reason: 'Exceeds $500k' 
    });
  }

  // Criteria 3: Cash-on-Cash ≥ 13% with baseline scenario down payment (5%)
  if (baselineScenario.cash_on_cash >= 13) {
    passedCriteria.push({ 
      criterion: `Cash-on-Cash ≥ 13% (${baselineScenario.down_payment_percent}% down)`, 
      value: `${baselineScenario.cash_on_cash.toFixed(1)}%`, 
      status: 'PASS' 
    });
  } else {
    failedCriteria.push({ 
      criterion: `Cash-on-Cash ≥ 13% (${baselineScenario.down_payment_percent}% down)`, 
      value: `${baselineScenario.cash_on_cash.toFixed(1)}%`, 
      reason: 'Below 13% threshold' 
    });
  }

  // Criteria 4: Financing Terms Viable
  passedCriteria.push({ 
    criterion: 'Financing Terms Viable', 
    value: '0-4% rates available', 
    status: 'PASS' 
  });

  // Update financial_summary to match baseline scenario
  const updatedAnalysis = {
    ...analysis,
    financial_summary: {
      monthly_noi: comprehensiveScenarios.assumptions.monthly_noi,
      annual_noi: comprehensiveScenarios.assumptions.annual_noi,
      down_payment: baselineScenario.down_payment,
      down_payment_percent: baselineScenario.down_payment_percent,
      monthly_payment: baselineScenario.monthly_payment,
      monthly_payment_percent: baselineScenario.payment_percentage_of_income,
      monthly_cash_flow: baselineScenario.monthly_cash_flow,
      annual_cash_flow: baselineScenario.annual_cash_flow,
      cash_on_cash: baselineScenario.cash_on_cash,
      financed_amount: baselineScenario.financed_amount,
      balloon_payment: baselineScenario.balloon_payment,
      balloon_term_years: baselineScenario.balloon_term_years
    },
    cashflow_amount: baselineScenario.monthly_cash_flow,
    cashflow_positive: baselineScenario.monthly_cash_flow >= 0,
    
    // Generate fresh criteria breakdown based on baseline scenario
    criteria_breakdown: {
      baseline_scenario_name: baselineScenario.name,
      baseline_down_payment_percent: baselineScenario.down_payment_percent,
      baseline_payment_percent_of_income: baselineScenario.payment_percentage_of_income,
      baseline_monthly_payment: baselineScenario.monthly_payment,
      baseline_monthly_cash_flow: baselineScenario.monthly_cash_flow,
      baseline_cash_on_cash: baselineScenario.cash_on_cash,
      passed: passedCriteria,
      failed: failedCriteria,
      total_tests: passedCriteria.length + failedCriteria.length,
      passed_count: passedCriteria.length,
      failed_count: failedCriteria.length
    }
  };

  // Update recommendation based on baseline scenario status
  if (baselineScenario.status === 'Strong') {
    updatedAnalysis.recommendation = `PURSUE - Baseline scenario (${baselineScenario.name}) is strong with ${baselineScenario.cash_on_cash.toFixed(1)}% CoC return`;
  } else if (baselineScenario.status === 'Acceptable') {
    updatedAnalysis.recommendation = `REVIEW - Baseline scenario (${baselineScenario.name}) is acceptable with ${baselineScenario.cash_on_cash.toFixed(1)}% CoC return`;
  } else {
    updatedAnalysis.recommendation = `PASS - Baseline scenario (${baselineScenario.name}) shows weak returns of ${baselineScenario.cash_on_cash.toFixed(1)}% CoC`;
  }

  return updatedAnalysis;
}

module.exports = {
  analyzeProperty,
  calculateFinancingOptions,
  calculateDSCRRequirements,
  calculateMonthlyPayment,
  calculateGrossNOI,
  generateComprehensiveScenarios,
  syncAnalysisWithBaselineScenario,
  AVOID_STATES
};
