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
        console.log('🔵 Starting capturePremium process');

        // ✅ Step 1: Fetch recent rows in a single query
        const recentRows = await plainDb.query(
            `
            SELECT id, symbol, datetime
            FROM beuliping
            WHERE datetime = (SELECT MAX(datetime) FROM beuliping)
            ORDER BY id DESC
        `
        );

        if (!recentRows || recentRows.length === 0) {
            console.log('⚠️ No recent rows found.');
            if (res) return res.status(404).send('No recent rows found');
            return;
        }

        console.log(`✅ Found ${recentRows.length} recent rows`);

        // ✅ Step 2: Launch Playwright browser once for all captures
        console.log('🚀 Launching Playwright browser...');
        browser = await chromium.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
        });

        // ✅ Step 3: Process symbols in parallel with concurrency control
        const maxConcurrentScreenshots = 3; // Adjust based on your server performance
        // const processRows = async (row) => {
        //     try {
        //         const { id, symbol } = row;
        //         console.log(`🔵 Processing symbol: ${symbol} (ID: ${id})`);
        //
        //         // ✅ Step 3.1: Check content in vm_beuliping_KR
        //         const [contentCheck] = await plainDb.query(
        //             `SELECT content FROM beuliping_KR WHERE m_id = ?`,
        //             [id]
        //         );
        //
        //         if (!contentCheck || contentCheck.length === 0 || contentCheck.content.includes("없습니다.")) {
        //             console.log(`⚠️ Skipping symbol: ${symbol} due to empty or invalid content.`);
        //             return;
        //         }
        //
        //         // ✅ Skip known unregistered symbols
        //         if (['1000BONK', 'CVC', 'RAY'].includes(symbol)) {
        //             console.log(`⚠️ Skipping unregistered symbol: ${symbol}`);
        //             return;
        //         }
        //
        //         // ✅ Step 3.2: Prepare page & navigate
        //         const url = `https://tryex.xyz/capture_brief_chart.php?kind=${symbol}USDT&hour=50&authKey=tryex013579`;
        //         const page = await browser.newPage();
        //         await page.setViewportSize({ width: 800, height: 600 });
        //
        //         // console.log(`🌍 Navigating to URL: ${url}`);
        //         let retries = 3;
        //         while (retries > 0) {
        //             try {
        //                 await page.goto(url, { timeout: 60000, waitUntil: "networkidle" });
        //                 // Wait explicitly for the chart to appear
        //                 await page.waitForSelector('.tv-lightweight-charts', { timeout: 15000 });
        //                 await page.waitForTimeout(500); // 렌더 버퍼
        //
        //                 break;
        //             } catch (navError) {
        //                 console.warn(`⚠️ Navigation or selector failed for ${symbol} (Retrying ${retries - 1} left)`, navError.message);
        //                 retries--;
        //                 if (retries === 0) throw navError;
        //             }
        //         }
        //
        //         const chartElement = page.locator('.tv-lightweight-charts');
        //         if (!(await chartElement.isVisible())) {
        //             console.warn(`⚠️ Chart element still not visible for ${symbol}. Skipping.`);
        //             await page.close();
        //             return;
        //         }
        //
        //
        //         const chartBuffer = await chartElement.screenshot({ type: 'png' });
        //         console.log(`📸 Screenshot taken for ${symbol}`);
        //
        //         await page.close();
        //
        //         // ✅ Step 3.4: Upload to S3
        //         const chartS3Params = {
        //             Bucket: process.env.S3_BUCKET,
        //             Key: `premiumchart-${uuidv4()}.png`,
        //             Body: chartBuffer,
        //             ContentType: 'image/png',
        //             CacheControl: 'max-age=31536000, immutable'
        //         };
        //
        //         console.log('☁️ Uploading screenshot to S3...');
        //         const chartS3Response = await s3.upload(chartS3Params).promise();
        //         const chartImageUrl = chartS3Response.Location;
        //         console.log(`✅ Screenshot uploaded to S3: ${chartImageUrl}`);
        //
        //         // ✅ Step 3.5: Update database
        //         console.log(`📝 Updating database for row ID: ${id}`);
        //         await plainDb.query('UPDATE beuliping SET images = ? WHERE id = ?', [chartImageUrl, id]);
        //         console.log(`✅ Database updated for row ID: ${id}`);
        //     } catch (error) {
        //         console.error(`❌ Error processing symbol ${row.symbol} (ID ${row.id}):`, error.stack);
        //     }
        // };
        const MAX_RETRIES = 3;

        const processRows = async (row) => {
            try {
                const { id, symbol } = row;
                console.log(`🔵 Processing symbol: ${symbol} (ID: ${id})`);

                // ✅ 1) 콘텐츠 유효성 체크 (beuliping_KR)
                const [contentRow] = await plainDb.query(
                    `SELECT content FROM beuliping_KR WHERE m_id = ?`,
                    [id]
                );

                if (!contentRow || !contentRow.content || contentRow.content.includes("없습니다.")) {
                    console.log(`⚠️ Skipping symbol: ${symbol} due to empty or invalid content.`);
                    return;
                }

                // ✅ 2) 특정 심볼 스킵
                if (['1000BONK', 'CVC', 'RAY'].includes(symbol)) {
                    console.log(`⚠️ Skipping unregistered symbol: ${symbol}`);
                    return;
                }

                // ✅ 3) 캡쳐 대상 URL 생성
                const url = `https://tryex.xyz/capture_brief_chart.php?kind=${symbol}USDT&hour=50&authKey=tryex013579`;

                let retries = MAX_RETRIES;

                // ✅ 4) 심볼당 최대 MAX_RETRIES번 재시도
                while (retries > 0) {
                    const page = await browser.newPage();

                    try {
                        await page.setViewportSize({ width: 800, height: 600 });

                        // 페이지 로드: domcontentloaded 까지만 기다리고,
                        // 실제 차트 준비는 아래 waitForSelector로 보장
                        await page.goto(url, {
                            timeout: 45000,
                            waitUntil: 'domcontentloaded'
                        });

                        // 차트 요소가 DOM에 등장할 때까지 대기
                        await page.waitForSelector('.tv-lightweight-charts', { timeout: 15000 });
                        await page.waitForTimeout(500); // 렌더 안정화 버퍼

                        const chartElement = page.locator('.tv-lightweight-charts');

                        if (!(await chartElement.isVisible())) {
                            console.warn(`⚠️ Chart element still not visible for ${symbol}. Skipping this attempt.`);
                            await page.close();
                            throw new Error('Chart not visible');
                        }

                        // ✅ 5) 스크린샷 캡쳐
                        const chartBuffer = await chartElement.screenshot({ type: 'png' });
                        console.log(`📸 Screenshot taken for ${symbol}`);

                        await page.close();

                        // ✅ 6) S3 업로드
                        const chartS3Params = {
                            Bucket: process.env.S3_BUCKET,
                            Key: `premiumchart-${uuidv4()}.png`,
                            Body: chartBuffer,
                            ContentType: 'image/png',
                            CacheControl: 'max-age=31536000, immutable'
                        };

                        console.log('☁️ Uploading screenshot to S3...');
                        const chartS3Response = await s3.upload(chartS3Params).promise();
                        const chartImageUrl = chartS3Response.Location;
                        console.log(`✅ Screenshot uploaded to S3: ${chartImageUrl}`);

                        // ✅ 7) DB 업데이트
                        console.log(`📝 Updating database for row ID: ${id}`);
                        await plainDb.query(
                            'UPDATE beuliping SET images = ? WHERE id = ?',
                            [chartImageUrl, id]
                        );
                        console.log(`✅ Database updated for row ID: ${id}`);

                        // 여기까지 왔으면 성공이므로 재시도 루프 탈출
                        break;

                    } catch (navError) {
                        retries--;
                        console.warn(
                            `⚠️ Navigation or selector failed for ${symbol} (Retrying ${retries} left)`,
                            navError.message
                        );

                        // 실패 시 페이지 정리 (실패했어도 페이지는 무조건 닫기)
                        try {
                            await page.close();
                        } catch (e) {
                            // 이미 크래시난 페이지일 수도 있으니 에러는 무시
                        }

                        // 재시도 횟수 모두 소진 → 바깥 catch에서 한 번 더 로깅
                        if (retries === 0) {
                            throw navError;
                        }
                    }
                }

            } catch (error) {
                console.error(`❌ Error processing symbol ${row.symbol} (ID ${row.id}):`, error.stack);
            }
        };

        // ✅ Process rows in parallel with limited concurrency
        for (let i = 0; i < recentRows.length; i += maxConcurrentScreenshots) {
            await Promise.all(recentRows.slice(i, i + maxConcurrentScreenshots).map(processRows));
        }

        if (res) res.send('✅ Screenshots captured and updated successfully.');
        console.log('🎉 CapturePremium process completed successfully.');
    } catch (error) {
        console.error('❌ Error in capturePremium function:', error.stack);
        if (res) res.status(500).send('Error processing request');
    } finally {
        if (browser) {
            console.log('🔴 Closing Playwright browser');
            await browser.close();
        }
        console.log('✅ capturePremium function ended');
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
