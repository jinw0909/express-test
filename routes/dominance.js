var express = require('express');
var router = express.Router();
const axios = require('axios');
const moment = require('moment');
const { Dominance, DominanceAnalysis } = require('../models');
const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey : process.env.API_KEY
});

async function runDominanceConversation() {
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients." },
        { role: "system", content: "The dominance score represents the percentage share of a particular cryptocurrency in the entire cryptocurrency market. For example, if BTC's dominance score is 52, it means that Bitcoin occupies 52% of the total cryptocurrency market size. Additionally, the Goya dominance score is an indicator that can predict the overall upward and downward trends in the cryptocurrency market. If the Goya dominance score is on an upward trend, it can be expected that funds will flow into the coin market in the future. Conversely, if the Goya dominance score is on a downward trend, it can be expected that funds will flow out of the coin market in the future."},
        { role: "user", content: "Analyze the current dominance state of the ten most dominant cryptocurrencies in the context of Bitcoin, Ethereum, and altcoins. The dominance index of the ten most dominant cryptocurrencies of the last seven hours is provided. Additionally, predict how the cryptocurrency market will change in the future based on the Goya dominance score over the past 7 hours. Send out the result in a plain text that can be seamlessly changed into real voice." },
    ]
    const tools = [
        {
            type: "function",
            function: {
                name: "get_dominance_data",
                description: "returns the recent 7 hour's dominance data of the ten crypto currencies and the recent 7 hour's Goya dominance indicator score"
            }
        },
    ]
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: tools,
        tool_choice : "auto", //auto is default, but we'll be explicit
        // response_format: { type: "json_object" }
    });
    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
        const availableFunctions = {
            get_dominance_data: getDominanceData
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
async function getGoyaDominance() {
    try {
        const res = await axios.get('http://15.165.194.33/analysis/dominance?hour=7');
        return res.data;  // Return the data from the response
    } catch (error) {
        console.error(error);
        throw error;  // Rethrow the error if you want to handle it outside this function
    }
}

async function getDominanceData() {
    try {
        const dominanceData = await Dominance.findAll({
            limit: 7,
            order: [['createdAt', 'DESC']]
        })
        const dominanceJSON = JSON.stringify(dominanceData);
        return dominanceJSON;
    } catch (error) {
        console.error('Error fetching dominance data');
        throw error;
    }
}

async function getDominanceAnalysis() {
    try {
        const dominanceAnalysis = await DominanceAnalysis.findOne({
            order : [['createdAt', 'DESC']]
        })
        return dominanceAnalysis;
    } catch (error) {
        console.error('Error fetching dominance analysis');
        throw error;
    }
}

async function fetchGlobalMarketData() {
    const url = 'https://api.coingecko.com/api/v3/global';

    try {
        const response = await axios.get(url);
        return response.data.data;
    } catch (error) {
        console.error('Error fetching global market data:', error);
        return null;
    }
}

async function getRecentAndUpdate() {
    try {
        const analysis = await DominanceAnalysis.findOne({
            order: [['createdAt', 'DESC']]
        })

        if (!analysis) {
            throw new Error('No analysis found');
        }

        const analysisJp = await translateText(analysis.analysis, 'Japanese');
        const analysisKr = await translateText(analysis.analysis, 'Korean');
        const analysisVn = await translateText(analysis.analysis, 'Vietnamese');
        const analysisCn = await translateText(analysis.analysis, 'Chinese');

        // Update the instance with new values
        analysis.analysis_jp = analysisJp;
        analysis.analysis_kr = analysisKr;
        analysis.analysis_vn = analysisVn;
        analysis.analysis_cn = analysisCn;

        // Save the updated instance
        await analysis.save();

        console.log('Analysis updated successfully');
    } catch (error) {
        console.error('Error fetching and updating recent analysis', error);
        throw error;
    }
}

async function fetchDominanceData() {
    const timestamps = Array.from({ length: 7 }, (_, i) => moment().subtract(i, 'hours').unix());

    const dominanceData = await Promise.all(timestamps.map(async (timestamp) => {
        const data = await fetchGlobalMarketData();
        return {
            time: moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss'),
            bitcoin: data.market_cap_percentage.bitcoin,
            ethereum: data.market_cap_percentage.ethereum
        };
    }));

    dominanceData.forEach((data, index) => {
        console.log(`Hour ${index + 1} ago (${data.time}):`);
        console.log(`  Bitcoin Dominance: ${data.bitcoin}%`);
        console.log(`  Ethereum Dominance: ${data.ethereum}%`);
    });
}

// Function to fetch historical market cap data for a given cryptocurrency
// Function to fetch historical market cap data for a given cryptocurrency
async function fetchHistoricalMarketCap(cryptoId, timestamp) {
    const url = `https://api.coingecko.com/api/v3/coins/${cryptoId}/market_chart/range`;
    const params = {
        vs_currency: 'usd',
        from: timestamp - 1800, // 30 minutes before the timestamp to get a range
        to: timestamp + 1800 // 30 minutes after the timestamp to get a range
    };

    try {
        const response = await axios.get(url, { params });
        const data = response.data;
        return data.market_caps[0][1]; // Market cap value closest to the given timestamp
    } catch (error) {
        console.error(`Error fetching market cap for ${cryptoId}:`, error);
        return null;
    }
}

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main function to fetch and calculate historical dominance data
async function fetchHistoricalDominanceData() {
    const timestamps = Array.from({ length: 7 }, (_, i) => moment().subtract(i, 'hours').unix());

    for (const timestamp of timestamps) {
        const timeFormatted = moment.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');

        // Fetch historical market cap for major cryptocurrencies
        const bitcoinMarketCap = await fetchHistoricalMarketCap('bitcoin', timestamp);
        await delay(2000); // Add a delay of 2 seconds between requests
        const ethereumMarketCap = await fetchHistoricalMarketCap('ethereum', timestamp);
        await delay(2000); // Add a delay of 2 seconds between requests

        if (bitcoinMarketCap && ethereumMarketCap) {
            // Sum the market caps to approximate total market cap
            const totalMarketCap = bitcoinMarketCap + ethereumMarketCap;

            // Calculate dominance percentages
            const bitcoinDominance = (bitcoinMarketCap / totalMarketCap) * 100;
            const ethereumDominance = (ethereumMarketCap / totalMarketCap) * 100;

            console.log(`At ${timeFormatted}:`);
            console.log(`  Total Market Cap: $${totalMarketCap.toFixed(2)}`);
            console.log(`  Bitcoin Dominance: ${bitcoinDominance.toFixed(2)}%`);
            console.log(`  Ethereum Dominance: ${ethereumDominance.toFixed(2)}%`);
        } else {
            console.log(`Failed to retrieve market cap data for some cryptocurrencies at ${timeFormatted}.`);
        }
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

async function getRSIanalysis() {
    let res = await axios.get('http://15.165.194.33/analysis/gpt');
    console.log(res.data);
}

router.get('/', async function(req, res, next) {
    try {
        let dominance = await getDominanceData();
        let data = JSON.parse(dominance);
        let analysis = await getDominanceAnalysis();
        console.log("data: ", data);
        let goyaArr = data.map(el => {
            return el.goya_dominance;
        });
        console.log("goyaArr: ", goyaArr);
        let finalDominance = data[data.length - 1].dominance;
        console.log("finalDominance", finalDominance);
        res.render("dominance", {goyDominance : goyaArr, dominance : finalDominance});
    } catch (error) {
        console.error(error);
    }
});

router.post('/create', async function(req, res) {
   try {
        let result = await runDominanceConversation();
        console.log("result: ", result[0].message.content);

        let analysis = await DominanceAnalysis.create({
            analysis: result[0].message.content,
            createdAt: new Date(),
            updatedAt: new Date()
        })
       // Translate the analysis content
       const analysisJp = await translateText(analysis.analysis, 'Japanese');
       const analysisKr = await translateText(analysis.analysis, 'Korean');
       const analysisVn = await translateText(analysis.analysis, 'Vietnamese');
       const analysisCn = await translateText(analysis.analysis, 'Chinese');

       // Update the analysis entry with translated content
       analysis.analysis_jp = analysisJp;
       analysis.analysis_kr = analysisKr;
       analysis.analysis_vn = analysisVn;
       analysis.analysis_cn = analysisCn;

       // Save the updated analysis entry
       await analysis.save();

       res.send('ok');
   } catch (error) {
       console.error(error);
       res.status(500).send('Error creating analysis');
   }
});

router.post('/collect', async function(req, res) {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/global');
        const dominance = response.data.data.market_cap_percentage;
        console.log("dominance: ", dominance);
        const goya = await axios.get('http://15.165.194.33/analysis/dominance?hour=1');
        console.log("goya: ", goya);
        const goyaDominance = goya.data.result[0].dominance;
        console.log("goyaDominance: ", goyaDominance);
        await Dominance.create({
            dominance,
            goya_dominance: goyaDominance
        });
        res.status(200).send('Dominance data collected and inserted successfully.');
        // await fetchHistoricalDominanceData();
    } catch (error) {
        console.error('Error fetching dominance data');
        res.status(500).send('Error fetching dominance data');
    }
})

router.post('/rsi', async function(req, res) {
    try {
        await getRSIanalysis();
        res.send('ok');
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;