var express = require('express');
var router = express.Router();
const axios = require('axios');
const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey : process.env.API_KEY
});

const { Sequelize } = require("sequelize");
const Blockmedia = require('../blockmedia');
const Analysis = require('../analysis');
const { Op } = require('sequelize');
const multer = require("multer");
const AWS = require("aws-sdk");

async function getRecentAndUpdate() {
    try {
        const recentAnalyses = await Analysis.findAll({
            where: {
                mp3: null
            },
            order: [['createdAt', 'DESC']], // Order by 'createdAt' in descending order
            limit: 5
        });

        for (const analysis of recentAnalyses) {
            // Retrieve the matching entry from the Blockmedia table
            const blockmediaEntry = await Blockmedia.findOne({
                where: { id: analysis.id }
            });

            if (blockmediaEntry) {
                // console.log('analysis: ', analysis.analysis);
                //Translate analysis content
                let analysisJp = '';
                let analysisKr = '';
                if (!analysis.analysis_jp) {
                    analysisJp = await translateText(analysis.analysis, 'Japanese');
                } else {
                    analysisJp = analysis.analysis_jp;
                }
                if (!analysis.analysis_kr) {
                    analysisKr = await translateText(analysis.analysis, 'Korean');
                } else {
                    analysisKr = analysis.analysis_kr;
                }
                const mp3En = await generateTTS(analysis.analysis, 'English', analysis.id);
                const mp3Jp = await generateTTS(analysisJp, 'Japanese', analysis.id);
                const mp3Kr = await generateTTS(analysisKr, 'Korean', analysis.id);

                // Update the Analysis entry with values from the Blockmedia entry
                await analysis.update({
                    title: blockmediaEntry.title,
                    content: blockmediaEntry.content,
                    imageUrl: blockmediaEntry.imageUrl,
                    date: blockmediaEntry.date,
                    publisher: blockmediaEntry.publisher,
                    analysis_jp: analysisJp,
                    analysis_kr: analysisKr,
                    updatedAt: new Date(),
                    mp3: mp3En, // Path or URL to the English MP3 file
                    mp3_jp: mp3Jp, // Path or URL to the Japanese MP3 file
                    mp3_kr: mp3Kr // Path or URL to the Korean MP3 file
                });
            }
        }

        // Optionally, return the updated analyses
        const updatedAnalyses = await Analysis.findAll({
            order: [['createdAt', 'DESC']], // Optionally re-fetch to send updated data back
            limit: 5
        });

        return JSON.stringify(updatedAnalyses.map(a => a.toJSON()));

    } catch (error) {
        console.error("Error fetching and updating recent analysis:", error);
        throw error;
    }
}

async function translateText(content, lang) {
    let messages = [];
    if (lang == 'Japanese') {
        messages = [
            { role: "system", content: "You are a professional translator capable of translating between English and Japanese. You can understand the context of sentences and derive the meanings of words within that context, enabling you to translate accurately and appropriately for English and Japanese speakers. Additionally, you possess knowledge about cryptocurrencies, Bitcoin, stocks, and finance in general, allowing you to aptly translate articles and analyses related to these topics into the respective languages."},
            { role: "user", content: "Please translate the following document into Japanese. I only need the translated output, without any additional comments or indicators. Document: The report on national and corporate Bitcoin accumulations reveals significant crypto asset holdings by entities like MicroStrategy and various governments, including the U.S. and China. This trend underscores a substantial institutional and governmental embrace of Bitcoin, posing implications for market stability and pricing structures. Institutional holding can lead to lower market volatility and potentially higher price floors due to reduced circulatory supply. Understanding these dynamics is critical for evaluating Bitcoin's broader adoption and its perception as a store of value."},
            { role: "assistant", content: "国と企業のビットコイン蓄積に関するレポートは、MicroStrategyやアメリカ、中国などの政府を含む機関がかなりの暗号資産を保有していることを明らかにしています。この傾向は、ビットコインに対する大規模な機関および政府の受容を強調し、市場の安定性と価格構造に対する影響を示唆しています。機関の保有は、流通供給の減少により市場のボラティリティを低下させ、潜在的にはより高い価格の床を可能にするかもしれません。これらのダイナミクスを理解することは、ビットコインの広範な採用と価値の保存としての認識を評価する上で重要です。"},
            { role: "user", content: `Please translate the following document into Japanese. I only need the translated output, without any additional comments or indicators. Document: ${content}`},
        ];
    } else if (lang === 'Korean') {
        messages = [
            { role: "system", content: "You are a professional translator capable of translating between English and Korean. You can understand the context of sentences and derive the meanings of words within that context, enabling you to translate accurately and appropriately for English and Korean speakers. Additionally, you possess knowledge about cryptocurrencies, Bitcoin, stocks, and finance in general, allowing you to aptly translate articles and analyses related to these topics into the respective languages."},
            { role: "user", content: "Please translate the following document into Korean. I only need the translated output, without any additional comments or indicators. Document: The report on national and corporate Bitcoin accumulations reveals significant crypto asset holdings by entities like MicroStrategy and various governments, including the U.S. and China. This trend underscores a substantial institutional and governmental embrace of Bitcoin, posing implications for market stability and pricing structures. Institutional holding can lead to lower market volatility and potentially higher price floors due to reduced circulatory supply. Understanding these dynamics is critical for evaluating Bitcoin's broader adoption and its perception as a store of value."},
            { role: "assistant", content: "국가 및 기업의 비트코인 축적에 관한 보고서는 MicroStrategy와 미국, 중국 등의 정부와 같은 주체들이 상당한 암호화 자산을 보유하고 있음을 밝히고 있습니다. 이러한 추세는 비트코인에 대한 상당한 기관 및 정부의 수용을 강조하며, 시장 안정성과 가격 구조에 대한 함의를 제기합니다. 기관의 보유는 유통 공급의 감소로 인해 시장 변동성을 낮추고 잠재적으로 더 높은 가격 바닥을 형성할 수 있습니다. 이러한 역학을 이해하는 것은 비트코인의 더 넓은 수용과 가치 저장 수단으로서의 인식을 평가하는 데 있어 중요합니다."},
            { role: "user", content: `Please translate the following document into Korean. I only need the translated output, without any additional comments or indicators. Document: ${content}`},
        ];
    }

    const response  = await openai.chat.completions.create({
        model: "gpt-4-turbo",
        messages: messages
    })

    const responseMessage = response.choices[0].message.content;
    console.log("response message: ", responseMessage);
    return responseMessage;
}

const storage = multer.memoryStorage();
const upload = multer({storage: storage});
AWS.config.update({
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_PASSWORD
})
const s3 = new AWS.S3();

async function generateTTS(content, lang, id) {

    const mp3 = await openai.audio.speech.create({
       model: 'tts-1-hd',
       voice: 'alloy',
       input: content
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    const s3Params = {
        Bucket: 's3bucketjinwoo',
        Key: `${id}_${lang}.mp3`,
        Body: buffer,
        ContentType: "audio/mpeg",
    }

    return new Promise((resolve, reject) => {
        s3.upload(s3Params, function(err, data) {
            if (err) {
                console.error("Error uploading to S3:", err);
                reject(err);
            } else {
                console.log("Successfully uploaded data to " + data.Location);
                resolve(data.Location);
            }
        });
    });
}

/* GET users listing. */
router.get('/', function(req, res, next) {
    res.render('brief');
});

router.get('/construct', async function(req, res) {
    await getRecentAndUpdate()
        .then(result => {
            res.json(result);
        })
        .catch(console.error)
});

module.exports = router;
