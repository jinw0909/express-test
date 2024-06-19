var express = require('express');
var router = express.Router();

const axios = require('axios');

const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey : process.env.API_KEY
});

const { Sequelize } = require("sequelize");
const { Op } = require('sequelize');
const multer = require("multer");
const AWS = require("aws-sdk");
// const Viewpoint = require("../viewpoint");
// const Analysis = require('../analysis');
const { Blockmedia, Viewpoint, Analysis, Candidate, Translation } = require('../models');
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

//get latest 5 articles from blockmedia and save it to the db
//also return the data for further processing (for test only)
async function getLatestArticle() {
    try {
        let baseURL = process.env.API_BASE_URL
        const response = await fetch(`${baseURL}/crawl/articles`);

        // Check if the response was successful
        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.statusText);
        }

        const data = await response.json();
        console.log("article data: ", data);
        return JSON.stringify(data, null, 2);
    } catch(err) {
        console.error(err);
        return { error: err.message }
    }
}

async function get24articles() {
    try {
        //Calculate the datetime 24 hours ago
        const yesterday = new Date(new Date() - 24 * 60 * 60 * 1000);
        const twelveHoursAgo = new Date(new Date() - 12 * 60 * 60 * 1000);

        const articles = await Blockmedia.findAll({
            where: {
                createdAt: {
                    [Sequelize.Op.gte]: twelveHoursAgo
                }
            }
        })
        if (!articles.length) {
            console.log('No articles published in the last 12 hours');
            return JSON.stringify([]);
        }
        console.log("Article data: ", articles);
        // const data = await response.json();
        return JSON.stringify(articles, null, 2);
    } catch(err) {
        console.error(err);
        return { error: err.message }
    }
}

async function runIndexConversation() {
    //Step 1 : send the conversation and available functions to the model
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context."},
        { role: "user", content: "From the articles of Blockmedia within the past 24 hours, select five articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement, and give me each article's id and the reason for its selection in a json format. Don't improvise the id and search from the provided function call result."},
        // { role: "function", name: "get_blockmedia_articles_24"},
        { role: "assistant", content: '{"selected_articles" : [{"id": 523806, "reason": "This article discusses BNP Paribas\' investment in a Bitcoin spot ETF managed by BlackRock, marking a significant entry by one of Europe\'s largest banks into the cryptocurrency space. The move reflects growing institutional interest in cryptocurrencies, which can be a bullish indicator for the market."}, {"id": 524335, "reason" : "Coinbase, a major cryptocurrency exchange in the U.S., reported a substantial increase in revenue and profits due to the surge in Bitcoin prices. This reflects heightened trading activity and could signify ongoing interest and investment in the cryptocurrency from both retail and institutional investors."}, {"id": 523502, "reason": "The delay in expected rate cuts by the Federal Reserve could have implications for the cryptocurrency market. Typically, lower interest rates can lead to higher investments in risk assets like cryptocurrencies, so any delays can affect market sentiment and investment flows."}, {"id": 523654, "reason": "Although Fed Chair Jerome Powell indicated that an immediate rate hike isn\'t forthcoming, the ongoing concerns about inflation and economic overheating can create a volatile environment for cryptocurrencies, as investors might reassess risk assets."}, {"id": 523725, "reason": "This article covers how Bitcoin adoption in El Salvador and other Latin American countries is influencing the regional economy and sparking a widespread interest in cryptocurrencies. The regional adoption can play a crucial role in highlighting the utility and acceptance of cryptocurrencies on a broader scale. These articles provide insights into regulatory movements, economic conditions, and significant market activities that are crucial for understanding the current trends and future movements of the cryptocurrency market."}]'},
        { role: "user", content: "From the articles of Blockmedia within the past 24 hours, select five articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement, and give me each article's id and the reason for its selection in a json format with a key of 'selected_articles'. Don't improvise the id and search the article id from the provided function call result."},
    ];
    const tools = [
        {
            type: "function",
            function: {
                name: "get_blockmedia_articles_24",
                description: "returns the list of all the articles published by Blockmedia within 24 hours in a JSON format",
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

    // Step 2: check if the model wanted to call a function
    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
        // Step3. call the function
        // Note: the JSON response may not always be valid; be sure to handle errors
        const availableFunctions = {
            get_blockmedia_articles_24 : get24articles
        }; //only one function in this example, but you can have multiple
        messages.push(responseMessage); //extend the conversation with assistant's reply
        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            console.log("functionName: ", functionName);
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
            const functionResponse = await functionToCall(
                functionArgs.location,
                functionArgs.unit
            );
            console.log("functionResponse: ", functionResponse);
            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: functionResponse,
            }); //extend the conversation with function response
        }

        const secondResponse = await openai.chat.completions.create({
            //model: "gpt-3.5-turbo-0125",
            model: "gpt-4o",
            messages: messages,
            response_format: {type: "json_object"}
        });
        return secondResponse.choices;
    }

}

async function runCreateConversation(candidates) {
    //Step 1 : send the conversation and available functions to the model
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context."},
        { role: "user", content: `${JSON.stringify(candidates)} /// This is a  data which shows the selected candidate article's id, and the reason for its selection, among all of the Blockmedia articles published within 24 hours. What i want you to do is give me a detailed and profound summary and analysis for each article, on the context with the reason for its selection. The analysis has to be at least ten sentences in english and the summary has to be at least six sentences in english. The response should be formatted as a JSON [{id : integer, analysis: text, summary: text}] with key named "summaries_and_analyses" so I can save each summary and analysis in a local database with much ease. Don't improvise the id of the created Analysis and be sure that the id, analysis, and summary matches the provided article.`}
    ];
    const tools = [
        {
            type: "function",
            function: {
                name: "get_candidate_articles",
                description: "Get selected candidate articles based on their IDs from articles published within 12 hours in Blockmedia",
                parameters: {
                    "type": "object",
                    "properties": {
                        "indexList": {
                            "type": "array",
                            "items": {
                                "type": "integer",
                                "description": "A list of article IDs"
                            }
                        }
                    },
                    "required": ["indexList"]
                }
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

    // Step 2: check if the model wanted to call a function
    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
        // Step3. call the function
        // Note: the JSON response may not always be valid; be sure to handle errors
        const availableFunctions = {
            get_candidate_articles : getCandidates
        }; //only one function in this example, but you can have multiple
        messages.push(responseMessage); //extend the conversation with assistant's reply
        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            console.log("functionName: ", functionName);
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments);
            const functionResponse = await functionToCall(
                functionArgs.indexList,
            );
            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: functionResponse,
            }); //extend the conversation with function response
        }

        const secondResponse = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: messages,
            response_format: { type: "json_object" }
        });
        console.log("secondResponse: ", secondResponse.choices);
        return secondResponse.choices;

    }

}

async function getCandidates(indexList) {
    try {
        const articles = await Blockmedia.findAll({
            where: {
                id : {
                    [Sequelize.Op.in]: indexList
                }
            },
            limit: 4
        })
        console.log("query result: ", articles);
        return JSON.stringify(articles, null, 2);
    } catch(err) {
        console.error("Error in getCandidates:", err);
        throw err;
    }
}
async function getRecent() {
    try {
        const recentAnalyses = await Analysis.findAll({
            order: [['createdAt', 'DESC']], //Order by 'createdAt' in descending order
            limit: 4
        });
        const analyses = recentAnalyses.map(analysis => {
            return { id: analysis.id, analysis: analysis.analysis, summary: analysis.summary}
        });
        return analyses;
    } catch (error) {
        console.error("Error fetching recent analysis:", error);
        throw error;
    }
}

async function getRecentAndUpdate() {
    try {
        const recentAnalyses = await Analysis.findAll({
            order: [['createdAt', 'DESC']], // Order by 'createdAt' in descending order
            limit: 4
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

                const content = await translateText(blockmediaEntry.content, 'English');
                const contentJp = await translateText(blockmediaEntry.content, 'Japanese');
                const contentVn = await translateText(blockmediaEntry.content, 'Vietnamese');
                const contentCn = await translateText(blockmediaEntry.content, 'Chinese');

                const mp3En = await generateTTS(analysis.analysis, 'English', analysis.id);
                const mp3Jp = await generateTTS(analysisJp, 'Japanese', analysis.id);
                const mp3Kr = await generateTTS(analysisKr, 'Korean', analysis.id);
                const mp3Vn = await generateTTS(analysisVn, 'Vietnamese', analysis.id);
                const mp3Cn = await generateTTS(analysisCn, 'Chinese', analysis.id);

                // Update the Analysis entry with values from the Blockmedia entry
                // await analysis.update({
                //     title: title,
                //     title_kr: blockmediaEntry.title,
                //     title_jp: titleJp,
                //     title_vn: titleVn,
                //     title_cn: titleCn,
                //     content: blockmediaEntry.content,
                //     imageUrl: blockmediaEntry.imageUrl,
                //     date: blockmediaEntry.date,
                //     publisher: blockmediaEntry.publisher,
                //     analysis_jp: analysisJp,
                //     analysis_kr: analysisKr,
                //     analysis_vn: analysisVn,
                //     analysis_cn: analysisCn,
                //     summary_jp: summaryJp,
                //     summary_kr: summaryKr,
                //     summary_vn: summaryVn,
                //     summary_cn: summaryCn,
                //     content: content,
                //     content_jp: contentJp,
                //     content_kr: contentKr,
                //     content_vn: contentVn,
                //     content_cn: contentCn,
                //     updatedAt: new Date(),
                //     mp3: mp3En, // Path or URL to the English MP3 file
                //     mp3_jp: mp3Jp, // Path or URL to the Japanese MP3 file
                //     mp3_kr: mp3Kr, // Path or URL to the Korean MP3 file
                //     mp3_vn: mp3Vn, // Path or URL to the Vietnamese MP3 file
                //     mp3_cn: mp3Cn // Path or URL to the Chinese MP3 file
                // });
                await Translation.upsert({
                    id: analysis.id,
                    title: title,
                    title_jp: titleJp,
                    title_kr: blockmediaEntry.title,
                    title_vn: titleVn,
                    title_cn: titleCn,
                    content: content,
                    content_jp: contentJp,
                    content_kr: blockmediaEntry.content,
                    content_vn: contentVn,
                    content_cn : contentCn,
                    imageUrl: blockmediaEntry.imageUrl,
                    date: blockmediaEntry.date,
                    publisher: blockmediaEntry.publisher,
                    analysis: analysis.analysis,
                    analysis_jp: analysisJp,
                    analysis_kr: analysisKr,
                    analysis_vn: analysisVn,
                    analysis_cn: analysisCn,
                    summary: analysis.summary,
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
        const recentTranslation = await Translation.findAll({
            order: [['createdAt', 'DESC']], // Optionally re-fetch to send updated data back
            limit: 4
        });

        return recentTranslation.map(a => a);

    } catch (error) {
        console.error("Error fetching and updating recent analysis:", error);
        throw error;
    }
}

async function getRecentAndUpdateTest() {
    try {
        const recentAnalyses = await Analysis.findAll({
            order: [['createdAt', 'DESC']], // Order by 'createdAt' in descending order
            limit: 1
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

                const content = await translateText(blockmediaEntry.content, 'English');
                const contentJp = await translateText(blockmediaEntry.content, 'Japanese');
                const contentVn = await translateText(blockmediaEntry.content, 'Vietnamese');
                const contentCn = await translateText(blockmediaEntry.content, 'Chinese');

                const mp3En = await generateTTS(analysis.analysis, 'English', analysis.id);
                const mp3Jp = await generateTTS(analysisJp, 'Japanese', analysis.id);
                const mp3Kr = await generateTTS(analysisKr, 'Korean', analysis.id);
                const mp3Vn = await generateTTS(analysisVn, 'Vietnamese', analysis.id);
                const mp3Cn = await generateTTS(analysisCn, 'Chinese', analysis.id);

                // Update the Analysis entry with values from the Blockmedia entry
                // await analysis.update({
                //     title: title,
                //     title_kr: blockmediaEntry.title,
                //     title_jp: titleJp,
                //     title_vn: titleVn,
                //     title_cn: titleCn,
                //     content: blockmediaEntry.content,
                //     imageUrl: blockmediaEntry.imageUrl,
                //     date: blockmediaEntry.date,
                //     publisher: blockmediaEntry.publisher,
                //     analysis_jp: analysisJp,
                //     analysis_kr: analysisKr,
                //     analysis_vn: analysisVn,
                //     analysis_cn: analysisCn,
                //     summary_jp: summaryJp,
                //     summary_kr: summaryKr,
                //     summary_vn: summaryVn,
                //     summary_cn: summaryCn,
                //     content: content,
                //     content_jp: contentJp,
                //     content_kr: contentKr,
                //     content_vn: contentVn,
                //     content_cn: contentCn,
                //     updatedAt: new Date(),
                //     mp3: mp3En, // Path or URL to the English MP3 file
                //     mp3_jp: mp3Jp, // Path or URL to the Japanese MP3 file
                //     mp3_kr: mp3Kr, // Path or URL to the Korean MP3 file
                //     mp3_vn: mp3Vn, // Path or URL to the Vietnamese MP3 file
                //     mp3_cn: mp3Cn // Path or URL to the Chinese MP3 file
                // });
                await Translation.upsert({
                    id: analysis.id,
                    title: title,
                    title_kr: blockmediaEntry.title,
                    title_jp: titleJp,
                    title_vn: titleVn,
                    title_cn: titleCn,
                    content: content,
                    content_kr: blockmediaEntry.content,
                    content_jp: contentJp,
                    content_vn: contentVn,
                    content_cn : contentCn,
                    imageUrl: blockmediaEntry.imageUrl,
                    date: blockmediaEntry.date,
                    publisher: blockmediaEntry.publisher,
                    analysis: analysis.analysis,
                    analysis_jp: analysisJp,
                    analysis_kr: analysisKr,
                    analysis_vn: analysisVn,
                    analysis_cn: analysisCn,
                    summary: analysis.summary,
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
        // const updatedAnalyses = await Analysis.findAll({
        //     order: [['createdAt', 'DESC']], // Optionally re-fetch to send updated data back
        //     limit: 4
        // });
        //
        // return updatedAnalyses.map(a => a);

    } catch (error) {
        console.error("Error fetching and updating recent analysis:", error);
        throw error;
    }
}
// async function translateText(content, lang) {
//     let messages = [
//         { role: "system", content: "You are a professional translator capable of translating between English, Japanese, and Korean. You can understand the context of sentences and derive the meanings of words within that context, enabling you to translate accurately and appropriately for English, Japanese, and Korean speakers. Additionally, you possess knowledge about cryptocurrencies, Bitcoin, stocks, and finance in general, allowing you to aptly translate articles and analyses related to these topics into the respective languages."},
//         { role: "user", content: "Please translate the following document into Japanese. I only need the translated output, without any additional comments or indicators. Document: The report on national and corporate Bitcoin accumulations reveals significant crypto asset holdings by entities like MicroStrategy and various governments, including the U.S. and China. This trend underscores a substantial institutional and governmental embrace of Bitcoin, posing implications for market stability and pricing structures. Institutional holding can lead to lower market volatility and potentially higher price floors due to reduced circulatory supply. Understanding these dynamics is critical for evaluating Bitcoin's broader adoption and its perception as a store of value."},
//         { role: "assistant", content: "国と企業のビットコイン蓄積に関するレポートは、MicroStrategyやアメリカ、中国などの政府を含む機関がかなりの暗号資産を保有していることを明らかにしています。この傾向は、ビットコインに対する大規模な機関および政府の受容を強調し、市場の安定性と価格構造に対する影響を示唆しています。機関の保有は、流通供給の減少により市場のボラティリティを低下させ、潜在的にはより高い価格の床を可能にするかもしれません。これらのダイナミクスを理解することは、ビットコインの広範な採用と価値の保存としての認識を評価する上で重要です。"},
//         { role: "user", content: `Please translate the following document into ${lang}. I only need the translated output, without any additional comments or indicators. Document: ${content}`},
//     ];
//
//     const response  = await openai.chat.completions.create({
//         model: "gpt-4-turbo",
//         messages: messages
//     })
//
//     const responseMessage = response.choices[0].message.content;
//     console.log("response message: ", responseMessage);
//     return responseMessage;
// }
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
                Bucket: 'gpt-premium-charts',
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
                    Bucket: 'gpt-premium-charts',
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
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context. You are also capable of derive the bitcoin market trend by analyzing the bitcoin price movement within a certain period, and capable of deriving the relationship between the trend and real-world events" },
        { role: "user", content: "From the analysis conducted on the Blockmedia articles, provide your final viewpoint derived from the most recent five analyses regarding the Bitcoin and cryptocurrency markets. Also, relate your viewpoint to the price fluctuations in the Bitcoin market over the past 7 days and within the last 24 hours. Additionally, based on your final viewpoint, if possible, provide a rough estimate of the future changes in the price of Bitcoin. Don't mention 'Blockmedia' in your viewpoint response and don't mention the analysis' id or title too. I Also want you to return the id's of five analysis you used to create the viewpoint as refs. Please return the result in JSON format as {'viewpoint': 'text', 'refs': [number, number, number, number, number]}."},
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
            limit: 4
        });
        return JSON.stringify(recentAnalyses, null, 2);
    } catch(error) {
        console.error(error);
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
async function getViewpointAndUpdate() {
    try {
        const viewpoint = await getRecentViewpoint();

        if (viewpoint) {

            const viewpointJp = await translateText(viewpoint.viewpoint, 'Japanese');
            const viewpointKr = await translateText(viewpoint.viewpoint, 'Korean');
            const viewpointVn = await translateText(viewpoint.viewpoint, 'Vietnamese');
            const viewpointCn = await translateText(viewpoint.viewpoint, 'Chinese');

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
async function getArticlesDay() {
    try {
        //Calculate the datetime 24 hours ago
        const yesterday = new Date(new Date() - 12 * 60 * 60 * 1000);
        const articles = await Blockmedia.findAll({
            where: {
                createdAt: {
                    [Sequelize.Op.gte]: yesterday
                }
            },
        })
        if (!articles.length) {
            console.log('No articles published in the last 12 hours');
            return null;
        }

        console.log("Article data: ", articles);
        // const data = await response.json();
        // return JSON.stringify(transformedArticles, null, 2);
        return articles;
    } catch(err) {
        console.error(err);
        return { error: err.message }
    }
}
async function runCandidateConversation(articles) {
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context."},
        { role: "user", content: "From the given articles, select four articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement, return the selected articles in a json format as following. {'candidates' : [{'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}]. Also Don't improvise the 'id' and search from the given article list's id. 'summary' should be the brief summary of the article content. 'reason' should be the reason why the article was selected as a candidate. 'summary' and 'reason' should be in English. Article list : " + JSON.stringify(articles)},
    ];
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        // tools: tools,
        // tool_choice : "auto", //auto is default, but we'll be explicit
        response_format: { type: "json_object" }
    });

    const responseMessage = response.choices[0].message;
    const parsed = JSON.parse(responseMessage.content);
    console.log("parsed: ", parsed);
    return parsed['candidates'];
}
async function createCandidates() {

    const articles = await getArticlesDay();
    const candidates = [];

    for (let i = 0; i < articles.length; i += 12) {
        const batch = articles.slice(i, i + 12);
        const result = await runCandidateConversation(batch);
        candidates.push(...result);
    }

    return candidates;
}

async function runFinalConversation(candidates) {
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context." },
        { role: "user", content: "From the given article candidates, select four candidates that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement. The 'reason' is about why the article was selected as a candidate. Return the four candidates in a json format as following. {'finals' : [{'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}] Just return the list without a key. Also Don't improvise the 'id', 'summary', 'reason' and search from the given candidate list. Candidate List : " + JSON.stringify(candidates) },
    ];
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        // tools: tools,
        // tool_choice : "auto", //auto is default, but we'll be explicit
        response_format: { type: "json_object" }
    });

    const responseMessage = response.choices[0].message;
    console.log("responseMessage: ", responseMessage);
    const finals = JSON.parse(responseMessage.content)['finals'];
    return finals;
}

async function recurseFinals(candidates) {
    const finalists = [];

    // Process summaries in batches of 12
    for (let i = 0; i < candidates.length; i += 12) {
        const batch = candidates.slice(i, i + 12);
        const finals = await runFinalConversation(batch);
        finalists.push(...finals);
    }

    // If we have more than 4 finalists, process them recursively
    if (finalists.length > 4) {
        return recurseFinals(finalists);
    } else {
        return finalists.slice(0, 4);
    }
}

async function makeCandidates() {
    const candidates = await createCandidates();
    const finals = await recurseFinals(candidates);

    for (const candidate of finals) {
        await Candidate.upsert({
            articleId: candidate.id,
            summary: candidate.summary,
            reason: candidate.reason,
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    const recent = await Candidate.findAll({
        order: [['createdAt', 'DESC']],
        limit: 4
    });

    const result = recent.map(candidate => ({
        id: candidate.articleId,
        summary: candidate.summary,
        reason: candidate.reason
    }));

    return result;
}

async function getAllViewpointWithAnalysisIds() {
    try {
        return Viewpoint.findAll({
            include: [{
                model: Analysis,
                as: 'Analyses', // Assuming you have defined this alias in your Sequelize associations
                attributes: ['id'], // Fetch only the id of the Analysis records
                required: false // This ensures that viewpoints with no matching analyses are also returned
            }],
            order: [['createdAt', 'DESC']]
        });

    } catch (error) {
        console.error(error);
    }
}

router.get('/', async function(req, res) {
    const vpList = await getAllViewpointWithAnalysisIds();
    res.render('create', {vpList: vpList});
});
router.post('/complete', async function(req, res) {
    try {
        // console.log("step 1: candidates: ", candidates);
        const candidates = await makeCandidates();
        console.log("candidates: ", candidates);
        // Then, pass these indexes to runCreateConveration
        const createResult = await runCreateConversation(candidates);

        const articles = JSON.parse(createResult[0].message.content)['summaries_and_analyses'];
        console.log("step 2: articles: ", articles);

        for (const article of articles) { // Loop through each article
            try {
                const [instance, created] = await Analysis.upsert({
                    id: article.id,
                    analysis: article.analysis,
                    summary: article.summary,
                    createdAt: new Date(), // Consider managing this within Sequelize model definition
                    updatedAt: new Date()  // Sequelize can handle updatedAt automatically
                });

                if (created) {
                    console.log(`Analysis with ID ${article.id} was created.`);
                } else {
                    console.log(`Analysis with ID ${article.id} was updated.`);
                }
            } catch (err) {
                console.error('Error upserting article:', err);
            }
        }

        const updated = await getRecentAndUpdate();
        console.log("updated: ", updated);

        const result = await runViewpointConversation();
        const content = result[0].message.content;
        const { viewpoint, refs } = JSON.parse(content);
        console.log("viewpoint: ", viewpoint);
        console.log("refs: ", refs);

        const today = new Date();
        console.log("today: ", today); // Logs current date and time in UTC

        // Convert to KST using toLocaleString
        const kstDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        console.log("kstDate: ", kstDate); // Logs the adjusted date and time for KST

        // Get the KST hours using local time
        const kstHours = kstDate.getHours();
        console.log("kstHours: ", kstHours); // Logs the KST hours correctly

        // Determine AM/PM suffix
        const period = kstHours >= 12 ? 'PM' : 'AM';

        // Construct the ID using the KST date and period
        const year = kstDate.getFullYear();
        const month = String(kstDate.getMonth() + 1).padStart(2, '0');
        const day = String(kstDate.getDate()).padStart(2, '0');
        const id = `${year}${month}${day}_${period}`;
        console.log("id: ", id); // Logs the constructed ID based on KST date and period

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

        const updatedVp = await getViewpointAndUpdate();
        console.log("updatedVp: ", updatedVp);

        // res.status(200).send('ok');
        res.send('ok');
    } catch (error) {
        console.error("Error during operations: ", error);
        res.status(500).send("An error occurred");
    }
});

router.post('/completevp', async function(req, res) {
    try {
        const result = await runViewpointConversation();
        const content = result[0].message.content;
        const { viewpoint, refs } = JSON.parse(content);
        console.log("viewpoint: ", viewpoint);
        console.log("refs: ", refs);

        const today = new Date();
        console.log("today: ", today); // Logs current date and time in UTC

        // Convert to KST using toLocaleString
        const kstDate = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        console.log("kstDate: ", kstDate); // Logs the adjusted date and time for KST

        // Get the KST hours using local time
        const kstHours = kstDate.getHours();
        console.log("kstHours: ", kstHours); // Logs the KST hours correctly

        // Determine AM/PM suffix
        const period = kstHours >= 12 ? 'PM' : 'AM';

        // Construct the ID using the KST date and period
        const year = kstDate.getFullYear();
        const month = String(kstDate.getMonth() + 1).padStart(2, '0');
        const day = String(kstDate.getDate()).padStart(2, '0');
        const id = `${year}${month}${day}_${period}`;
        console.log("id: ", id); // Logs the constructed ID based on KST date and period


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

        const updatedVp = await getViewpointAndUpdate();
        console.log("updatedVp: ", updatedVp);
        res.status(200).send("ok"); // Send response with recent analyses
    } catch (error) {
        console.error(error);
        res.send("An error occurred");
    }
})
router.post('/recent', async function(req, res) {
    try {
        const result = await getRecentAndUpdateTest();
        console.log("result: ", result);
    } catch (error) {
        console.error(error);
    }
})
router.post('/createanalysis', async function(req, res) {
    try {
        // console.log("step 1: candidates: ", candidates);
        const candidates = await makeCandidates();
        console.log("candidates: ", candidates);
        // Then, pass these indexes to runCreateConveration
        const createResult = await runCreateConversation(candidates);

        const articles = JSON.parse(createResult[0].message.content)['summaries_and_analyses'];
        console.log("step 2: articles: ", articles);

        for (const article of articles) { // Loop through each article
            try {
                const [instance, created] = await Analysis.upsert({
                    id: article.id,
                    analysis: article.analysis,
                    summary: article.summary,
                    createdAt: new Date(), // Consider managing this within Sequelize model definition
                    updatedAt: new Date()  // Sequelize can handle updatedAt automatically
                });

                if (created) {
                    console.log(`Analysis with ID ${article.id} was created.`);
                } else {
                    console.log(`Analysis with ID ${article.id} was updated.`);
                }
            } catch (err) {
                console.error('Error upserting article:', err);
            }
        }
        res.send('ok');
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;