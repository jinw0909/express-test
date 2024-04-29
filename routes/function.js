var express = require('express');
var router = express.Router();

const axios = require('axios');

const OpenAi = require('openai');
const openai = new OpenAi({
   apiKey : process.env.API_KEY
});

function getCurrentWeather(location, unit="fhrenheit") {
   if (location.toLowerCase().includes("tokyo")) {
      return JSON.stringify({location: "Tokyo", temperature: "10", unit: "celsius"});
   } else if (location.toLowerCase().includes("san francisco")) {
      return JSON.stringify({location: "San Francisco", temperature: "72", unit: "fahrenheit"});
   } else if (location.toLowerCase().includes("paris")) {
      return JSON.stringify({location: "Paris", temperature: "22", unit: "fahrenheit"});
   } else {
      return JSON.stringify({location, temperature: "unknown"});
   }
}

async function runConversation() {
   //Step 1 : send the conversation and available functions to the model
   const messages = [
      { role: "user", content: "What's the weather like in San Francisco, Tokyo, and Paris?"},
   ];
   const tools = [
      {
         type: "function",
         function: {
            name: "get_current_weather",
            description: "Get the current weather in a given location",
            parameters: {
               type: "object",
               properties: {
                  location: {
                     type: "string",
                     description: "The city and state, e.g. San Francisco, CA",
                  },
                  unit: {type: "string", enum: ["celsius", "fahrenheit"]}
               },
               required: ["location"]
            }
         }
      }
   ]

   const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0125",
      messages: messages,
      tools: tools,
      tool_choice : "auto", //auto is default, but we'll be explicit
   });
   const responseMessage = response.choices[0].message;

   // Step 2: check if the model wanted to call a function
   const toolCalls = responseMessage.tool_calls;
   if (responseMessage.tool_calls) {
      // Step3. call the function
      // Note: the JSON response may not always be valid; be sure to handle errors
      const availableFunctions = {
         get_current_weather : getCurrentWeather
      }; //only one function in this example, but you can have multiple
      messages.push(responseMessage); //extend the conversation with assistant's reply
      for (const toolCall of toolCalls) {
         const functionName = toolCall.function.name;
         const functionToCall = availableFunctions[functionName];
         const functionArgs = JSON.parse(toolCall.function.arguments);
         const functionResponse = functionToCall(
             functionArgs.location,
             functionArgs.unit
         );
         messages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: functionResponse,
         }); //extend the conversation with function response
      }

      const secondResponse = await openai.chat.completions.create({
         //model: "gpt-3.5-turbo-0125",
         model: "gpt-4-turbo",
         messages: messages
      });
      return secondResponse.choices;

   }

}

async function getCoinPriceWeek() {
   try {
      const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=7');
      const data = await response.json();
      return data;
   } catch(err) {
      console.error("Error: ", err);
      throw err;
   }

}

async function getCoinPriceDay() {
   try {
      const response = await fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1h&limit=24')
      const data = await response.json();
      return data;
   } catch (err) {
      console.error("Failed to fetch Bitcoin prices (24hr) : ", err);
      return { error: err.message }
   }
}

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
      return data;
   } catch(err) {
      console.error(err);
      return { error: err.message }
   }
}

async function runCoinConversation() {
   //Step 1 : send the conversation and available functions to the model
   const messages = [
      { role: "user",
         content: "Please provide the analysis of the bitcoin price movement within the last seven days and the past 24 hours in bullet points, including key price changes, trends, and significant trading volumes."
      },
   ];
   const tools = [
      {
         type: "function",
         function: {
            name: "get_bitcoin_price_seven",
            description: "Get the bitcoin price of the last seven days",
         }
      },
      {
         type: "function",
         function: {
            name: "get_bitcoin_price_day",
            description: "Returns the Bitcoin price fluctuation within the past 24 hours"
         }
      }
   ]

   const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: messages,
      tools: tools,
      tool_choice : "auto", //auto is default, but we'll be explicit
   });
   const responseMessage = response.choices[0].message;

   // Step 2: check if the model wanted to call a function
   const toolCalls = responseMessage.tool_calls;
   if (responseMessage.tool_calls) {
      // Step3. call the function
      // Note: the JSON response may not always be valid; be sure to handle errors
      const availableFunctions = {
         get_bitcoin_price_seven : getCoinPriceWeek,
         get_bitcoin_price_day: getCoinPriceDay
      }; //only one function in this example, but you can have multiple
      messages.push(responseMessage); //extend the conversation with assistant's reply
      for (const toolCall of toolCalls) {
         const functionName = toolCall.function.name;
         const functionToCall = availableFunctions[functionName];
         const functionArgs = JSON.parse(toolCall.function.arguments || "{}");
         const functionResponse = await functionToCall(
             functionArgs.location,
             functionArgs.unit
         );
         console.log("functionResponse: ", functionResponse);
         if (functionName === "getCoinPriceWeek") {
            messages.push({
               tool_call_id: toolCall.id,
               role: "tool",
               name: functionName + "_description",
               content: "This dataset represents daily candlestick data for Bitcoin (BTC) against the US Dollar (USDT) from the Binance exchange over the last 7 days. Each entry includes open time, open price, high price, low price, close price, volume, close time, quote asset volume, number of trades, taker buy base asset volume, taker buy quote asset volume, and an ignore field. This data helps in analyzing market trends, assessing price volatility, and developing trading strategies."
            })
         }

         if (functionName === "getCoinPriceDay") {
            messages.push({
               tool_call_id: toolCall.id,
               role: "tool",
               name: functionName + "_description",
               content: "This dataset represents daily candlestick data for Bitcoin (BTC) against the US Dollar (USDT) from the Binance exchange over the last 24 hours. Each entry includes open time, open price, high price, low price, close price, volume, close time, quote asset volume, number of trades, taker buy base asset volume, taker buy quote asset volume, and an ignore field. This data helps in analyzing market trends, assessing price volatility, and developing trading strategies."
            })
         }

         messages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: functionResponse.toString(),
         }); //extend the conversation with function response

      }

      const secondResponse = await openai.chat.completions.create({
         model: "gpt-3.5-turbo-0125",
         messages: messages
      });

      //console.log("secondResponse for analysis: ", secondResponse.choices);
      return secondResponse.choices;
   }

}

async function runArticleConversation() {
   //Step 1 : send the conversation and available functions to the model
   const messages = [
      { role: "user",
         content: "Please provide the analysis of the 5 latest news from the cryptocurrency media Blockmedia."
      },
   ];
   const tools = [
      {
         type: "function",
         function: {
            name: "get_latest_article",
            description: "Provides the five latest articles from Blockmedia"
         }
      },
      // {
      //    type: "function",
      //    function: {
      //       name: "get_bitcoin_price_day",
      //       description: "Returns the Bitcoin price fluctuation within the past 24 hours"
      //    }
      // }
   ]

   const response = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: messages,
      tools: tools,
      tool_choice : "auto", //auto is default, but we'll be explicit
   });
   const responseMessage = response.choices[0].message;

   // Step 2: check if the model wanted to call a function
   const toolCalls = responseMessage.tool_calls;
   if (responseMessage.tool_calls) {
      // Step3. call the function
      // Note: the JSON response may not always be valid; be sure to handle errors
      const availableFunctions = {
         get_latest_article : getLatestArticle,
         // get_bitcoin_price_day: getCoinPriceDay
      }; //only one function in this example, but you can have multiple
      messages.push(responseMessage); //extend the conversation with assistant's reply
      for (const toolCall of toolCalls) {
         const functionName = toolCall.function.name;
         console.log("functionName: ", functionName);
         const functionToCall = availableFunctions[functionName];
         const functionArgs = JSON.parse(toolCall.function.arguments || "{}");
         const functionResponse = await functionToCall(
             functionArgs.location,
             functionArgs.unit
         );
         console.log("functionResponse: ", functionResponse);
         // if (functionName === "getCoinPriceWeek") {
         //    messages.push({
         //       tool_call_id: toolCall.id,
         //       role: "tool",
         //       name: functionName + "_description",
         //       content: "This dataset represents daily candlestick data for Bitcoin (BTC) against the US Dollar (USDT) from the Binance exchange over the last 7 days. Each entry includes open time, open price, high price, low price, close price, volume, close time, quote asset volume, number of trades, taker buy base asset volume, taker buy quote asset volume, and an ignore field. This data helps in analyzing market trends, assessing price volatility, and developing trading strategies."
         //    })
         // }
         //
         // if (functionName === "getCoinPriceDay") {
         //    messages.push({
         //       tool_call_id: toolCall.id,
         //       role: "tool",
         //       name: functionName + "_description",
         //       content: "This dataset represents daily candlestick data for Bitcoin (BTC) against the US Dollar (USDT) from the Binance exchange over the last 24 hours. Each entry includes open time, open price, high price, low price, close price, volume, close time, quote asset volume, number of trades, taker buy base asset volume, taker buy quote asset volume, and an ignore field. This data helps in analyzing market trends, assessing price volatility, and developing trading strategies."
         //    })
         // }

         messages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: functionResponse.toString(),
         }); //extend the conversation with function response

      }

      const secondResponse = await openai.chat.completions.create({
         model: "gpt-3.5-turbo-0125",
         messages: messages
      });

      //console.log("secondResponse for analysis: ", secondResponse.choices);
      return secondResponse.choices;
   }

}

router.get('/', function(req, res) {
   res.render('function');
});

router.get('/data', function(req, res) {

   runConversation()
       .then((result) => {
          res.json(result);
       })
       .catch(console.error);
});

router.get('/coin', function(req, res) {
   runCoinConversation()
       .then((result) => {
         res.json(result)
      })
       .catch(console.error);
   // res.json({"analysis": ""});
})

router.get('/article', function(req, res) {
   runArticleConversation()
       .then(result => {
          console.log(result);
          res.json(result);
       })
       .catch(console.error);
})

module.exports = router;