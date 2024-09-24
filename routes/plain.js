const express = require('express');
const plainDb = require('../plainConnection');
const router = express.Router();

// Route to get data from a table in schema2
router.get('/', async (req, res) => {
    try {
        // Example query to select all rows from a table in schema2
        const results = await plainDb.query('SELECT * FROM beuliping');
        res.json(results);
    } catch (error) {
        console.error('Error querying schema2:', error);
        res.status(500).send('Error querying schema2');
    }
});

router.get('/test', async (req, res) => {
    try {
        const [latestRow] = await plainDb.query('SELECT datetime FROM beuliping ORDER BY id DESC LIMIT 1');

        if (latestRow.length === 0) {
            if (res) return res.status(404).send('No rows found');
            return;
        }

        console.log(latestRow);

        const latestDatetime = latestRow.datetime;

        // Retrieve all rows that were created within 5 minutes before the latest datetime
        const recentRows = await plainDb.query(`
            SELECT id, symbol 
            FROM beuliping 
            WHERE datetime BETWEEN DATE_SUB(?, INTERVAL 5 MINUTE) AND ?
            ORDER BY datetime DESC
        `, [latestDatetime, latestDatetime]);

        // Log the recent rows for debugging
        console.log('Recent Rows:', recentRows);

        if (recentRows.length === 0) {
            if (res) return res.status(404).send('No recent rows found');
            return;
        }

        res.json(recentRows);
    } catch (error) {
        console.error('Error querying schema2:', error);
        res.status(500).send('Error querying schema2');
    }
});

module.exports = router;
