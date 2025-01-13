const express = require('express');
const router = express.Router();
const { chromium } = require('playwright');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { BitcoinAnalysis } = require('../models');
const plainDb = require('../plainConnection');

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_PASSWORD,
    region: process.env.S3_REGION
});

const capture = async function (req, res) {
    let browser;
    try {
        browser = await chromium.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true
        });

        const page = await browser.newPage({deviceScaleFactor: 2});

        // Set a high-resolution viewport
        await page.setViewportSize({
            width: 1920,
            height: 1080
        });

        // Navigate to the page
        console.log('Navigating to the page...');
        await page.goto('https://daily-news-generator.com/chart/draw', { waitUntil: 'networkidle' });

        // Wait for canvas elements to load
        console.log('Waiting for #dayChart...');
        const dayChart = page.locator('#dayChart');
        await dayChart.waitFor({ timeout: 60000 });

        console.log('Waiting for #monthChart...');
        const monthChart = page.locator('#monthChart');
        await monthChart.waitFor({ timeout: 60000 });

        // Take screenshots of the elements
        console.log('Capturing screenshots...');
        const dayBuffer = await dayChart.screenshot();
        const monthBuffer = await monthChart.screenshot();

        // Close the browser
        await browser.close();

        // Prepare S3 upload parameters
        const dayS3Params = {
            Bucket: process.env.S3_BUCKET,
            Key: `charts/day-chart-${uuidv4()}.png`,
            Body: dayBuffer,
            ContentType: 'image/png'
        };

        const monthS3Params = {
            Bucket: process.env.S3_BUCKET,
            Key: `charts/month-chart-${uuidv4()}.png`,
            Body: monthBuffer,
            ContentType: 'image/png'
        };

        // Upload screenshots to S3
        console.log('Uploading screenshots to S3...');
        const [dayS3Response, monthS3Response] = await Promise.all([
            s3.upload(dayS3Params).promise(),
            s3.upload(monthS3Params).promise()
        ]);

        // Get the URLs from the S3 responses
        const dayImageUrl = dayS3Response.Location;
        const monthImageUrl = monthS3Response.Location;

        // Fetch the latest row's ID
        const latestEntry = await BitcoinAnalysis.findOne({
            order: [['id', 'DESC']]
        });

        if (!latestEntry) {
            throw new Error('No entries found in the BitcoinAnalysis table');
        }

        // Update the latest row with the new URLs using the instance method
        console.log('Updating database with image URLs...');
        await latestEntry.update({
            daychart_imgUrl: dayImageUrl,
            monthchart_imgUrl: monthImageUrl
        });

        if (res) res.send(`Day chart screenshot saved to S3: ${dayImageUrl}, Month chart screenshot saved to S3: ${monthImageUrl}`);


    } catch (error) {
        console.error('Error: ', error);
        if (res) res.status(500).send('Error processing request')
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

const capturePremium = async function (req, res) {
    let browser;

    try {
        console.log('Starting capturePremium process');

        // Step 1: Fetch the latest datetime
        const [latestRow] = await plainDb.query(
            'SELECT datetime FROM beuliping ORDER BY id DESC LIMIT 1'
        );
        if (!latestRow || latestRow.length === 0) {
            console.log('No rows found in beuliping.');
            if (res) return res.status(404).send('No rows found');
            return;
        }

        const latestDatetime = latestRow.datetime;
        console.log('Latest Datetime:', latestDatetime);

        // Step 2: Fetch recent rows with the latest datetime
        const recentRows = await plainDb.query(
            `
            SELECT id, symbol
            FROM beuliping
            WHERE datetime = ?
            ORDER BY id DESC
        `,
            [latestDatetime]
        );

        console.log('Fetched recent rows:', recentRows);

        if (!recentRows || recentRows.length === 0) {
            console.log('No recent rows found for the latest datetime.');
            if (res) return res.status(404).send('No recent rows found');
            return;
        }

        // Step 3: Launch Playwright browser
        console.log('Launching Playwright browser');
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        for (const row of recentRows) {
            try {
                const { id, symbol } = row;
                console.log(`Processing symbol: ${symbol}, row ID: ${id}`);

                if (symbol === '1000BONK' || symbol === 'CVC' || symbol === 'RAY') {
                    console.log('Skipping unregistered symbol');
                    continue;
                }

                // const url = `https://tryex.xyz/capture_premium.php?kind=${symbol}USDT&authKey=tryex013579`;
                // const url = `https://retri.xyz/capture_premium.php?kind=${symbol}USDT`;
                const url = 'https://tryex.xyz/capture_brief_chart.php?kind=BTCUSDT&hour=50&authKey=tryex013579';

                const page = await browser.newPage({deviceScaleFactor: 2});
                await page.setViewportSize({
                    width: 800,
                    height: 600,
                });
                // Step 4: Navigate to the page
                console.log(`Navigating to URL: ${url}`);

                // const consoleLogs = [];
                // page.on('console', (msg) => {
                //     consoleLogs.push(msg.text());
                // });

                await page.goto(url, { waitUntil: 'networkidle' });

                // await new Promise(async (resolve, reject) => {
                //     page.on('console', (msg) => {
                //         if (msg.text() === 'success') {
                //             console.log('Chart is fully loaded.');
                //             resolve();
                //         }
                //     });
                //     const interval = setInterval(() => {
                //         if (consoleLogs.includes('success')) {
                //             console.log('Chart is fully loaded.');
                //             clearInterval(interval);
                //             resolve();
                //         }
                //     }, 1000);
                //
                //     // Optional: set a timeout to stop waiting after 60 seconds
                //     setTimeout(() => {
                //         clearInterval(interval);
                //         reject(new Error("Timeout: 'success' message was not received"));
                //     }, 60000);
                // });
                //
                // await page.waitForTimeout(1000); // Give extra time for rendering

                const chartElement = await page.locator('.tv-lightweight-charts');
                if (!(await chartElement.isVisible())) {
                    console.error(`Chart element not found for symbol ${symbol}`);
                    await page.close();
                    continue;
                }

                // Step 5: Take the screenshot
                const chartBuffer = await chartElement.screenshot({ type: 'png' });
                console.log(`Screenshot taken for ${symbol}`);

                await page.close();

                // Step 6: Upload screenshot to S3
                const chartS3Params = {
                    Bucket: process.env.S3_BUCKET,
                    Key: `premiumchart-${uuidv4()}.png`,
                    Body: chartBuffer,
                    ContentType: 'image/png',
                };

                console.log('Uploading screenshot to S3...');
                const chartS3Response = await s3.upload(chartS3Params).promise();
                const chartImageUrl = chartS3Response.Location;
                console.log(`Screenshot uploaded to S3, URL: ${chartImageUrl}`);

                // Step 7: Update database with image URL
                console.log(`Updating database for row ID: ${id}`);
                await plainDb.query('UPDATE beuliping SET images = ? WHERE id = ?', [chartImageUrl, id]);
                console.log(`Database updated successfully for row ID: ${id}`);
            } catch (error) {
                console.error(`Error processing symbol ${row.symbol} (ID ${row.id}):`, error);
            }
        }

        if (res) res.send('Screenshots captured and updated successfully.');
        console.log('CapturePremium process completed successfully.');
    } catch (error) {
        console.error('Error in capturePremium function:', error);
        if (res) res.status(500).send('Error processing request');
    } finally {
        if (browser) {
            console.log('Closing Playwright browser');
            await browser.close();
        }
        console.log('capturePremium function ended');
    }
};
// Route Definition
router.get('/test', capturePremium);
router.get('/test2', capture);

module.exports = {
    router,
    capturePremium,
    capture
};
