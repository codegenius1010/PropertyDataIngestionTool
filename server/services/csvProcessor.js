const fs = require('fs');
const csv = require('csv-parser');
const pool = require('../config/database');

class CSVProcessorService {
  /**
   * Process CSV file and insert into database
   */
  async processCSVFile(filePath, loadId) {
    return new Promise(async (resolve, reject) => {
      let successCount = 0;
      let failureCount = 0;
      const errors = [];
      const properties = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          properties.push(this.mapCSVRowToProperty(row, loadId));
        })
        .on('end', async () => {
          try {
            // Batch insert properties
            for (const property of properties) {
              try {
                await this.insertProperty(property);
                successCount++;
              } catch (error) {
                failureCount++;
                console.error('Insert error for property:', error.message, 'Property:', property);
                errors.push({
                  row: property.mls_id || 'unknown',
                  error: error.message
                });
              }
            }

            resolve({
              successCount,
              failureCount,
              errors,
              totalProcessed: properties.length
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Map CSV columns to property object
   */
  mapCSVRowToProperty(row, loadId) {
    return {
      mls_id: row.Id || row.id || '',
      address: row.Address || row.address || '',
      city: row.City || row.city || '',
      state: row.State || row.state || '',
      zip_code: row.Zip || row.zip || row['Zip Code'] || '',
      county: row.County || row.county || '',
      living_square_feet: parseInt(row['Living Square Feet'] || 0),
      year_built: parseInt(row['Year Built'] || row.YearBuilt || 0),
      lot_acres: parseFloat(row['Lot (Acres)'] || 0),
      lot_square_feet: parseFloat(row['Lot (Square Feet)'] || 0),
      land_use: row['Land Use'] || '',
      property_type: row['Property Type'] || row.PropertyType || '',
      property_use: row['Property Use'] || '',
      subdivision: row.Subdivision || '',
      apn: row.APN || '',
      legal_description: row['Legal Description'] || '',
      units_count: parseInt(row['Units Count'] || 0),
      bedrooms: parseInt(row.Bedrooms || row.bedrooms || 0),
      bathrooms: parseFloat(row.Bathrooms || row.bathrooms || 0),
      stories: parseInt(row['# of Stories'] || 0),
      garage_type: row['Garage Type'] || '',
      garage_square_feet: parseInt(row['Garage Square Feet'] || 0),
      carport: row.Carport || '',
      carport_area: parseFloat(row['Carport Area'] || 0),
      air_conditioning_type: row['Air Conditioning Type'] || '',
      heating_type: row['Heating Type'] || '',
      fireplaces: parseInt(row['# of Fireplaces'] || 0),
      owner1_first_name: row['Owner 1 First Name'] || '',
      owner1_last_name: row['Owner 1 Last Name'] || '',
      owner_mailing_address: row['Owner Mailing Address'] || '',
      owner_mailing_city: row['Owner Mailing City'] || '',
      owner_mailing_state: row['Owner Mailing State'] || '',
      owner_mailing_zip: row['Owner Mailing Zip'] || '',
      ownership_length_months: parseInt(row['Ownership Length (Months)'] || 0),
      owner_type: row['Owner Type'] || '',
      owner_occupied: row['Owner Occupied'] || '',
      vacant: row['Vacant?'] || '',
      listing_status: row['Listing Status'] || '',
      listing_price: parseFloat(row['Listing Price'] || 0),
      days_on_market: parseInt(row['Days on Market'] || 0),
      last_updated: row['Last Updated'] || '',
      agent_name: row['Listing Agent Full Name'] || '',
      agent_first_name: row['Listing Agent First Name'] || '',
      agent_last_name: row['Listing Agent Last Name'] || '',
      agent_email: row['Listing Agent Email'] || '',
      agent_phone: row['Listing Agent Phone'] || '',
      brokerage_name: row['Listing Brokerage Name'] || '',
      brokerage_phone: row['Listing Brokerage Phone'] || '',
      mls_type: row['MLS Type'] || '',
      last_sale_date: row['Last Sale Date'] || '',
      last_sale_amount: parseFloat(row['Last Sale Amount'] || 0),
      estimated_value: parseFloat(row['Estimated Value'] || 0),
      estimated_equity: parseFloat(row['Estimated Equity'] || 0),
      market_value: parseFloat(row['Market Value'] || 0),
      tax_amount: parseFloat(row['Tax Amount'] || 0),
      assessment_year: parseInt(row['Assessment Year'] || 0),
      assessed_total_value: parseFloat(row['Assessed Total Value'] || 0),
      // Mortgage and rental data fields (for deal analysis)
      mortgage_principal: parseFloat(row['Open Mortgage Balance'] || 0),
      mortgage_rate: parseFloat(row['Recorded Mortgage Interest Rate'] || 0),
      rental_income: parseFloat(row['Annual Rental Income'] || row['Monthly Rental Income'] || 0),
      load_id: loadId
    };
  }

  /**
   * Insert single property into database
   */
  async insertProperty(property) {
    const connection = await pool.getConnection();
    try {
      // Build dynamic INSERT to only include properties that exist
      const columns = [];
      const values = [];
      const placeholders = [];

      // List of all possible property columns
      const propertyKeys = [
        'mls_id', 'address', 'city', 'state', 'zip_code', 'county', 'living_square_feet',
        'year_built', 'lot_acres', 'lot_square_feet', 'land_use', 'property_type',
        'property_use', 'subdivision', 'apn', 'legal_description', 'units_count',
        'bedrooms', 'bathrooms', 'stories', 'garage_type', 'garage_square_feet',
        'carport', 'carport_area', 'air_conditioning_type', 'heating_type', 'fireplaces',
        'owner1_first_name', 'owner1_last_name', 'owner_mailing_address',
        'owner_mailing_city', 'owner_mailing_state', 'owner_mailing_zip',
        'ownership_length_months', 'owner_type', 'owner_occupied', 'vacant',
        'listing_status', 'listing_price', 'days_on_market', 'last_updated',
        'agent_name', 'agent_first_name', 'agent_last_name', 'agent_email', 'agent_phone',
        'brokerage_name', 'brokerage_phone', 'mls_type', 'last_sale_date',
        'last_sale_amount', 'estimated_value', 'estimated_equity', 'market_value',
        'tax_amount', 'assessment_year', 'assessed_total_value', 
        'mortgage_principal', 'mortgage_rate', 'rental_income', 'load_id'
      ];

      // Build the INSERT statement dynamically
      for (const key of propertyKeys) {
        if (property[key] !== undefined) {
          columns.push(key);
          values.push(property[key]);
          placeholders.push('?');
        }
      }

      const query = `
        INSERT INTO properties (${columns.join(', ')})
        VALUES (${placeholders.join(', ')})
      `;

      await connection.execute(query, values);
    } catch (error) {
      console.error('Database insert error:', error.message, 'SQL Code:', error.code);
      throw error;
    } finally {
      connection.release();
    }
  }
}

module.exports = new CSVProcessorService();
