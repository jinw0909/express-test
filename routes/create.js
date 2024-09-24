var express = require('express');
var router = express.Router();

const axios = require('axios');

const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey : process.env.API_KEY
});

const { Sequelize } = require("sequelize");
const { Op } = require('sequelize');
const AWS = require("aws-sdk");
const { Blockmedia, Viewpoint, Analysis, Candidate, Translation } = require('../models');

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
async function getArticlesDay() {
    try {
        //Calculate the datetime 12 hours ago
        const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000);
        const articleIds = await Blockmedia.findAll({
            where: {
                date: {
                    [Sequelize.Op.gte]: twelveHoursAgo
                }
            },
            attributes: ['id'],
            order: [['id', 'DESC']]
        });
        if (!articleIds.length) {
            console.log('No articles published in the last 12 hours');
            return null;
        }

        const articleIdList = articleIds.map(article => article.get({plain: true}));
        console.log("Article ids within 12 hours: ", articleIdList);
        return articleIdList;
    } catch(err) {
        console.error(err);
        return { error: err.message }
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
        const articleData = articles.map(article => article.get({plain: true}));
        console.log("query result: ", articleData);
        return JSON.stringify(articleData, null, 2);
    } catch(err) {
        console.error("Error in getCandidates:", err);
        throw err;
    }
}
async function getArticles(indexList) {
    try {
        const articles = await Blockmedia.findAll({
            where: {
                id : {
                    [Sequelize.Op.in]: indexList
                }
            },
            limit: 12
        })

        //Convert each article to a plain object
        const plainArticles = articles.map(article => article.get({plain: true}));
        console.log("query result: ", plainArticles);
        return JSON.stringify(plainArticles, null, 2);
    } catch(err) {
        console.error("Error in getArticles:", err);
        throw err;
    }
}
async function getArticle(index) {
    try {
        // Find the article with the given id
        const article = await Blockmedia.findOne({
            where: {
                id: index
            }
        });

        if (!article) {
            console.log(`No article found with id: ${index}`);
            return null;
        }

        // Convert the article to a plain object
        const plainArticle = article.get({ plain: true });
        console.log("query result: ", plainArticle);
        return JSON.stringify(plainArticle, null, 2);
    } catch (err) {
        console.error("Error in getArticleById:", err);
        throw err;
    }
}
async function getRecentAndUpdate() {
    try {
        const recentAnalyses = await Analysis.findAll({
            order: [['createdAt', 'DESC']], // Order by 'createdAt' in descending order
            limit: 4
        });

        console.log("recent analysis: ", recentAnalyses);

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

                // const mp3En = await generateTTS(analysis.analysis, 'English', analysis.id);
                // const mp3Jp = await generateTTS(analysisJp, 'Japanese', analysis.id);
                // const mp3Kr = await generateTTS(analysisKr, 'Korean', analysis.id);
                // const mp3Vn = await generateTTS(analysisVn, 'Vietnamese', analysis.id);
                // const mp3Cn = await generateTTS(analysisCn, 'Chinese', analysis.id);

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
                    createdAt: new Date(),
                    mp3: "",
                    mp3_jp: "",
                    mp3_kr: "",
                    mp3_vn: "",
                    mp3_cn: ""
                    // mp3: mp3En, // Path or URL to the English MP3 file
                    // mp3_jp: mp3Jp, // Path or URL to the Japanese MP3 file
                    // mp3_kr: mp3Kr, // Path or URL to the Korean MP3 file
                    // mp3_vn: mp3Vn, // Path or URL to the Vietnamese MP3 file
                    // mp3_cn: mp3Cn // Path or URL to the Chinese MP3 file
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
                Bucket: process.env.S3_BUCKET,
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
                    Bucket: process.env.S3_BUCKET,
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
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context. You are also capable of deriving the bitcoin market trend by analyzing the bitcoin price movement within a certain period, and capable of deriving the relationship between the trend and real-world events" },
        { role: "user", content: "From the analysis conducted on the Blockmedia articles, provide your final viewpoint derived from the most recent four analyses regarding the Bitcoin and cryptocurrency markets. Also, relate your viewpoint to the price fluctuations in the Bitcoin market over the past 7 days and within the last 24 hours. Additionally, based on your final viewpoint, if possible, provide a rough estimate of the future changes in the price of Bitcoin. Don't mention 'Blockmedia' in your viewpoint response and don't mention the analysis' id or title too. I Also want you to return the id's of four analysis you used to create the viewpoint as refs. Please return the result in JSON format as {'viewpoint': 'text', 'refs': [number, number, number, number, number]}."},
    ]
    const tools = [
        {
            type: "function",
            function: {
                name: "get_recent_analyses",
                description: "returns the list of the four most recent analyses created."
            }
        },
        {
            type: "function",
            function: {
                name: "get_coinprice_week",
                description: "returns the bitcoin price movement within the last seven days."
            }
        },
        {
            type: "function",
            function: {
                name: "get_coinprice_day",
                description: "returns the bitcoin price movement within the last 24 hours."
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

async function getViewpointAndUpdate() {
    try {
        const viewpoint = await getRecentViewpoint();

        if (viewpoint) {

            const viewpointJp = await translateText(viewpoint.viewpoint, 'Japanese');
            const viewpointKr = await translateText(viewpoint.viewpoint, 'Korean');
            const viewpointVn = await translateText(viewpoint.viewpoint, 'Vietnamese');
            const viewpointCn = await translateText(viewpoint.viewpoint, 'Chinese');

            // const mp3En = await generateTTS(viewpoint.viewpoint, 'English', viewpoint.id);
            // const mp3Jp = await generateTTS(viewpointJp, 'Japanese', viewpoint.id);
            // const mp3Kr = await generateTTS(viewpointKr, 'Korean', viewpoint.id);
            // const mp3Vn = await generateTTS(viewpointVn, 'Vietnamese', viewpoint.id);
            // const mp3Cn = await generateTTS(viewpointCn, 'Chinese', viewpoint.id);

            // Update the Analysis entry with values from the Blockmedia entry
            await viewpoint.update({
                viewpoint_jp: viewpointJp,
                viewpoint_kr: viewpointKr,
                viewpoint_vn: viewpointVn,
                viewpoint_cn: viewpointCn,
                updatedAt: new Date(),
                mp3: "", // Path or URL to the English MP3 file
                mp3_jp: "", // Path or URL to the Japanese MP3 file
                mp3_kr: "", // Path or URL to the Korean MP3 file
                mp3_vn: "", // Path or URL to the Vietnamese MP3 file
                mp3_cn: "", // Path or URL to the Chinese MP3 file
                // mp3: mp3En, // Path or URL to the English MP3 file
                // mp3_jp: mp3Jp, // Path or URL to the Japanese MP3 file
                // mp3_kr: mp3Kr, // Path or URL to the Korean MP3 file
                // mp3_vn: mp3Vn, // Path or URL to the Vietnamese MP3 file
                // mp3_cn: mp3Cn // Path or URL to the Chinese MP3 file
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

async function makeCandidates() {
    const candidates = await createCandidates();
    const finals = await recurseFinals(candidates);

    for (const candidate of finals) {
        await Candidate.upsert({
            articleId: candidate.id,
            summary: candidate.summary,
            reason: candidate.reason,
        });
    }

    const recent = await Candidate.findAll({
        order: [['id', 'DESC']],
        limit: 4
    });

    return recent.map(candidate => ({
        id: candidate.articleId,
        summary: candidate.summary,
        reason: candidate.reason
    }));
}
async function createCandidates() {

    const articleIds = await getArticlesDay();
    // const articleIds = articles.map(article => article.id);
    console.log("article ids: ", articleIds);
    const candidates = [];

    for (let i = 0; i < articleIds.length; i += 12) {
        const batch = articleIds.slice(i, i + 12);
        const result = await runCandidateConversation(batch);
        const left = await runVerifyConversation(result);
        candidates.push(...left);
    }

    return candidates;
}
async function runCandidateConversation(articleIds) {
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and summarize the main points and significance of the articles in that context. You are also capable to compare various articles and select the candidates that tend to have more significance than others. Since you are very accurate in your work, the candidate IDs you derive always match the original article IDs exactly."},
        { role: "user", content: "Here is a list of article ids that point their original articles." },
        { role: "user", content: JSON.stringify(articleIds)},
        { role: "user", content: "From the provided articles, select four articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement as candidates. Return the selected candidates in a json format as follows.  {'candidates' : [{'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}, {'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}, {'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}, {'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}].  The 'id' should be same to the id of the article that the candidate refers to. The 'summary' should be the brief summary of the provided article's content. and the 'reason' should be the reason why you selected that article as a candidate. The generated 'summary' and 'reason' should be in English." }
    ];
    const tools = [
        {
            type: "function",
            function: {
                name: "get_articles_with_id",
                description: "Get the original article of each candidate based on its id.",
                parameters: {
                    "type": "object",
                    "properties": {
                        "indexList": {
                            "type": "array",
                            "items": {
                                "type": "integer",
                                "description": "A list of candidate articles' IDs that point to their original articles"
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
        tool_choice: "auto",
        response_format: { type: "json_object" }
    });

    const responseMessage = response.choices[0].message;

    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
        const availableFunctions = {
            get_articles_with_id : getArticles
        }
        messages.push(responseMessage);

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
        const finalResponse= secondResponse.choices[0].message;
        const parsed = JSON.parse(finalResponse.content);
        console.log("parsed: ", parsed);
        return parsed['candidates'];
    }

    const parsed = JSON.parse(responseMessage.content);
    console.log("parsed: ", parsed);
    return parsed['candidates'];
}
async function runVerifyConversation(candidates) {
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context. Also you are capable to compare the summary of the article and the original article content, and check if the summary is correct."},
        { role: "user", content: "I will provide you the list of the candidates"},
        { role: "user", content: JSON.stringify(candidates)},
        { role: "user", content: "The provided candidate's id point to its original article. The 'summary' is the summary of the article that it refers to. the 'reason' is why the article was selected as a candidate. Using the id of the provided candidate, look up the original article that it points to and check if the summary of the article is correctly made. If the summary is not correct, then drop that candidate from the provided list. After checking all the candidates in the list, return the list that dropped the candidates whose summary was not correct. Return the list in a json format as follows. {'candidates' : [{'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}...} The length of the list depends on how many candidates were dropped from the initially provided list." }
    ];
    const tools = [
        {
            type: "function",
            function: {
                name: "get_article_with_id",
                description: "Get the original article of the candidate based on its id.",
                parameters: {
                    "type": "object",
                    "properties": {
                        "index": {
                            "type": "integer",
                            "description": "A candidate's id that points to its original article"
                        }
                    },
                    "required": ["index"]
                }
            }
        }
    ]

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: tools,
        tool_choice: "auto",
        response_format: { type: "json_object" }
    });

    const responseMessage = response.choices[0].message;

    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
        const availableFunctions = {
            get_article_with_id : getArticle
        }
        messages.push(responseMessage);

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            console.log("functionName: ", functionName);
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments);
            const functionResponse = await functionToCall(
                functionArgs.index,
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
        const finalResponse= secondResponse.choices[0].message;
        const parsed = JSON.parse(finalResponse.content);
        console.log("left: ", parsed);
        return parsed['candidates'];
    }

    const parsed = JSON.parse(responseMessage.content);
    console.log("left: ", parsed);
    return parsed['candidates'];
}
async function runFinalConversation(candidates) {
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles in relevance with the overall flow of the coin market, and understand the main points and significance of the articles in that context." },
        { role: "user", content: "Here is a list of article candidates which includes the summary and the reason why it was selected as a candidate : " },
        { role: "user" ,content: JSON.stringify(candidates)},
        { role: "user", content: "From the provided article candidates' list , select four candidates that are the most relevant with the movement of the cryptocurrency market and that are helpful in predicting the cryptocurrency market movement. Additionally, the final four selected candidates should not have duplicated or identical content. The 'reason' is about why the candidate was selected among other articles, and the 'summary' is the summary of the candidate's original content. The 'id' is the value that points to the original article of that candidate. Return four candidates in a json format as follows: {'finals' : [{'id': 'EXACT_ID_FROM_LIST', 'summary' : 'EXACT_SUMMARY_FROM_LIST', 'reason' : 'EXACT_REASON_FROM_LIST'}, {'id': 'EXACT_ID_FROM_LIST', 'summary' : 'EXACT_SUMMARY_FROM_LIST', 'reason' : 'EXACT_REASON_FROM_LIST'}, {'id': 'EXACT_ID_FROM_LIST', 'summary' : 'EXACT_SUMMARY_FROM_LIST', 'reason' : 'EXACT_REASON_FROM_LIST'}, {'id': 'EXACT_ID_FROM_LIST', 'summary' : 'EXACT_SUMMARY_FROM_LIST', 'reason' : 'EXACT_REASON_FROM_LIST'}]. Ensure the IDs exactly match the provided candidates' IDs." },
    ];
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        response_format: { type: "json_object" }
    });

    const responseMessage = response.choices[0].message;
    console.log("responseMessage: ", responseMessage);
    return JSON.parse(responseMessage.content)['finals'];
}
async function runCreateConversation(candidates) {
    //Step 1 : send the conversation and available functions to the model
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context."},
        { role: "user", content: "Here is a list of four final candidates that are selected from articles published within 12 hours: "},
        { role: "user", content: JSON.stringify(candidates)},
        { role: "user", content: `Give me a detailed and profound summary and analysis for each article, on the context with the reason for its selection. The analysis has to be at least ten sentences in english and the summary has to be at least six sentences in english. The response should be formatted as a JSON [{id : INT, analysis: TEXT, summary: TEXT}, ...] with a key named "summaries_and_analyses" so I can save each summary and analysis in a local database with ease. Don't improvise the id of the created analysis place it with a id that matches the original article. Utilize a function call to retrieve the original article of each candidate`},
    ];
    const tools = [
        {
            type: "function",
            function: {
                name: "get_candidate_articles",
                description: "Get the original article of each candidate based on its id.",
                parameters: {
                    "type": "object",
                    "properties": {
                        "indexList": {
                            "type": "array",
                            "items": {
                                "type": "integer",
                                "description": "A list of candidate articles' IDs that point to their original articles"
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
async function getAllViewpointWithAnalysisIds() {
    try {
        return Viewpoint.findAll({
            include: [{
                model: Analysis,
                as: 'Analyses', // Assuming you have defined this alias in your Sequelize associations
                attributes: ['id', 'createdAt'], // Fetch only the id of the Analysis records
                required: false // This ensures that viewpoints with no matching analyses are also returned
            }],
            order: [['createdAt', 'DESC']],
            limit: 7
        });
    } catch (error) {
        console.error(error);
    }
}
async function createViewpointImage() {
    try {
        // Fetch the most recent viewpoint from the database
        const recentViewpoint = await Viewpoint.findOne({
            attributes: ['id', 'createdAt', 'viewpoint'],
            order: [['createdAt', 'DESC']]
        });

        if (!recentViewpoint || !recentViewpoint.viewpoint) {
            console.error('No recent viewpoint found.');
            return;
        }

        const viewpointText = recentViewpoint.viewpoint;

        // Prepare messages for the OpenAI API
        let messages = [
            { role: 'user', content: 'Generate an image from the next analysis text of the crypto market.' },
            { role: 'user', content: viewpointText }
        ];

        // Call the OpenAI API to generate an image
        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: `Generate the image from the given daily perspective of the crypto market. Ensure that charts or text are not included in the generated image as much as possible. PROVIDED TEXT: ${viewpointText}`,
            style: "vivid",
            size: '1024x1024',
            response_format: "url"
        });
        console.log("response on image generation: ", response);

        // Extract the image URL from the API response
        const imageUrl = response.data[0].url;

        // Fetch the image data from the URL
        const imageResponse = await fetch(imageUrl);

        // Convert the response to an array buffer
        const arrayBuffer = await imageResponse.arrayBuffer();

        // Convert the array buffer to a Node.js Buffer object
        const imageBuffer = Buffer.from(arrayBuffer);

        // Set up S3 upload parameters
        const s3Params = {
            Bucket: process.env.S3_BUCKET,
            Key: `${recentViewpoint.id}_image.png`, // Save as a PNG file with a unique name
            Body: imageBuffer, // Image buffer to upload
            ContentType: "image/png", // Correct MIME type for an image
        };

        // Upload the image to S3
        const s3UploadPromise = new Promise((resolve, reject) => {
            s3.upload(s3Params, function (err, data) {
                if (err) {
                    console.error("Error uploading to S3:", err);
                    reject(err);
                } else {
                    console.log("Successfully uploaded data to " + data.Location);
                    resolve(data.Location); // Resolve with the URL of the uploaded image
                }
            });
        });

        // Wait for the image upload to complete and get the URL
        const uploadedImageUrl = await s3UploadPromise;

        // Update the imageUrl in the Viewpoint record with the S3 URL
        await Viewpoint.update(
            { imageUrl: uploadedImageUrl },
            { where: { id: recentViewpoint.id } }
        );

        console.log("Viewpoint image URL updated successfully:", uploadedImageUrl);
        return uploadedImageUrl; // Return the S3 URL of the uploaded image

    } catch (error) {
        console.error("Error during image generation or upload:", error);
    }
}
async function performArticleAnalysis() {
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
        await createViewpointImage();

        // res.status(200).send('ok');
        return "Successfully created and saved article analysis"
    } catch (error) {
        console.error("Error during operations: ", error);
        throw new Error('Error creating articles analysis');
    }
}

router.get('/', async function(req, res) {
    // const vpList = await getAllViewpointWithAnalysisIds();
    res.render('create');
});
router.get('/open', async function(req, res) {
   const vpList = await getAllViewpointWithAnalysisIds();
   res.send(vpList);
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
        const imageUrl = await createViewpointImage();

        // res.status(200).send('ok');
        res.send('ok');
    } catch (error) {
        console.error("Error during operations: ", error);
        res.status(500).send("An error occurred");
    }
});
router.get('/recent', async function(req, res) {
    try {
        const result = await getArticlesDay();
        const arr = result.map((article) => {
            return [
                article.id,
                article.title,
                article.date
            ]
        })
        res.send(arr);
    } catch (error) {
        console.error(error);
    }
})
router.get('/candidates', async function(req, res) {
   const candidates = await makeCandidates();
   console.log("candidates: ", candidates);
   res.json(candidates);
});
router.post('/image', async function(req, res) {
    try {
        // Call the function and wait for the result
        const imageUrl = await createViewpointImage();

        if (imageUrl) {
            // Send the URL back to the client
            res.json({ url: imageUrl });
        } else {
            // Handle the case where no URL is returned
            res.status(500).json({ error: "Image generation failed." });
        }
    } catch (error) {
        // Handle any errors that occurred during the process
        res.status(500).json({ error: "An error occurred: " + error.message });
    }
});
module.exports = { router, performArticleAnalysis, getArticlesDay };