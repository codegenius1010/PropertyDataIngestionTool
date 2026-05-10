const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  console.log('Running database migrations...');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'migration.sql');
    const migrationSql = fs.readFileSync(migrationPath, 'utf-8');

    // Create connection
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      multipleStatements: true
    });

    console.log('✓ Connected to MariaDB');

    // Execute the migration SQL
    await connection.execute(migrationSql);

    console.log('✓ Migration completed successfully!');
    console.log('✓ Added columns: sync_enabled, rental_income, mortgage_principal, mortgage_rate, mortgage_term, estimated_arv, estimated_repair_cost');
    console.log('✓ Created table: property_analysis');

    await connection.end();
  } catch (error) {
    console.error('✗ Error running migration:', error.message);
    process.exit(1);
  }
}

runMigration();
