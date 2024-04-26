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
         model: "gpt-3.5-turbo-0125",
         messages: messages
      });
      return secondResponse.choices;

   }

}

function getCoinPrice() {
   fetch('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=7')
       .then(res => res.json())
       .then(data => console.log(data))
       .catch(err => {
          console.error('Error: ', err);
       })
}

async function runCoinConversation() {
   //Step 1 : send the conversation and available functions to the model
   const messages = [
      { role: "user", content: "Give me the analysis of the bitcoin price movement within the last seven days"},
   ];
   const tools = [
      {
         type: "function",
         function: {
            name: "get_bitcoin_price_seven",
            description: "Get the bitcoin price of the last seven days from the Binance crypto exchange",
            parameters: {
               // type: "object",
               // properties: {
               //    location: {
               //       type: "string",
               //       description: "The city and state, e.g. San Francisco, CA",
               //    },
               //    unit: {type: "string", enum: ["celsius", "fahrenheit"]}
               // },
               // required: ["location"]

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
         get_bitcoin_price_seven : getCoinPrice
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
         model: "gpt-3.5-turbo-0125",
         messages: messages
      });
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

router.get('/coin', function(res, req) {
   getCoinPrice();
   // res.json({"analysis": ""});
})

module.exports = router;