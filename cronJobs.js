const cron = require('node-cron');
const axios = require('axios');
const { DateTime } = require('luxon');

// Helper function to get KST time in ISO format
function getKSTTime() {
    return DateTime.now().setZone('Asia/Seoul').toISO();
}

// Log that cron jobs have been scheduled
console.log(`[${getKSTTime()}] Cron jobs scheduled.`);

// Cron job to run at 8:45 AM and 4:45 PM KST everyday for /capture route
cron.schedule('45 8,16 * * *', async () => {
    console.log(`[${getKSTTime()}] Invoking /capture`);
    try {
        const response = await axios.get('http://3.35.39.80:8080/capture');
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error invoking /capture:', error);
    }
}, {
    timezone: 'Asia/Seoul'
});

// Cron job to run at 8:45 AM and 4:45 PM KST everyday for /capture/dominance route
cron.schedule('45 8,16 * * *', async () => {
    console.log(`[${getKSTTime()}] Invoking /capture/dominance`);
    try {
        const response = await axios.get('http://3.35.39.80:8080/capture/dominance');
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error invoking /capture/dominance:', error);
    }
}, {
    timezone: 'Asia/Seoul'
});

// Cron job to run at every hour's 5th minute for /capture/premium route
cron.schedule('5 * * * *', async () => {
    console.log(`[${getKSTTime()}] Invoking /capture/premium`);
    try {
        const response = await axios.get('http://3.35.39.80:8080/capture/premium');
        console.log('Response:', response.data);
    } catch (error) {
        console.error('Error invoking /capture/premium:', error);
    }
}, {
    timezone: 'Asia/Seoul'
});

console.log('Cron jobs scheduled.');
