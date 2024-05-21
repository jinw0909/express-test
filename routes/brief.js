var express = require('express');
var router = express.Router();
const axios = require('axios');
const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey : process.env.API_KEY
});

const { Sequelize } = require("sequelize");
const Blockmedia = require('../models/blockmedia');
const { Analysis, Viewpoint } = require('../models');
const { Op } = require('sequelize');
const multer = require("multer");
const AWS = require("aws-sdk");

async function getRecentAndUpdate() {
    try {
        const recentAnalyses = await Analysis.findAll({
            order: [['createdAt', 'DESC']], // Order by 'createdAt' in descending order
            limit: 5
        });

        for (const analysis of recentAnalyses) {
            // Retrieve the matching entry from the Blockmedia table
            const blockmediaEntry = await Blockmedia.findOne({
                where: { id: analysis.id }
            });

            if (blockmediaEntry) {

                 const title = await translateText(blockmediaEntry.title, 'English');
                 const titleJp = await translateText(blockmediaEntry.title, 'Japanese');
                 const titleVn = await translateText(blockmediaEntry.title, 'Vietnamese');
                 const titleCn = await translateText(blockmediaEntry.title, 'Chinese');

                const analysisJp = await translateText(analysis.analysis, 'Japanese');
                const analysisKr = await translateText(analysis.analysis, 'Korean');
                const analysisVn = await translateText(analysis.analysis, 'Vietnamese');
                const analysisCn = await translateText(analysis.analysis, 'Chinese');

                const summaryJp = await translateText(analysis.summary, 'Japanese');
                const summaryKr = await translateText(analysis.summary, 'Korean');
                const summaryVn = await translateText(analysis.summary, 'Vietnamese');
                const summaryCn = await translateText(analysis.summary, 'Chinese');

                const mp3En = await generateTTS(analysis.analysis, 'English', analysis.id);
                const mp3Jp = await generateTTS(analysisJp, 'Japanese', analysis.id);
                const mp3Kr = await generateTTS(analysisKr, 'Korean', analysis.id);
                const mp3Vn = await generateTTS(analysisKr, 'Vietnamese', analysis.id);
                const mp3Cn = await generateTTS(analysisKr, 'Chinese', analysis.id);

                // Update the Analysis entry with values from the Blockmedia entry
                await analysis.update({
                    title: title,
                    title_kr: blockmediaEntry.title,
                    title_jp: titleJp,
                    title_vn: titleVn,
                    title_cn: titleCn,
                    content: blockmediaEntry.content,
                    imageUrl: blockmediaEntry.imageUrl,
                    date: blockmediaEntry.date,
                    publisher: blockmediaEntry.publisher,
                    analysis_jp: analysisJp,
                    analysis_kr: analysisKr,
                    analysis_vn: analysisVn,
                    analysis_cn: analysisCn,
                    summary_jp: summaryJp,
                    summary_kr: summaryKr,
                    summary_vn: summaryVn,
                    summary_cn: summaryCn,
                    updatedAt: new Date(),
                    mp3: mp3En, // Path or URL to the English MP3 file
                    mp3_jp: mp3Jp, // Path or URL to the Japanese MP3 file
                    mp3_kr: mp3Kr, // Path or URL to the Korean MP3 file
                    mp3_vn: mp3Vn, // Path or URL to the Vietnamese MP3 file
                    mp3_cn: mp3Cn // Path or URL to the Chinese MP3 file
                });
            }
        }

        // Optionally, return the updated analyses
        const updatedAnalyses = await Analysis.findAll({
            order: [['createdAt', 'DESC']], // Optionally re-fetch to send updated data back
            limit: 5
        });

        return updatedAnalyses.map(a => a);

    } catch (error) {
        console.error("Error fetching and updating recent analysis:", error);
        throw error;
    }
}

async function translateText(content, lang) {
    let messages = [
        { role: "system", content: "You are a professional translator capable of translating between English, Japanese, Korean, Vietnamese, and Chinese. You can understand the context of sentences and derive the meanings of words within that context, enabling you to translate accurately and appropriately for English, Japanese, Korean, Vietnamese and Chinese speakers. Additionally, you possess knowledge about cryptocurrencies, Bitcoin, stocks, and finance in general, allowing you to aptly translate articles and analyses related to these topics into the respective languages. You can also naturally translate article headlines or titles into other languages."},
        { role: "user", content: "Please translate the following text into Japanese. I only need the translated output, without any additional comments or indicators. Please ensure to apply honorifics when translating into Korean or Japanese. Text: The report on national and corporate Bitcoin accumulations reveals significant crypto asset holdings by entities like MicroStrategy and various governments, including the U.S. and China. This trend underscores a substantial institutional and governmental embrace of Bitcoin, posing implications for market stability and pricing structures. Institutional holding can lead to lower market volatility and potentially higher price floors due to reduced circulatory supply. Understanding these dynamics is critical for evaluating Bitcoin's broader adoption and its perception as a store of value."},
        { role: "assistant", content: "国と企業のビットコイン蓄積に関するレポートは、MicroStrategyやアメリカ、中国などの政府を含む機関がかなりの暗号資産を保有していることを明らかにしています。この傾向は、ビットコインに対する大規模な機関および政府の受容を強調し、市場の安定性と価格構造に対する影響を示唆しています。機関の保有は、流通供給の減少により市場のボラティリティを低下させ、潜在的にはより高い価格の床を可能にするかもしれません。これらのダイナミクスを理解することは、ビットコインの広範な採用と価値の保存としての認識を評価する上で重要です。"},
        { role: "user", content: "Please translate the following text into Japanese. I only need the translated output, without any additional comments or indicators.Please ensure to apply honorifics when translating into Korean or Japanese. Text: [마켓뷰] '금리 인하 이르다고?' 美 물가지표 지켜보자"},
        { role: "assistant", content: "[マーケットビュー]「金利引き下げは早い？」米国の物価指標を注視しよう"},
        { role: "user", content: `Please translate the following text into ${lang}. I only need the translated output, without any additional comments or indicators. Please ensure to apply honorifics when translating into Korean or Japanese. Text: ${content}`},
    ];

    const response  = await openai.chat.completions.create({
        model: "gpt-4o",
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

const Polly = new AWS.Polly({
    signatureVersion: '',
    region: 'us-east-1'
});

async function generateTTS(content, lang, id) {
    if (lang === 'Vietnamese') {
        // Use OpenAI TTS for Vietnamese
        try {
            const mp3 = await openai.audio.speech.create({
                model: 'tts-1',
                voice: 'alloy',
                input: content
            });

            const buffer = Buffer.from(await mp3.arrayBuffer());

            const s3Params = {
                Bucket: 's3bucketjinwoo',
                Key: `${id}_${lang}.mp3`,
                Body: buffer,
                ContentType: "audio/mpeg",
            };

            return new Promise((resolve, reject) => {
                s3.upload(s3Params, function (err, data) {
                    if (err) {
                        console.error("Error uploading to S3:", err);
                        reject(err);
                    } else {
                        console.log("Successfully uploaded data to " + data.Location);
                        resolve(data.Location);
                    }
                });
            });
        } catch (error) {
            console.error("Error generating TTS with OpenAI:", error);
            throw error;
        }
    } else {
        // Use AWS Polly for other languages
        let voiceId = 'Danielle';
        if (lang == 'Japanese') {
            voiceId = 'Kazuha';
        } else if (lang == 'Korean') {
            voiceId = 'Seoyeon';
        } else if (lang == 'Chinese') {
            voiceId = 'Zhiyu';
        }

        let pollyParams = {
            'Text': content,
            'OutputFormat': 'mp3',
            'VoiceId': voiceId,
            'Engine': 'neural'
        };

        return new Promise((resolve, reject) => {
            // Synthesize speech using Polly
            Polly.synthesizeSpeech(pollyParams, (err, data) => {
                if (err) {
                    console.error("Error synthesizing speech:", err);
                    reject(err);
                    return;
                }

                // S3 upload parameters
                const s3Params = {
                    Bucket: 's3bucketjinwoo',
                    Key: `${id}_${lang}.mp3`,
                    Body: data.AudioStream,
                    ContentType: "audio/mpeg",
                };

                // Upload to S3
                s3.upload(s3Params, (err, data) => {
                    if (err) {
                        console.error("Error uploading to S3:", err);
                        reject(err);
                    } else {
                        console.log("Successfully uploaded data to " + data.Location);
                        resolve(data.Location);
                    }
                });
            });
        });
    }
}

async function runViewpointConversation() {
    const messages = [
        {role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context. You are also capable of derive the bitcoin market trend by analyzing the bitcoin price movement within a certain period, and capable of deriving the relationship between the trend and real-world events"},
        {role: "user", content: "From the analysis conducted on the Blockmedia articles, provide your final viewpoint derived from the most recent five analyses regarding the Bitcoin and cryptocurrency markets. Also, relate your viewpoint to the price fluctuations in the Bitcoin market over the past 7 days and within the last 24 hours. Additionally, based on your final viewpoint, if possible, provide a rough estimate of the future changes in the price of Bitcoin. Don't mention 'Blockmedia' in your response. Also return the id's of five analysis you used to create the viewpoint. Please return the result in JSON format as {'viewpoint': 'text', 'refs': [number, number, number, number, number]}."},
        // {role: "assistant", content: ""},
        // {role: "user", content: ""},
    ]
    const tools = [
        {
            type: "function",
            function: {
                name: "get_recent_analyses",
                description: "returns the list of the 5 most recent analyses created. "
            }
        },
        {
            type: "function",
            function: {
                name: "get_coinprice_week",
                description: "returns the bitcoin price movement within the last seven days. "
            }
        },
        {
            type: "function",
            function: {
                name: "get_coinprice_day",
                description: "returns the bitcoin price movement within the last 24 hours. "
            }
        }
    ]
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: tools,
        tool_choice : "auto", //auto is default, but we'll be explicit
        response_format: {type: "json_object"}
    });
    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
        const availableFunctions = {
            get_recent_analyses: getRecentAnalyses,
            get_coinprice_week : getCoinPriceWeek,
            get_coinprice_day: getCoinPriceDay
        };
        messages.push(responseMessage);
        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionToCall = availableFunctions[functionName];
            console.log("functionToCall: ", functionToCall);
            const functionArgs = JSON.parse(toolCall.function.arguments || "{}");
            const functionResponse = await functionToCall(
                functionArgs
            )
            console.log("functionResponse: ", functionResponse);

            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: functionResponse,
            })
        }

        const secondResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            response_format: {type: "json_object"}
        });

        return secondResponse.choices;
    }
}
async function getRecentAnalyses() {
    try {
        const recentAnalyses = await Analysis.findAll({
            order: [['createdAt', 'DESC']], // Order by 'createdAt' in descending order
            limit: 5
        });
        return JSON.stringify(recentAnalyses, null, 2);
    } catch(error) {
        console.error(error);
    }
}
async function getViewpointAndUpdate() {
    try {
        const viewpoint = await getRecentViewpoint();

        if (viewpoint) {

            const viewpointJp = await translateText(viewpoint.viewpoint, 'Japanese');
            const viewpointKr = await translateText(viewpoint.viewpoint, 'Korean');
            const viewpointVn = await translateText(viewpoint.viewpoint, 'Vietnamese');
            const viewpointCn = await translateText(viewpoint.viewpoint, 'Chinese')

            const mp3En = await generateTTS(viewpoint.viewpoint, 'English', viewpoint.id);
            const mp3Jp = await generateTTS(viewpointJp, 'Japanese', viewpoint.id);
            const mp3Kr = await generateTTS(viewpointKr, 'Korean', viewpoint.id);
            const mp3Vn = await generateTTS(viewpointVn, 'Vietnamese', viewpoint.id);
            const mp3Cn = await generateTTS(viewpointCn, 'Chinese', viewpoint.id);

            // Update the Analysis entry with values from the Blockmedia entry
            await viewpoint.update({
                viewpoint_jp: viewpointJp,
                viewpoint_kr: viewpointKr,
                viewpoint_vn: viewpointVn,
                viewpoint_cn: viewpointCn,
                updatedAt: new Date(),
                mp3: mp3En, // Path or URL to the English MP3 file
                mp3_jp: mp3Jp, // Path or URL to the Japanese MP3 file
                mp3_kr: mp3Kr, // Path or URL to the Korean MP3 file
                mp3_vn: mp3Vn, // Path or URL to the Vietnamese MP3 file
                mp3_cn: mp3Cn // Path or URL to the Chinese MP3 file
            });

        }

        // Optionally, return the updated analyses
        const updatedViewpoint = await Viewpoint.findOne({
            order: [['createdAt', 'DESC']], // Optionally re-fetch to send updated data back
        });

        return updatedViewpoint;

    } catch (error) {
        console.error("Error fetching and updating recent analysis:", error);
        throw error;
    }
}
async function getCoinPriceDay() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24')
        const data = await response.json();
        return JSON.stringify(data, null, 2);
    } catch (err) {
        console.error("Failed to fetch Bitcoin prices (24hr) : ", err);
        return { error: err.message }
    }
}
async function getCoinPriceWeek() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=7');
        const data = await response.json();
        return JSON.stringify(data, null, 2);
    } catch(err) {
        console.error("Error: ", err);
        throw err;
    }
}
async function getRecentViewpoint() {
    try {
        const viewpoint = await Viewpoint.findOne({
            order: [['createdAt', 'DESC']], // Order by 'createdAt' in descending order
        })
        // const viewpoint = recentAnalyses.map(analysis => {
        //     return { id: analysis.id, analysis: analysis.analysis, summary: analysis.summary}
        // });
        return viewpoint;

    } catch (error) {
        console.error(error);
    }
}

async function runIntroConversation() {
    try {
        const messages = [
            { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You belong to a crypto currency consulting firm called 'Blocksquare' and you will send your analysis presentation everyday twice at AM and PM. Your presentation consists of the anlaysis of five cryptocurreny articles within 24 hours that represents the movement and trend of the cryptocurrency market. Finally you provide the finally viewpoint regarding the bitcoin price movement and prediction. You are capable of analyzing various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to your clients. You are also able to make presentation in English, Japanese, Korean, Vietnamese, and Chinese"},
            { role: "user", content: "Create an opening ment for the cryptocurrency article analysis. You should mention your company in the opening comment. Also mention the specific date and whether it is AM or PM. Please be sure that you are making an opening ment for your regular presentation. Officially your presentations is called as the morning or afternoon briefing to your clients. Please return your comment in a JSON format for all English, Japanese, Korean, Vietnamese, and Chinese."},
        ]
        const tools = [
            {
                type: "function",
                function: {
                    name: "get_current_time",
                    description: "returns the list of the current time in json format of date, day, and period. For example {date: '2024-05-17', day: 'Friday', period: 'PM'}"
                }
            },
        ]
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            tools: tools,
            tool_choice : "auto", //auto is default, but we'll be explicit
            response_format: {type: "json_object"}
        });
        const responseMessage = response.choices[0].message;
        const toolCalls = responseMessage.tool_calls;
        if (responseMessage.tool_calls) {
            const availableFunctions = {
                get_current_time: getCurrentTime,
            };
            messages.push(responseMessage);
            for (const toolCall of toolCalls) {
                const functionName = toolCall.function.name;
                const functionToCall = availableFunctions[functionName];
                console.log("functionToCall: ", functionToCall);
                const functionArgs = JSON.parse(toolCall.function.arguments || "{}");
                const functionResponse = await functionToCall(
                    functionArgs
                )
                console.log("functionResponse: ", functionResponse);

                messages.push({
                    tool_call_id: toolCall.id,
                    role: "tool",
                    name: functionName,
                    content: functionResponse,
                })
            }

            const secondResponse = await openai.chat.completions.create({
                model: "gpt-4o",
                messages: messages,
                response_format: {type: "json_object"}
            });

            return secondResponse.choices;
    }
    } catch (error) {
        console.error(error);
        throw error;
    }
}

async function getCurrentTime() {
    // Get the current date and time in KST
    const options = { timeZone: 'Asia/Seoul', hour12: false };
    const formatter = new Intl.DateTimeFormat('en-US', {
        ...options,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        weekday: 'long',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });

    const parts = formatter.formatToParts(new Date());
    const date = `${parts.find(p => p.type === 'year').value}-${parts.find(p => p.type === 'month').value}-${parts.find(p => p.type === 'day').value}`;
    const day = parts.find(p => p.type === 'weekday').value;
    const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
    const period = hour < 12 ? 'AM' : 'PM';

    return JSON.stringify({
        date,
        day,
        period
    });
}


async function runOutroConversation() {

}

async function createOutro() {
    try {

    } catch (error) {
        console.error(error);
        throw error;
    }
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
router.get('/viewpoint', async function(req, res) {
    try {
        const result = await runViewpointConversation();
        console.log("result: ", result);
        const content = result[0].message.content;
        const { viewpoint, refs } = JSON.parse(content);
        console.log("refs: ", refs);
        const today = new Date();
        const idSuffix = today.getHours() >= 12 ? 'PM' : 'AM';
        const id = `${today.getFullYear()}${(today.getMonth() + 1).toString().padStart(2, '0')}${today.getDate().toString().padStart(2, '0')}_${idSuffix}`;
        console.log("Generated ID: ", id);
        try {
            const [instance, created] = await Viewpoint.upsert({
                id: id,
                viewpoint: viewpoint,
                imageUrl: '/defaultImg.png',
                createdAt: new Date(),
                updatedAt: new Date()
            });
            if (created) {
                console.log('New Viewpoint instance created:', instance.toJSON());
            } else {
                console.log('Viewpoint updated:', instance.toJSON());
            }
            // Update ref column in analysis table
            if (refs && refs.length > 0) {
                await Analysis.update({ ref: id }, {
                    where: {
                        id: refs  // Assuming `refs` is an array of IDs
                    }
                });
            }
        } catch (error) {
            console.error(error);
        }

        const viewPoint = await getRecentViewpoint(); // Fetch recent analyses
        res.json(viewPoint); // Send response with recent analyses
    } catch (error) {
        console.error(error);
        res.send("An error occurred");
    }
});

router.get('/constructvp', async function(req, res) {
    try {
        await getViewpointAndUpdate()
            .then(result => {
                res.json(result);
            })
            .catch(console.error)
    } catch (error) {
        console.error(error);
    }
})

router.get('/intro', async function(req, res) {
    try {
        const response = await runIntroConversation();
        console.log("response: ", response);
        res.json(response);
    } catch (error) {
        console.error(error);
    }
})

router.get('/current', async function(req, res) {
    try {
        const response = await getCurrentTime();
        res.json(response);
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;
