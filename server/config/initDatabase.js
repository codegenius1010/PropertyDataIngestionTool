const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initializeDatabase() {
  console.log('Initializing database schema...');
  
  try {
    // Read the schema SQL file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf-8');

    // Create connection to MySQL (without specifying database initially)
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      multipleStatements: true
    });

    console.log('Connected to MariaDB successfully');

    // Execute the schema SQL
    await connection.execute(schemaSql);

    console.log('✓ Database schema initialized successfully!');
    console.log(`✓ Database: ${process.env.DB_NAME}`);
    console.log('✓ Tables created: properties, loads, ghl_automations_log, property_analysis');

    await connection.end();
  } catch (error) {
    console.error('✗ Error initializing database:', error.message);
    process.exit(1);
  }
}

initializeDatabase();
