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
            limit: 4
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
        const language = req.query.lang || 'en';
        const recentAnalyses = await getRecent();
        const recentViewpoint = await getRecentVp();

        const langSuffix = language == 'en' ? '' : `_${language}`;
        const analyses = recentAnalyses.map(element => ({
            title: element[`title${langSuffix}`],
            summary: element[`title${langSuffix}`],
            analysis: element[`analysis${langSuffix}`],
            mp3 : element[`analysis${langSuffix}`],
            imageUrl: element.imageUrl,
            createdAt: element.createdAt
        }));

        const viewpoint = {
            id: recentViewpoint.id,
            viewpoint: recentViewpoint[`viewpoint${langSuffix}`],
            mp3: recentViewpoint[`mp3${langSuffix}`],
            imageUrl: recentViewpoint.imageUrl
        }

        console.log("analyses: ", analyses);
        console.log("viewpoint: ", viewpoint);
        res.render('run', { analyses: analyses, lang: language, viewpoint: viewpoint });
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