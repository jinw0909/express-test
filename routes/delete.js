var express = require('express');
var router = express.Router();
const { Blockmedia, Analysis, Candidate, Translation, Dominance, DominanceAnalysis,
    BitcoinAnalysis, BitcoinPrice } = require('../models');
const {Sequelize} = require("sequelize");

async function performDeleteWeek() {
    try {
        const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
        await Blockmedia.destroy({
            where: {
                date: {
                    [Sequelize.Op.lt]: twoWeeksAgo
                }
            }
        });
        await Dominance.destroy({
            where: {
                createdAt: {
                    [Sequelize.Op.lt]: twoWeeksAgo
                }
            }
        })
        console.log('Processed weekly deletion');
    } catch (err) {
        console.error("failed to delete weekly", err);
    }
}

async function performDeleteMonth() {
    try {
        const twoMonthsAgo = new Date(Date.now - 0);
        await Analysis.destroy({
            where: {
                createdAt: {
                    [Sequelize.Op.lt]: twoMonthsAgo
                }
            }
        });
        await Candidate.destroy({
            where: {
                createdAt: {
                    [Sequelize.Op.lt]: twoMonthsAgo
                }
            }
        })
        await Translation.destroy({
            where: {
                createdAt: {
                    [Sequelize.Op.lt]: twoMonthsAgo
                }
            }
        })
        await DominanceAnalysis.destroy({
            where: {
                createdAt: {
                    [Sequelize.Op.lt]: twoMonthsAgo
                }
            }
        });
        await BitcoinPrice.destroy({
            where: {
                createdAt: {
                    [Sequelize.Op.lt]: twoMonthsAgo
                }
            }
        });
        await BitcoinAnalysis.destroy({
            where: {
                createdAt: {
                    [Sequelize.Op.lt]: twoMonthsAgo
                }
            }
        });

        res.send("Processed monthly deletion");
    } catch (error) {
        console.error("failed to delete every analysis created two month ago.", error);
    }
}
/* GET home page. */
router.get('/weekly', async function(req, res, next) {
    await performDeleteWeek();
    res.send("Processed weekly deletion");
});

router.get('/monthly', async function(req,res) {
   await performDeleteMonth();
   res.send("Processed monthly deletion");
});

module.exports = router;