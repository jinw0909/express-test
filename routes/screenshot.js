var express = require('express');
var router = express.Router();
const path = require('path');

const puppeteer = require('puppeteer');

const screenshotDir = path.join(__dirname, '../screenshots');
const fs = require('fs');
if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir, { recursive: true });
}

async function captureScreenshot(url, filePath) {
    const browser = await puppeteer.launch({
        headless: false,  // Run in non-headless mode
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu'
        ]
    });
    const page = await browser.newPage();

    // Set a realistic User-Agent
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36');

    // Optionally, you can set additional headers if needed
    await page.setExtraHTTPHeaders({
        'Accept-Language': 'en-US,en;q=0.9'
    });

    // Add a delay to mimic human behavior
    await page.waitForTimeout(2000);

    await page.goto(url, { waitUntil: 'networkidle2' });

    await page.screenshot({ path: filePath });
    await browser.close();
}

/* GET home page. */
router.get('/', async function(req, res, next) {
    try {
        const filePath = path.join(screenshotDir, 'liquidation.png');
        await captureScreenshot('https://www.coinglass.com/ko/LiquidationData', filePath);
        res.send('Screenshot captured. You can access it at /screenshots/liquidation.png');
    } catch (error) {
        console.error(error);
        res.status(500).send('Error capturing screenshot');
    }
});

module.exports = router;
