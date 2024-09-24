const cron = require('node-cron');
const { capture, captureDominance, capturePremium } = require('./routes/capture');
const { performPriceAnalysis } = require('./routes/chart');
const { performArticleAnalysis } = require('./routes/create');
const { performArticleCrawl } = require('./routes/crawl');
const { performDominanceAnalysis, performDominanceCollect } = require('./routes/dominance');

const startCronJobs = () => {

    // Task to run capturePremium at every hour at the 8th minute in KST (e.g., 1:08, 2:08)
    cron.schedule('8 * * * *', async () => {
        console.log(`Running capturePremium at ${new Date().toLocaleString()}`);
        await capturePremium(); // Call your function
    }, {
        timezone: "Asia/Seoul"
    });

    // Task to run capture at 8:55 AM and 8:55 PM every day in KST
    cron.schedule('55 8,20 * * *', async () => {
        console.log(`Running capture at ${new Date().toLocaleString()}`);
        await capture(); // Call your function
    }, {
        timezone: "Asia/Seoul"
    });

    // Task to run performPriceAnalysis at 8:50 AM and 8:50 PM every day in KST
    cron.schedule('50 8,20 * * *', async () => {
        console.log(`Running performPriceAnalysis at ${new Date().toLocaleString()}`);
        await performPriceAnalysis(); // Call your function
    }, {
        timezone: "Asia/Seoul"
    });

    // Task to run performArticleCrawl every 3 hours starting from 8:00 AM in KST (8:00, 11:00, 14:00, etc.)
    cron.schedule('0 2-23/3 * * *', async () => {
        console.log(`Running performArticleCrawl at ${new Date().toLocaleString()}`);
        await performArticleCrawl(); // Call your function
    }, {
        timezone: "Asia/Seoul"
    });

    // Task to run performArticleAnalysis at 8:30 AM and 8:30 PM every day in KST
    cron.schedule('30 8,20 * * *', async () => {
        console.log(`Running performArticleAnalysis at ${new Date().toLocaleString()}`);
        await performArticleAnalysis(); // Call your function
    }, {
        timezone: "Asia/Seoul"
    });

    // // Example for a frequently running task (every 30 seconds, as a reference)
    // cron.schedule('*/30 * * * * *', async () => {
    //     console.log(`Running a task every 30 seconds at ${new Date().toLocaleString()}`);
    // }, {
    //     timezone: "Asia/Seoul"
    // });
    //
    // // Task every minute
    // cron.schedule('* * * * *', async () => {
    //     console.log(`Running a task every minute at ${new Date().toLocaleString()}`);
    // }, {
    //     timezone: "Asia/Seoul"
    // });
};

module.exports = { startCronJobs };
