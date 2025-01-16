const mysql = require('mysql2/promise');
const dbConfig = {
    host: process.env.DOL_DB_HOST,
    user: process.env.DOL_DB_USER,
    password: process.env.DOL_DB_PASSWORD,
    database: 'dolai'
}

const pool = mysql.createPool(dbConfig);

// Function to log the connection status
async function checkConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('Successfully connected to the dolphin database');
        connection.release();
    } catch (error) {
        console.error('Error connecting to the dophin database:', error);
    }
}

async function query(sql, params) {
    const [results, ] = await pool.execute(sql, params);
    return results;
}

checkConnection();

module.exports = {
    query,
    pool
};