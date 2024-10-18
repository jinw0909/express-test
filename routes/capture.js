const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const AWS = require('aws-sdk');
const { v4: uuidv4 } = require('uuid');
const { BitcoinAnalysis, DominanceAnalysis } = require('../models');  // Ensure this path is correct for your project
const plainDb = require('../plainConnection'); // Import the plain DB connection

// Configure AWS S3
const s3 = new AWS.S3({
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_PASSWORD,
    region: process.env.S3_REGION
});

const capture = async function(req, res) {
    let browser;
    try {
        // Launch browser and navigate to the page
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();

        // Set a high-resolution viewport
        await page.setViewport({
            width: 1920,  // Increase width for a larger screenshot
            height: 1080, // Increase height
            deviceScaleFactor: 2 // Set to 2 for high-resolution screens, increase further if needed
        });

        // await page.goto('https://blocksquare-automation.com/chart/draw', { waitUntil: 'networkidle0' });
        await page.goto('https://goya-regular-brief.com/chart/draw', { waitUntil: 'networkidle0' });

        // Increase timeout and wait for the canvas elements
        console.log('Waiting for #dayChart...');
        await page.waitForSelector('#dayChart', { timeout: 60000 }); // Increase timeout to 60 seconds

        console.log('Waiting for #monthChart...');
        await page.waitForSelector('#monthChart', { timeout: 60000 }); // Increase timeout to 60 seconds

        // Select the canvas elements and take screenshots
        const dayElement = await page.$('#dayChart');
        const monthElement = await page.$('#monthChart');

        if (!dayElement || !monthElement) {
            throw new Error('One or more elements not found on the page');
        }

        const dayBuffer = await dayElement.screenshot();
        const monthBuffer = await monthElement.screenshot();

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

        // Upload both screenshots to S3
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

        // Update the latest row with the new URLs using instance method
        await latestEntry.update({
            daychart_imgUrl: dayImageUrl,
            monthchart_imgUrl: monthImageUrl
        });

        if (res) res.send(`Day chart screenshot saved to S3: ${dayImageUrl}, Month chart screenshot saved to S3: ${monthImageUrl}`);
    } catch (error) {
        console.error('Error:', error);
        if (res) res.status(500).send('Error processing request');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
const captureDominance = async function(req, res) {
    let browser;
    try {
        // Launch browser and navigate to the page
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto('http://localhost:8080/dominance', { waitUntil: 'networkidle0' });

        // Increase timeout and wait for the canvas elements
        console.log('Waiting for #lineChart...');
        await page.waitForSelector('#lineChart', { timeout: 60000 }); // Increase timeout to 60 seconds

        console.log('Waiting for #doughnutChart...');
        await page.waitForSelector('#doughnutChart', { timeout: 60000 }); // Increase timeout to 60 seconds

        // Select the canvas elements and take screenshots
        const lineElement = await page.$('#lineChart');
        const doughnutElement = await page.$('#doughnutChart');

        if (!lineElement || !doughnutElement) {
            throw new Error('One or more elements not found on the page');
        }

        const boundingBox = await doughnutElement.boundingBox();

        const lineBuffer = await lineElement.screenshot();
        const doughnutBuffer = await doughnutElement.screenshot();

        await browser.close();

        // Prepare S3 upload parameters
        const lineS3Params = {
            Bucket: process.env.S3_BUCKET,
            Key: `charts/line-chart-${uuidv4()}.png`,
            Body: lineBuffer,
            ContentType: 'image/png'
        };

        const doughnutS3Params = {
            Bucket: process.env.S3_BUCKET,
            Key: `charts/doughnut-chart-${uuidv4()}.png`,
            Body: doughnutBuffer,
            ContentType: 'image/png'
        };

        // Upload both screenshots to S3
        const [lineS3Response, doughnutS3Response] = await Promise.all([
            s3.upload(lineS3Params).promise(),
            s3.upload(doughnutS3Params).promise()
        ]);

        // Get the URLs from the S3 responses
        const lineImageUrl = lineS3Response.Location;
        const doughnutImageUrl = doughnutS3Response.Location;

        // Fetch the latest row's ID in DominanceAnalysis
        const latestEntry = await DominanceAnalysis.findOne({
            order: [['id', 'DESC']]
        });

        if (!latestEntry) {
            throw new Error('No entries found in the DominanceAnalysis table');
        }

        // Update the latest row with the new URLs using instance method
        await latestEntry.update({
            goya_imgUrl: lineImageUrl,
            dominance_imgUrl: doughnutImageUrl
        });

        if (res) res.send(`Line chart screenshot saved to S3: ${lineImageUrl}, Doughnut chart screenshot saved to S3: ${doughnutImageUrl}`);
    } catch (error) {
        console.error('Error:', error);
        if (res) res.status(500).send('Error processing request');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
const captureDominanceS3 = async function(req, res) {
    let browser;
    const start = req.query.start;
    const end = req.query.end;
    try {
        // Launch browser and navigate to the page
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.goto(`http://localhost:8080/self/dominance?start=${start}&end=${end}`, { waitUntil: 'networkidle0' });

        // Increase timeout and wait for the canvas elements
        console.log('Waiting for #lineChart...');
        await page.waitForSelector('#lineChart', { timeout: 60000 }); // Increase timeout to 60 seconds

        console.log('Waiting for #doughnutChart...');
        await page.waitForSelector('#doughnutChart', { timeout: 60000 }); // Increase timeout to 60 seconds

        // Select the canvas elements and take screenshots
        const lineElement = await page.$('#lineChart');
        const doughnutElement = await page.$('#doughnutChart');

        if (!lineElement || !doughnutElement) {
            throw new Error('One or more elements not found on the page');
        }

        const boundingBox = await doughnutElement.boundingBox();

        const lineBuffer = await lineElement.screenshot();
        const doughnutBuffer = await doughnutElement.screenshot();

        await browser.close();

        // Prepare S3 upload parameters
        const lineS3Params = {
            Bucket: process.env.S3_BUCKET,
            Key: `charts/line-chart-${uuidv4()}.png`,
            Body: lineBuffer,
            ContentType: 'image/png'
        };

        const doughnutS3Params = {
            Bucket: process.env.S3_BUCKET,
            Key: `charts/doughnut-chart-${uuidv4()}.png`,
            Body: doughnutBuffer,
            ContentType: 'image/png'
        };

        // Upload both screenshots to S3
        const [lineS3Response, doughnutS3Response] = await Promise.all([
            s3.upload(lineS3Params).promise(),
            s3.upload(doughnutS3Params).promise()
        ]);

        // Get the URLs from the S3 responses
        const lineImageUrl = lineS3Response.Location;
        const doughnutImageUrl = doughnutS3Response.Location;

        if (res) res.send(`Line chart screenshot saved to S3: ${lineImageUrl}, Doughnut chart screenshot saved to S3: ${doughnutImageUrl}`);
    } catch (error) {
        console.error('Error:', error);
        if (res) res.status(500).send('Error processing request');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
const capturePremium = async function(req, res) {
    let browser;
    try {
        const [latestRow] = await plainDb.query('SELECT datetime FROM beuliping ORDER BY id DESC LIMIT 1');
        if (!latestRow || latestRow.length === 0) {
            if (res) return res.status(404).send('No rows found');
            return;
        }
        const latestDatetime = latestRow.datetime;
        console.log('Latest Datetime: ', latestDatetime);
        const recentRows = await plainDb.query(`
            SELECT id, symbol
            FROM beuliping
            WHERE datetime = ?
            ORDER BY id DESC
        `, [latestDatetime]);
        // Log the recent rows for debugging
        console.log('Recent Rows:', recentRows);
        if (!recentRows || recentRows.length === 0) {
            if (res) return res.status(404).send('No recent rows found');
            return;
        }
        // Launch the browser
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true
        });
        // Test Shot
        const page = await browser.newPage();
        await page.setViewport({
            width: 800,
            height: 600,
            deviceScaleFactor: 2 // Set to 2 for higher resolution (simulating a retina display)
        });
        await page.goto('https://retri.xyz/capture_premium.php?kind=BTCUSDT&hour=120', { waitUntil: 'networkidle0' });
        await page.waitForSelector('canvas', { timeout: 60000 });
        const chartElem = await page.$('.tv-lightweight-charts');
        if (!chartElem) {
            await page.close();
        }
        await chartElem.screenshot();
        await page.close();
        for (const row of recentRows) {
            try {
                const { id, symbol } = row;
                if (symbol === '1000BONK') continue;

                const url = `https://retri.xyz/capture_premium.php?kind=${symbol}USDT&hour=120`;
                const page = await browser.newPage();

                // Set a higher-resolution viewport and device scale factor
                await page.setViewport({
                    width: 800,
                    height: 600,
                    deviceScaleFactor: 2 // Set to 2 for higher resolution (simulating a retina display)
                });

                await page.goto(url, { waitUntil: 'networkidle0' });
                await sleep(1000);
                console.log(`Waiting for #chart to load for symbol ${symbol}...`);
                await page.waitForSelector('canvas', { timeout: 60000 });

                const chartElement = await page.$('.tv-lightweight-charts');
                if (!chartElement) {
                    console.error(`Chart element not found for symbol ${symbol}`);
                    await page.close();
                    continue; // Skip to the next iteration
                }

                // Capture a high-resolution screenshot
                const chartBuffer = await chartElement.screenshot();

                const chartS3Params = {
                    Bucket: process.env.S3_BUCKET,
                    Key: `premiumchart-${uuidv4()}.png`,
                    Body: chartBuffer,
                    ContentType: 'image/png'
                };

                const chartS3Response = await s3.upload(chartS3Params).promise();
                const chartImageUrl = chartS3Response.Location;

                await plainDb.query('UPDATE beuliping SET images = ? WHERE id = ?', [chartImageUrl, id]);
                console.log(`Updated row ${id} with image URL ${chartImageUrl}`);

                await page.close();
            } catch (error) {
                console.error(`Error processing symbol ${row.symbol}:`, error);
                // Catch and log the error, but continue with the next iteration
                //continue;
            }
        }

        if (res) res.send('Screenshots captured and updated successfully.');
    } catch (error) {
        console.error('Error:', error);
        if (res) res.status(500).send('Error processing request');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
const capturePremiumTest = async function(req, res) {
    let browser;
    try {
        const [latestRow] = await plainDb.query('SELECT datetime FROM beuliping ORDER BY id DESC LIMIT 1');
        if (!latestRow || latestRow.length === 0) {
            if (res) return res.status(404).send('No rows found');
            return;
        }
        const latestDatetime = latestRow.datetime;
        console.log('Latest Datetime: ', latestDatetime);
        const recentRows = await plainDb.query(`
            SELECT id, symbol
            FROM beuliping
            WHERE datetime = ?
            ORDER BY id DESC
        `, [latestDatetime]);
        // Log the recent rows for debugging
        console.log('Recent Rows:', recentRows);
        if (!recentRows || recentRows.length === 0) {
            if (res) return res.status(404).send('No recent rows found');
            return;
        }
        // Launch the browser
        browser = await puppeteer.launch({
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            headless: true
        });
        // Test Shot
        const page = await browser.newPage();
        await page.setViewport({
            width: 800,
            height: 600,
            deviceScaleFactor: 2 // Set to 2 for higher resolution (simulating a retina display)
        });
        // await page.goto('https://retri.xyz/capture_premium.php?kind=BTCUSDT&hour=120', { waitUntil: 'networkidle0' });
        // await page.waitForSelector('canvas', { timeout: 60000 });
        // const chartElem = await page.$('.tv-lightweight-charts');
        // if (!chartElem) {
        //     await page.close();
        // }
        // await chartElem.screenshot();
        // await page.close();
        for (const row of recentRows) {
            try {
                const { id, symbol } = row;
                if (symbol === '1000BONK') continue;

                const url = `https://retri.xyz/capture_premium.php?kind=${symbol}USDT&hour=120`;
                // const page = await browser.newPage();
                //
                // // Set a higher-resolution viewport and device scale factor
                // await page.setViewport({
                //     width: 800,
                //     height: 600,
                //     deviceScaleFactor: 2 // Set to 2 for higher resolution (simulating a retina display)
                // });

                await page.goto(url, { waitUntil: 'networkidle0' });
                await sleep(1000);
                console.log(`Waiting for #chart to load for symbol ${symbol}...`);
                await page.waitForSelector('canvas', { timeout: 60000 });

                const chartElement = await page.$('.tv-lightweight-charts');
                if (!chartElement) {
                    console.error(`Chart element not found for symbol ${symbol}`);
                    await page.close();
                    continue; // Skip to the next iteration
                }

                // Capture a high-resolution screenshot
                const chartBuffer = await chartElement.screenshot();

                const chartS3Params = {
                    Bucket: process.env.S3_BUCKET,
                    Key: `premiumchart-${uuidv4()}.png`,
                    Body: chartBuffer,
                    ContentType: 'image/png'
                };

                const chartS3Response = await s3.upload(chartS3Params).promise();
                const chartImageUrl = chartS3Response.Location;

                await plainDb.query('UPDATE beuliping SET images = ? WHERE id = ?', [chartImageUrl, id]);
                console.log(`Updated row ${id} with image URL ${chartImageUrl}`);

            } catch (error) {
                console.error(`Error processing symbol ${row.symbol}:`, error);
                // Catch and log the error, but continue with the next iteration
                //continue;
            }
        }
        await page.close();

        if (res) res.send('Screenshots captured and updated successfully.');
    } catch (error) {
        console.error('Error:', error);
        if (res) res.status(500).send('Error processing request');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
const captureSymbol = async function(req, res) {
    let browser;
    try {
        // Get the symbol from the query string
        const { symbol } = req.query;
        if (!symbol) {
            return res.status(400).send('Symbol query parameter is required');
        }

        // Launch the browser
        browser = await puppeteer.launch({
            // args: ['--no-sandbox', '--disable-setuid-sandbox'],
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu', '--disable-software-rasterizer'],
            headless: true
        });
        let version = await browser.version();
        console.log("version: ", version);

        const page = await browser.newPage();
        await page.setViewport({
            width: 800,
            height: 600,
            deviceScaleFactor: 2 // Set to 2 for higher resolution (simulating a retina display)
        });

        // Generate the URL for the requested symbol
        const url = `https://retri.xyz/capture_premium.php?kind=${symbol}USDT&hour=120`;

        // Navigate to the page and wait for the chart to load
        await page.goto(url, { waitUntil: 'networkidle2' });
        await page.waitForSelector('canvas', { timeout: 60000 });

        const chartElement = await page.$('.tv-lightweight-charts');
        if (!chartElement) {
            await page.close();
            return res.status(404).send(`Chart element not found for symbol ${symbol}`);
        }



        // Capture the screenshot and save it locally
        // const fileName = `premiumchart-${symbol}-${uuidv4()}.png`;
        // const filePath = path.join(__dirname, 'screenshots', fileName);


        const chartBuffer = await chartElement.screenshot({ type: 'png'});
        res.set('Content-Type', 'image/png');
        res.set('Content-Length', chartBuffer.length);

        res.send(chartBuffer);

        // Ensure the directory exists
        // if (!fs.existsSync(path.join(__dirname, 'screenshots'))) {
        //     fs.mkdirSync(path.join(__dirname, 'screenshots'));
        // }
        //
        // await chartElement.screenshot({ path: filePath });
        // console.log(`Screenshot saved locally as ${filePath}`);
        //
        // // Return the path to the screenshot in the response
        // res.sendFile(filePath);

        await page.close();
    } catch (error) {
        console.error('Error:', error);
        res.status(500).send('Error processing request');
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
router.post('/', capture);
router.post('/dominance', captureDominance);
router.post('/premium', capturePremiumTest);
router.get('/test', capturePremiumTest);
router.get('/dominanceS3', captureDominanceS3);
router.get('/symbol', captureSymbol);
module.exports = {
    router,
    capture,
    captureDominance,
    capturePremium
};
