const cron = require('node-cron');
// const { capture, captureDominance, capturePremium } = require('./routes/capture');
const { capture, capturePremium } = require('./routes/screenshot');
const { performPriceAnalysis } = require('./routes/chart');
const { performArticleAnalysis } = require('./routes/create');
const { performArticleCrawl } = require('./routes/crawl');
const { performDominanceAnalysis, performDominanceCollect } = require('./routes/dominance');
const { captureDolphin } = require('./routes/capture');

const startCronJobs = () => {

    // Task to run capturePremium at every hour at the 8th minute in KST (e.g., 1:08, 2:08)
    // 8th minute in KST becomes 8 - 9 = -1 => corresponds to 23:08 of the previous hour UTC
    cron.schedule('13 * * * *', async () => {
        console.log(`Running capturePremium at ${new Date().toLocaleString()}`);
        // await capturePremium(); // Call your function
        await capturePremium(); // Call your function
    }, {
        timezone: "UTC"
    });

    // Task to run capture at 8:55 AM and 8:55 PM every day in KST
    // 8:55 AM KST becomes 23:55 UTC (previous day)
    // 8:55 PM KST becomes 11:55 UTC
    cron.schedule('55 23,11 * * *', async () => {
        console.log(`Running capture at ${new Date().toLocaleString()}`);
        await capture(); // Call your function
    }, {
        timezone: "UTC"
    });

    // Task to run performPriceAnalysis at 8:50 AM and 8:50 PM every day in KST
    // 8:50 AM KST becomes 23:50 UTC (previous day)
    // 8:50 PM KST becomes 11:50 UTC
    cron.schedule('50 23,11 * * *', async () => {
        console.log(`Running performPriceAnalysis at ${new Date().toLocaleString()}`);
        await performPriceAnalysis(); // Call your function
    }, {
        timezone: "UTC"
    });


    cron.schedule('0 17,20,23,2,5,8,11,14 * * *', async () => {
        console.log(`Running performArticleCrawl at ${new Date().toLocaleString()}`);
        await performArticleCrawl(); // Call your function
    }, {
        timezone: "UTC"
    });

    // Task to run performArticleAnalysis at 8:30 AM and 8:30 PM every day in KST
    // 8:30 AM KST becomes 23:30 UTC (previous day)
    // 8:30 PM KST becomes 11:30 UTC
    cron.schedule('30 23,11 * * *', async () => {
        console.log(`Running performArticleAnalysis at ${new Date().toLocaleString()}`);
        await performArticleAnalysis(); // Call your function
    }, {
        timezone: "UTC"
    });

    // Task to run at 13:25 KST, which is 04:25 UTC
    cron.schedule('25 4 * * *', async () => {
        console.log(`Test cron job running at ${new Date().toLocaleString()} (UTC time)`);
        // Place your test logic here
    }, {
        timezone: "UTC"  // Running based on UTC
    });

    // Task to run at 13:25 KST, which is 04:25 UTC
    // cron.schedule('40 * * * *', async () => {
    //     console.log(`Running dolphinCapture at ${new Date().toLocaleString()} (UTC time)`);
    //     await captureDolphin();
    // }, {
    //     timezone: "UTC"  // Running based on UTC
    // });
};

module.exports = { startCronJobs };
