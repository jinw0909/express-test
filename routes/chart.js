var express = require('express');
var router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey : process.env.API_KEY
});


const {BitcoinAnalysis, BitcoinPrice} = require('../models');
const AWS = require("aws-sdk");

async function translateText(content, lang) {
    let messages = [
        { role: "system", content: "You are a professional translator capable of translating between English, Japanese, Korean, Vietnamese, and Chinese. You can understand the context of sentences and derive the meanings of words within that context, enabling you to translate accurately and appropriately for English, Japanese, Korean, Vietnamese and Chinese speakers. Additionally, you possess knowledge about cryptocurrencies, Bitcoin, stocks, and finance in general, allowing you to aptly translate articles and analyses related to these topics into the respective languages. You can also naturally translate article headlines or titles into other languages."},
        { role: "user", content: "Please translate the following text into Korean. I only need the translated output, without any additional comments or indicators. Please ensure to apply honorifics when translating into Korean or Japanese. Text: Over the past day, the Goya score has shown significant fluctuations, ranging from 21.3 to 115.2. Recent data indicates a high Goya score of 115.2, suggesting a rise in Bitcoin price is to be expected within the next 24 to 48 hours. The Bitcoin price ranged from $66,789 to $71,249.4 during this period, ending at $71,249.4."},
        { role: "assistant", content: "지난 24시간 동안 고야 스코어는 21.3에서 115.2까지 큰 변동을 보였습니다. 최근 데이터에 따르면 고야 스코어가 115.2로 높게 나타나며, 이는 다음 24시간에서 48시간 이내에 비트코인 가격이 상승할 것으로 예상된다는 것을 시사합니다. 이 기간 동안 비트코인 가격은 66,789달러에서 71,249.4달러 사이에서 변동했으며, 71,249.4달러로 마감했습니다."},
        { role: "user", content: "Please translate the following text into Korean. I only need the translated output, without any additional comments or indicators.Please ensure to apply honorifics when translating into Korean or Japanese. Text: Given the latest surge in the Goya score to 115.2 and the ongoing trends, it's likely that Bitcoin's price will increase to around $72,000 - $74,000 in the next 24 to 48 hours. In the context of a week, we may see prices around $70,000 - $72,000 if the Goya score remains stable or increases slightly. For a month outlook, considering the long-term Goya score, Bitcoin might hover around $70,000 - $75,000 with noted volatility during this time."},
        { role: "assistant", content: "최신 고야 점수가 115.2로 급증한 상황과 현재의 추세를 감안할 때, 비트코인의 가격은 다음 24시간에서 48시간 내에 약 72,000달러에서 74,000달러로 상승할 가능성이 큽니다. 일주일의 관점에서 보면, 고야 점수가 안정적으로 유지되거나 약간 증가하면 가격은 약 70,000달러에서 72,000달러 정도가 될 것입니다. 한 달 전망을 고려하면, 장기 고야 점수를 감안할 때 비트코인은 이 기간 동안 상당한 변동성을 동반하며 약 70,000달러에서 75,000달러 사이를 맴돌 것으로 보입니다."},
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
                Key: `bitcoin${id}_${lang}.mp3`,
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
                    Key: `bitcoin${id}_${lang}.mp3`,
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
async function getAnalysisAndUpdate() {
    try {
        const recentAnalysis = await BitcoinAnalysis.findOne({
            order: [['requestTime', 'DESC']]
        })

        const dayJp = await translateText(recentAnalysis.day, 'Japanese');
        const dayKr = await translateText(recentAnalysis.day, 'Korean');
        const dayVn = await translateText(recentAnalysis.day, 'Vietnamese');
        const dayCn = await translateText(recentAnalysis.day, 'Chinese');

        const weekJp = await translateText(recentAnalysis.week, 'Japanese');
        const weekKr = await translateText(recentAnalysis.week, 'Korean');
        const weekVn = await translateText(recentAnalysis.week, 'Vietnamese');
        const weekCn = await translateText(recentAnalysis.week, 'Chinese');

        const monthJp = await translateText(recentAnalysis.month, 'Japanese');
        const monthKr = await translateText(recentAnalysis.month, 'Korean');
        const monthVn = await translateText(recentAnalysis.month, 'Vietnamese');
        const monthCn = await translateText(recentAnalysis.month, 'Chinese');

        const predictionJp = await translateText(recentAnalysis.prediction, 'Japanese');
        const predictionKr = await translateText(recentAnalysis.prediction, 'Korean');
        const predictionVn = await translateText(recentAnalysis.prediction, 'Vietnamese');
        const predictionCn = await translateText(recentAnalysis.prediction, 'Chinese');

        const combinedText = `${recentAnalysis.day} ${recentAnalysis.week} ${recentAnalysis.month} ${recentAnalysis.prediction}`
        const combinedTextJp = `${dayJp} ${weekJp} ${monthJp} ${predictionJp}`;
        const combinedTextKr = `${dayKr} ${weekKr} ${monthKr} ${predictionKr}`;
        const combinedTextVn = `${dayVn} ${weekVn} ${monthVn} ${predictionVn}`;
        const combinedTextCn = `${dayCn} ${weekCn} ${monthCn} ${predictionCn}`;

        // Generate TTS for each language
        const mp3En = await generateTTS(combinedText, 'English', recentAnalysis.id);
        const mp3Jp = await generateTTS(combinedTextJp, 'Japanese', recentAnalysis.id);
        const mp3Kr = await generateTTS(combinedTextKr, 'Korean', recentAnalysis.id);
        const mp3Vn = await generateTTS(combinedTextVn, 'Vietnamese', recentAnalysis.id);
        const mp3Cn = await generateTTS(combinedTextCn, 'Chinese', recentAnalysis.id);

        const images = await captureChart();

        await recentAnalysis.update({
            day_jp: dayJp,
            day_kr: dayKr,
            day_vn: dayVn,
            day_cn: dayCn,
            week_jp: weekJp,
            week_kr: weekKr,
            week_vn: weekVn,
            week_cn: weekCn,
            month_jp: monthJp,
            month_kr: monthKr,
            month_vn: monthVn,
            month_cn: monthCn,
            prediction_jp: predictionJp,
            prediction_kr: predictionKr,
            prediction_vn: predictionVn,
            prediction_cn: predictionCn,
            mp3: mp3En,
            mp3_jp: mp3Jp,
            mp3_kr: mp3Kr,
            mp3_vn: mp3Vn,
            mp3_cn: mp3Cn,
            daychart_imgUrl: images[0],
            monthchart_imgUrl: images[1]
        });
    } catch (error) {
        console.error(error);
    }
}
async function runAnalysisConversation() {
    const messages = [
        {
            role: "system",
            content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context. You are also capable of deriving the bitcoin market trend by analyzing the bitcoin price movement within a certain period, and capable of deriving the relationship between the trend and real-world events"
        },
        {
            role: "system",
            content: "Through the analysis of the Goya score, you can predict the price of Bitcoin 24 to 48 hours in the future. If the Goya score increases, the price of Bitcoin will rise about 24 to 48 hours later, depending on the rate of increase. Conversely, if the Goya score decreases, the price of Bitcoin will fall after 24 to 48 hours, depending on the rate of decrease. If the price of Bitcoin rises or falls 24 to 48 hours after a rise or fall in the Goya score, it can be considered that the Goya score's prediction was successful.\n" +
                "\n" +
                "You can analyze the fluctuations of the Goya score as well as the actual changes in Bitcoin price within the same period, to calculate the points and instances where the Goya score's predictions were successful.\n" +
                "\n" +
                "Additionally, you can compare and analyze the fluctuations of the Goya score with the actual Bitcoin prices to roughly predict the price of Bitcoin 24 to 48 hours from the current time." +
                "\n" +
                "You can convey your analysis in English, Japanese, Korean, Vietnamese, and Chinese"
        },
        {
            role: "user",
            content: "Analyze the Goya score and the Bitcoin price movement within 24 hours, 7 days, and 30 days. Also tell me what the bitcoin price would be like after one day, one week, and one month based on the Goya score data and your analysis. When you reference a time, the calculations should be made on the current Korean Standard Time as a criteria. the The response should be in a JSON format {'day': 'text', 'week' : 'text', 'month' : 'text', 'prediction' : 'text'} but the items marked as 'text' should be in a plain word for presentation."
        },
    ]
    const tools = [
        {
            type: "function",
            function: {
                name: "get_goyascore_day",
                description: "returns the list of the Goya score and Bitcoin price within the last 24 hours. Each score and price in the array represents the score and price of the hour."
            }
        },
        {
            type: "function",
            function: {
                name: "get_goyascore_week",
                description: "returns the list of the Goya score and Bitcoin price within last 7 days. Each score in the array represents the average score and price of each day."
            }
        },
        {
            type: "function",
            function: {
                name: "get_goyascore_month",
                description: "returns the list of the Goya score and Bitcoin price within last 30 days. Each score in the array represents the average score and price of each day."
            }
        },
        {
            type: "function",
            function: {
                name: "get_month_day_hour",
                description: "returns the current Korean Standard Time in a month, day, and hour format"
            }
        }
    ]
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: tools,
        tool_choice: "auto", //auto is default, but we'll be explicit
        response_format: {type: "json_object"}
    });
    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
        const availableFunctions = {
            get_goyascore_day: getGoyaScoreDay,
            get_goyascore_week: getGoyaScoreWeek,
            get_goyascore_month: getGoyaScoreMonth,
            get_month_day_hour: getMDH
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
async function runChartConversation() {
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context. You are also capable of deriving the bitcoin market trend by analyzing the bitcoin price movement within a certain period, and capable of deriving the relationship between the trend and real-world events" },
        { role: "system", content: "Through the analysis of the Goya score, you can predict the price of Bitcoin 24 to 48 hours in the future. If the Goya score increases, the price of Bitcoin will rise about 24 to 48 hours later, depending on the rate of increase. Conversely, if the Goya score decreases, the price of Bitcoin will fall after 24 to 48 hours, depending on the rate of decrease. If the price of Bitcoin rises or falls 24 to 48 hours after a rise or fall in the Goya score, it can be considered that the Goya score's prediction was successful.\n" +
        "\n" +
        "You can analyze the fluctuations of the Goya score of the past 7 days(168 hours) and the past 24 hours, as well as the actual changes in Bitcoin price within the same period, to calculate the points and instances where the Goya score's predictions were successful.\n" +
        "\n" +
        "Additionally, you can compare and analyze the fluctuations of the Goya score with the actual Bitcoin prices to roughly predict the price of Bitcoin 24 to 48 hours from the current time."},
        { role: "user", content: "Based on the Goya score data within 7 days and within 24 hours, the actual bitcoin price movement data within 7 days and within 24 hours, please tell me some points where the Goya score prediction was highly successful. Also tell me what the bitcoin price would be like after 24 to 48 hours based on the Goya score data and your analysis"},
    ]
    const tools = [
        {
            type: "function",
            function: {
                name: "get_goyascore_day",
                description: "returns the list of the Goya score within last 24 hours. Each score in the array represents the score of the hour."
            }
        },
        {
            type: "function",
            function: {
                name: "get_goyascore_week",
                description: "returns the list of the Goya score within last 7 days. Each score in the array represents the average score of each day."
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
        // response_format: {type: "json_object"}
    });
    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
        const availableFunctions = {
            get_goyascore_week: getGoyaScoreWeek,
            get_goyascore_day: getGoyaScoreDay,
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
            // response_format: {type: "json_object"}
        });

        return secondResponse.choices;
    }
}

async function getMDH() {
    const now = new Date();// Korean Standard Time (KST) is UTC+9
    const options = {
        timeZone: 'Asia/Seoul',
        month: 'long',
        day: 'numeric',
        hour: 'numeric',
        hour12: false
    };
    // Format the date to KST
    const formatter = new Intl.DateTimeFormat('en-US', options);
    const parts = formatter.formatToParts(now);

    // Extract the parts
    let month, day, hour;
    parts.forEach(({ type, value }) => {
        if (type === 'month') month = value;
        if (type === 'day') day = value;
        if (type === 'hour') hour = value;
    });

    // Return the formatted date and time
    let format =  {
        month,
        day: parseInt(day, 10),
        hour: parseInt(hour, 10)
    };
    return JSON.stringify(format);
}

async function getCoinPriceMonth() {
    try {
        const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=30');
        const data = await response.json();
        return JSON.stringify(data, null, 2);
    } catch(err) {
        console.error("Error: ", err);
        throw err;
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

// Function to fetch Bitcoin price data
function extractScorePrice(data) {
    let score = [];
    let price = [];

    for (let key in data) {
        if (data.hasOwnProperty(key) && key !== 'info') {
            score.push(data[key].score);
            price.push(parseFloat(data[key].price))
        }
    }
    let result = {
        score: score,
        price: price
    }
    console.log(result);
    return result;
}

function extractScorePriceWeek(data) {
    let scores = [];
    let prices = [];

    // Collect all scores and prices from the data object
    for (let key in data) {
        if (data.hasOwnProperty(key) && key !== 'info') {
            scores.push(data[key].score);
            prices.push(parseFloat(data[key].price));
        }
    }

    // Function to calculate average of an array
    function calculateAverage(arr) {
        const sum = arr.reduce((acc, val) => acc + val, 0);
        const average = sum / arr.length;
        return parseFloat(average.toFixed(2));
    }

    let avgScores = [];
    let avgPrices = [];

    // Calculate the average for each 24-hour chunk
    for (let i = 0; i < scores.length; i += 24) {
        let scoreChunk = scores.slice(i, i + 24);
        let priceChunk = prices.slice(i, i + 24);

        avgScores.push(calculateAverage(scoreChunk));
        avgPrices.push(calculateAverage(priceChunk));
    }

    let result = {
        score: avgScores,
        price: avgPrices
    };

    console.log(result);
    return result;
}
function extractPrice(data) {
    let result = data.map((elem, index) => {
        return elem[1];
    });
    return result;
}

async function getGoyaScoreDay() {
    const jsonData = await axios.get('https://won.korbot.com/page/predict_chart_api.php?kind=BTCUSDT&ob_number=24');
    const scoreArray = extractScorePrice(jsonData.data);
    console.log("dayArray: ", scoreArray);
    return JSON.stringify(scoreArray);
}
async function getGoyaScoreWeek() {
    const jsonData = await axios.get('https://won.korbot.com/page/predict_chart_api.php?kind=BTCUSDT&ob_number=168');
    const scoreArray = extractScorePriceWeek(jsonData.data);
    console.log("weekArray: ", scoreArray);
    return JSON.stringify(scoreArray);
}

async function getGoyaScoreMonth() {
    const jsonData = await axios.get('https://won.korbot.com/page/predict_chart_api.php?kind=BTCUSDT&ob_number=672');
    const scoreArray = extractScorePriceWeek(jsonData.data);
    console.log("monthArray: ", scoreArray);
    return JSON.stringify(scoreArray);
}

async function getCurrentKST() {
    // Create a new Date object with the current time
    const now = new Date();

    // Convert the current time to KST (UTC+9) using toLocaleString with timeZone option
    const options = { timeZone: 'Asia/Seoul', hour12: false };
    const kstString = now.toLocaleString('en-US', options);

    // Create a new Date object from the KST string
    const kstDate = new Date(kstString);

    // Extract and format the components
    const year = kstDate.getFullYear();
    const month = String(kstDate.getMonth() + 1).padStart(2, '0');
    const date = String(kstDate.getDate()).padStart(2, '0');
    const hour = String(kstDate.getHours()).padStart(2, '0');
    const minute = String(kstDate.getMinutes()).padStart(2, '0');

    // Combine the components into the desired format
    const formattedKST = `${year}-${month}-${date}-${hour}:${minute}`;

    return formattedKST;
}

router.get('/', async function(req, res, next) {
    try {
        const url = "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart";
        const params = {
            vs_currency: "usd",
            days: "30",
            interval: "daily"
        };
        const response = await axios.get(url, { params });
        const prices = response.data.prices;

        // Transform data to separate dates and prices
        const dates = prices.map(item => new Date(item[0]));
        const priceValues = prices.map(item => item[1]);

        const priceDay = await getCoinPriceDay();
        let dayPrice = extractPrice(JSON.parse(priceDay));
        const priceWeek = await getCoinPriceWeek()
        let weekPrice = extractPrice(JSON.parse(priceWeek));
        const priceMonth = await getCoinPriceMonth();
        let monthPrice = extractPrice(JSON.parse(priceMonth));

        const scoreDay = await getGoyaScoreDay();
        let dayScore = JSON.parse(scoreDay);
        const scoreWeek = await getGoyaScoreWeek();
        let weekScore = JSON.parse(scoreWeek);
        const scoreMonth = await getGoyaScoreMonth();
        let monthScore = JSON.parse(scoreMonth);

        const scoreValues = {
            dayPrice: dayPrice,
            weekPrice: weekPrice,
            monthPrice: monthPrice,
            dayScore: dayScore,
            weekScore: weekScore,
            monthScore: monthScore
        }

        console.log("dayPrice: ", dayPrice);
        console.log("weekPrice: ", weekPrice);
        console.log("dayScore: ", dayScore);
        console.log("weekScore: ", weekScore);

        res.render('chart', { dates, priceValues, scoreValues });
    } catch (error) {
        res.status(500).send('Failed to fetch data');
    }
});

async function savePriceToDb(requestTime, period, data) {
    try {
        await BitcoinPrice.create({
            requestTime,
            period,
            score: data.score,
            price: data.price
        })
        console.log(`Data for ${period} saved successfully`);
    } catch (error) {
        console.error(`Failed to save data for ${period}`, error);
    }
}

async function saveAnalysisToDb(dayData, weekData, monthData, predictionText, requestTime) {
    try {
        await BitcoinAnalysis.create({
            requestTime,
            day: dayData,
            week: weekData,
            month: monthData,
            prediction: predictionText
        })
        console.log('Analysis saved successfully');
    } catch (error) {
        console.error('Failed to save analysis: ', error);
        throw error;
    }
}

async function updatePriceWithAnalysisId(analysisId, day, week, month) {
    try {
        if (day) {
            await day.update({ ref: analysisId });
        }
        if (week) {
            await week.update({ ref: analysisId });
        }
        if (month) {
            await month.update({ ref: analysisId });
        }

        console.log('Price updated with analysis ID successfully.');
    } catch (error) {
        console.error('Failed to update price with analysis ID:', error);
        throw error;
    }
}

const parseData = (data) => data.map(value => parseFloat(value));

// Function to get the scale limits
// Function to get the scale limits for each dataset
const getScaleLimits = (data) => {
    const min = Math.min(...data);
    const max = Math.max(...data);
    return { min, max };
};

// Chart configuration function
const createChartConfiguration = (labels, scores, prices, label) => {
    const scoreLimits = getScaleLimits(scores);
    const priceLimits = getScaleLimits(prices);

    return {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: `${label} Scores`,
                    data: parseData(scores),
                    borderColor: 'rgba(75, 192, 192, 1)',
                    borderWidth: 1,
                    yAxisID: 'y-axis-1',
                    fill: false,
                    tension: 0.4 // Add tension for curvy lines
                },
                {
                    label: `${label} Prices`,
                    data: parseData(prices),
                    borderColor: 'rgba(153, 102, 255, 1)',
                    borderWidth: 1,
                    yAxisID: 'y-axis-2',
                    fill: false,
                    tension: 0.4 // Add tension for curvy lines
                }
            ]
        },
        options: {
            scales: {
                'y-axis-1': {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: false,
                    min: scoreLimits.min,
                    max: scoreLimits.max,
                    title: {
                        display: true,
                        text: 'Scores'
                    }
                },
                'y-axis-2': {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: false,
                    min: priceLimits.min,
                    max: priceLimits.max,
                    title: {
                        display: true,
                        text: 'Prices'
                    },
                    grid: {
                        drawOnChartArea: false, // Only want the grid lines for one axis to show up
                    }
                }
            }
        }
    };
};
const saveToS3 = async (buffer, label) => {
    const s3Params = {
        Bucket: 's3bucketjinwoo',
        Key: `charts/${label}-${uuidv4()}.png`,
        Body: buffer,
        ContentType: 'image/png'
    };

    const s3Response = await s3.upload(s3Params).promise();
    console.log("s3Response: ", s3Response.Location);
    return s3Response.Location;
};

const captureChart = async () => {
    try {
        const [day, week, month] = await Promise.all([
            BitcoinPrice.findOne({ where: { period: 'day' }, order: [['requestTime', 'DESC']] }),
            BitcoinPrice.findOne({ where: { period: 'week' }, order: [['requestTime', 'DESC']] }),
            BitcoinPrice.findOne({ where: { period: 'month' }, order: [['requestTime', 'DESC']] })
        ]);
        let data = {
            scoreDay: { score: day.score, price: day.price },
            scoreWeek: { score: week.score, price: week.price },
            scoreMonth: { score: month.score, price: month.price }
        }
        console.log("data: ", data);

        const width = 800;
        const height = 600;
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height});

        const dailyData = {
            labels: Array.from({ length: 24}, (_, i) => i + 1),
            scores: data.scoreDay.score,
            prices: data.scoreDay.price
        }

        const monthlyData = {
            labels: Array.from({ length: 28}, (_, i) => i + 1),
            scores: data.scoreMonth.score,
            prices: data.scoreMonth.price
        }

        const configuration = createChartConfiguration(dailyData.labels, dailyData.scores, dailyData.prices, 'Daily');
        const configurationMonth = createChartConfiguration(monthlyData.labels, monthlyData.scores, monthlyData.prices,'Monthly');
        const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
        const imageBufferMonth = await chartJSNodeCanvas.renderToBuffer(configurationMonth);

        const s3Url = await saveToS3(imageBuffer, 'Daily');
        const s3UrlMonth = await saveToS3(imageBufferMonth, 'Monthly');
        let urls = [s3Url, s3UrlMonth];
        return urls;

    } catch (error) {
        console.error(error);
    }
}

router.get('/goya', async function(req, res) {
    try {
        const response = await runChartConversation();
        console.log("response: ", response);
        const content = response[0].message.content;
        console.log("content: ", content);
        res.send(content);
    } catch (error) {
        console.error(error);
        throw error;
    }
})


// router.get('/time', async function(req, res) {
//     const time = await getCurrentKST();
//     console.log("kstTime: ", time);
//     res.send(time);
// });

router.get('/price', async function(req,res) {
    const scoreDay = await getGoyaScoreDay();
    const scoreWeek = await getGoyaScoreWeek();
    const scoreMonth = await getGoyaScoreMonth();
    let data = {
        scoreDay: scoreDay,
        scoreWeek: scoreWeek,
        scoreMonth: scoreMonth
    }
    // let jsonData = JSON.stringify(data);
    // console.log("jsonData: ", jsonData);
    res.render('price', {data: data});
})

router.get('/analysis', async function(req,res) {
    const result = await runAnalysisConversation();
    console.log("result: ", result);
    const response = result[0].message.content;
    console.log("response: ", response);
    res.send(response);
});

router.get('/analysis-save', async function(req, res) {
    try {
        const [day, week, month] = await Promise.all([
            BitcoinPrice.findOne({ where: { period: 'day' }, order: [['requestTime', 'DESC']] }),
            BitcoinPrice.findOne({ where: { period: 'week' }, order: [['requestTime', 'DESC']] }),
            BitcoinPrice.findOne({ where: { period: 'month' }, order: [['requestTime', 'DESC']] })
        ]);

        console.log("day: ", day, "week: ", week, "month: ", month);
        console.log("day score: ", day.score);
        console.log("day price: ", day.price);
        const result = await runAnalysisConversation();
        const response = JSON.parse(result[0].message.content);

        const analysis = await saveAnalysisToDb(response.day, response.week, response.month, response.prediction);

        await updatePriceWithAnalysisId(analysis.id, day, week, month);

        res.send('Data and prediction saved successfully');

    } catch (error) {
        console.error(error);
    }
})

router.post('/save', async function(req, res) {
    try {
        const requestTime = new Date();
        const [dayResponse, weekResponse, monthResponse] = await Promise.all([
            getGoyaScoreDay(),
            getGoyaScoreWeek(),
            getGoyaScoreMonth()
        ]);

        const dayData = JSON.parse(dayResponse);
        const weekData = JSON.parse(weekResponse);
        const monthData = JSON.parse(monthResponse);

        await savePriceToDb(requestTime, 'day', dayData);
        await savePriceToDb(requestTime, 'week', weekData);
        await savePriceToDb(requestTime, 'month', monthData);

        res.send('Data saved successfully');
    } catch (error) {
        console.error('Failed to fetch and save data:', error);
        res.status(500).send('Failed to fetch and save data');
    }
})

router.post('/price-analysis', async function(req, res) {
    try {
        const requestTime = new Date();
        const [dayResponse, weekResponse, monthResponse] = await Promise.all([
            getGoyaScoreDay(),
            getGoyaScoreWeek(),
            getGoyaScoreMonth()
        ]);
        const dayData = JSON.parse(dayResponse);
        const weekData = JSON.parse(weekResponse);
        const monthData = JSON.parse(monthResponse);

        await savePriceToDb(requestTime, 'day', dayData);
        await savePriceToDb(requestTime, 'week', weekData);
        await savePriceToDb(requestTime, 'month', monthData);

        const result = await runAnalysisConversation();
        const response = JSON.parse(result[0].message.content);

        await saveAnalysisToDb(response.day, response.week, response.month, response.prediction, requestTime);

        await getAnalysisAndUpdate();

        res.redirect('/chart/draw');
    } catch (error) {
        console.error(error);
        throw error;
    }

})

router.get('/draw', async function(req, res) {
   try {

       const lang = req.query.lang || 'en';

       const [day, week, month] = await Promise.all([
           BitcoinPrice.findOne({ where: { period: 'day' }, order: [['requestTime', 'DESC']] }),
           BitcoinPrice.findOne({ where: { period: 'week' }, order: [['requestTime', 'DESC']] }),
           BitcoinPrice.findOne({ where: { period: 'month' }, order: [['requestTime', 'DESC']] })
       ]);
       let data = {
           scoreDay: { score: day.score, price: day.price },
           scoreWeek: { score: week.score, price: week.price },
           scoreMonth: { score: month.score, price: month.price }
       }
       console.log("data: ", data);
       const analysisRaw = await BitcoinAnalysis.findOne({
           order: [['requestTime', 'DESC']]
       })

       const langSuffix = lang === 'en' ? '' : `_${lang}`;
       console.log('langSuffix: ', langSuffix);

       let analysis = {
           time: analysisRaw.requestTime,
           day: analysisRaw[`day${langSuffix}`],
           week: analysisRaw[`week${langSuffix}`],
           month: analysisRaw[`month${langSuffix}`],
           prediction: analysisRaw[`prediction${langSuffix}`],
           mp3: analysisRaw[`mp3${langSuffix}`]
       };

       // let analysis = {
       //     time: analysisRaw.requestTime,
       //     day: analysisRaw.day,
       //     week: analysisRaw.week,
       //     month: analysisRaw.month,
       //     prediction: analysisRaw.prediction
       // }
       console.log("analysis: ", analysis);
       res.render('draw', {data: data, analysis: analysis})
   } catch (error) {
       console.error(error);
   }
});

router.get('/capture', async function(req, res) {
    try {
    //     const [day, week, month] = await Promise.all([
    //         BitcoinPrice.findOne({ where: { period: 'day' }, order: [['requestTime', 'DESC']] }),
    //         BitcoinPrice.findOne({ where: { period: 'week' }, order: [['requestTime', 'DESC']] }),
    //         BitcoinPrice.findOne({ where: { period: 'month' }, order: [['requestTime', 'DESC']] })
    //     ]);
    //     let data = {
    //         scoreDay: { score: day.score, price: day.price },
    //         scoreWeek: { score: week.score, price: week.price },
    //         scoreMonth: { score: month.score, price: month.price }
    //     }
    //     console.log("data: ", data);
    //
    //     const width = 800;
    //     const height = 600;
    //     const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height});
    //
    //     // Configure AWS S3
    //     const s3 = new AWS.S3({
    //         accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    //         secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    //         region: process.env.AWS_REGION
    //     });
    //
    //     const dailyData = {
    //         labels: Array.from({ length: 24}, (_, i) => i + 1),
    //         scores: data.scoreDay.score,
    //         prices: data.scoreDay.price
    //     }
    //
    //     try {
    //         const configuration = createChartConfiguration(dailyData.labels,     dailyData.scores, dailyData.prices, 'Daily');
    //         const imageBuffer = await chartJSNodeCanvas.renderToBuffer(configuration);
    //
    //         const s3Params = {
    //             Bucket: 's3bucketjinwoo',
    //             Key: `charts/daily-${uuidv4()}.png`,
    //             Body: imageBuffer,
    //             ContentType: 'image/png'
    //         };
    //
    //         const s3Url = await saveToS3(imageBuffer, 'Daily');
    //         res.send(`Daily chart saved to S3: ${s3Url}`);
    //     } catch (error) {
    //         console.error(error);
    //         res.status(500).send('An error occurred');
    //     }

        let urls = await captureChart();
        res.send(`Chart images saved to S3', ${urls}`);
    } catch (error) {
        console.error(error);
    }
})

router.get('/construct', async function(req, res) {
    try {
        await getAnalysisAndUpdate();
        res.send('ok');
    } catch (error) {
        console.error(error);
    }

});

router.get('/time', async function(req,res) {
    const time = await getMDH();
    console.log("time: ", time);
    res.send('ok');
})

module.exports = router;