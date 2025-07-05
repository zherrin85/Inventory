# Terminal Inventory System

A modern, web-based inventory management system designed for shipping terminals and warehouses. Features real-time barcode scanning, multi-location tracking, and Excel import/export capabilities.

![Terminal Inventory System](https://img.shields.io/badge/version-1.0.0-blue)
![Node.js](https://img.shields.io/badge/node.js-18%2B-green)
![MariaDB](https://img.shields.io/badge/mariadb-10.6%2B-orange)
![License](https://img.shields.io/badge/license-MIT-blue)

## 🚀 Features

- **📱 Real-time Barcode Scanning** - Camera-based barcode scanning with automatic detection
- **💾 Persistent Storage** - MariaDB database with full ACID compliance
- **📊 Excel Import/Export** - Bulk import existing inventory from Excel files
- **🔍 Advanced Search & Filtering** - Real-time search across all inventory fields
- **📍 Multi-Location Support** - Track items across buildings, floors, racks, and shelves
- **📈 Dashboard Analytics** - Real-time stats, low stock alerts, and activity tracking
- **👥 Multi-User Support** - Concurrent access with audit logging
- **📱 Mobile Responsive** - Works seamlessly on phones, tablets, and desktops
- **🔐 Secure** - Runs behind nginx reverse proxy with HTTPS support
- **⚡ Fast** - Optimized for quick add/remove operations in busy environments

## 📋 Prerequisites

### System Requirements
- **Operating System:** Linux (Ubuntu 20.04+, CentOS 8+, or similar)
- **Node.js:** Version 18 or higher
- **MariaDB:** Version 10.6 or higher
- **nginx:** Version 1.18 or higher
- **Memory:** Minimum 1GB RAM
- **Storage:** Minimum 10GB available space

### Network Requirements
- **HTTPS:** Required for camera access (can use self-signed certificates for LAN)
- **Ports:** 3001 (configurable) for Node.js application
- **LAN Access:** Designed for local network deployment

## 🛠️ Installation

### Step 1: Install System Dependencies

#### Ubuntu/Debian
```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install MariaDB
sudo apt install mariadb-server mariadb-client

# Install nginx
sudo apt install nginx

# Install additional tools
sudo apt install git curl wget
```
### Step 2: Secure MariaDB Installation
```bash
# Start and enable MariaDB
sudo systemctl start mariadb
sudo systemctl enable mariadb

# Run security script
sudo mysql_secure_installation
```

Follow the prompts:
- Set root password: **Yes**
- Remove anonymous users: **Yes**
- Disallow root login remotely: **Yes**
- Remove test database: **Yes**
- Reload privilege tables: **Yes**

### Step 3: Create Database and User
```bash
# Connect to MariaDB as root
sudo mysql -u root -p
```

Execute the following SQL commands:
```sql
-- Create database
CREATE DATABASE terminal_inventory;

-- Create user (replace 'your_secure_password' with a strong password)
CREATE USER 'inventory_user'@'localhost' IDENTIFIED BY 'your_secure_password';

-- Grant permissions
GRANT ALL PRIVILEGES ON terminal_inventory.* TO 'inventory_user'@'localhost';
FLUSH PRIVILEGES;

-- Use the database
USE terminal_inventory;

-- Create inventory table
CREATE TABLE inventory (
    id INT AUTO_INCREMENT PRIMARY KEY,
    vendor VARCHAR(100) NOT NULL,
    product VARCHAR(200) NOT NULL,
    part_number VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    quantity INT DEFAULT 0,
    location VARCHAR(200),
    last_inventoried DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_part_number (part_number),
    INDEX idx_vendor (vendor),
    INDEX idx_location (location)
);

-- Create audit log table
CREATE TABLE inventory_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    part_number VARCHAR(100),
    action VARCHAR(50),
    quantity_change INT,
    old_quantity INT,
    new_quantity INT,
    user VARCHAR(100) DEFAULT 'admin',
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_part_number (part_number),
    INDEX idx_timestamp (timestamp)
);

-- Insert sample data (optional)
INSERT INTO inventory (vendor, product, part_number, quantity, location, last_inventoried) VALUES
('Cisco', 'Catalyst 2960-X Switch', 'CSC-2960X-48', 3, 'Building A - Floor 2 - Rack A3', '2025-01-15'),
('Dell', 'UltraSharp 27" Monitor', 'DELL-U2720Q', 8, 'Building B - Zone 3 - Storage Shelf', '2025-01-10'),
('Nokia', '5G Antenna Module', 'NOK-5G-ANT', 2, 'Building C - Warehouse - Rack 5', '2025-01-08');

EXIT;
```

### Step 4: Clone and Setup Application
```bash
# Create application directory
sudo mkdir -p /var/www/inventory
cd /var/www/inventory

# Clone repository (replace with your repository URL)
sudo git clone https://github.com/yourusername/terminal-inventory-system .

# Or manually create the project structure:
sudo mkdir public uploads routes

# Install Node.js dependencies
sudo npm init -y
sudo npm install express mysql2 multer xlsx body-parser cors

# Set proper ownership
sudo chown -R www-data:www-data /var/www/inventory
```

### Step 5: Create Application Files

#### Create `server.js`
```bash
sudo nano /var/www/inventory/server.js
```

Copy the complete server.js code from the project (see server implementation in installation instructions above).

#### Create Frontend
```bash
sudo nano /var/www/inventory/public/index.html
```

Copy the complete HTML frontend code from the project.

### Step 6: Configure nginx

#### Create nginx configuration
```bash
sudo nano /etc/nginx/sites-available/inventory
```

```nginx
server {
    listen 80;
    server_name inventory.yourdomain.local;  # Change to your domain/IP

    # Redirect HTTP to HTTPS (recommended for camera access)
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name inventory.yourdomain.local;  # Change to your domain/IP

    # SSL Configuration (required for camera access)
    ssl_certificate /path/to/your/cert.pem;
    ssl_certificate_key /path/to/your/key.pem;
    
    # For self-signed certificates (LAN use):
    # sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    #   -keyout /etc/ssl/private/inventory.key \
    #   -out /etc/ssl/certs/inventory.crt

    # SSL Security Settings
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # Increase upload size for Excel files
    client_max_body_size 50M;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Timeout settings for large file uploads
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Optional: Serve static files directly
    location /static/ {
        alias /var/www/inventory/public/static/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### Enable the site
```bash
# Test nginx configuration
sudo nginx -t

# Enable site
sudo ln -s /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/

# Remove default site (optional)
sudo rm /etc/nginx/sites-enabled/default

# Restart nginx
sudo systemctl restart nginx
```

### Step 7: Create SSL Certificate (for HTTPS)

#### Option A: Self-signed certificate (for LAN use)
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/ssl/private/inventory.key \
  -out /etc/ssl/certs/inventory.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=inventory.yourdomain.local"

# Update nginx config to use these certificates
sudo nano /etc/nginx/sites-available/inventory
```

Update SSL paths in nginx config:
```nginx
ssl_certificate /etc/ssl/certs/inventory.crt;
ssl_certificate_key /etc/ssl/private/inventory.key;
```

#### Option B: Let's Encrypt (for public domains)
```bash
# Install certbot
sudo apt install certbot python3-certbot-nginx  # Ubuntu/Debian

# Get certificate
sudo certbot --nginx -d inventory.yourdomain.com
```

### Step 8: Create Systemd Service
```bash
sudo nano /etc/systemd/system/inventory.service
```

```ini
[Unit]
Description=Terminal Inventory System
After=network.target mariadb.service
Wants=mariadb.service

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/inventory
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=3001

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=inventory

# Security
NoNewPrivileges=yes
PrivateTmp=yes
ProtectSystem=strict
ReadWritePaths=/var/www/inventory/uploads

[Install]
WantedBy=multi-user.target
```

### Step 9: Start Services
```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable and start inventory service
sudo systemctl enable inventory
sudo systemctl start inventory

# Start and enable nginx
sudo systemctl enable nginx
sudo systemctl start nginx

# Start and enable mariadb
sudo systemctl enable mariadb
sudo systemctl start mariadb

# Check service status
sudo systemctl status inventory
sudo systemctl status nginx
sudo systemctl status mariadb
```

### Step 10: Configure Firewall
```bash
# Ubuntu/Debian (ufw)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable

## 🔧 Configuration

### Environment Variables
Create `/var/www/inventory/.env` (optional):
```bash
# Database Configuration
DB_HOST=localhost
DB_USER=inventory_user
DB_PASSWORD=your_secure_password
DB_NAME=terminal_inventory

# Application Configuration
PORT=3001
NODE_ENV=production

# Security
SESSION_SECRET=your_session_secret_here
```

### Application Settings
Edit `server.js` to modify:
- Database connection settings
- Port number (default: 3001)
- File upload limits
- CORS settings

## 📱 Usage

### Accessing the System
- **HTTPS (Recommended):** `https://inventory.yourdomain.local`
- **HTTP:** `http://inventory.yourdomain.local` (will redirect to HTTPS)
- **Direct:** `http://your-server-ip:3001` (for testing)

### Main Features

#### 1. Dashboard
- View inventory statistics
- Monitor low stock items
- Recent activity overview
- Quick access to main functions

#### 2. Barcode Scanner
- Click "📷 Start Camera Scanner"
- Point camera at barcode
- Automatic detection and processing
- Add/remove items instantly

#### 3. Search & Browse
- View complete inventory table
- Real-time search filtering
- Sortable columns (click headers)
- Mobile-responsive design

#### 4. Excel Import
- Go to Settings → Import Excel Inventory
- Upload .xlsx file with columns: Vendor, Equipment, Part Number, Description, Quantity, Location, Last inventoried
- Automatic column mapping
- Bulk import with progress feedback

#### 5. Inventory Management
- Quick Add: Scan/type part number → Add quantities
- Quick Remove: Scan/type part number → Remove quantities
- Location tracking across multiple facilities
- Automatic audit logging

### Excel File Format
Your Excel file should have these columns (in any order):
- **Vendor** - Manufacturer/supplier name
- **Equipment** - Product name/type
- **Part Number** - Unique identifier (primary key)
- **Description** - Detailed item description
- **Quantity** - Current stock count
- **Location** - Storage location
- **Last inventoried** - Last count date (optional)

## 🔍 API Documentation

### Endpoints

#### Get All Inventory
```http
GET /api/inventory
```
Returns array of all inventory items.

#### Search Inventory
```http
GET /api/inventory/search?q=searchterm
```
Returns filtered inventory items.

#### Update Quantity
```http
POST /api/inventory/update-quantity
Content-Type: application/json

{
  "partNumber": "CSC-2960X-48",
  "quantityChange": 5,
  "action": "add"  // or "remove"
}
```

#### Import Excel
```http
POST /api/inventory/import
Content-Type: multipart/form-data

file: [Excel file]
```

#### Get Dashboard Stats
```http
GET /api/dashboard
```
Returns summary statistics.

## 🐛 Troubleshooting

### Service Not Starting
```bash
# Check service status
sudo systemctl status inventory

# View logs
sudo journalctl -u inventory -f

# Check for port conflicts
sudo netstat -tlnp | grep 3001

# Restart service
sudo systemctl restart inventory
```

### Database Connection Issues
```bash
# Test database connection
mysql -u inventory_user -p terminal_inventory

# Check MariaDB status
sudo systemctl status mariadb

# View MariaDB logs
sudo journalctl -u mariadb -f
```

### nginx Configuration Issues
```bash
# Test nginx configuration
sudo nginx -t

# Check nginx status
sudo systemctl status nginx

# View nginx logs
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/access.log
```

### Camera Not Working
1. **Ensure HTTPS** - Camera requires secure connection
2. **Check browser permissions** - Allow camera access
3. **Try different browser** - Chrome/Safari work best
4. **Check device** - Ensure camera is available
5. **Use manual entry** - Fallback option always available

### Performance Issues
```bash
# Monitor system resources
htop

# Check disk space
df -h

# Monitor database performance
sudo mysqladmin -u root -p processlist
sudo mysqladmin -u root -p status
```

### File Upload Issues
- Check nginx `client_max_body_size` setting
- Verify `/var/www/inventory/uploads` directory permissions
- Ensure adequate disk space

## 🔒 Security Considerations

### Production Deployment
1. **Use HTTPS** - Required for camera access and data security
2. **Strong passwords** - Database and application passwords
3. **Regular backups** - Database and application files
4. **Firewall rules** - Restrict access to necessary ports only
5. **User authentication** - Consider adding login system for production
6. **Regular updates** - Keep system packages updated

### Database Security
```bash
# Regular backups
sudo mysqldump -u root -p terminal_inventory > backup_$(date +%Y%m%d).sql

# Set up automated backups
sudo crontab -e
# Add: 0 2 * * * mysqldump -u root -p[password] terminal_inventory > /backups/inventory_$(date +\%Y\%m\%d).sql
```

## 🧪 Testing

### Unit Tests
```bash
# Install testing dependencies
npm install --save-dev jest supertest

# Run tests
npm test
```

### Load Testing
```bash
# Install artillery
npm install -g artillery

# Run load test
artillery quick --count 10 --num 5 http://localhost:3001
```

## 📊 Monitoring

### Application Monitoring
```bash
# Monitor application logs
sudo journalctl -u inventory -f

# Monitor system resources
watch -n 1 'ps aux | grep node'
```

### Database Monitoring
```bash
# Monitor database connections
mysql -u root -p -e "SHOW PROCESSLIST;"

# Check database size
mysql -u root -p -e "SELECT table_schema 'Database', ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) 'DB Size in MB' FROM information_schema.tables WHERE table_schema='terminal_inventory';"
```

## 🔄 Updates and Maintenance

### Updating the Application
```bash
cd /var/www/inventory

# Backup current version
sudo cp -r . ../inventory_backup_$(date +%Y%m%d)

# Pull updates
sudo git pull origin main

# Update dependencies
sudo npm install

# Restart service
sudo systemctl restart inventory
```

### Database Migrations
```bash
# Backup before migration
mysqldump -u root -p terminal_inventory > backup_before_migration.sql

# Apply schema changes
mysql -u root -p terminal_inventory < migration.sql
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit changes: `git commit -am 'Add your feature'`
4. Push to branch: `git push origin feature/your-feature`
5. Submit a Pull Request

### Development Setup
```bash
# Clone repository
git clone https://github.com/zherrin85/inventory
cd terminal-inventory-system

# Install dependencies
npm install

# Set up development database
mysql -u root -p < setup/dev_database.sql

# Start development server
npm run dev
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🎯 Roadmap

- [ ] User authentication and authorization
- [ ] Advanced reporting and analytics
- [ ] Mobile app (React Native)
- [ ] Integration with external systems (ERP, etc.)
- [ ] Automated reorder notifications
- [ ] QR code generation for items
- [ ] Multi-language support
- [ ] Dark mode theme

## 👥 Authors

- Zac Herrin - *Initial work* - [YourGitHub](https://github.com/zherrin85)

## 🙏 Acknowledgments

- ZXing library for barcode scanning
- Express.js for web framework
- MariaDB for database
- nginx for reverse proxy
- Bootstrap/CSS for styling

---

**Note:** This system is designed for local network deployment in shipping terminals and warehouses. For internet-facing deployments, additional security measures should be implemented.
