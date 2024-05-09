var express = require('express');
var router = express.Router();
const puppeteer = require('puppeteer');
const cheerio = require('cheerio');
const axios = require('axios');
const Coinness = require('../coinness');

async function clickLoadMore(page, selector) {
    try {
        const button = await page.waitForSelector(selector, {
            visible: true,
            timeout: 10000
        })
        await button.click();
    } catch (error) {
        console.error(error);
    }
}
async function run() {
    // Launch the browser and open a new page
    const browser = await puppeteer.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    // await page.setViewport({width: 1920, height: 1080});
    //Go to the target web page
    await page.goto('https://coinness.com');
    // for (let i = 0; i < 10; i++) {
    //     await page.waitForSelector('.bFouuK');
    //     await page.click('.bFouuK');
    //     await new Promise((page) => setTimeout(page, 100));
    // }
    await page.waitForSelector('.bFouuK');
    await page.click('.bFouuK');
    await new Promise((page) => setTimeout(page, 1000));
    // Wait for the main content to be loaded
    // await page.waitForSelector('.eUnrgV > span');
    await page.waitForSelector('.kxaAxM');



    const mainContent = await page.evaluate(() => {
        // const divs = Array.from(document.querySelectorAll('.eUnrgV > span'));
        const divs = Array.from(document.querySelectorAll('.kxaAxM'));
        console.log("divs: ", divs);
        return divs.map((div, index) => {
            const time = div.firstChild.textContent.trim();
            const title = div.lastChild.children[0].textContent.trim();
            const id = div.lastChild.children[0].firstChild.getAttribute('href').split('/').pop();
            const content = div.lastChild.children[1].textContent.trim();

            return {
                time: time,
                title: title,
                content: content,
                id: id
            }
        });
    });

    console.log("mainContent: ", mainContent);
    await browser.close();
    // mainContent.forEach(async (item) => {
    //     try {
    //         // Try to find a Coinness entry with the same id
    //         const existingCoinness = await Coinness.findOne({ where: { id: item.id } });
    //
    //         // If no entry with the same id exists, create a new one
    //         if (!existingCoinness) {
    //             const coinness = await Coinness.create({
    //                 createdAt: new Date(),
    //                 title: item.title,
    //                 content: item.content,
    //                 time: item.time,
    //                 updatedAt: new Date(),
    //                 id: item.id
    //             });
    //             console.log('Coinness entry created:', coinness.toJSON());
    //         } else {
    //             console.log(`Coinness entry with id ${item.id} already exists. Skipping insertion.`);
    //         }
    //     } catch (error) {
    //         console.error('Error creating Coinness entry:', error);
    //     }
    // });
    for (const item of mainContent) {
        try {
            const [coinness, created] = await Coinness.upsert({
                id: item.id,
                title: item.title,
                content: item.content,
                time: item.time,
                createdAt: new Date(),
                updatedAt: new Date()
            });

            if (created) {
                console.log('Coinness entry created:', coinness.toJSON());
            } else {
                console.log('Coinness entry updated:', coinness.toJSON());
            }
        } catch (error) {
            console.error('Error in upserting Coinness entry:', error);
        }
    }

}

async function getArticle() {
    try {
        const response = await axios.get('https://coinness.com');
        console.log(response.data);
        const $ = cheerio.load(response.data);
        const articles = $('.app');
        articles.each((index, element) => {
            const articleText = $(element).text().trim();
            console.log(articleText);
        });
    } catch (err) {
        console.error(err);
    }
}

router.get('/', async function(req, res) {

    try {
        run();
        // Query all news entries from the database
        const news = await Coinness.findAll({
            order: [['id', 'DESC']]
        });
        // Render the view template with the retrieved news data
        res.render('puppet', { news });
    } catch (error) {
        console.error('Error retrieving news:', error);
        // Handle errors
        res.status(500).send('Internal Server Error');
    }

});

router.get('/select', async function(req, res) {
    try {
        
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;