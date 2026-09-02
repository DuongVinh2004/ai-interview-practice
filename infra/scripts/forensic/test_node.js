const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, '9router', 'db', 'data.sqlite');
console.log('Testing 9Router SQLite connection with better-sqlite3:', dbPath);

// Let's test with node if available, or write a node verification script.
