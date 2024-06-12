const express = require('express');
const router = express.Router();

// Route to get data from a table in schema2
router.get('/', async (req, res) => {
    // try {
    //     // Example query to select all rows from a table in schema2
    //     const results = await plainDb.query('SELECT * FROM beuliping');
    //     res.json(results);
    // } catch (error) {
    //     console.error('Error querying schema2:', error);
    //     res.status(500).send('Error querying schema2');
    // }
    res.send('ok');
});

router.get('/test', async (req, res) => {
    // try {
    //     // Query the last row ordered by datetime
    //     const [lastRow] = await plainDb.query(`
    //         SELECT id, symbol, datetime
    //         FROM beuliping
    //         ORDER BY datetime DESC
    //         LIMIT 1
    //     `);
    //
    //     if (!lastRow) {
    //         return res.status(404).send('No rows found');
    //     }
    //
    //     // Extract the hour from the last row's datetime
    //     const lastDatetime = new Date(lastRow.datetime);
    //     const lastHour = lastDatetime.getHours();
    //     const lastDate = lastDatetime.toISOString().split('T')[0]; // Extract the date part
    //
    //     // Query to retrieve all rows that match the hour of the last row's datetime
    //     const results = await plainDb.query(`
    //         SELECT id, symbol, datetime
    //         FROM beuliping
    //         WHERE DATE(datetime) = ? AND HOUR(datetime) = ?
    //         ORDER BY datetime DESC
    //     `, [lastDate, lastHour]);
    //
    //     if (results.length === 0) {
    //         return res.status(404).send('No recent rows found');
    //     }
    //
    //     res.json(results);
    // } catch (error) {
    //     console.error('Error querying schema2:', error);
    //     res.status(500).send('Error querying schema2');
    // }
    res.send('ok');
})

module.exports = router;
