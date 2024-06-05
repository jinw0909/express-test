const cron = require('node-cron');
const axios = require('axios');

cron.schedule('* */4 * * *', async () => {
    console.log('Running a task every four hours');

    // Make an API call
    try {
        const response = await axios.get(`${process.env.API_BASE_URL}/crawl/articles`);
        console.log('API call successful. Data: ', response.data);
    } catch (error) {
        console.error('Error making API call: ', error);
    }

})


// Keep the Node.js process running
console.log('Cron job scheduled. The process will keep running to execute the scheduled task.');
