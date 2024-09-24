var express = require('express');
var router = express.Router();

const axios = require('axios');

const OpenAi = require('openai');
const openai = new OpenAi({
   apiKey : process.env.API_KEY
});

const { Blockmedia, Analysis, Candidate } = require('../models');
const { Sequelize } = require("sequelize");
const { Op } = require('sequelize');

function getCurrentWeather(location, unit="fehrenheit") {
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

async function runCandidateConversation(articles) {
   const messages = [
      { role: "system", content: "Article List: " + JSON.stringify(articles) + ". You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context." },
      { role: "user", content: "From the given articles, select four articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement, return the selected articles in a json format as following. {'candidates' : [{'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}]. Don't improvise the 'id' and search from the given article list's id. It is very important that you return the exact 'id' that matches with the id of the article. 'summary' should be the brief summary of the article content in english and 'reason' should be the reason why the article was selected as a candidate, in english." },
   ];
   const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      response_format: { type: "json_object" }
   });

   const responseMessage = response.choices[0].message;
   const parsed = JSON.parse(responseMessage.content);
   console.log("parsed: ", parsed);
   return parsed['candidates'];
}

async function runFinalConversation(candidates) {
   const messages = [
      { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context." },
      { role: "user", content: "Candidate List: " + JSON.stringify(candidates) + ". From the provided candidates select and return the four candidates that is the most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement. The 'reason' is explaining why the article was selected as a candidate. Return the four candidates in a json format as following. {'finals' : [{'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}, {'id': 'integer', 'summary' : 'text', 'reason' : 'text'}] . Also Don't improvise the 'id', 'summary', 'reason' and find them from the given candidate list." },
   ];
   const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages,
      response_format: { type: "json_object" }
   });

   const responseMessage = response.choices[0].message;
   console.log("responseMessage: ", responseMessage);
   const finals = JSON.parse(responseMessage.content)['finals'];
   return finals;
}

async function getArticlesDay() {
   try {
      //Calculate the datetime 24 hours ago
      const yesterday = new Date(new Date() - 24 * 60 * 60 * 1000);
      const articles = await Blockmedia.findAll({
         where: {
            createdAt: {
               [Sequelize.Op.gte]: yesterday
            }
         },
      })
      if (!articles.length) {
         console.log('No articles published in the last 24 hours');
         return null;
      }

      console.log("Article data: ", articles);
      return articles;
   } catch(err) {
      console.error(err);
      return { error: err.message }
   }
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

         messages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: functionResponse,
         }); //extend the conversation with function response

      }

      const secondResponse = await openai.chat.completions.create({
         model: "gpt-4o",
         messages: messages
      });

      //console.log("secondResponse for analysis: ", secondResponse.choices);
      return secondResponse.choices;
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

async function runArticleConversation() {
   //Step 1 : send the conversation and available functions to the model
   const messages = [
      {
         role: "user",
         content: "Please provide the analysis of the 5 latest news from the cryptocurrency media Blockmedia. If you are hesitant because it is paid content, please use the data I provided using function call."
      }
   ];
   const tools = [
      {
         type: "function",
         function: {
            name: "get_latest_article",
            description: "This function retrieves the 5 latest articles from Blockmedia, a cryptocurrency press outlet. The return data includes structured information about the article, such as its index, title, content, publication date, and the image URL associated with it."
         }
      },
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
         // console.log("functionResponse: ", functionResponse);
         // console.log("functionResponse type: ", typeof functionResponse);

         messages.push({
            tool_call_id: toolCall.id,
            role: "tool",
            name: functionName,
            content: functionResponse
         }); //extend the conversation with function response

      }

      const secondResponse = await openai.chat.completions.create({
         model: "gpt-4-turbo",
         messages: messages
      });

      //console.log("secondResponse for analysis: ", secondResponse.choices);
      return secondResponse.choices;
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

// async function runRelevantConversation() {
//    //Step 1 : send the conversation and available functions to the model
//    const messages = [
//       { role: "user", content: "From the articles of Blockmedia within the past 24 hours, give me five articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency market trend"},
//    ];
//    const tools = [
//       {
//          type: "function",
//          function: {
//             name: "get_blockmedia_articles_24",
//             description: "returns the list of all the articles published by Blockmedia within 24 hours in a JSON format",
//          }
//       }
//    ]
//
//    const response = await openai.chat.completions.create({
//       model: "gpt-4-turbo",
//       messages: messages,
//       tools: tools,
//       tool_choice : "auto", //auto is default, but we'll be explicit
//    });
//    const responseMessage = response.choices[0].message;
//
//    // Step 2: check if the model wanted to call a function
//    const toolCalls = responseMessage.tool_calls;
//    if (responseMessage.tool_calls) {
//       // Step3. call the function
//       // Note: the JSON response may not always be valid; be sure to handle errors
//       const availableFunctions = {
//          get_blockmedia_articles_24 : get24articles
//       }; //only one function in this example, but you can have multiple
//       messages.push(responseMessage); //extend the conversation with assistant's reply
//       for (const toolCall of toolCalls) {
//          const functionName = toolCall.function.name;
//          console.log("functionName: ", functionName);
//          const functionToCall = availableFunctions[functionName];
//          const functionArgs = JSON.parse(toolCall.function.arguments || '{}');
//          const functionResponse = await functionToCall(
//              functionArgs.location,
//              functionArgs.unit
//          );
//          console.log("functionResponse: ", functionResponse);
//          messages.push({
//             tool_call_id: toolCall.id,
//             role: "tool",
//             name: functionName,
//             content: functionResponse,
//          }); //extend the conversation with function response
//       }
//
//       const secondResponse = await openai.chat.completions.create({
//          //model: "gpt-3.5-turbo-0125",
//          model: "gpt-4-turbo",
//          messages: messages
//       });
//       return secondResponse.choices;
//    }
//
// }

async function get24articles() {
   try {
      //Calculate the datetime 24 hours ago
      const yesterday = new Date(new Date() - 24 * 60 * 60 * 1000);
      const articles = await Blockmedia.findAll({
         where: {
            createdAt: {
               [Sequelize.Op.gte]: yesterday
            }
         },
         limit: 20
      })
      if (!articles.length) {
         console.log('No articles published in the last 24 hours');
         return JSON.stringify([]);
      }
      // Transform the Sequelize instances to plain objects with only the desired properties
      // const transformedArticles = articles.map(article => ({
      //    id: article.id,
      //    title: article.title,
      //    content: article.content
      // }));
      // Check if the response was successful
      // console.log("Transformed Article data: ", transformedArticles);
      console.log("Article data: ", articles);
      // const data = await response.json();
      // return JSON.stringify(transformedArticles, null, 2);
      return JSON.stringify(articles, null, 2);
   } catch(err) {
      console.error(err);
      return { error: err.message }
   }
}

// async function get24articles() {
//    try {
//       const pageSize = 8; // Number of articles per page
//       let currentPage = 1;
//       let articles = [];
//       let fetchedArticles;
//
//       // Calculate the datetime 24 hours ago
//       const yesterday = new Date(new Date() - 24 * 60 * 60 * 1000);
//
//       // Fetch articles in pages until there are no more articles left to fetch
//       do {
//          // Fetch articles for the current page with pagination options
//          fetchedArticles = await Blockmedia.findAll({
//             where: {
//                createdAt: {
//                   [Sequelize.Op.gte]: yesterday
//                }
//             },
//             order: [['createdAt', 'DESC']], // Order by createdAt in descending order
//             limit: pageSize, // Limit the number of results per page
//             offset: (currentPage - 1) * pageSize // Apply the offset to paginate the results
//          });
//
//          // If there are fetched articles, push them into the articles array
//          if (fetchedArticles.length > 0) {
//             articles.push(fetchedArticles);
//          }
//
//          // Increment the currentPage counter for the next iteration
//          currentPage++;
//       } while (fetchedArticles.length === pageSize); // Continue until the number of fetched articles is less than the pageSize
//
//       console.log("Article data: ", articles);
//       return JSON.stringify(articles, null, 2);
//    } catch(err) {
//       console.error(err);
//       return { error: err.message }
//    }
// }
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
      { role: "user", content: `${JSON.stringify(candidates)} /// This is a  data which shows the selected candidate article's id, a brief summary, and the reason for its selection, Give me a detailed and profound summary and analysis for each article, on the context with the reason for its selection. The analysis has to be at least ten sentences and the summary has to be at least six sentences. The response should be formatted as a JSON [{id : integer, analysis: text, summary: text}] with key named "summaries_and_analyses" so I can save each summary and analysis in a local database with much ease. Don't improvise the id of the created Analysis and be sure that the id, analysis, and summary matches the provided article.`}
   ];
   const tools = [
      {
         type: "function",
         function: {
            name: "get_candidate_articles",
            description: "Get selected candidate articles based on their IDs, from all of the articles published within 24 hours",
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
      response_format: { type: "json_object" }
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
         limit: 5
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
         limit: 5
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
});

// router.get('/relevant', function(req, res) {
//    runRelevantConversation()
//        .then(result => {
//           console.log(result);
//           res.json(result);
//        })
//        .catch(console.error)
// });

router.get('/recent', async function(req, res) {
  await getRecent()
       .then(result => {
          console.log(result);
          res.json(result);
       })
       .catch(console.error);
});

router.get('/index', async function(req, res) {
   try {
      const result = await runIndexConversation();
      console.log("result: ", result);
      res.json(result[0].message.content);
   } catch (error) {
      console.error(error);
   }
});

router.post('/index', async function(req, res) {
   const candidates = req.body.data;
   console.log('Received candidates: ', candidates);

   try {
      const result = await runCreateConversation(candidates);
      console.log(result);
      const content = result[0].message.content;
      const articles = JSON.parse(content).summaries_and_analyses;
      console.log("articles: ", articles);
      // const articles = JSON.parse((result[0].message.content).replace(/```json|```|\n/g, ''));

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

      const recentAnalyses = await getRecent(); // Fetch recent analyses
      res.json(recentAnalyses); // Send response with recent analyses
   } catch (error) {
      console.error(error);
      res.send("An error occurred");
   }
});

router.get('/complete', async function(req, res) {
   try {
      // First, run runIndexConversation to get the indexes
      // const indexResult = await runIndexConversation();
      // console.log("indexResult: ", indexResult);
      // const candidates = JSON.parse(indexResult[0].message['content'])['selected_articles'];
      // console.log("step 1: candidates: ", candidates);

      // First select five most recent candidates

      const recentCandidates = await Candidate.findAll({
         order: [['createdAt', 'DESC']],
         limit: 4
      });

      const candidates = recentCandidates.map(candidate => ({
         id: candidate.articleId,
         summary: candidate.summary,
         reason: candidate.reason
      }))

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

      res.status(200).send('ok');
   } catch (error) {
      console.error("Error during operations: ", error);
      res.status(500).send("An error occurred");
   }

});

router.get('/candidates', async function(req,res) {
   const result = await createCandidates();
   console.log("result: ", result);
   res.send('ok');
});

router.get('/finals', async function(req, res) {
   const result = await createCandidates();
   const finals = await recurseFinals(result);
   console.log("finals: ", finals);

   for (const candidate of finals) {
      await Candidate.create({
         articleId: candidate.id,
         summary: candidate.summary,
         reason: candidate.reason,
         createdAt: new Date()
      });
   }
   res.send('ok');
})

module.exports = router;