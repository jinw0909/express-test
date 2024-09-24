const cron = require('node-cron');
const { capture, captureDominance, capturePremium } = require('./routes/capture');
const { performPriceAnalysis } = require('./routes/chart');
const { performArticleCrawl } = require('./routes/crawl');
const { performDominanceAnalysis, performDominanceCollect } = require('./routes/dominance');
const startCronJobs = () => {

    //Run every minute
    cron.schedule('* * * * *', () => {
        console.log('Running a task every minute');
    });

    //Run every midnight
    cron.schedule('0 0 * * *', () => {
        console.log('Running a task every day at midnight');
    });

    //Run task every Monday at 1:00 PM
    cron.schedule('0 13 * * 1', () => {
       console.log('Running a task every Monday at 1:00 PM');
    });

    cron.schedule('*/5 * * * *', () => {
        console.log('Running a task every 5 mintues');
    });

}

module.exports = { startCronJobs };