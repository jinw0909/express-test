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

const triggerPuppetCrawl = async () => {
    try {
        const response = await axios.get(`${process.env.API_BASE_URL}/puppet`);
        console.log("Puppet crawl initiated: ", response.data);
    } catch (error) {
        console.error('Error triggering puppet crawl: ', error);
    }
}

const setupCronJobs = () => {
    cron.schedule('0 */4 * * *', () => {
        console.log('Running a task every 4 hours');
        triggerArticleCrawl();
    });

    // Run every hour at the start of the hour
    cron.schedule('0 * * * *', () => {
        console.log('Running a task every hour');
        triggerPuppetCrawl();
    });
};

module.exports = setupCronJobs;