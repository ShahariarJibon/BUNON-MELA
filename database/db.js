const fs = require('fs');
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcrypt');
const path = require('path');

const isServerless = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
let dbPath = path.resolve(__dirname, '../database.sqlite');

if (isServerless) {
  const tmpDbPath = path.join('/tmp', 'database.sqlite');
  try {
    if (!fs.existsSync(tmpDbPath)) {
      if (fs.existsSync(dbPath)) {
        fs.copyFileSync(dbPath, tmpDbPath);
      }
    }
    dbPath = tmpDbPath;
  } catch (err) {
    console.error('❌ Error initializing database in /tmp:', err.message);
  }
}

const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('❌ DB connection error:', err.message);
  else console.log('✨ Connected to SQLite:', dbPath);
});

function initDatabase() {
  db.serialize(() => {
    // Users table
    db.run(`CREATE TABLE IF NOT EXISTS Users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT DEFAULT 'customer',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('❌ Users table error:', err.message);
      else console.log('✅ Users table ready');
    });

    // Categories table
    db.run(`CREATE TABLE IF NOT EXISTS Categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('❌ Categories table error:', err.message);
      else console.log('✅ Categories table ready');
    });

    // Products table
    db.run(`CREATE TABLE IF NOT EXISTS Products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT,
      price REAL NOT NULL,
      category TEXT DEFAULT 'Decorated Bags',
      image_url TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('❌ Products table error:', err.message);
      else console.log('✅ Products table ready');
    });

    // Ensure category column exists in existing DB
    db.run(`ALTER TABLE Products ADD COLUMN category TEXT DEFAULT 'Decorated Bags'`, () => {});

    // CartItems table
    db.run(`CREATE TABLE IF NOT EXISTS CartItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      quantity INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(id),
      FOREIGN KEY (product_id) REFERENCES Products(id)
    )`, (err) => {
      if (err) console.error('❌ CartItems table error:', err.message);
      else console.log('✅ CartItems table ready');
    });

    // Orders table (Step 2 Checkout)
    db.run(`CREATE TABLE IF NOT EXISTS Orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      user_id INTEGER NOT NULL,
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      division TEXT NOT NULL,
      district TEXT NOT NULL,
      upazila TEXT NOT NULL,
      area TEXT NOT NULL,
      delivery_address TEXT NOT NULL,
      payment_method TEXT NOT NULL,
      transaction_id TEXT,
      total_amount REAL NOT NULL,
      status TEXT DEFAULT 'Pending',
      delivery_charge REAL DEFAULT 0,
      coupon_code TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES Users(id)
    )`, (err) => {
      if (err) console.error('❌ Orders table error:', err.message);
      else console.log('✅ Orders table ready');
    });

    // Ensure delivery_charge and coupon_code exist in existing SQLite DB
    db.run(`ALTER TABLE Orders ADD COLUMN delivery_charge REAL DEFAULT 0`, () => {});
    db.run(`ALTER TABLE Orders ADD COLUMN coupon_code TEXT`, () => {});

    // Coupons table (Free delivery promotional codes)
    db.run(`CREATE TABLE IF NOT EXISTS Coupons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      discount_type TEXT DEFAULT 'free_delivery',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`, (err) => {
      if (err) console.error('❌ Coupons table error:', err.message);
      else {
        console.log('✅ Coupons table ready');
        db.get('SELECT COUNT(*) as count FROM Coupons', (cErr, row) => {
          if (!cErr && row && row.count === 0) {
            db.run('INSERT OR IGNORE INTO Coupons (code) VALUES (?)', ['FREESHIP']);
            db.run('INSERT OR IGNORE INTO Coupons (code) VALUES (?)', ['BUNONMELA']);
          }
        });
      }
    });

    // OrderItems table
    db.run(`CREATE TABLE IF NOT EXISTS OrderItems (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      product_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      price REAL NOT NULL,
      quantity INTEGER NOT NULL,
      FOREIGN KEY (order_id) REFERENCES Orders(id),
      FOREIGN KEY (product_id) REFERENCES Products(id)
    )`, (err) => {
      if (err) console.error('❌ OrderItems table error:', err.message);
      else console.log('✅ OrderItems table ready');
    });

    seedData();
  });
}

async function seedData() {
  // Seed admin user only (no fake demo customers)
  db.get('SELECT COUNT(*) as count FROM Users WHERE role = "admin"', async (err, row) => {
    if (!err && row && row.count === 0) {
      try {
        const hashedPassword = await bcrypt.hash('admin123', 10);
        db.run('INSERT INTO Users (name, email, password, role) VALUES (?, ?, ?, ?)', ['Admin Royal', 'admin@bunonmela.luxury', hashedPassword, 'admin']);
      } catch (e) {
        console.error('Error seeding admin:', e.message);
      }
    }
  });

  // Seed standard categories
  const initialCategories = [
    'Decorated Bags',
    'Decorated Parts',
    'Decorated Nose Pin',
    'Decorated Hair Clip',
    'Silk Sarees',
    'Haute Couture'
  ];
  const catStmt = db.prepare('INSERT OR IGNORE INTO Categories (name) VALUES (?)');
  initialCategories.forEach(cat => catStmt.run(cat));
  catStmt.finalize();

  // Seed products with diverse categories and Taka-scaled luxury pricing
  db.get('SELECT COUNT(*) as count FROM Products', (err, row) => {
    if (!err && row && row.count === 0) {
      const products = [
        { title: 'Royal Amethyst Silk Saree', category: 'Silk Sarees', description: 'Handwoven Mulberry silk with pure zari motifs and delicate lavender borders.', price: 48500, image_url: 'https://images.unsplash.com/photo-1610030469983-98e550d6193c?auto=format&fit=crop&w=800&q=80' },
        { title: 'Plum Artisanal Embroidered Bag', category: 'Decorated Bags', description: 'Full-grain Italian leather in plum adorned with gold cordwork and crystals.', price: 36000, image_url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=800&q=80' },
        { title: 'Imperial Kundan Nose Pin', category: 'Decorated Nose Pin', description: 'Handcrafted floral nose pin with uncut Polki stones and 22k gold foiling.', price: 17500, image_url: 'https://images.unsplash.com/photo-1535632066927-ab7c9ab60908?auto=format&fit=crop&w=800&q=80' },
        { title: 'Filigree Pearl Hair Clip', category: 'Decorated Hair Clip', description: 'Baroque pearl and botanical motif hair jewel with champagne crystal clusters.', price: 14000, image_url: 'https://images.unsplash.com/photo-1576871337622-98d48d1cf531?auto=format&fit=crop&w=800&q=80' },
        { title: 'Velvet Midnight Kaftan', category: 'Haute Couture', description: 'Midnight violet velvet embellished with antique metallic cordwork and crystal accents.', price: 62000, image_url: 'https://images.unsplash.com/photo-1539109136881-3be0616acf4b?auto=format&fit=crop&w=800&q=80' },
        { title: 'Ornate Antique Zari Brooch', category: 'Decorated Parts', description: 'Artisanal decorative metallic accessory part for custom couture drapery.', price: 19500, image_url: 'https://images.unsplash.com/photo-1611652022419-a9419f74343d?auto=format&fit=crop&w=800&q=80' }
      ];
      const stmt = db.prepare('INSERT INTO Products (title, category, description, price, image_url) VALUES (?, ?, ?, ?, ?)');
      products.forEach(p => stmt.run(p.title, p.category, p.description, p.price, p.image_url));
      stmt.finalize(() => console.log('🌱 Seeded products with categories in Taka'));
    }
  });
}

initDatabase();
module.exports = db;
