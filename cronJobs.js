const cron = require('node-cron');
const { DateTime } = require('luxon');
const { capture, captureDominance, capturePremium } = require('./routes/capture'); // Adjust the path as needed

// Helper function to get KST time in ISO format
function getKSTTime() {
    return DateTime.now().setZone('Asia/Seoul').toISO();
}

// Log that cron jobs have been scheduled
console.log(`[${getKSTTime()}] Cron jobs scheduled.`);

// Cron job to run at 8:45 AM and 8:45 PM KST every day for /capture route
cron.schedule('45 8,20 * * *', async () => {
    console.log(`[${getKSTTime()}] Invoking /capture`);
    try {
        await capture();
        console.log('Capture function invoked successfully.');
    } catch (error) {
        console.error('Error invoking capture function:', error);
    }
}, {
    timezone: 'Asia/Seoul'
});

// Cron job to run at 8:45 AM and 8:45 PM KST every day for /capture/dominance route
cron.schedule('45 8,20 * * *', async () => {
    console.log(`[${getKSTTime()}] Invoking /capture/dominance`);
    try {
        await captureDominance();
        console.log('CaptureDominance function invoked successfully.');
    } catch (error) {
        console.error('Error invoking captureDominance function:', error);
    }
}, {
    timezone: 'Asia/Seoul'
});

// Cron job to run at every hour's 5th minute for /capture/premium route
cron.schedule('8 * * * *', async () => {
    console.log(`[${getKSTTime()}] Invoking /capture/premium`);
    try {
        await capturePremium();
        console.log('CapturePremium function invoked successfully.');
    } catch (error) {
        console.error('Error invoking capturePremium function:', error);
    }
}, {
    timezone: 'Asia/Seoul'
});

console.log('Cron jobs scheduled.');
