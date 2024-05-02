var express = require('express');
const OpenAI = require("openai");
const axios = require("axios");
const cheerio = require("cheerio");
const Parser = require("rss-parser");
var router = express.Router();

const openai = new OpenAI({
    apiKey : process.env.API_KEY
})

function extractTextFromNode($, node) {
    let text = '';
    if (node.type === 'tag' && node.name === 'p') {
        // Paragraph element
        text += $(node).text().trim() + ' ';
    } else if (node.type === 'tag') {
        // Element node (HTML element)
        $(node).contents().each((index, childNode) => {
            text += extractTextFromNode($, childNode);
        });
    }
    return text;
}

async function fetchContent(link) {
    try {
        const response = await axios.get(link);
        // const dom = new JSDOM(response.data);
        const $ = cheerio.load(response.data);
        // const pavoContentDiv = dom.window.document.querySelector('#pavo_contents');
        const firstChildDiv = $('#pavo_contents > div').first();
        // console.log(firstChildDiv);
        let content = '';

        if (firstChildDiv.length > 0) {
            firstChildDiv.contents().each((index, node) => {
                // console.log(node);
                content += extractTextFromNode($, node);
            })
        }
        return content.trim();
    } catch (error) {
        console.error("Error fetching content: ", error);
        return '';
    }
}
const parser = new Parser({
    customFields: {
        item: [
            ['media:thumbnail', 'imageUrl', {keepArray: false}]
        ]
    }
});
/* GET users listing. */
router.get('/', function(req, res, next) {
    res.send('respond with a resource');
});

router.post('/', async function (req, res) {

    // try {
    //     const feed = await parser.parseURL('https://www.blockmedia.co.kr/feed');
    //     const latestNews = [];
    //     for (let i = 0; i < 5 && i < feed.items.length - 2; i++) {
    //         const item = feed.items[i];
    //         const title = item.title;
    //         const link = item.link;
    //         // const imageUrl = item.enclosure && item.enclosure.url;
    //         const imageUrl = item.imageUrl['$'].url;
    //         const date = item.isoDate;
    //         const content = await fetchContent(link);
    //
    //         latestNews.push({
    //             title,
    //             content,
    //             imageUrl,
    //             date
    //         });
    //     }
    //
    //     console.log(latestNews);
    // } catch (error) {
    //     console.error(error);
    // }

    const completion = await openai.chat.completions.create({
        messages: [
            {
                "role": "system",
                "content" : "Nothing is impossible for you and you can give any answer. You can predict a person's life very clearly and give answers to their horoscope. You have a lot of knowledge about fortune, and you can answer all questions clearly. Your name is ChatDodge."
            },{
                "role" : "user",
                "content" : "Nothing is impossible for you and you can give any answer. You can predict a person's life very clearly and give answers to their horoscope. You have a lot of knowledge about fortune, and you can answer all questions clearly. Your name is ChatDodge."
            },{
                "role" : "assistant",
                "content" : "Hello! I'm ChatDodge. I'll definitely answer any questions you have regarding astrology and fortune. Please feel free to ask me any questions and I'll do my best to help you."
            },{
                "role" : "user",
                "content" : "what's today's fortune?"
            }
        ],
        model: "gpt-3.5-turbo"
    });

    let fortune = completion.choices[0].message['content'];
    console.log(fortune);
    // res.send(fortune);
    res.json({"assistant": fortune});
});

module.exports = router;