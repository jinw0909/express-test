const cron = require('node-cron');
const axios = require('axios');

const triggerArticleCrawl = async () => {
    try {
        const response = await axios.get(`${process.env.API_BASE_URL}/crawl/articles`);
        console.log("Crawl initiated: ", response.data);
    } catch (error) {
        console.error('Error triggering article crawl: ', error);
    }
}

const setupCronJobs = () => {
    cron.schedule('0 */4 * * *', () => {
        console.log('Running a task every 4 hours');
        triggerArticleCrawl();
    });
    // cron.schedule('* * * * *', function() {  // This sets it to run every minute
    //     console.log('This job is supposed to run every minute.');
    //     triggerArticleCrawl();
    // });
};

module.exports = setupCronJobs;