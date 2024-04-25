var express = require('express');
var router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser')
/* GET home page. */

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
router.get('/', async function(req, res, next) {
    try {
      const feed = await parser.parseURL('https://www.blockmedia.co.kr/feed');
      const latestNews = [];
      for (let i = 0; i < 5 && i < feed.items.length - 2; i++) {
          const item = feed.items[i];
          console.log("item: ", item);
          const title = item.title;
          const link = item.link;
          // const imageUrl = item.enclosure && item.enclosure.url;
          const imageUrl = item.imageUrl['$'].url;
          const date = item.isoDate;
          const content = await fetchContent(link);

          latestNews.push({
              title,
              content,
              imageUrl,
              date
          });
      }
      res.render('crawl', {latestNews: latestNews});
    } catch (error) {
        console.error(error);
    }
});

module.exports = router;