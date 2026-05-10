-- Add missing columns to properties table
ALTER TABLE properties ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT true;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS rental_income DECIMAL(12, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS mortgage_principal DECIMAL(12, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS mortgage_rate DECIMAL(5, 3);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS mortgage_term INT;
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_arv DECIMAL(12, 2);
ALTER TABLE properties ADD COLUMN IF NOT EXISTS estimated_repair_cost DECIMAL(12, 2);

-- Create property_analysis table if it doesn't exist
CREATE TABLE IF NOT EXISTS property_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  property_id INT NOT NULL UNIQUE,
  analysis_type ENUM('subto', 'owner_financing', 'multi_family', 'unknown') DEFAULT 'unknown',
  overall_score VARCHAR(20),
  state_pass BOOLEAN,
  state_pass_reason VARCHAR(500),
  cashflow_positive BOOLEAN,
  cashflow_amount DECIMAL(12, 2),
  subto_criteria_met BOOLEAN,
  subto_failures JSON,
  owner_financing_criteria_met BOOLEAN,
  owner_financing_failures JSON,
  multi_family_criteria_met BOOLEAN,
  multi_family_failures JSON,
  dscr_loan_qualified BOOLEAN,
  dscr_monthly_required DECIMAL(12, 2),
  financing_option_asking DECIMAL(12, 2),
  financing_option_asking_rate DECIMAL(5, 3),
  financing_option_above_asking DECIMAL(12, 2),
  financing_option_above_asking_rate DECIMAL(5, 3),
  green_light BOOLEAN,
  yellow_light BOOLEAN,
  red_light BOOLEAN,
  analysis_notes TEXT,
  recommendation VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
  INDEX idx_property_id (property_id),
  INDEX idx_overall_score (overall_score),
  INDEX idx_created_at (created_at)
);
