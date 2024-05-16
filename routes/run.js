var express = require('express');
var router = express.Router();
const {Blockmedia, Analysis, Viewpoint} = require('../models');
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

async function getRecentVp() {
    try {
        const viewPoint = await Viewpoint.findOne({
            order: [
                ['createdAt', 'DESC'] // Orders by 'createdAt' in descending order
            ]
        });
        return viewPoint;
    } catch (error) {
        console.error("Error fetching recent analyses:", error);
    }
}

router.get('/', async function(req, res, next) {
    try {
        const language = req.query.lang || 'English';
        const recentAnalyses = await getRecent();
        const recentViewpoint = await getRecentVp();
        console.log("recentAnalyses: ", recentAnalyses);
        console.log("recentViewpoint: ", recentViewpoint);
        res.render('run', {data: recentAnalyses, lang: language, vp: recentViewpoint});
    } catch (error) {
        console.error(error);
    }
});

// router.post('/', async function(req, res) {
//    try {
//        const lang = req.body.lang;
//        const recentAnalyses = await getRecent();
//        const recentViewpoint = await getRecentVp();
//        console.log("recentAnalyses: ", recentAnalyses);
//        console.log("recentViewpoint: ", recentViewpoint);
//        res.render('run', {data: recentAnalyses, lang: lang, vp: recentViewpoint});
//    } catch (error) {
//        console.error(error);
//    }
// });

module.exports = router;