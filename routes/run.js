var express = require('express');
var router = express.Router();
const Blockmedia = require('../blockmedia');
const Analysis = require('../analysis');
const { Sequelize } = require("sequelize");
const { Op } = require('sequelize');

async function getRecent() {
    try {
        const recentAnalyses = await Analysis.findAll({
            where: {
                mp3: {
                    [Sequelize.Op.not]: null
                }
            },
            order: [
                ['createdAt', 'DESC'] // Orders by 'createdAt' in descending order
            ],
            limit: 5
        });
        return recentAnalyses;
    } catch (error) {
        console.error("Error fetching recent analyses:", error);
    }
}

router.get('/', async function(req, res, next) {
    try {
        const recentAnalyses = await getRecent();
        console.log("recentAnalyses: ", recentAnalyses);
        res.render('run', {data: recentAnalyses});
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;