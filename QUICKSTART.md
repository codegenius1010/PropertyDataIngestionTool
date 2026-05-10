# Quick Start Guide

## 5-Minute Setup

### Step 1: Install Dependencies
```bash
cd wholesale
npm install
cd client && npm install && cd ..
```

### Step 2: Setup Database

**Option A: Using MySQL Command Line**
```bash
mysql -u root -p
```
Then paste the contents of `server/config/schema.sql`

**Option B: Direct File Import**
```bash
mysql -u root -p property_data < server/config/schema.sql
```

### Step 3: Configure Environment

Edit `.env` file:
```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=property_data
```

### Step 4: Start the Application

**Terminal 1 - Backend:**
```bash
npm run dev
```

**Terminal 2 - Frontend:**
```bash
npm run client
```

### Step 5: Open in Browser
http://localhost:3000

---

## Testing with Sample Data

A sample CSV file is provided at `PropertyData/IA_DesMoines_MLS_Active_Clear_60Days.csv`

1. Go to http://localhost:3000
2. Click "Choose CSV File..."
3. Select the sample CSV
4. Ensure "Automatically trigger automations" is checked (or unchecked to skip GoHighLevel)
5. Click "Upload & Process"
6. View results in "Load History" tab

---

## Configuring GoHighLevel (Optional)

1. Get your API Key from GoHighLevel dashboard
2. Find your Location ID
3. Add to `.env`:
   ```
   GHL_API_KEY=your_key_here
   GHL_LOCATION_ID=your_location_id
   ```
4. Check "Trigger automations" when uploading CSV files

---

## Troubleshooting

**Port 3000 or 5000 already in use?**
- Change PORT in `.env` (e.g., PORT=5001)
- Kill the process using `lsof -i :3000` (Mac/Linux) or `netstat -ano | findstr :3000` (Windows)

**MariaDB connection refused?**
- Verify MariaDB is running: `mysql -u root -p -e "SELECT 1"`
- Check credentials in `.env`
- Ensure database `property_data` exists

**CSV upload fails?**
- Ensure file is actual CSV (not Excel converted)
- Check column headers match expected format
- File should be UTF-8 encoded
- Max file size: 100MB

---

## Next Steps

- ✅ Test with sample CSV
- ✅ Configure GoHighLevel API keys
- ✅ Set up email notifications
- ✅ Upload your own property data
- ✅ Monitor loads in history page
- ✅ Customize CSV field mapping (if needed)

---

## API Testing (Optional)

```bash
# Check server health
curl http://localhost:5000/api/health

# Get all loads
curl http://localhost:5000/api/loads

# Get specific load
curl http://localhost:5000/api/loads/1
```

---

For detailed documentation, see [README.md](README.md)
