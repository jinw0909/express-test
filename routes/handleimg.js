var express = require('express');
var router = express.Router();

router.post('/', async function(req, res, next) {
    try {
        console.log('Data received: ', req.body);
        res.send('ok');
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred');
    }
});

module.exports = router;
