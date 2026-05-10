# 📊 Analysis Features Update - Quick Guide

## New Features Added

### 1. **Analysis Results Dashboard** (`/analysis`)
A visual overview page showing all uploaded properties with traffic light indicators (Green/Yellow/Red):
- **Green (🟢)** - Properties that meet investment criteria and are worth pursuing
- **Yellow (🟡)** - Properties that need review/consideration (may not fully meet criteria)
- **Red (🔴)** - Properties that don't meet criteria and should be passed on

**Features:**
- View all properties at a glance with visual traffic lights
- Filter by status (Green/Yellow/Red) or search by address/city/state
- Quick statistics showing totals by status
- "Analyze All Properties" button to run analysis on unanalyzed properties
- Click any property card to view detailed analysis

### 2. **Detailed Analysis View** (`/analysis/:propertyId`)
Comprehensive analysis page for each property including:

#### Analysis Summary
- Deal type classification (SubTo, Owner Financing, Multi-Family)
- Passing and failing criteria for the specific deal type
- Clear indicators of which requirements are met or not

#### DSCR Scenario Matrix & Offer Recommendations
The system now generates 3+ seller financing scenarios:

1. **Asking Price Scenario** (4% interest, 6-year balloon)
   - Conservative offer at list price
   - Good for building rapport with sellers

2. **10% Above Asking Scenario** (0% interest, 6-year balloon)
   - Best risk-adjusted returns
   - Most attractive to sellers
   - Maximizes investor returns

3. **5% Above Asking Scenario** (2% interest, 6-year balloon)
   - Middle-ground option
   - Balance of price and terms

Each scenario shows:
- Offer price, down payment, and financed amount
- Monthly payment, NOI, and cashflow
- **Cash-on-Cash Return** (target: 13%+)
- Status (Strong/Acceptable/Weak/Not Viable)

#### Monthly Breakdown
Shows expense calculations:
- Gross monthly rent
- Vacancy (5%), Maintenance (10%), CapEx (5%)
- Taxes and Insurance
- Monthly NOI (Net Operating Income)

#### DSCR Loan Comparison
Compares seller financing to traditional DSCR loans:
- Standard terms: 20% down, 7% interest, 30-year term
- Shows if property qualifies (DSCR ≥ 1.25)
- Helps determine if seller financing is necessary

#### Deal Interpretation
Analysis summary with key insights

#### Recommended Next Steps
Clear guidance on whether to pursue, review, or pass on the deal

#### Risk Assessment
- Categorized risks (High/Medium/Low)
- Specific issues to watch

## How to Use

### Step 1: Upload Properties
1. Go to **Upload CSV** page
2. Upload your property data CSV file
3. Wait for upload to complete

### Step 2: Analyze Properties
1. Go to **Analysis** page
2. Click **"Analyze All Properties"** button
3. Wait for analysis to complete

### Step 3: Review Results
- See all properties with color-coded traffic lights
- Use filters to focus on Green/Yellow/Red deals
- Click on any property to see detailed analysis

### Step 4: Make Decisions
- **Green deals** → Ready to sync with GHL and present to agents
- **Yellow deals** → Review details and use scenarios to make offer
- **Red deals** → Consider passing or doing more due diligence

## Analysis Criteria Used

### SubTo (Subject To Existing Mortgage)
✓ $150+ monthly positive cashflow
✓ Mortgage under $150k at max 8% interest OR over $150k at max 5%
✓ Property value < $500,000
✓ Max 15% equity in property
✓ Fixed rate interest only
✓ Max 15% down payment

### Owner Financing (No Existing Mortgage)
✓ $200+ monthly cashflow
✓ Property value < $500,000
✓ 13%+ cash-on-cash return (with 10% down)
✓ Max 4% interest (ideally 0% with above asking)
✓ 5-6 year balloon term
✓ Max 15% down (ideally under 10%)

### Multi-Family Owner Financing
✓ 2+ units
✓ Property value < $3,000,000
✓ Rental income available
✓ Payment-to-rent ratio ≤ 40%
✓ 10% down, 6-year balloon

### DSCR Requirements
✓ Traditional loan: 20% down, 7% interest
✓ Needs DSCR ≥ 1.25 to qualify
✓ DSCR = Annual NOI / Annual Debt Service

## State Restrictions
**Don't Wholesale In:** Illinois, Oregon, Washington, South Carolina, New Jersey

**Caution (Low Population):** North Dakota, South Dakota, Wyoming, Alaska
(These get downgraded from Green to Yellow)

## Next Steps for Agents

Once a deal is marked Green and ready to sync:

1. Review detailed analysis and scenarios
2. Choose best offer scenario based on seller motivation
3. Sync property to GHL for agent notification
4. Present recommended scenario to property owner/agent
5. Negotiate using the scenario matrix as guide

## Technical Details

- Analysis runs automatically when properties are viewed
- Criteria based on investment requirements and DSCR standards
- Scenario matrix calculates realistic deal structures
- All assumptions clearly shown (vacancy, maintenance, etc.)

---

**Need help?** Check the detailed analysis sections for:
- Specific criteria failing and why
- Alternative scenarios that might work
- DSCR qualification status for financing options
