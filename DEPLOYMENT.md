# Deployment Guide

## Local Development Setup

Already completed! Your local development environment is ready.

## Deploying to Production

### Option 1: Traditional Server (Recommended for Beginners)

#### Requirements
- Linux/Windows Server with Node.js installed
- MariaDB database server
- Domain name (optional but recommended)
- SSL certificate (Let's Encrypt - free)

#### Steps

1. **Clone/Copy Project**
   ```bash
   cd /var/www
   git clone <your-repo> property-tool
   cd property-tool
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

3. **Build Frontend**
   ```bash
   npm run build
   ```

4. **Create Production .env**
   ```bash
   cp .env .env.production
   # Edit with production values
   nano .env.production
   ```

5. **Set Up Systemd Service** (Linux)
   ```bash
   sudo nano /etc/systemd/system/property-tool.service
   ```
   
   Add:
   ```
   [Unit]
   Description=Property Data Ingestion Tool
   After=network.target
   
   [Service]
   Type=simple
   User=www-data
   WorkingDirectory=/var/www/property-tool
   ExecStart=/usr/bin/node server/index.js
   Restart=on-failure
   RestartSec=10
   Environment="NODE_ENV=production"
   EnvironmentFile=/var/www/property-tool/.env.production
   
   [Install]
   WantedBy=multi-user.target
   ```

6. **Start Service**
   ```bash
   sudo systemctl daemon-reload
   sudo systemctl start property-tool
   sudo systemctl enable property-tool
   ```

7. **Setup Nginx Reverse Proxy**
   ```bash
   sudo nano /etc/nginx/sites-available/property-tool
   ```
   
   Add:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;
       
       client_max_body_size 100M;
       
       location / {
           proxy_pass http://localhost:5000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

8. **Enable Nginx Site**
   ```bash
   sudo ln -s /etc/nginx/sites-available/property-tool /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

9. **Setup SSL (Let's Encrypt)**
   ```bash
   sudo apt-get install certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com
   ```

### Option 2: Heroku (Easiest for Quick Deployment)

#### Requirements
- Heroku account (free tier available)
- Heroku CLI installed
- Git repository

#### Steps

1. **Create Heroku App**
   ```bash
   heroku create property-data-tool
   ```

2. **Add BuildPacks**
   ```bash
   heroku buildpacks:add heroku/nodejs
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set DB_HOST=your-db-host
   heroku config:set DB_USER=your-db-user
   heroku config:set DB_PASSWORD=your-db-password
   heroku config:set NODE_ENV=production
   # ... set all other env variables
   ```

4. **Create Procfile**
   ```bash
   cat > Procfile << EOF
   web: node server/index.js
   EOF
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

### Option 3: Docker (Most Professional)

#### Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Build frontend
COPY client ./client
WORKDIR /app/client
RUN npm install && npm run build
WORKDIR /app

# Copy server code
COPY server ./server

# Expose port
EXPOSE 5000

# Start server
CMD ["node", "server/index.js"]
```

#### Create docker-compose.yml
```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - DB_HOST=mariadb
      - DB_USER=root
      - DB_PASSWORD=password
      - DB_NAME=property_data
      - NODE_ENV=production
    depends_on:
      - mariadb

  mariadb:
    image: mariadb:latest
    environment:
      MYSQL_ROOT_PASSWORD: password
      MYSQL_DATABASE: property_data
    volumes:
      - db_data:/var/lib/mysql
      - ./server/config/schema.sql:/docker-entrypoint-initdb.d/schema.sql

volumes:
  db_data:
```

#### Deploy with Docker
```bash
docker-compose up -d
```

### Option 4: AWS/DigitalOcean (Cloud Hosting)

#### Using AWS Lightsail

1. Launch Node.js instance
2. Install MariaDB
3. Clone repository
4. Follow "Traditional Server" setup above
5. Configure security groups for ports 80, 443

#### Using DigitalOcean App Platform

1. Create new app
2. Connect GitHub repository
3. Set environment variables
4. Configure build command: `npm install && cd client && npm install && npm run build && cd ..`
5. Configure start command: `node server/index.js`
6. Deploy!

---

## Production Checklist

- [ ] Database is backed up daily
- [ ] SSL/HTTPS is enabled
- [ ] Environment variables are configured
- [ ] File uploads directory has enough disk space
- [ ] Database has appropriate indexes
- [ ] Monitoring is set up (error logging, uptime)
- [ ] Rate limiting is configured
- [ ] API keys are rotated
- [ ] Firewall rules are configured
- [ ] CDN is configured (optional)

---

## Monitoring & Maintenance

### Log Monitoring
```bash
# View Systemd logs
sudo journalctl -u property-tool -f

# View Nginx logs
tail -f /var/log/nginx/access.log
tail -f /var/log/nginx/error.log
```

### Database Backups
```bash
# Automated daily backup script
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
mysqldump -u root -p$DB_PASSWORD property_data | \
  gzip > /backups/property_data_$DATE.sql.gz

# Remove backups older than 30 days
find /backups -name "property_data_*.sql.gz" -mtime +30 -delete
```

### Health Checks
```bash
# Add health check endpoint
curl https://yourdomain.com/api/health
```

### Performance Monitoring
```bash
# Monitor server resources
top
# or
htop

# Monitor database
mysql -u root -p -e "SHOW PROCESSLIST;"
```

---

## Scaling Strategy

### Stage 1: Single Server (0-1000 uploads/month)
- One server for app + database
- Daily backups
- Current setup is sufficient

### Stage 2: Separated Services (1000-10000 uploads/month)
- Separate database server
- Load balancer
- Multiple app instances
- Implement caching (Redis)

### Stage 3: Enterprise (10000+ uploads/month)
- Multiple app servers behind load balancer
- Separate database cluster (MariaDB Galera)
- Message queue (RabbitMQ) for async jobs
- CDN for static files
- Separate analytics database

---

## Troubleshooting Production Issues

### High Memory Usage
1. Check for memory leaks in logs
2. Implement file streaming for large uploads
3. Add pagination to queries
4. Use database connection pooling

### Slow Database Queries
```bash
# Enable slow query log
mysql -u root -p -e "SET GLOBAL slow_query_log = 'ON';"
mysql -u root -p -e "SET GLOBAL long_query_time = 2;"
tail -f /var/log/mysql/slow.log
```

### File Upload Failures
1. Check disk space: `df -h`
2. Check file permissions: `ls -la uploads/`
3. Increase upload timeout in nginx:
   ```nginx
   client_max_body_size 100M;
   ```

### GoHighLevel API Errors
1. Verify API key hasn't expired
2. Check rate limiting
3. Review GoHighLevel status page
4. Check network connectivity

---

## Rollback Procedure

```bash
# Keep previous versions
git tag v1.0 v2.0 v3.0

# Rollback to previous version
git checkout v2.0
npm install
npm run build
# Restart service
sudo systemctl restart property-tool
```

---

## Support & Updates

1. **Subscribe to updates**
   - Watch GitHub repository for releases
   - Subscribe to security advisories

2. **Regular maintenance**
   - Update dependencies monthly: `npm update`
   - Update system packages: `sudo apt update && sudo apt upgrade`
   - Review logs weekly

3. **Disaster Recovery Plan**
   - Test restore procedures monthly
   - Document all configurations
   - Keep offline backups

---

## Cost Estimation

### Self-Hosted (Monthly)
- Server: $5-50 (DigitalOcean/Linode)
- Database: Included in server or $15-50
- Backups: $5-20 (cloud storage)
- Domain: $10-15/year
- **Total: $25-85/month**

### Heroku (Monthly)
- Dyno: $50-500
- Add-ons: $50-200
- Database (managed): Free-$150
- **Total: $100-850/month**

### AWS (Monthly)
- EC2: $10-100
- RDS: $20-200
- S3 storage: $5-50
- **Total: $35-350/month**

---

## Next Steps

1. Choose deployment option
2. Set up production environment
3. Configure backups
4. Set up monitoring
5. Document procedures
6. Test disaster recovery
7. Monitor performance
