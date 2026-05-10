const pool = require('./database');

async function addInputAssumptionsColumn() {
  const connection = await pool.getConnection();
  try {
    console.log('Checking if input_assumptions column exists...');
    
    // Check if column exists
    const [rows] = await connection.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_NAME = 'property_analysis' 
      AND COLUMN_NAME = 'input_assumptions'
      AND TABLE_SCHEMA = DATABASE()
    `);

    if (rows.length === 0) {
      console.log('Column does not exist. Adding input_assumptions column...');
      await connection.execute(`
        ALTER TABLE property_analysis 
        ADD COLUMN input_assumptions JSON DEFAULT NULL 
        AFTER recommendation
      `);
      console.log('✓ input_assumptions column added successfully');
    } else {
      console.log('✓ input_assumptions column already exists');
    }
  } catch (error) {
    console.error('Error adding column:', error.message);
  } finally {
    connection.release();
    process.exit(0);
  }
}

addInputAssumptionsColumn();
