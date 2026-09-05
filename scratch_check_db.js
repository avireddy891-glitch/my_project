const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'backend', 'database.sqlite');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database', err);
        return;
    }
    
    db.all(`SELECT name FROM sqlite_master WHERE type='table'`, [], (err, tables) => {
        console.log("Tables:", tables.map(t => t.name));
        
        db.all(`SELECT * FROM users`, [], (err, users) => {
            console.log("\nUsers:");
            console.table(users);
            
            db.all(`SELECT * FROM device_states_user1`, [], (err, states) => {
                if(err) console.log("No states table for user1");
                else {
                    console.log("\ndevice_states_user1:");
                    console.table(states);
                }
            });
        });
    });
});
