const express = require('express');
const mysql = require('mysql2');
const multer = require('multer');
const XLSX = require('xlsx');
const path = require('path');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const PORT = 3001; // Different from your existing app

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

// MariaDB connection
const db = mysql.createConnection({
    host: '127.0.0.1',
    user: 'inventory_user',
    password: 'PASSWORD_HERE',
    database: 'terminal_inventory'
});

// Connect to database
db.connect((err) => {
    if (err) {
        console.error('Database connection failed:', err);
        return;
    }
    console.log('Connected to MariaDB database');
});

// Configure multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Serve the main HTML file
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Routes

// Get all inventory
app.get('/api/inventory', (req, res) => {
    const query = 'SELECT * FROM inventory ORDER BY vendor, product';
    db.query(query, (err, results) => {
        if (err) {
            console.error('Database query error:', err);
            return res.status(500).json({ error: 'Database error' });
        }
        res.json(results);
    });
});

// Search inventory
app.get('/api/inventory/search', (req, res) => {
    const searchTerm = req.query.q;
    const query = `
        SELECT * FROM inventory 
        WHERE vendor LIKE ? OR product LIKE ? OR part_number LIKE ? OR location LIKE ?
        ORDER BY vendor, product
    `;
    const searchPattern = `%${searchTerm}%`;
    
    db.query(query, [searchPattern, searchPattern, searchPattern, searchPattern], (err, results) => {
        if (err) {
            console.error('Search error:', err);
            return res.status(500).json({ error: 'Search error' });
        }
        res.json(results);
    });
});

// Update inventory quantity
app.post('/api/inventory/update-quantity', (req, res) => {
    const { partNumber, quantityChange, action } = req.body;
    
    // First get current quantity
    db.query('SELECT quantity FROM inventory WHERE part_number = ?', [partNumber], (err, results) => {
        if (err || results.length === 0) {
            return res.status(404).json({ error: 'Item not found' });
        }
        
        const currentQuantity = results[0].quantity;
        const newQuantity = action === 'add' ? 
            currentQuantity + parseInt(quantityChange) : 
            currentQuantity - parseInt(quantityChange);
            
        if (newQuantity < 0) {
            return res.status(400).json({ error: 'Insufficient stock' });
        }
        
        // Update inventory
        db.query('UPDATE inventory SET quantity = ?, last_inventoried = CURDATE() WHERE part_number = ?', 
            [newQuantity, partNumber], (err) => {
                if (err) {
                    console.error('Update error:', err);
                    return res.status(500).json({ error: 'Update failed' });
                }
                
                // Log the change
                db.query(`INSERT INTO inventory_log (part_number, action, quantity_change, old_quantity, new_quantity) 
                          VALUES (?, ?, ?, ?, ?)`, 
                    [partNumber, action.toUpperCase(), quantityChange, currentQuantity, newQuantity], (logErr) => {
                        if (logErr) console.error('Logging error:', logErr);
                    });
                
                res.json({ 
                    success: true, 
                    oldQuantity: currentQuantity, 
                    newQuantity: newQuantity 
                });
            });
    });
});

// Excel import
app.post('/api/inventory/import', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }
    
    try {
        const workbook = XLSX.readFile(req.file.path);
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // Skip instruction row, get headers from row 2
        const headers = jsonData[1];
        const dataRows = jsonData.slice(2);
        
        const vendorCol = headers.indexOf('Vendor');
        const equipmentCol = headers.indexOf('Equipment');
        const partCol = headers.indexOf('Part Number');
        const descCol = headers.indexOf('Description');
        const qtyCol = headers.indexOf('Quantity');
        const locCol = headers.indexOf('Location');
        const lastInvCol = headers.indexOf('Last inventoried');
        
        // Clear existing data
        db.query('DELETE FROM inventory', (err) => {
            if (err) {
                console.error('Clear inventory error:', err);
                return res.status(500).json({ error: 'Failed to clear inventory' });
            }
            
            let imported = 0;
            let processed = 0;
            const totalRows = dataRows.filter(row => row && row[vendorCol] && row[partCol]).length;
            
            if (totalRows === 0) {
                return res.json({ imported: 0, message: 'No valid data found' });
            }
            
            dataRows.forEach(row => {
                if (row && row[vendorCol] && row[partCol]) {
                    const lastInv = row[lastInvCol] ? 
                        new Date(row[lastInvCol]).toISOString().split('T')[0] : null;
                    
                    const insertQuery = `
                        INSERT INTO inventory (vendor, product, part_number, description, quantity, location, last_inventoried)
                        VALUES (?, ?, ?, ?, ?, ?, ?)
                    `;
                    
                    db.query(insertQuery, [
                        row[vendorCol] || 'Unknown',
                        row[equipmentCol] || 'Unknown',
                        row[partCol],
                        row[descCol] || '',
                        parseInt(row[qtyCol]) || 0,
                        row[locCol] || 'Unknown',
                        lastInv
                    ], (insertErr) => {
                        processed++;
                        if (!insertErr) imported++;
                        
                        if (processed === totalRows) {
                            // Clean up uploaded file
                            require('fs').unlink(req.file.path, () => {});
                            res.json({ imported, total: totalRows });
                        }
                    });
                }
            });
        });
        
    } catch (error) {
        console.error('Import error:', error);
        res.status(500).json({ error: 'Import failed: ' + error.message });
    }
});

// Get dashboard stats
app.get('/api/dashboard', (req, res) => {
    const queries = {
        totalItems: 'SELECT SUM(quantity) as total FROM inventory',
        lowStock: 'SELECT COUNT(*) as count FROM inventory WHERE quantity <= 5',
        totalLocations: 'SELECT COUNT(DISTINCT location) as count FROM inventory',
        recentActivity: 'SELECT COUNT(*) as count FROM inventory_log WHERE timestamp >= DATE_SUB(NOW(), INTERVAL 24 HOUR)'
    };
    
    const results = {};
    let completed = 0;
    
    Object.keys(queries).forEach(key => {
        db.query(queries[key], (err, result) => {
            if (!err && result.length > 0) {
                results[key] = Object.values(result[0])[0];
            } else {
                results[key] = 0;
            }
            
            completed++;
            if (completed === Object.keys(queries).length) {
                res.json(results);
            }
        });
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Inventory server running on port ${PORT}`);
});
