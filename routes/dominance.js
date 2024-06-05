var express = require('express');
var router = express.Router();
const axios = require('axios');
const moment = require('moment');
const { Dominance } = require('../models');
const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey : process.env.API_KEY
});

async function runDominanceConversation() {
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients." },
        { role: "user", content: "Give me your interpretation of the provided dominance data of the entire cryptocurrency market in a json format." },
        { role: "assistant", content: '{\n' +
                '  "total_market_cap": {\n' +
                '    "btc": 39191815.55022334,\n' +
                '    "eth": 714276833.4416517,\n' +
                '    "usd": 2667932192921.822\n' +
                '  },\n' +
                '  "dominance": {\n' +
                '    "btc": 50.28,\n' +
                '    "eth": 16.82,\n' +
                '    "usdt": 4.19,\n' +
                '    "bnb": 3.41,\n' +
                '    "sol": 2.87,\n' +
                '    "additional_data": {\n' +
                '      "steth": 1.33,\n' +
                '      "usdc": 1.21,\n' +
                '      "xrp": 1.08,\n' +
                '      "doge": 0.86,\n' +
                '      "ada": 0.59\n' +
                '    }\n' +
                '  },\n' +
                '  "market_updates": {\n' +
                '    "recent_cap_change_percentage": 0.37,\n' +
                '    "updated_at": 1717147191\n' +
                '  },\n' +
                '  "cryptocurrency_activity": {\n' +
                '    "active_cryptocurrencies": 14605,\n' +
                '    "ongoing_icos": 49,\n' +
                '    "ended_icos": 3376,\n' +
                '    "markets": 1108\n' +
                '  },\n' +
                '  "total_volume": {\n' +
                '    "btc": 1148648.0497874245,\n' +
                '    "eth": 20934286.412164304,\n' +
                '    "usd": 78192731501.24002\n' +
                '  }\n' +
                '}\n'},
        { role: "user", content: "Give me your interpretation of the provided dominance data of the entire cryptocurrency market in a json format like the following. '{\n" +
                "  \"interpretation\": {\n" +
                "    \"total_market_cap\": {\n" +
                "      \"btc\": \"number\",\n" +
                "      \"eth\": \"number\",\n" +
                "      \"usd\": \"number\"\n" +
                "    },\n" +
                "    \"dominance\": {\n" +
                "      \"btc\": \"number\",\n" +
                "      \"eth\": \"number\",\n" +
                "      \"usdt\": \"number\",\n" +
                "      \"bnb\": \"number\",\n" +
                "      \"sol\": \"number\",\n" +
                "      \"additional_data\": {\n" +
                "        \"steth\": \"number\",\n" +
                "        \"usdc\": \"number\",\n" +
                "        \"xrp\": \"number\",\n" +
                "        \"doge\": \"number\",\n" +
                "        \"ada\": \"number\"\n" +
                "      }\n" +
                "    },\n" +
                "    \"market_updates\": {\n" +
                "      \"recent_cap_change_percentage\": \"number\",\n" +
                "      \"updated_at\": \"timestamp\"\n" +
                "    },\n" +
                "    \"cryptocurrency_activity\": {\n" +
                "      \"active_cryptocurrencies\": \"number\",\n" +
                "      \"ongoing_icos\": \"number\",\n" +
                "      \"ended_icos\": \"number\",\n" +
                "      \"markets\": \"number\"\n" +
                "    },\n" +
                "    \"total_volume\": {\n" +
                "      \"btc\": \"number\",\n" +
                "      \"eth\": \"number\",\n" +
                "      \"usd\": \"number\"\n" +
                "    }\n" +
                "  },\n" +
                "  \"analysis\": {\n" +
                "    \"Overall Market Cap\": \"string\",\n" +
                "    \"Market Dominance\": \"string\",\n" +
                "    \"Market Activity\": \"string\",\n" +
                "    \"Volume and Liquidity\": \"string\",\n" +
                "    \"Recent Changes\": \"string\",\n" +
                "    \"Additional Dominance Insights\": \"string\"\n" +
                "  }\n" +
                "}\n'" },
    ]
    const tools = [
        {
            type: "function",
            function: {
                name: "get_dominance_data",
                description: "returns the current dominance data of the entire cryptocurrency market."
            }
        },
        {
            type: "function",
            function: {
                name: "get_goya_dominance",
                description: "returns the Goya Dominance data."
            }
        },
    ]
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        tools: tools,
        tool_choice : "auto", //auto is default, but we'll be explicit
        response_format: { type: "json_object" }
    });
    const responseMessage = response.choices[0].message;
    const toolCalls = responseMessage.tool_calls;
    if (responseMessage.tool_calls) {
        const availableFunctions = {
            get_dominance_data: getDominanceData,
            get_goya_dominance : getGoyaDominance,
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
        const response = await axios.get('https://api.coingecko.com/api/v3/global');
        const dominance = response.data.data;
        return JSON.stringify(dominance);
    } catch (error) {
        console.error('Error fetching dominance data');
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

async function getRSIanalysis() {
    let res = await axios.get('http://15.165.194.33/analysis/gpt');
    console.log(res.data);
}

router.get('/', async function(req, res, next) {
    try {
        let dominance = await getGoyaDominance();
        console.log("dominance: ", dominance);
        let jsonDominance = JSON.stringify(dominance);
        let response = await runDominanceConversation();
        console.log("response: ", response);
        let data = JSON.parse(response[0].message.content);
        console.log("data: ", data);
        res.render("dominance",  {data: data});
    } catch (error) {
        console.error(error);
    }
});

router.get('/collect', async function(req, res) {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/global');
        const dominance = response.data.data.market_cap_percentage;
        console.log("dominance: ", dominance);
        await Dominance.create({ dominance });
        res.status(200).send('Dominance data collected and inserted successfully.');
        // await fetchHistoricalDominanceData();
    } catch (error) {
        console.error('Error fetching dominance data');
        res.status(500).send('Error fetching dominance data');
    }
})

router.get('/rsi', async function(req, res) {
    try {
        await getRSIanalysis();
        res.send('ok');
    } catch (error) {
        console.error(error);
    }
})

module.exports = router;