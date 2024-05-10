var express = require('express');
var router = express.Router();

const axios = require('axios');

const OpenAi = require('openai');
const openai = new OpenAi({
   apiKey : process.env.API_KEY
});

const Blockmedia = require('../blockmedia');
const Analysis = require('../analysis');
const { Sequelize } = require("sequelize");
const { Op } = require('sequelize');

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
         model: "gpt-3.5-turbo-0125",
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

async function runRelevantConversation() {
   //Step 1 : send the conversation and available functions to the model
   const messages = [
      { role: "user", content: "From the articles of Blockmedia within the past 24 hours, give me five articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency market trend"},
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
         model: "gpt-4-turbo",
         messages: messages
      });
      return secondResponse.choices;
   }

}

async function get24articles() {
   try {
      //Calculate the datetime 24 hours ago
      const yesterday = new Date(new Date() - 24 * 60 * 60 * 1000);
      const articles = await Blockmedia.findAll({
         where: {
            createdAt: {
               [Sequelize.Op.gte]: yesterday
            }
         }
      })
      if (!articles.length) {
         console.log('No articles published in the last 24 hours');
         return JSON.stringify([]);
      }
      // Check if the response was successful
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
      { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context. "},
      { role: "user", content: "From the articles of Blockmedia within the past 24 hours, select five articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement, and give me each article's id and the reason for its selection in a json format. Don't improvise the id and search from the provided function call result. I need only the formatted string without any comments or format indicators"},
      // { role: "function", name: "get_blockmedia_articles_24"},
      { role: "assistant", content: `[{"id": 523806, "reason": "This article discusses BNP Paribas' investment in a Bitcoin spot ETF managed by BlackRock, marking a significant entry by one of Europe's largest banks into the cryptocurrency space. The move reflects growing institutional interest in cryptocurrencies, which can be a bullish indicator for the market."}, {"id": 524335, "reason" : "Coinbase, a major cryptocurrency exchange in the U.S., reported a substantial increase in revenue and profits due to the surge in Bitcoin prices. This reflects heightened trading activity and could signify ongoing interest and investment in the cryptocurrency from both retail and institutional investors."}, {"id": 523502, "reason": "The delay in expected rate cuts by the Federal Reserve could have implications for the cryptocurrency market. Typically, lower interest rates can lead to higher investments in risk assets like cryptocurrencies, so any delays can affect market sentiment and investment flows."}, {"id": 523654, "reason": "Although Fed Chair Jerome Powell indicated that an immediate rate hike isn't forthcoming, the ongoing concerns about inflation and economic overheating can create a volatile environment for cryptocurrencies, as investors might reassess risk assets."}, {"id": 523725, "reason": "This article covers how Bitcoin adoption in El Salvador and other Latin American countries is influencing the regional economy and sparking a widespread interest in cryptocurrencies. The regional adoption can play a crucial role in highlighting the utility and acceptance of cryptocurrencies on a broader scale. These articles provide insights into regulatory movements, economic conditions, and significant market activities that are crucial for understanding the current trends and future movements of the cryptocurrency market."}]`},
      { role: "user", content: "From the articles of Blockmedia within the past 24 hours, select five articles that is most relevant with the movement of the cryptocurrency market and that is helpful to predict the cryptocurrency movement, and give me each article's id and the reason for its selection in a json format. Don't improvise the id and search from the provided function call result. I need only the formatted string without any comments or format indicators"},
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
         model: "gpt-4-turbo",
         messages: messages
      });
      return secondResponse.choices;
   }

}

async function runCreateConversation(candidates) {
   //Step 1 : send the conversation and available functions to the model
   const messages = [
      { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context."},
      // { role: "user", content: `[{ "id": 523806, "reason": "This article details BNP Paribas' investment in a Bitcoin spot ETF managed by BlackRock, marking a noteworthy development of cryptocurrency adoption by major European banks. Interest from leading financial institutions can significantly influence market confidence and investment flows into Bitcoin and other cryptocurrencies." }, { "id": 523694, "reason": "Discussing the Federal Reserve's potential rate decisions, this article outlines the tension between rate hikes and inflation pressures. As cryptocurrencies often react to macroeconomic indicators, insights on inflation and rate changes can impact predictions on cryptocurrency volatility and investor behavior." }, { "id": 523725, "reason": "This article highlights Bitcoin's significant impact on the economy of El Salvador and its ripple effects across Latin America. Understanding regional adoption trends can assist in analyzing the broader acceptance and integration of cryptocurrencies into emerging markets." }, { "id": 524335, "reason": "Coinbase's financial performance, reflecting higher revenue and profits due to Bitcoin's price surge, indicates robust trading activity and market enthusiasm. This data can be pivotal for projecting future market trends and investor sentiment in cryptocurrencies." }, { "id": 524280, "reason": "Though not directly about cryptocurrencies, this article discusses economic indicators and movements in traditional financial markets, such as stock indices and forex changes, which can have correlative impacts on the cryptocurrency market. Understanding these dynamics is essential for comprehensive market analysis." } ] /// This is a  data which shows the selected candidate article's id, and the reason for its selection, among all of the Blockmedia articles published within 24 hours. What i want you to do is give me a detailed and profound summary and analysis for each article, on the context with the reason for its selection. The analysis has to be at least eight sentences or more and the summary has to be at least four sentences or more. The response should be formatted as a javascript object [{id : integer, analysis: text, summary: text}] so I can save each summary and analysis in a local database with much ease. I need only the formatted string without any comments or format indicators`},
      // { role: "assistant", content: '[{"id": 523806, "analysis": "The investment of BNP Paribas in BlackRock\'s Bitcoin spot ETF signifies a substantial move towards cryptocurrency acceptance by major European banks. This event signals broader institutional trust in cryptocurrencies, potentially leading to increased investor confidence and broader market acceptance. BNP\'s decision, although involving a relatively modest sum, reflects a growing interest from traditional financial institutions in the digital asset space. The involvement of other prominent banks like Citigroup and Royal Bank of Canada in similar investments reinforces the trend towards mainstream financial entities embracing cryptocurrencies. This development could indicate a shift in how traditional investment vehicles perceive the stability and potential of cryptocurrencies. It might also influence regulatory stances in the future, as more conventional banks integrate digital assets into their portfolios.", "summary": "BNP Paribas has confirmed its investment in a Bitcoin spot ETF managed by BlackRock, which symbolizes increasing acceptance of cryptocurrencies among major European banks. Other major institutions are also investing in similar products, illustrating a broader trend of traditional financial acceptance. This development could enhance investor confidence and impact the regulatory landscape for cryptocurrencies."}, {"id": 523694, "analysis": "Jerome Powell\'s remarks on maintaining the current interest rates unless inflation pressures worsen highlights key factors affecting the cryptocurrency markets. Cryptocurrencies are sensitive to macroeconomic indicators such as interest rates and inflation, which influence investor behavior and market volatility. In scenarios where traditional financial policies tighten due to inflation, cryptocurrencies might be viewed as alternative investments. However, stable or increasing rates could also deter investments in riskier assets like cryptocurrencies. Powell\'s cautious stance reflects ongoing uncertainties in the economic environment, which can lead to increased market volatility, impacting cryptocurrencies indirectly through shifts in investor sentiment and risk appetite.", "summary": "Federal Reserve Chair Jerome Powell indicated that the Fed is not planning to raise interest rates soon, but may reconsider if inflation remains uncontrolled. This decision influences traditional financial markets and can indirectly affect cryptocurrencies. Powell\'s statements cause market participants to vigilantly monitor the inflation indices, impacting investment strategies including those related to cryptocurrencies."},{"id": 523725, "analysis": "El Salvador\'s adoption of Bitcoin as a legal tender and the resultant economic ripple effects across Latin America signify a pivotal experiment in the integration of cryptocurrencies into a national economy. This bold move by El Salvador has inspired similar interests from other Latin American countries, potentially paving the way for broader regional adoption. The success or failure of this experiment can provide valuable insights into the practical challenges and benefits of widespread cryptocurrency utilization. It also tests the resilience and stability of cryptocurrencies under intense economic pressures and varied regulatory environments. This scenario further illustrates the transformative potential of digital currencies in reshaping economic landscapes, particularly in regions characterized by volatile national currencies and financial instability.", "summary": "El Salvador has risked its economic strategy on the success of Bitcoin, which has also influenced other countries in Latin America. The nation experienced considerable financial outcomes from its Bitcoin investments, reflecting the significant impact cryptocurrencies can have on national economies. Observing El Salvador\'s example, other countries in the region are exploring similar paths, potentially leading to widespread regional adoption of cryptocurrencies."},{"id": 524335, "analysis": "Coinbase\'s reported surge in revenue and profits during a bullish phase for Bitcoin illustrates the high volatility and reward potential inherent in the cryptocurrency market. Their financial performance is a testament to the growing mainstream acceptance of cryptocurrencies and the viability of trading platforms in the fintech sector. The significant increase in trading volume due to rising Bitcoin prices demonstrates the dynamic nature of the crypto market, wherein price movements can dramatically affect trading behaviors and platform revenues. This report can guide potential investors about the current market sentiments and expectations, possibly leading to informed investment decisions. Furthermore, the economic indication of such results from a major player like Coinbase could lead to increased confidence among minor investors and possibly attract new users to the cryptocurrency space.", "summary": "Coinbase Global has announced better-than-expected financial results for the first quarter, driven by a significant increase in Bitcoin prices and trading activity. This performance highlights the platform\'s robust position in the cryptocurrency market and its ability to capitalize on market trends. These results are crucial indicators of both the growing acceptance of cryptocurrencies and the potential for lucrative operations within the cryptocurrency exchanges."},{"id": 524280, "analysis": "The movement in traditional financial markets such as stocks indices and foreign exchange rates can often have correlating impacts on the cryptocurrency market. As seen with the increase in the KOSPI and the decrease in the USD/KRW exchange rate, these traditional market indicators can signal broader economic trends that also affect investor sentiment towards cryptocurrencies. Understanding these correlations is crucial for cryptocurrency investors to anticipate potential market movements and manage risks more effectively. Given the increasing integration of cryptocurrency in broader financial systems, such fluctuations in traditional markets may offer predictive insights into corresponding shifts in the cryptocurrency market, potentially aiding in strategic investment planning.", "summary": "The article reports on the opening figures for KOSPI, KOSDAQ, and the USD/KRW exchange rate. Movements in these traditional financial market indicators are crucial as they can also impact the cryptocurrency market by influencing general investor sentiment and economic conditions. Monitoring these indicators provides valuable insights for managing investments in cryptocurrencies."}]'},
      { role: "user", content: `${JSON.stringify(candidates)} /// This is a  data which shows the selected candidate article's id, and the reason for its selection, among all of the Blockmedia articles published within 24 hours. What i want you to do is give me a detailed and profound summary and analysis for each article, on the context with the reason for its selection. The analysis has to be at eight to ten sentences and the summary has to be at four to five sentences. The response should be formatted as a javascript object [{id : integer, analysis: text, summary: text}] so I can save each summary and analysis in a local database with much ease. I need only the formatted string without any comments or markdown syntax`}
   ];
   const tools = [
      {
         type: "function",
         function: {
            name: "get_candidate_articles",
            description: "Get selected candidate articles based on their IDs from articles published within 24 hours in Blockmedia",
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
         model: "gpt-4-turbo",
         messages: messages
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
         limit: 10
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

router.get('/relevant', function(req, res) {
   runRelevantConversation()
       .then(result => {
          console.log(result);
          res.json(result);
       })
       .catch(console.error)
});

router.get('/index', function(req, res) {
   runIndexConversation()
       .then(result => {
          console.log(result);
          res.json(result);
       })
       .catch(console.error);
});

// router.post('/index', async function(req, res) {
//    const candidates = req.body.data;
//    console.log('Received candidates: ', candidates);
//
//    try {
//       const result = await runCreateConversation(candidates);
//       console.log(result);
//       console.log("content: ", result[0].message.content);
//       const articles = JSON.parse(result[0].message.content);
//       console.log("articles: ", articles);
//       for (const article of articles) { // Use a loop that supports await
//          try {
//             const [model, created] = await Analysis.findOrCreate({
//                where: { id: article.id },
//                defaults: {
//                   id: article.id,
//                   createdAt: new Date(),
//                   date: 'Default Time',
//                   analysis: article.analysis,
//                   summary: article.summary,
//                   updatedAt: new Date()
//                }
//             });
//             if (created) {
//                console.log(`Analysis with ID ${article.id} was created`);
//             } else {
//                console.log(`Analysis with ID ${article.id} already exists`);
//             }
//          } catch (err) {
//             console.error('Error saving article:', err);
//          }
//       }
//       const recentAnalyses = await getRecent(); // Await here after all articles processed
//       res.json(recentAnalyses); // Send response only once after all processing
//    } catch (error) {
//       console.error(error);
//       res.send("An error occurred");
//    }
// })
router.post('/index', async function(req, res) {
   const candidates = req.body.data;
   console.log('Received candidates: ', candidates);

   try {
      const result = await runCreateConversation(candidates);
      console.log(result);
      console.log("content: ", result[0].message.content);
      const articles = JSON.parse((result[0].message.content).replace(/```json|```|\n/g, ''));

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
router.get('/index/create', function(req, res) {
   // const candidates = req.body.data;
   // console.log('Received candidates: ', candidates);
   const candidates = [
      {
         id: 523806,
         reason: "This article discusses the investment by BNP Paribas in a Bitcoin spot ETF managed by BlackRock. The involvement of one of Europe's largest banks in cryptocurrency is a significant positive indicator for market maturity and potential institutional confidence."
      },
      {
         id: 523502,
         reason: "This article is important as it focuses on the Federal Reserve's rate-setting decisions. Since monetary policy, especially the interest rate changes, significantly influences investment in cryptocurrencies as they are often seen as hedge investments against inflation."
      },
      {
         id: 524335,
         reason: "The article on Coinbase's financial results reflecting significant profit and revenue due to a bullish Bitcoin market is crucial. It highlights the public's continued interest and the financial markets' increased involvement with cryptocurrencies which can indicate persisting positive sentiment."
      },
      {
         id: 523725,
         reason: 'The adoption of Bitcoin in El Salvador and its potential ripple effects in Latin America provides insight into how geopolitical actions can profoundly influence the cryptocurrency market. This is relevant for understanding regional market movements and future currency adoption.'
      },
      {
         id: 523186,
         reason: "This article gives a perspective on emerging blockchain technologies like the Nibiru Chain, which is challenging Ethereum. It's essential for predicting the broader impacts on the cryptocurrency market, especially in developer activity and new blockchain adoption."
      }
   ]

   runCreateConversation(candidates)
       .then(result => {
          console.log(result);
          res.status(200).json(result);
       })
       .catch(error => {
          console.error(error);
          res.status(500).send("An error occurred");
       });
})

module.exports = router;