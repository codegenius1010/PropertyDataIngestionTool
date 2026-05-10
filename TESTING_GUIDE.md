# Quick Start Guide - Testing the Complete Workflow

## Prerequisites
- MariaDB running on 127.0.0.1:3306 with credentials (root/Ghjk8!gh)
- Backend server running on port 5000
- React frontend running on port 3000
- CSV file ready: `PropertyData/IA_DesMoines_MLS_Active_Clear_60Days.csv`

## Step 1: Start the Application (If Not Already Running)

### Terminal 1 - Backend Server
```bash
cd wholesale
npm start
# Should show: "Server running on port 5000"
```

### Terminal 2 - React Frontend
```bash
cd wholesale/client
npm start
# Should show: "Compiled successfully!" and open http://localhost:3000
```

## Step 2: Open the Application

1. Open your browser to http://localhost:3000
2. You should see the navigation with three options:
   - Upload CSV
   - Properties
   - Load History

## Step 3: Upload CSV File

1. Click "Upload CSV" in the navigation
2. You'll see the upload form with drag-and-drop area
3. Either:
   - Drag and drop the CSV file onto the area
   - Click to browse and select the file
4. A CSV format guide shows the expected columns
5. Click "Upload File" button
6. You should see:
   - "File upload received and processing started" message
   - Load ID displayed
   - Success confirmation

### Expected Result
- Properties from CSV are inserted into database
- Load record created with status "completed"
- All properties have status "not_synced"

## Step 4: View Uploaded Properties

1. Click "Properties" in the navigation
2. You'll see a table with all uploaded properties
3. Table columns display:
   - Address (with MLS ID)
   - City, State, Zip
   - Price (formatted)
   - Beds / Bathrooms
   - Agent Name & Email
   - GHL Status (showing "Not Synced")
   - Action button ("Push to GHL")

### Search & Filter

**Search Box:**
- Type property address (e.g., "123 Main")
- Type city name (e.g., "Des Moines")
- Type agent name (e.g., "John")
- Results filter in real-time

**Status Filter:**
- Select "All Properties" to show all
- Select "Not Synced" to show properties not yet synced
- Select "Synced" to show successfully synced properties
- Select "Failed" to show properties that failed to sync

**Refresh Button:**
- Reloads property data from database

## Step 5: Test Single Property Sync

1. From the Properties table, find any property
2. Click the "Push to GHL" button in the Action column
3. A confirmation dialog will appear asking:
   - "Push "[ADDRESS]" to GoHighLevel?"
4. Click OK to confirm
5. Button will show "Syncing..." with a spinner
6. After a few seconds:
   - Status should change to "Synced" (green badge)
   - Sync date will be displayed below the status
   - Button will show "✓ Synced"

### Expected Result
- Property status in database: `ghl_sync_status` = "synced"
- Sync timestamp recorded in `ghl_sync_date`
- GoHighLevel webhook receives the property data
- User sees immediate feedback in UI

## Step 6: Test Error Handling

1. To test error handling, temporarily disconnect from internet or GoHighLevel
2. Try to sync a property
3. You should see:
   - Button shows "Syncing..." then returns to "Push to GHL"
   - Status badge shows "Failed" (red)
   - Error message displayed in popup
   - Error message stored in database `ghl_error_message`

## Step 7: View Load History

1. Click "Load History" in the navigation
2. You should see:
   - List of all CSV uploads
   - Filename and upload date
   - Statistics: total records, successful, failed
   - Status (completed, processing, failed)
   - Expandable details showing:
     - Properties from that load
     - Automation history
     - Any errors that occurred

## API Testing (Optional - Using Postman or curl)

### Get All Properties
```bash
curl http://localhost:5000/api/properties
# Returns: Array of all properties
```

### Get Single Property
```bash
curl http://localhost:5000/api/properties/1
# Returns: Single property object
```

### Sync Single Property
```bash
curl -X POST http://localhost:5000/api/properties/1/sync-ghl
# Returns: Success message or error
```

### Bulk Sync Properties
```bash
curl -X POST http://localhost:5000/api/properties/sync-ghl/batch \
  -H "Content-Type: application/json" \
  -d '{"propertyIds": [1, 2, 3, 4, 5]}'
# Returns: Summary of synced/failed count
```

## Database Verification (Optional)

### Connect to Database
```bash
mysql -h 127.0.0.1 -u root -pGhjk8!gh
```

### Check Tables
```sql
USE evergreen;
SHOW TABLES;
```

### View Properties
```sql
SELECT id, address, city, ghl_sync_status, ghl_sync_date 
FROM properties 
LIMIT 5;
```

### View Specific Property
```sql
SELECT * FROM properties WHERE id = 1\G
```

### Check Sync Status
```sql
SELECT address, ghl_sync_status, ghl_sync_date, ghl_error_message 
FROM properties 
WHERE ghl_sync_status != 'not_synced';
```

## Expected Data Flow

```
1. CSV Upload
   ↓
   Upload received → Load record created (status: processing)
   ↓
   CSV parsed → Properties mapped to database fields
   ↓
   Properties inserted with status: "not_synced"
   ↓
   Load updated (status: completed, count recorded)

2. View Properties
   ↓
   Frontend calls: GET /api/properties
   ↓
   Backend queries: SELECT * FROM properties
   ↓
   Data displayed in table with filters/search

3. Sync to GHL
   ↓
   Frontend calls: POST /api/properties/:id/sync-ghl
   ↓
   Backend fetches property and prepares payload
   ↓
   Sends to GHL webhook URL
   ↓
   Updates database: ghl_sync_status = 'synced'
   ↓
   Frontend updates UI with status badge and sync date
```

## Troubleshooting

### Properties Not Showing
- Check if upload was successful (check Load History)
- Verify database connection (check backend console)
- Refresh the page (F5)
- Check browser console for errors (F12)

### Sync Button Not Working
- Check backend server is running (should see "Server running on port 5000")
- Check GoHighLevel webhook URL is valid
- Check network connectivity
- Check browser console for error details

### CSV Upload Fails
- Verify CSV file is in correct format
- Check if file is too large (max 100MB)
- Check backend console for parsing errors
- Ensure all required columns present

### Database Issues
- Verify MariaDB is running
- Check credentials in .env file
- Verify evergreen database was created
- Check if tables were created successfully

## Success Indicators

✅ Upload CSV successfully
✅ Properties visible in Properties page
✅ Search finds properties by address/city/agent
✅ Filter by status works
✅ Single property sync succeeds
✅ Status updates to "Synced" with timestamp
✅ Load History shows upload details
✅ Database contains all properties with correct data
✅ GoHighLevel receives webhook payload

Once all success indicators are confirmed, the system is working correctly!

## Next Steps

1. **Scale Testing**: Test with larger CSV files (1000+ properties)
2. **Bulk Operations**: Use API for batch syncing
3. **Webhook Verification**: Confirm GoHighLevel receives and processes data
4. **Automation Testing**: Set up automations in GoHighLevel to trigger on webhook
5. **Production Deployment**: Deploy to production server with monitoring

## Support

If you encounter any issues:
1. Check the browser console (F12 → Console tab)
2. Check the backend server output/logs
3. Check MariaDB error logs
4. Review the error messages in the UI

All errors should provide detailed information to help troubleshoot.
