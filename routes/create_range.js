var express = require('express');
var router = express.Router();

const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey: process.env.API_KEY
});

const { Sequelize, Op, literal } = require("sequelize");
const AWS = require("aws-sdk");
const { Blockmedia, Viewpoint, Analysis, Candidate, Translation } = require('../models');

AWS.config.update({
    region: process.env.S3_REGION,
    accessKeyId: process.env.S3_KEY,
    secretAccessKey: process.env.S3_PASSWORD
});

const s3 = new AWS.S3();

const Polly = new AWS.Polly({
    signatureVersion: '',
    region: 'us-east-1'
});

const GPT_MODEL = 'gpt-5.2';

function extractJson(text) {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");
    if (first !== -1 && last !== -1) {
        return text.slice(first, last + 1);
    }
    return text;
}

function validateTargetDate(targetDate) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(targetDate)) {
        throw new Error("targetDate must be in YYYY-MM-DD format");
    }
}

function validatePeriod(period) {
    if (!['AM', 'PM'].includes(period)) {
        throw new Error("period must be 'AM' or 'PM'");
    }
}

function buildSessionInfo(targetDate, period) {
    validateTargetDate(targetDate);
    validatePeriod(period);

    const [year, month, day] = targetDate.split('-').map(Number);

    const viewpointId = `${year}${String(month).padStart(2, '0')}${String(day).padStart(2, '0')}_${period}`;

    // --- KST 기준 전날 계산 (UTC 혼용 없음)
    function getPrevDateStr(y, m, d) {
        const date = new Date(Date.UTC(y, m - 1, d)); // UTC 기준 안전 생성
        date.setUTCDate(date.getUTCDate() - 1);

        const py = date.getUTCFullYear();
        const pm = String(date.getUTCMonth() + 1).padStart(2, '0');
        const pd = String(date.getUTCDate()).padStart(2, '0');

        return `${py}-${pm}-${pd}`;
    }

    const prevDateStr = getPrevDateStr(year, month, day);

    let startAtKst;
    let endAtKst;
    let fixedCreatedAt;

    if (period === 'AM') {
        // 전날 21:00 ~ 당일 08:59:59
        startAtKst = `${prevDateStr} 21:00:00`;
        endAtKst = `${targetDate} 08:59:59`;

        // 👉 KST 08:30 기준 → UTC로 변환 (전날 23:30 UTC)
        fixedCreatedAt = new Date(Date.UTC(year, month - 1, day - 1, 23, 30, 0));

    } else {
        // 당일 09:00 ~ 당일 20:59:59
        startAtKst = `${targetDate} 09:00:00`;
        endAtKst = `${targetDate} 20:59:59`;

        // 👉 KST 20:30 기준 → UTC 11:30
        fixedCreatedAt = new Date(Date.UTC(year, month - 1, day, 11, 30, 0));
    }

    return {
        targetDate,
        period,
        startAtKst,
        endAtKst,
        fixedCreatedAt,
        viewpointId
    };
}

async function getCoinPriceWeek() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=7');
        const data = await response.json();
        return JSON.stringify(data, null, 2);
    } catch (err) {
        console.error("Error: ", err);
        throw err;
    }
}

async function getCoinPriceDay() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24');
        const data = await response.json();
        return JSON.stringify(data, null, 2);
    } catch (err) {
        console.error("Failed to fetch Bitcoin prices (24hr) : ", err);
        return { error: err.message };
    }
}

async function getArticlesBySession(targetDate, period) {
    try {
        const { startAtKst, endAtKst } = buildSessionInfo(targetDate, period);

        console.log(`[getArticlesBySession] ${targetDate}_${period}`);
        console.log("startAtKst:", startAtKst);
        console.log("endAtKst:", endAtKst);

        const articleIds = await Blockmedia.findAll({
            // where: {
            //     date: {
            //         [Op.gte]: startAtKst,
            //         [Op.lte]: endAtKst
            //     }
            // },
            where: {
                [Op.and]: [
                    literal(`date >= '${startAtKst}'`),
                    literal(`date <= '${endAtKst}'`)
                ]
            },
            attributes: ['id'],
            order: [['id', 'DESC']],
            raw: true
        });

        if (!articleIds || !articleIds.length) {
            console.log(`No articles found for ${targetDate}_${period} (KST)`);
            return [];
        }

        console.log(`article ids on ${targetDate}_${period}: `, articleIds);
        return articleIds;
    } catch (err) {
        console.error("Error in getArticlesBySession:", err);
        throw err;
    }
}

async function getCandidates(indexList) {
    try {
        const articles = await Blockmedia.findAll({
            where: {
                id: {
                    [Op.in]: indexList
                }
            },
            limit: 4,
            raw: true
        });

        return JSON.stringify(articles, null, 2);
    } catch (err) {
        console.error("Error in getCandidates:", err);
        throw err;
    }
}

async function getArticles(indexList) {
    try {
        const articles = await Blockmedia.findAll({
            where: {
                id: {
                    [Op.in]: indexList
                }
            },
            limit: 12,
            raw: true
        });

        return JSON.stringify(articles, null, 2);
    } catch (err) {
        console.error("Error in getArticles:", err);
        throw err;
    }
}

async function getAnalysesByIds(ids) {
    try {
        const analyses = await Analysis.findAll({
            where: {
                id: {
                    [Op.in]: ids
                }
            },
            order: [['createdAt', 'DESC']],
            raw: true
        });

        return JSON.stringify(analyses, null, 2);
    } catch (error) {
        console.error("Error in getAnalysesByIds:", error);
        throw error;
    }
}

async function translateText(content, lang) {
    let messages = [
        {
            role: "system",
            content: "You are a professional translator capable of translating between English, Japanese, Korean, Vietnamese, Chinese, and traditional Chinese. You can understand the context of sentences and derive the meanings of words within that context, enabling you to translate accurately and appropriately for English, Japanese, Korean, Vietnamese and Chinese speakers. Additionally, you possess knowledge about cryptocurrencies, Bitcoin, stocks, and finance in general, allowing you to aptly translate articles and analyses related to these topics into the respective languages. You can also naturally translate article headlines or titles into other languages. Please ensure to apply honorifics when mentioning asian personality name when translating into Korean or Japanese."
        },
        {
            role: "user",
            content: "Please translate the following text into Japanese. I only need the translated output, without any additional comments or indicators. Please ensure to apply honorifics when translating into Korean or Japanese. Text: The report on national and corporate Bitcoin accumulations reveals significant crypto asset holdings by entities like MicroStrategy and various governments, including the U.S. and China. This trend underscores a substantial institutional and governmental embrace of Bitcoin, posing implications for market stability and pricing structures. Institutional holding can lead to lower market volatility and potentially higher price floors due to reduced circulatory supply. Understanding these dynamics is critical for evaluating Bitcoin's broader adoption and its perception as a store of value."
        },
        {
            role: "assistant",
            content: "国と企業のビットコイン蓄積に関するレポートは、MicroStrategyやアメリカ、中国などの政府を含む機関がかなりの暗号資産を保有していることを明らかにしています。この傾向は、ビットコインに対する大規模な機関および政府の受容を強調し、市場の安定性と価格構造に対する影響を示唆しています。機関の保有は、流通供給の減少により市場のボラティリティを低下させ、潜在的にはより高い価格の床を可能にするかもしれません。これらのダイナミクスを理解することは、ビットコインの広範な採用と価値の保存としての認識を評価する上で重要です。"
        },
        {
            role: "user",
            content: "Please translate the following text into simplified Chinese. I only need the translated output, without any additional comments or indicators. Text: [마켓뷰] '금리 인하 이르다고?' 美 물가지표 지켜보자"
        },
        {
            role: "assistant",
            content: "【市场观察】“现在降息还太早？”先关注美国通胀数据"
        },
        {
            role: "user",
            content: "Please translate the following text into traditional Chinese. I only need the translated output, without any additional comments or indicators. Text: [롱/숏] 비트코인 횡보 속 ‘종목별 베팅’ 뚜렷…SOL·XRP 숏 집중, BCH·BNB 롱 우위"
        },
        {
            role: "assistant",
            content: "【多／空】比特幣橫盤之際「個別幣種押注」趨勢明顯……SOL・XRP 空頭集中，BCH・BNB 多頭占優"
        },
        {
            role: "user",
            content: `Please translate the following text into ${lang}. I only need the translated output, without any additional comments or indicators. Text: ${content}`
        }
    ];

    const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: messages
    });

    const responseMessage = response.choices[0].message.content;
    console.log("response message: ", responseMessage);
    return responseMessage;
}

async function generateTTS(content, lang, id) {
    if (lang === 'Vietnamese') {
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
        let voiceId = 'Danielle';
        if (lang === 'Japanese') {
            voiceId = 'Kazuha';
        } else if (lang === 'Korean') {
            voiceId = 'Seoyeon';
        } else if (lang === 'Chinese') {
            voiceId = 'Zhiyu';
        }

        let pollyParams = {
            Text: content,
            OutputFormat: 'mp3',
            VoiceId: voiceId,
            Engine: 'neural'
        };

        return new Promise((resolve, reject) => {
            Polly.synthesizeSpeech(pollyParams, (err, data) => {
                if (err) {
                    console.error("Error synthesizing speech:", err);
                    reject(err);
                    return;
                }

                const s3Params = {
                    Bucket: process.env.S3_BUCKET,
                    Key: `${id}_${lang}.mp3`,
                    Body: data.AudioStream,
                    ContentType: "audio/mpeg",
                };

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

async function runCandidateConversation(articleIds) {
    const messages = [
        {
            role: "system",
            content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and summarize the main points and significance of the articles in that context. You are also capable to compare various articles and select the candidates that tend to have more significance than others. Since you are very accurate in your work, the candidate IDs you derive always match the original article IDs exactly."
        },
        { role: "user", content: "Here is a list of article ids that point their original articles." },
        { role: "user", content: JSON.stringify(articleIds) },
        {
            role: "user",
            content: "From the provided articles, select four articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement as candidates. Return the selected candidates in a json format as follows. {'candidates' : [{'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}, {'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}, {'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}, {'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}]. The 'id' should be same to the id of the article that the candidate refers to. The 'summary' should be the brief summary of the provided article's content. and the 'reason' should be the reason why you selected that article as a candidate. The generated 'summary' and 'reason' should be in English."
        }
    ];

    const tools = [
        {
            type: "function",
            function: {
                name: "get_articles_with_ids",
                strict: true,
                description: "Get the original article of each candidate based on its id.",
                parameters: {
                    type: "object",
                    properties: {
                        indexList: {
                            type: "array",
                            items: {
                                type: "integer",
                                description: "candidate articles' ID that point to its original article"
                            }
                        }
                    },
                    required: ["indexList"],
                    additionalProperties: false
                }
            }
        }
    ];

    const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: messages,
        tools: tools,
        tool_choice: { type: "function", function: { name: "get_articles_with_ids" } },
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "Candidates",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        candidates: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "number" },
                                    summary: { type: "string" },
                                    reason: { type: "string" }
                                },
                                required: ["id", "summary", "reason"],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ["candidates"],
                    additionalProperties: false
                }
            }
        },
        parallel_tool_calls: false
    });

    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    if (toolCalls) {
        const availableFunctions = {
            get_articles_with_ids: getArticles
        };

        messages.push(responseMessage);

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments);
            const functionResponse = await functionToCall(functionArgs.indexList);

            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: functionResponse,
            });
        }

        const secondResponse = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: messages,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "Candidates",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            candidates: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "number" },
                                        summary: { type: "string" },
                                        reason: { type: "string" }
                                    },
                                    required: ["id", "summary", "reason"],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ["candidates"],
                        additionalProperties: false
                    }
                }
            },
        });

        const finalResponse = secondResponse.choices[0].message;
        const parsed = JSON.parse(finalResponse.content);
        return parsed['candidates'];
    }

    const parsed = JSON.parse(responseMessage.content);
    return parsed['candidates'];
}

async function runVerifyConversation(candidates) {
    const messages = [
        {
            role: "system",
            content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context. Also you are capable to compare the summary of the article and the original article content, and check if the summary is correct."
        },
        { role: "user", content: "I will provide you the list of the candidates" },
        { role: "user", content: JSON.stringify(candidates) },
        {
            role: "user",
            content: "The provided candidate's id point to its original article. The 'summary' is the summary of the article that it refers to. The 'reason' is why the article was selected as a candidate. Using the id of the provided candidate, look up the original article that it points to and check if the summary of the article is correctly made. Unless the provided list has only a single element, drop one candidate element from the list that you think is the least relevant to the cryptocurrency market trend and return the rest in the next json format. {'candidates' : [{'id': 'INT', 'summary' : 'TEXT', 'reason' : 'TEXT'}, ...]}"
        }
    ];

    const tools = [
        {
            type: "function",
            function: {
                name: "get_articles_with_ids",
                strict: true,
                description: "Get the original article of each candidate based on its id.",
                parameters: {
                    type: "object",
                    properties: {
                        indexList: {
                            type: "array",
                            items: {
                                type: "number",
                                description: "candidate articles' ID that point to its original article"
                            }
                        }
                    },
                    required: ["indexList"],
                    additionalProperties: false
                }
            }
        }
    ];

    const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: messages,
        tools: tools,
        tool_choice: { type: "function", function: { name: "get_articles_with_ids" } },
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "Candidates",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        candidates: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "number" },
                                    summary: { type: "string" },
                                    reason: { type: "string" }
                                },
                                required: ["id", "summary", "reason"],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ["candidates"],
                    additionalProperties: false
                }
            }
        },
        parallel_tool_calls: false
    });

    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    if (toolCalls) {
        const availableFunctions = {
            get_articles_with_ids: getArticles
        };

        messages.push(responseMessage);

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments);
            const functionResponse = await functionToCall(functionArgs.indexList);

            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: functionResponse,
            });
        }

        const secondResponse = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: messages,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "Candidates",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            candidates: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "number" },
                                        summary: { type: "string" },
                                        reason: { type: "string" }
                                    },
                                    required: ["id", "summary", "reason"],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ["candidates"],
                        additionalProperties: false
                    }
                }
            },
        });

        const finalResponse = secondResponse.choices[0].message;
        const parsed = JSON.parse(finalResponse.content);
        return parsed['candidates'];
    }

    const parsed = JSON.parse(responseMessage.content);
    return parsed['candidates'];
}

async function runFinalConversation(candidates, limit) {
    const messages = [
        {
            role: "system",
            content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles in relevance with the overall flow of the coin market, and understand the main points and significance of the articles in that context."
        },
        { role: "user", content: "Here is a list of candidates which is the summary and the reason why it was selected as a candidate :" },
        { role: "user", content: JSON.stringify(candidates) },
        {
            role: "user",
            content: `From the provided candidates list , select ${limit} candidates that are the most relevant with the the cryptocurrency market and that are the most helpful in predicting the cryptocurrency market trend. The final ${limit} candidates should not have duplicated or identical content. The given 'reason' is about why this candidate might be important, and the given 'summary' is the summary of the candidate's original content. The given 'id' is the value that points to the original article. Return the final ${limit} candidates in a json format as follows: {'finals' : [{'id': 'EXACT_ID_FROM_THE_PASSED_LIST', 'summary' : 'EXACT_SUMMARY_FROM_THE_PASSED_LIST', 'reason' : 'EXACT_REASON_FROM_THE_PASSED_LIST'}, ...]. Ensure the ID of each element exactly match the ID of the initially provided list`
        },
    ];

    const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: messages,
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "Candidates",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        finals: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "number" },
                                    summary: { type: "string" },
                                    reason: { type: "string" }
                                },
                                required: ["id", "summary", "reason"],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ["finals"],
                    additionalProperties: false
                }
            }
        },
    });

    const responseMessage = response.choices[0].message;
    return JSON.parse(responseMessage.content)['finals'];
}

async function recurseFinals(candidates, limit = 4, results = []) {
    console.log("recurseFinals() candidates:", candidates.length, "limit:", limit);

    if (!candidates || candidates.length === 0 || limit <= 0) {
        return results;
    }

    const finalists = [];

    for (let i = 0; i < candidates.length; i += 12) {
        const batch = candidates.slice(i, i + 12);
        const finals = await runFinalConversation(batch, limit);
        finalists.push(...finals);
    }

    if (!finalists.length) {
        return results;
    }

    if (finalists.length > 4) {
        return await recurseFinals(finalists, limit, results);
    }

    const verified = await runVerifyConversation(finalists);

    if (!verified || verified.length === 0) {
        return results;
    }

    results.push(...verified);

    if (results.length >= limit) {
        return results;
    }

    const remainingLimit = limit - results.length;
    const verifiedIds = new Set(verified.map(v => v.id));

    const filteredCandidates = candidates.filter(
        candidate => !verifiedIds.has(candidate.id)
    );

    if (!filteredCandidates.length) {
        return results;
    }

    if (filteredCandidates.length === candidates.length) {
        console.warn("Filtered candidates did not shrink; stopping recursion to avoid infinite loop.");
        return results;
    }

    return await recurseFinals(filteredCandidates, remainingLimit, results);
}

async function createCandidatesBySession(targetDate, period) {
    try {
        const articleIds = await getArticlesBySession(targetDate, period);

        if (!articleIds || articleIds.length === 0) {
            console.log(`No articles found for ${targetDate}_${period}.`);
            return [];
        }

        const candidates = [];

        for (let i = 0; i < articleIds.length; i += 12) {
            const batch = articleIds.slice(i, i + 12);
            const result = await runCandidateConversation(batch);
            candidates.push(...result);
        }

        return candidates;
    } catch (error) {
        console.error("Error in createCandidatesBySession:", error);
        return [];
    }
}

async function makeCandidatesBySession(targetDate, period) {
    const candidates = await createCandidatesBySession(targetDate, period);
    console.log("candidates to recurse on: ", candidates);

    const finals = await recurseFinals(candidates, 4);
    console.log("final candidates: ", finals);

    for (const candidate of finals) {
        await Candidate.upsert({
            articleId: candidate.id,
            summary: candidate.summary,
            reason: candidate.reason,
        });
    }

    return finals.map(candidate => ({
        id: candidate.id,
        summary: candidate.summary,
        reason: candidate.reason
    }));
}

async function runCreateConversation(candidates) {
    const messages = [
        {
            role: "system",
            content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context."
        },
        { role: "user", content: "Here is a list of four final candidates that are selected from articles published within a certain target date:" },
        { role: "user", content: JSON.stringify(candidates) },
        // {
        //     role: "user",
        //     content: `Give me a detailed and profound summary and analysis for each article, on the context with the reason for its selection. The analysis has to be at least ten sentences in english and the summary has to be at least six sentences in english. The response should be formatted as a JSON [{id : INT, analysis: TEXT, summary: TEXT}, ...] with a key named "summaries_and_analyses" so I can save each summary and analysis in a local database with ease. Don't improvise the id of the created analysis place it with a id that matches the original article. Utilize a function call to retrieve the original article of each candidate`
        // },
        {
            role: "user",
            content: `Give me a detailed and profound summary and analysis for each original article.
            The analysis must be based primarily on the original article content retrieved by the function call.
            You may use the candidate's reason only as secondary background context, but do not restate it directly and do not make it the structure of the analysis.
            The analysis has to be at least ten sentences in English and the summary has to be at least six sentences in English.
            The analysis should focus on:
            1. the article's main claims and facts,
            2. why the article matters to the cryptocurrency market,
            3. possible implications for Bitcoin or other crypto assets,
            4. broader market context.
            Do not begin the analysis with phrases like "This article was selected because".
            Return the response in JSON format with a key named "summaries_and_analyses" as:
            {"summaries_and_analyses":[{"id":INT,"analysis":"TEXT","summary":"TEXT"}]}`
        }
    ];

    const tools = [
        {
            type: "function",
            function: {
                name: "get_candidate_articles",
                description: "Get the original article of each candidate based on its id.",
                parameters: {
                    type: "object",
                    properties: {
                        indexList: {
                            type: "array",
                            items: {
                                type: "number",
                                description: "candidate articles' ID that point to its original article"
                            }
                        }
                    },
                    required: ["indexList"],
                    additionalProperties: false
                }
            }
        }
    ];

    const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: messages,
        tools: tools,
        tool_choice: { type: "function", function: { name: "get_candidate_articles" } },
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "Analysis",
                schema: {
                    type: "object",
                    properties: {
                        summaries_and_analyses: {
                            type: "array",
                            items: {
                                type: "object",
                                properties: {
                                    id: { type: "number" },
                                    analysis: { type: "string" },
                                    summary: { type: "string" }
                                },
                                required: ["id", "analysis", "summary"],
                                additionalProperties: false
                            }
                        }
                    },
                    required: ["summaries_and_analyses"],
                    additionalProperties: false
                }
            }
        },
        parallel_tool_calls: false
    });

    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    if (toolCalls) {
        const availableFunctions = {
            get_candidate_articles: getCandidates
        };

        messages.push(responseMessage);

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments);
            const functionResponse = await functionToCall(functionArgs.indexList);

            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: functionResponse,
            });
        }

        const secondResponse = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: messages,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "Analysis",
                    schema: {
                        type: "object",
                        properties: {
                            summaries_and_analyses: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        id: { type: "number" },
                                        analysis: { type: "string" },
                                        summary: { type: "string" }
                                    },
                                    required: ["id", "analysis", "summary"],
                                    additionalProperties: false
                                }
                            }
                        },
                        required: ["summaries_and_analyses"],
                        additionalProperties: false
                    }
                }
            },
        });

        return secondResponse.choices;
    }
}

async function runViewpointConversationByIds(analysisIds) {
    const messages = [
        {
            role: "system",
            content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context. You are also capable of deriving the bitcoin market trend by analyzing the bitcoin price movement within a certain period, and capable of deriving the relationship between the trend and real-world events"
        },
        {
            role: "user",
            content: `From the analysis conducted on the provided Analysis records, provide your final viewpoint derived only from these analysis ids: ${JSON.stringify(analysisIds)} regarding the Bitcoin and cryptocurrency markets. Also, relate your viewpoint to the price fluctuations in the Bitcoin market over the past 7 days and within the last 24 hours. Additionally, based on your final viewpoint, if possible, provide a rough estimate of the future changes in the price of Bitcoin. Don't mention the analysis id or title too. I also want you to return the id's of the analyses you used to create the viewpoint as refs. Please return the result in JSON format as {'viewpoint': 'text', 'refs': [number, number, number, number]}.`
        },
    ];

    const tools = [
        {
            type: "function",
            function: {
                name: "get_analyses_by_ids",
                strict: true,
                description: "returns the analyses for the passed ids",
                parameters: {
                    type: "object",
                    properties: {
                        ids: {
                            type: "array",
                            items: {
                                type: "number",
                                description: "analysis ids"
                            }
                        }
                    },
                    required: ["ids"],
                    additionalProperties: false
                }
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
    ];

    const response = await openai.chat.completions.create({
        model: GPT_MODEL,
        messages: messages,
        tools: tools,
        tool_choice: "auto",
        response_format: {
            type: "json_schema",
            json_schema: {
                name: "Viewpoint",
                strict: true,
                schema: {
                    type: "object",
                    properties: {
                        viewpoint: { type: "string" },
                        refs: {
                            type: "array",
                            items: { type: "number" }
                        }
                    },
                    required: ['viewpoint', 'refs'],
                    additionalProperties: false
                }
            }
        },
        parallel_tool_calls: true
    });

    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;

    if (toolCalls) {
        const availableFunctions = {
            get_analyses_by_ids: ({ ids }) => getAnalysesByIds(ids),
            get_coinprice_week: getCoinPriceWeek,
            get_coinprice_day: getCoinPriceDay
        };

        messages.push(responseMessage);

        for (const toolCall of toolCalls) {
            const functionName = toolCall.function.name;
            const functionToCall = availableFunctions[functionName];
            const functionArgs = JSON.parse(toolCall.function.arguments || "{}");
            const functionResponse = await functionToCall(functionArgs);

            messages.push({
                tool_call_id: toolCall.id,
                role: "tool",
                name: functionName,
                content: functionResponse,
            });
        }

        const secondResponse = await openai.chat.completions.create({
            model: GPT_MODEL,
            messages: messages,
            response_format: {
                type: "json_schema",
                json_schema: {
                    name: "Viewpoint",
                    strict: true,
                    schema: {
                        type: "object",
                        properties: {
                            viewpoint: { type: "string" },
                            refs: {
                                type: "array",
                                items: { type: "number" }
                            }
                        },
                        required: ['viewpoint', 'refs'],
                        additionalProperties: false
                    }
                }
            },
        });

        return secondResponse.choices;
    }

    return response.choices;
}

// async function updateTranslationsForAnalysisIds(analysisIds, forcedCreatedAt) {
//     try {
//         const analyses = await Analysis.findAll({
//             where: {
//                 id: {
//                     [Op.in]: analysisIds
//                 }
//             },
//             raw: true
//         });
//
//         for (const analysis of analyses) {
//             const blockmediaEntry = await Blockmedia.findOne({
//                 where: { id: analysis.id },
//                 raw: true
//             });
//
//             if (!blockmediaEntry) {
//                 continue;
//             }
//
//             console.log(`starting title translation for article DB id: ${blockmediaEntry.id}`);
//
//             const title = await translateText(blockmediaEntry.title, 'English');
//             const content = await translateText(blockmediaEntry.content, 'English');
//             const title_kr = await translateText(blockmediaEntry.title, 'Korean');
//             const content_kr = await translateText(blockmediaEntry.content, 'Korean');
//             const title_jp = await translateText(blockmediaEntry.title, 'Japanese');
//             const content_jp = await translateText(blockmediaEntry.content, 'Japanese');
//             const title_cn = await translateText(blockmediaEntry.title, 'Simplified Chinese');
//             const content_cn = await translateText(blockmediaEntry.content, 'Simplified Chinese');
//             const title_tw = await translateText(blockmediaEntry.title, 'Traditional Chinese');
//             const content_tw = await translateText(blockmediaEntry.content, 'Traditional Chinese');
//             const title_vn = await translateText(blockmediaEntry.title, 'Vietnamese');
//             const content_vn = await translateText(blockmediaEntry.content, 'Vietnamese');
//
//             await Translation.upsert({
//                 id: analysis.id,
//                 title: title,
//                 content: content,
//                 imageUrl: blockmediaEntry.imageUrl,
//                 date: blockmediaEntry.date,
//                 analysis: analysis.analysis,
//                 summary: analysis.summary,
//                 title_kr: title_kr,
//                 title_jp: title_jp,
//                 title_cn: title_cn,
//                 title_tw: title_tw,
//                 title_vn: title_vn,
//                 content_kr: content_kr,
//                 content_jp: content_jp,
//                 content_cn: content_cn,
//                 content_tw: content_tw,
//                 content_vn: content_vn,
//                 createdAt: forcedCreatedAt,
//                 updatedAt: forcedCreatedAt
//             });
//         }
//     } catch (error) {
//         console.error("Error updating translations:", error);
//         throw error;
//     }
// }
async function updateTranslationsForAnalysisIds(analysisIds, forcedCreatedAt) {
    try {
        const analyses = await Analysis.findAll({
            where: {
                id: {
                    [Op.in]: analysisIds
                }
            },
            order: [['createdAt', 'DESC']],
            raw: true
        });

        for (const analysis of analyses) {
            const blockmediaEntry = await Blockmedia.findOne({
                where: { id: analysis.id },
                raw: true
            });

            if (!blockmediaEntry) continue;

            console.log(`Processing id: ${analysis.id}`);

            // 🔹 title 번역
            const title_en = await translateText(blockmediaEntry.title, 'English');
            const title_jp = await translateText(blockmediaEntry.title, 'Japanese');
            const title_kr = await translateText(blockmediaEntry.title, 'Korean');
            const title_vn = await translateText(blockmediaEntry.title, 'Vietnamese');
            const title_cn = await translateText(blockmediaEntry.title, 'Simplified Chinese');

            // 🔹 analysis 번역
            const analysis_jp = await translateText(analysis.analysis, 'Japanese');
            const analysis_kr = await translateText(analysis.analysis, 'Korean');
            const analysis_vn = await translateText(analysis.analysis, 'Vietnamese');
            const analysis_cn = await translateText(analysis.analysis, 'Simplified Chinese');

            // 🔹 summary 번역
            const summary_jp = await translateText(analysis.summary, 'Japanese');
            const summary_kr = await translateText(analysis.summary, 'Korean');
            const summary_vn = await translateText(analysis.summary, 'Vietnamese');
            const summary_cn = await translateText(analysis.summary, 'Simplified Chinese');

            await Translation.upsert({
                id: analysis.id,

                // ✅ title 계열
                title: title_en,
                title_jp,
                title_kr,
                title_vn,
                title_cn,

                // ✅ 원본 데이터
                imageUrl: blockmediaEntry.imageUrl,
                date: blockmediaEntry.date,

                // ✅ analysis 계열
                analysis: analysis.analysis,
                analysis_jp,
                analysis_kr,
                analysis_vn,
                analysis_cn,

                // ✅ summary 계열
                summary: analysis.summary,
                summary_jp,
                summary_kr,
                summary_vn,
                summary_cn,

                createdAt: forcedCreatedAt,
                updatedAt: forcedCreatedAt,

                // 필요하면 유지
                mp3: "",
                mp3_jp: "",
                mp3_kr: "",
                mp3_vn: "",
                mp3_cn: ""
            });
        }
    } catch (error) {
        console.error("Error updating translations:", error);
        throw error;
    }
}
async function updateViewpointTranslationsById(viewpointId, forcedUpdatedAt) {
    try {
        const viewpoint = await Viewpoint.findByPk(viewpointId);

        if (!viewpoint) {
            return null;
        }

        const viewpointJp = await translateText(viewpoint.viewpoint, 'Japanese');
        const viewpointKr = await translateText(viewpoint.viewpoint, 'Korean');
        const viewpointCn = await translateText(viewpoint.viewpoint, 'Simplified Chinese');
        const viewpointTw = await translateText(viewpoint.viewpoint, 'Traditional Chinese');
        const viewpointVn = await translateText(viewpoint.viewpoint, 'Vietnamese');

        await viewpoint.update({
            viewpoint_jp: viewpointJp,
            viewpoint_kr: viewpointKr,
            viewpoint_cn: viewpointCn,
            viewpoint_tw: viewpointTw,
            viewpoint_vn: viewpointVn,
            updatedAt: forcedUpdatedAt,
        });

        return viewpoint;
    } catch (error) {
        console.error("Error updating viewpoint translations:", error);
        throw error;
    }
}

async function performSessionAnalysis(targetDate, period) {
    try {
        const { fixedCreatedAt, viewpointId } = buildSessionInfo(targetDate, period);

        console.log(`[performSessionAnalysis] targetDate=${targetDate}, period=${period}`);
        console.log("fixedCreatedAt:", fixedCreatedAt);
        console.log("viewpointId:", viewpointId);

        console.log("step 1: select final candidates");
        const candidates = await makeCandidatesBySession(targetDate, period);
        console.log("candidates: ", candidates);

        if (!candidates || candidates.length === 0) {
            return `No articles found for ${targetDate}_${period}`;
        }

        console.log("step 2: analyze final candidates");
        const createResult = await runCreateConversation(candidates);
        const rawCreateContent = createResult?.[0]?.message?.content;

        let analyses;

        try {
            const parsed = JSON.parse(extractJson(rawCreateContent));
            analyses = parsed['summaries_and_analyses'];
        } catch (err) {
            console.error("JSON parse error (analysis)", err);
            throw err;
        }

        console.log("created analyses: ", analyses);

        const analysisIds = [];

        for (const analysis of analyses) {
            analysisIds.push(analysis.id);

            await Analysis.upsert({
                id: analysis.id,
                analysis: analysis.analysis,
                summary: analysis.summary,
                createdAt: fixedCreatedAt,
                updatedAt: fixedCreatedAt
            });
        }

        console.log("step 3: create viewpoint");
        const result = await runViewpointConversationByIds(analysisIds);
        const content = result?.[0]?.message?.content;

        let viewpoint;
        let refs;

        try {
            const parsed = JSON.parse(extractJson(content));
            viewpoint = parsed.viewpoint;
            refs = parsed.refs;
        } catch (err) {
            console.error("JSON parse error (viewpoint)");
            throw err;
        }

        console.log("refs: ", refs);

        await Viewpoint.upsert({
            id: viewpointId,
            viewpoint: viewpoint,
            createdAt: fixedCreatedAt,
            updatedAt: fixedCreatedAt
        });

        if (refs && refs.length > 0) {
            await Analysis.update(
                {
                    ref: viewpointId,
                    updatedAt: fixedCreatedAt
                },
                {
                    where: {
                        id: refs
                    }
                }
            );
        }

        console.log("step 4: translate analyses");
        await updateTranslationsForAnalysisIds(analysisIds, fixedCreatedAt);

        console.log("step 5: translate viewpoint");
        await updateViewpointTranslationsById(viewpointId, fixedCreatedAt);

        console.log("complete.");
        return `Successfully created and saved article analysis and viewpoint for ${targetDate}_${period}`;
    } catch (error) {
        console.error("Error during operations: ", error);
        throw new Error(`Error creating articles analysis for ${targetDate}_${period}`);
    }
}
router.get('/', async function(req, res) {
    res.render('create');
});

router.post('/complete', async function(req, res) {
    try {
        const { date, period } = req.body;

        if (!date) {
            return res.status(400).json({
                ok: false,
                error: "date is required. format: YYYY-MM-DD"
            });
        }

        if (!period) {
            return res.status(400).json({
                ok: false,
                error: "period is required. format: AM or PM"
            });
        }

        const result = await performSessionAnalysis(date, period);

        return res.json({
            ok: true,
            result
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

router.get('/articles', async function(req, res) {
    try {
        const { date, period } = req.query;

        if (!date || !period) {
            return res.status(400).json({
                ok: false,
                error: "date and period are required. format: YYYY-MM-DD, period=AM|PM"
            });
        }

        const result = await getArticlesBySession(date, period);

        return res.json(result || []);
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

module.exports = {
    router,
    performTimeRangeAnalysis: performSessionAnalysis,
    getArticlesByDate: getArticlesBySession
};