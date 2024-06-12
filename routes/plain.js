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

module.exports = router;
