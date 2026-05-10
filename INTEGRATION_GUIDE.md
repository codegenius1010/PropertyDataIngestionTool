# Integration Guides

## GoHighLevel Setup

### Getting Your API Credentials

1. **Log into GoHighLevel**
   - Navigate to https://app.gohighlevel.com

2. **Get Your Location ID**
   - Settings → Locations
   - Select your location
   - Copy the Location ID from the URL or settings

3. **Create API Key**
   - Settings → Integrations → API Keys
   - Click "Create New API Key"
   - Copy the API Key

4. **Add to .env**
   ```
   GHL_API_KEY=your_api_key_here
   GHL_LOCATION_ID=your_location_id_here
   ```

### Testing GoHighLevel Integration

```bash
# Check that the GoHighLevel service is working
# Upload a CSV with the "Trigger automations" checkbox enabled
# Monitor the Load History to see automation status
```

---

## Email Notifications (Optional)

### Using Gmail

1. **Enable 2-Factor Authentication**
   - Go to myaccount.google.com
   - Security tab
   - Enable 2-Step Verification

2. **Create App Password**
   - Go to myaccount.google.com/apppasswords
   - Select "Mail" and "Windows Computer" (or your device)
   - Google will generate a 16-character password

3. **Add to .env**
   ```
   EMAIL_SERVICE=gmail
   EMAIL_USER=your_email@gmail.com
   EMAIL_PASSWORD=your_16_char_app_password
   EMAIL_FROM=your_email@gmail.com
   ```

### Using Other Email Providers

```
EMAIL_SERVICE=outlook
EMAIL_USER=your_email@outlook.com
EMAIL_PASSWORD=your_password
EMAIL_FROM=your_email@outlook.com
```

Available services: 'gmail', 'outlook', 'yahoo', 'aol', etc.

---

## SMS Notifications (Using Twilio)

### Setup Twilio Account

1. **Create Account**
   - Go to https://www.twilio.com/console
   - Sign up for a free account (includes $15 credit)

2. **Get Credentials**
   - Console Dashboard shows your Account SID and Auth Token
   - Buy a phone number (or use trial number)

3. **Add to .env**
   ```
   SMS_ACCOUNT_SID=your_account_sid
   SMS_AUTH_TOKEN=your_auth_token
   SMS_PHONE_NUMBER=+1234567890
   ```

4. **Verify Phone Numbers** (for trial account)
   - Add recipients' numbers in Twilio console
   - They must verify before receiving messages

---

## Custom Webhooks

### Setting Up Webhook Automations

1. **Create Webhook URL**
   - Set up an endpoint that receives JSON POST requests
   - Example: `https://your-domain.com/webhooks/properties`

2. **Add to .env**
   ```
   GHL_WEBHOOK_URL=https://your-domain.com/webhooks/properties
   ```

3. **Expected Payload**
   ```json
   {
     "property": {
       "id": 1,
       "address": "123 Main St",
       "city": "Des Moines",
       "state": "IA",
       "agent_email": "john@example.com",
       "agent_phone": "555-1234",
       "property_price": 325000,
       "bedrooms": 3,
       "bathrooms": 2
     },
     "eventType": "new_property_lead",
     "timestamp": "2024-01-15T10:30:00Z"
   }
   ```

---

## Database Backup & Restore

### Backup Your Data

```bash
# Create a backup
mysqldump -u root -p property_data > property_data_backup.sql

# Or with compression
mysqldump -u root -p property_data | gzip > property_data_backup.sql.gz
```

### Restore from Backup

```bash
# Restore from backup
mysql -u root -p property_data < property_data_backup.sql

# Or from compressed backup
gunzip < property_data_backup.sql.gz | mysql -u root -p property_data
```

---

## Monitoring & Logging

### Server Logs

The server logs important events:
- File uploads
- Processing status
- Automation triggers
- Errors

Check the terminal where `npm run dev` is running.

### Database Monitoring

```bash
# Check all loads
mysql -u root -p -e "SELECT * FROM property_data.loads;"

# Check properties count
mysql -u root -p -e "SELECT COUNT(*) as total FROM property_data.properties;"

# Check automation logs
mysql -u root -p -e "SELECT * FROM property_data.ghl_automations_log LIMIT 10;"
```

---

## Scaling Considerations

### For Large CSV Files (1GB+)

1. **Stream Processing**
   - Currently processes in memory
   - For large files, implement streaming from disk

2. **Batch Inserts**
   - Group database inserts into batches
   - Reduces transaction overhead

3. **Increase Timeout**
   - Set longer timeout for large uploads
   - Adjust in upload.js multer configuration

### For High Volume

1. **Database Optimization**
   - Add more indexes for frequently queried columns
   - Use read replicas for reporting

2. **Queue System**
   - Implement job queue (Bull, RabbitMQ) for automation triggers
   - Process automations asynchronously

3. **Caching**
   - Cache load history
   - Cache agent information

---

## Troubleshooting Integration

### GoHighLevel Not Triggering

1. Check API key is valid
2. Verify Location ID is correct
3. Ensure agent emails are in GoHighLevel
4. Check GoHighLevel automation setup

### Email Not Sending

1. Verify email credentials
2. Check email service allows less secure apps (if not using app password)
3. Check spam folder
4. Verify agent email addresses exist

### SMS Not Sending (Twilio)

1. Verify phone numbers are in international format
2. Check Twilio account has credit
3. For trial: Verify numbers are in Verified Callers list
4. Check phone number format in CSV

---

## Security Best Practices

1. **Never commit .env to version control**
   - Add `.env` to `.gitignore`

2. **Rotate API keys regularly**
   - Update in GoHighLevel and .env

3. **Use environment-specific configurations**
   - Different keys for dev, staging, production

4. **Enable HTTPS in production**
   - Use Let's Encrypt for free SSL

5. **Secure database credentials**
   - Use strong passwords
   - Restrict database access to application server only

6. **Regular backups**
   - Automate daily backups
   - Test restore procedure

---

## Support Resources

- **GoHighLevel Docs**: https://docs.gohighlevel.com/
- **Twilio Docs**: https://www.twilio.com/docs/
- **Node.js Docs**: https://nodejs.org/docs/
- **MariaDB Docs**: https://mariadb.com/kb/en/
- **React Docs**: https://react.dev/

---

## Next Steps

1. ✅ Set up GoHighLevel API keys
2. ✅ Configure email notifications
3. ✅ Test with sample CSV
4. ✅ Set up data backups
5. ✅ Deploy to production
