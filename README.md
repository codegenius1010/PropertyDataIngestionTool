# Property Data Ingestion Tool

A comprehensive tool for ingesting property CSV data into MariaDB, triggering GoHighLevel automations, and sending agent notifications via email and SMS.

## Features

✅ **CSV Upload & Processing** - Upload property data CSV files with flexible column mapping
✅ **MariaDB Integration** - Automatic database schema creation and data storage
✅ **GoHighLevel Automation** - Automatically trigger email and SMS notifications to agents
✅ **Load History** - Track all CSV imports with detailed statistics
✅ **Browser-Based UI** - Simple, intuitive interface for uploads and monitoring
✅ **Real-time Status** - Monitor processing status and automation results

## Project Structure

```
wholesale/
├── server/                  # Node.js/Express backend
│   ├── config/             # Database and configuration
│   ├── controllers/        # Request handlers
│   ├── routes/            # API routes
│   ├── services/          # Business logic
│   │   ├── csvProcessor.js
│   │   ├── goHighLevel.js
│   │   └── loadService.js
│   └── index.js           # Server entry point
├── client/                # React frontend
│   ├── src/
│   │   ├── pages/
│   │   │   ├── UploadPage.js
│   │   │   └── HistoryPage.js
│   │   ├── App.js
│   │   └── index.js
│   └── package.json
├── .env                   # Environment configuration
├── package.json          # Root dependencies
└── README.md            # This file
```

## Prerequisites

- **Node.js** (v14 or higher) - https://nodejs.org/
- **MariaDB** (v10.5 or higher) - https://mariadb.org/download/
- **npm** (comes with Node.js)
- **GoHighLevel Account** (optional, for automations)

## Installation

### 1. Clone/Setup Repository
```bash
cd c:\Users\agend\OneDrive\Desktop\Work\VS_Code_App_Builds\wholesale
```

### 2. Install Dependencies

```bash
# Install root dependencies
npm install

# Install client dependencies
cd client
npm install
cd ..
```

### 3. Setup Database

```bash
# Connect to MariaDB
mysql -u root -p

# Run the schema script
source server/config/schema.sql
```

Or if you prefer command line:
```bash
mysql -u root -p property_data < server/config/schema.sql
```

### 4. Configure Environment Variables

Edit the `.env` file in the root directory:

```bash
# Server Configuration
PORT=5000
NODE_ENV=development

# MariaDB Configuration
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_mariadb_password
DB_NAME=property_data

# GoHighLevel Configuration (optional)
GHL_API_KEY=your_ghl_api_key_here
GHL_LOCATION_ID=your_ghl_location_id_here
GHL_WEBHOOK_URL=https://your-webhook-url

# Email Configuration (optional)
EMAIL_SERVICE=gmail
EMAIL_USER=your_email@gmail.com
EMAIL_PASSWORD=your_app_password_here
EMAIL_FROM=noreply@yourdomain.com

# SMS Configuration (optional, Twilio)
SMS_ACCOUNT_SID=your_twilio_account_sid
SMS_AUTH_TOKEN=your_twilio_auth_token
SMS_PHONE_NUMBER=+1234567890
```

## Running the Application

### Development Mode (with auto-reload)

```bash
# Terminal 1: Start the backend server
npm run dev

# Terminal 2: Start the React development server
npm run client
```

The application will be available at:
- **Frontend**: http://localhost:3000
- **API**: http://localhost:5000/api

### Production Mode

```bash
# Build the React app
npm run build

# Start the server (serves both frontend and API)
npm start
```

## CSV File Format

Your CSV file should include the following columns (case-insensitive):

| Column | Type | Required | Example |
|--------|------|----------|---------|
| Address | String | Yes | 123 Main St |
| City | String | Yes | Des Moines |
| State | String | Yes | IA |
| ZipCode | String | No | 50309 |
| Price | Number | No | 250000 |
| AgentName | String | Yes | John Doe |
| AgentEmail | String | Yes | john@example.com |
| AgentPhone | String | No | 555-1234 |
| PropertyType | String | No | Single Family |
| Bedrooms | Number | No | 3 |
| Bathrooms | Number | No | 2.5 |
| SquareFeet | Number | No | 2500 |
| LotSize | Number | No | 0.25 |
| YearBuilt | Number | No | 2005 |
| MLSID | String | No | DM123456 |
| DaysOnMarket | Number | No | 45 |
| Status | String | No | active |

## API Endpoints

### Upload CSV
```
POST /api/upload
Content-Type: multipart/form-data

Body:
- csvFile: <CSV file>
- triggerAutomations: true/false (optional)
- uploadedBy: <username> (optional)

Response:
{
  "success": true,
  "loadId": 1,
  "fileName": "properties.csv",
  "message": "File upload received and processing started"
}
```

### Get Load History
```
GET /api/loads?limit=50&offset=0

Response:
{
  "data": [...],
  "total": 100,
  "limit": 50,
  "offset": 0
}
```

### Get Load Details
```
GET /api/loads/:loadId
```

### Get Load Properties
```
GET /api/loads/:loadId/properties?limit=100&offset=0
```

### Get Automations Log
```
GET /api/loads/:loadId/automations?limit=100&offset=0
```

### Get Statistics
```
GET /api/loads/stats/overview
```

## Database Schema

### properties Table
Stores all property data from CSV uploads

### loads Table
Tracks each CSV import with processing status and history

### ghl_automations_log Table
Logs all GoHighLevel automation triggers (emails, SMS)

## GoHighLevel Integration

The tool integrates with GoHighLevel to:

1. **Send Emails** - Property lead notifications to agents
2. **Send SMS** - Text message alerts to agent phones
3. **Trigger Webhooks** - Custom automation workflows

To configure:
1. Get your GoHighLevel API key from your account
2. Find your Location ID
3. Add to `.env` file
4. Enable "Trigger Automations" checkbox when uploading CSV

## Troubleshooting

### Database Connection Issues
```bash
# Test MariaDB connection
mysql -h localhost -u root -p -e "SELECT 1"

# Check if the property_data database exists
mysql -u root -p -e "SHOW DATABASES;"
```

### Port Already in Use
```bash
# Change PORT in .env file to a different port (e.g., 5001)
PORT=5001
```

### CSV Upload Issues
- Ensure file is actually CSV format (not Excel)
- Check that column headers match expected names
- Verify file encoding is UTF-8

### GoHighLevel Errors
- Verify API key and Location ID are correct
- Check that agent emails/phones are valid
- Review GHL_WEBHOOK_URL configuration

## Performance Considerations

- Large CSV files (>100MB) may take time to process
- Database indexes are created for common queries
- Batch processing is recommended for multiple large files
- Consider implementing file compression for upload

## Security Notes

- Keep `.env` file secure and never commit to version control
- Use strong database passwords
- API keys should be rotated regularly
- Consider adding authentication to the frontend
- Implement HTTPS in production

## Future Enhancements

- [ ] User authentication and authorization
- [ ] Advanced CSV field mapping
- [ ] Duplicate detection and handling
- [ ] Data validation and error reporting UI
- [ ] Scheduled imports
- [ ] Multi-file upload support
- [ ] Export capabilities
- [ ] Advanced filtering and search

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review application logs in the terminal
3. Check the console in browser DevTools (F12)
4. Verify `.env` configuration

## License

MIT

## Author

Created for property data ingestion and GoHighLevel automation
