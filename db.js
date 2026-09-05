const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = process.env.DB_PATH || path.join(__dirname, 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
    } else {
        console.log('📦 Connected to SQLite database.');
        
        // Create users table
        db.run(`CREATE TABLE IF NOT EXISTS users (
            username TEXT PRIMARY KEY,
            password TEXT NOT NULL,
            email TEXT,
            temp_threshold REAL DEFAULT 50.0,
            gas_threshold INTEGER DEFAULT 300
        )`, (err) => {
            if (!err) {
                // Try to upgrade table silently if it lacks the email column
                db.run(`ALTER TABLE users ADD COLUMN email TEXT`, () => {});

                // Seed initial users
                const seedUsers = [
                    { username: 'admin', password: 'password123', email: 'admin@smarthome.local' },
                    { username: 'user1', password: 'user1pass', email: 'user1@smarthome.local' }
                ];
                const stmt = db.prepare('INSERT OR IGNORE INTO users (username, password, email) VALUES (?, ?, ?)');
                seedUsers.forEach(user => {
                    stmt.run(user.username, user.password, user.email);
                });
                stmt.finalize();
            }
        });

        // Create history table
        // Replaced by user-specific tables (created dynamically in server.js)
    }
});

module.exports = db;
