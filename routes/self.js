var express = require('express');
var router = express.Router();
const { Dominance, DominanceAnalysis, BitcoinPrice } = require('../models');
const { Op } = require('sequelize');
/* GET home page. */
async function getDominanceData(startId, endId) {
    try {
        const dominanceData = await Dominance.findAll({
            where: {
                id: {
                    [Op.gte]: startId,
                    [Op.lte]: endId
                }
            },
            order: [['createdAt', 'DESC']]
        })
        const dominanceJSON = JSON.stringify(dominanceData);
        return dominanceJSON;
    } catch (error) {
        console.error('Error fetching dominance data');
        throw error;
    }
}
router.get('/dominance', async function(req, res, next) {
    try {

        // Extract the start and end parameters from the query string
        const startId = parseInt(req.query.start, 10);
        const endId = parseInt(req.query.end, 10);

        // Validate the parameters
        if (isNaN(startId) || isNaN(endId)) {
            res.status(400).send('Invalid start or end parameter');
            return;
        }

        let dominance = await getDominanceData(startId, endId);
        let data = JSON.parse(dominance);
        data = data.reverse();
        let goyaArr = data.map(el => {
            return el.goya_dominance;
        });
        console.log("data: ", data);
        console.log("goyaArr: ", goyaArr);
        let finalDominance = data[data.length - 1].dominance;
        console.log("finalDominance", finalDominance);
        let analysis = {};
        res.render('dominance', {goyaDominance: goyaArr, dominance: finalDominance, analysis : analysis});
    } catch (error) {
        console.error(error);
    }
});

router.get('/score', async function(req, res) {
    try {
        res.render('draw', {title: 'Express'});
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;