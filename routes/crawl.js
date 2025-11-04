var express = require('express');
var router = express.Router();
const axios = require('axios');
const cheerio = require('cheerio');
const Parser = require('rss-parser');
const {Coinness, Blockmedia, Analysis, Viewpoint} = require("../models");
/* GET home page. */

// async function fetchContent(link) {
//     try {
//         const response = await axios.get(link);
//         // const dom = new JSDOM(response.data);
//         const $ = cheerio.load(response.data);
//         // const pavoContentDiv = dom.window.document.querySelector('#pavo_contents');
//         //const firstChildDiv = $('#pavo_contents > div').first();
//         // console.log(firstChildDiv);
//         let content = '';
//
//         // if (firstChildDiv.length > 0) {
//         //     firstChildDiv.contents().each((index, node) => {
//         //         // console.log(node);
//         //         content += extractTextFromNode($, node);
//         //     })
//         // }
//         const pavoContents = $('#pavo_contents');
//         const textContent = pavoContents.text().trim().replace(/\n/g,'');
//         // const pTextContent = pavoContents.find('p').map((index, element) => $(element).text()).get();
//         // console.log('Text Content: ', textContent);
//         // console.log('Text Content inside p:', pTextContent);
//         // // console.log(content);
//         const textWithoutImg = textContent.replace(/<img.*?>|<\/img>|<iframe.*?>|<\/iframe>/g, '');
//         const index = textWithoutImg.indexOf('속보는 블록미디어 텔레그램으로');
//         const finalContent = index !== -1 ? textWithoutImg.slice(0, index) : textWithoutImg;
//         return finalContent;
//         // return textContent;
//     } catch (error) {
//         console.error("Error fetching content: ", error);
//         return '';
//     }
// }


async function fetchContent(link) {
    try {
        const response = await axios.get(link, {
            headers: {
                // 사이트가 UA 안 주면 막는 경우가 있어서 넣어두는 게 안전
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);

        // ✅ 1) 첫 번째 .post-content div 선택
        const postContent = $('.post-content').first();
        if (!postContent.length) {
            console.error('No .post-content found for link:', link);
            return '';
        }

        // ✅ 2) 그 안의 모든 <p> 태그 텍스트를 모아 배열로
        const paragraphs = postContent
            .find('p')
            .map((index, el) => {
                const $imgs = $(el).find('img, iframe, picture, figure');
                if ($imgs.length > 0) {
                    console.log("REMOVING IMG TAG");
                    // 🔍 log each img’s HTML before removing
                    $imgs.each((i, img) => {
                        console.log($.html(img));   // or $(img).toString()
                    });
                    $imgs.remove();
                }
                return $(el).text().trim();
            })
            .get()
            .filter(text => text.length > 0);    // 빈 줄 제거

        if (paragraphs.length === 0) {
            console.warn('No <p> inside .post-content for link:', link);
            return '';
        }

        // ✅ 3) 문단들 합쳐서 하나의 문자열로 (원하면 '\n\n' 대신 ' ' 사용 가능)
        let finalContent = paragraphs.join('\n');

        // (선택) 예전처럼 텔레그램 광고 문구 잘라내기 유지
        const cutIndex = finalContent.indexOf('속보는 블록미디어 텔레그램으로');
        if (cutIndex !== -1) {
            finalContent = finalContent.slice(0, cutIndex).trim();
        }

        // 🔒 마지막 안전장치: 혹시라도 HTML 태그(특히 img)가 섞여 있으면 제거
        if (finalContent.includes('<')) {
            // 1) img / iframe 태그 제거
            finalContent = finalContent
                .replace(/<img[^>]*>/gi, '')
                .replace(/<iframe[^>]*>.*?<\/iframe>/gis, '');

            // 2) 만약 정말 “순수 텍스트”만 원하면, 나머지 태그도 전부 제거
            finalContent = finalContent.replace(/<\/?[^>]+(>|$)/g, '');

            finalContent = finalContent.trim();
        }

        // 🔍 여기서 최종 결과에 태그가 남았는지 확인
        console.log('=== finalContent from fetchContent ===');
        console.log(finalContent);
        console.log('contains <img>?', finalContent.includes('<img'));
        console.log('=======================================');

        return finalContent;
    } catch (error) {
        console.error('Error fetching content:', error);
        return '';
    }
}


async function fetchArticle(link) {
    try {
        const response = await axios.get(link,{
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36'
            }
        });
        const $ = cheerio.load(response.data);
        const article = $('article');
        const textContent = article.text().trim();
        console.log("textContent: ", textContent);
       return textContent;
    } catch(err) {
        console.error(err);
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
      // const feed = await parser.parseURL('https://www.blockmedia.co.kr/feed');
      // const latestNews = [];
      // for (let i = 0; i < 5 && i < feed.items.length; i++) {
      //     const item = feed.items[i];
      //     //console.log("item: ", item);
      //     const title = item.title;
      //     const link = item.link;
      //     // const imageUrl = item.enclosure && item.enclosure.url;
      //     const imageUrl = item.imageUrl['$'].url;
      //     const date = item.isoDate;
      //     const content = await fetchContent(link);
      //
      //     latestNews.push({
      //         title,
      //         content,
      //         imageUrl,
      //         date
      //     });
      // }
        const latestNews = await Blockmedia.findAll({
           order: [['id', 'DESC']],
            limit: 10
        });

      //console.log(latestNews);
      res.render('crawl', {latestNews: latestNews});
    } catch (error) {
        console.error(error);
    }
});

router.get('/coinness', async function(req, res) {

    try {
        const feed = await parser.parseURL('https://cointelegraph.com/rss/tag/bitcoin');
        const latestNews = [];
        console.log(feed);
        for (let i = 0; i < 5 && i < feed.items.length; i++) {
            const item = feed.items[i];
            //console.log("item: ", item);
            const title = item.title;
            const link = item.link;
            // const imageUrl = item.enclosure && item.enclosure.url;
            const imageUrl = item.enclosure && item.enclosure.url
            const date = item.isoDate;
            const content = await fetchArticle(link);

            latestNews.push({
                title,
                content,
                imageUrl,
                date,
                link
            });
        }
        res.send(latestNews);
        // res.render('crawl', {latestNews: latestNews});
    } catch (error) {
        console.error(error);
    }
    // try {
    //     const response = await axios.get('https://coinness.com/');
    //     const $ = cheerio.load(response.data);
    //
    //     const textContent = $.text().trim();
    //     // console.log(textContent);
    //     res.send(textContent);
    // } catch (err) {
    //     console.error(err);
    // }
});

const performArticleCrawl = async () => {
    try {
        const feed = await parser.parseURL('https://www.blockmedia.co.kr/feed');
        const latestNews = [];
        for (let i = 0; i < 10 && i < feed.items.length; i++) {
            const item = feed.items[i];
            console.log("item: ", item);
            const title = item.title;
            const link = item.link;
            // const imageUrl = item.enclosure && item.enclosure.url;
            let imageUrl = '/defaultImg.png';
            if (item.imageUrl) {
                imageUrl = item.imageUrl['$'].url;
            }
            const date = item.isoDate;
            const content = await fetchContent(link);
            const index = i;
            const publisher = 'blockmedia';
            let id = 0;

            let url = item.guid;
            let match = url.match(/p=(\d+)/);
            if (match) {
                id = match[1];
            } else {
                console.log("No number found");
            }

            latestNews.push({
                id,
                title,
                content,
                imageUrl,
                date,
                publisher,
            });
        }
        for (const item of latestNews) {
            try {
                const [blockmedia, created] = await Blockmedia.upsert({
                    id: item.id,
                    title: item.title,
                    content: item.content,
                    imageUrl: item.imageUrl,
                    date: item.date,
                    publisher: item.publisher,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });

                if (created) {
                    console.log('Blockmedia entry created:', blockmedia.toJSON());
                } else {
                    console.log('Blockmedia entry updated:', blockmedia.toJSON());
                }
            } catch (error) {
                console.error('Error upserting Blockmedia entry: ', error);
            }
        }
        return "crawl success";
    } catch (error) {
        console.error(error);
    }
}
router.post('/articles', async function(req, res, next) {
    // try {
    //     const feed = await parser.parseURL('https://www.blockmedia.co.kr/feed');
    //     const latestNews = [];
    //     for (let i = 0; i < 10 && i < feed.items.length; i++) {
    //         const item = feed.items[i];
    //         console.log("item: ", item);
    //         const title = item.title;
    //         const link = item.link;
    //         // const imageUrl = item.enclosure && item.enclosure.url;
    //         let imageUrl = '/defaultImg.png';
    //         if (item.imageUrl) {
    //             imageUrl = item.imageUrl['$'].url;
    //         }
    //         const date = item.isoDate;
    //         const content = await fetchContent(link);
    //         const index = i;
    //         const publisher = 'blockmedia';
    //         let id = 0;
    //
    //         let url = item.guid;
    //         let match = url.match(/p=(\d+)/);
    //         if (match) {
    //             id = match[1];
    //         } else {
    //             console.log("No number found");
    //         }
    //
    //         latestNews.push({
    //             id,
    //             title,
    //             content,
    //             imageUrl,
    //             date,
    //             publisher,
    //         });
    //
    //     }
    //
    //     const reversedNews = [...latestNews].reverse();
    //
    //     for (const item of reversedNews) {
    //         try {
    //             const [blockmedia, created] = await Blockmedia.upsert({
    //                 id: item.id,
    //                 title: item.title,
    //                 content: item.content,
    //                 imageUrl: item.imageUrl,
    //                 date: item.date,
    //                 publisher: item.publisher
    //             }, {
    //                 conflictFields: ['id']
    //             });
    //
    //             console.log(`Processed: ${item.id}, Created: ${created}`);
    //         } catch (error) {
    //             console.error(`Error processing: ${item.id}`, error);
    //         }
    //     }
    //     res.json(reversedNews);
    //
    // } catch (error) {
    //     console.error(error);
    // }
    await performArticleCrawl();
    res.send('ok');
})

module.exports = { router, performArticleCrawl };