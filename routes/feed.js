var express = require('express');
var router = express.Router();

const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey : process.env.API_KEY
});
async function runAnalyzeConversation(content) {
    const messages = [
        { role: "system", content: "You are a cryptocurrency and Bitcoin expert and consultant. You can analyze various articles and indicators related to cryptocurrencies and Bitcoin, and you have the ability to accurately convey your analysis and predictions to clients. Additionally, you can interpret cryptocurrency-related articles within the overall flow of the coin market, and understand the main points and significance of the articles in that context."},
        { role: "user", content: `The provided content analyzes the price movements of Bitcoin and Ethereum. Based on this information, please predict the future prices of Bitcoin and Ethereum in an easy-to-understand manner. I want the response to be in a JSON format, {"date": "text", "bitcoin": "text", "ethereum" : "text", "overall" : "text"} with a key of "analysis". Provided content: 暗号資産市場は上値重いまま、 BTC（ビットコイン）は少しずつ価格回復
            ビットコインなどの暗号資産（仮想通貨）をチャートで学ぶ
            2024/05/13
            
            印刷 暗号資産市場は上値重いまま、 BTC（ビットコイン）は少しずつ価格回復
            印刷
            アンケート
            ｱﾝｹｰﾄ
            
            加藤 宏幸
            CXRエンジニアリング株式会社 代表取締役
            Twitter:
            @hiropi_fx
            もっと見る 
            暗号資産
            ビットコイン
            BTC（ビットコイン）、待ちの状態で 押し目買いの体制を整える時間帯
            ETH（イーサリアム）は地合い悪し、44万円割れから41万円前後か？
            先週前半は順調に推移をしていた暗号資産市場ですが、後半から価格が崩れ、BTCは一時940万円前後まで価格を押し下げられました。急落ではありましたが、特段、大きなネガティブ材料が出たわけではなさそうです。ここ２日間は少しずつ価格を回復させており、5月12日夜には960万円に一時的に回復する局面も見られました。レンジ切り下げでしょうか？ 
            
            BTC（ビットコイン）、待ちの状態で 押し目買いの体制を整える時間帯
            【図表1】BTC/JPY　日足チャート
            
            出所：MONEX TRADER CRYPTO（iPhoneアプリ）
            BTC／JPY日足チャート分析から入ります。先週もまたSMA30（黄色）がレジスタンスとなりました。3月以降、極めて高い確率でレジサポ要因として機能しています。 現在のSMA30は985万円前後で推移しており、今週はここを突破してクローズする日があるかどうか注目です。 
             
            さらにSMA90(水色)もSMA30と隣接しており、強力なレジスタンスラインとしてワークしそうです。 よって今週は975－985万円が鬼門ゾーンとなるのではないでしょうか。ここを突破してローソク足がクローズできると、今度は強力なサポートラインとして機能すると思われ、仮に超えて下落した場合は、買い場となりやすいでしょう。 
            
            今週仮に1000万円近辺まで再度上値を伸ばすタイミングがあれば、965－975万円がサポートラインとして機能するフェーズとなり、今週後半から週末にかけてチャンス到来となるかもしれません。今は少し待ち、上値の更新を見届けてから押し目買いに入る体制を整えておくとよいのではないでしょうか。 
            
            ETH（イーサリアム）は地合い悪し、44万円割れから41万円前後か？
            【図表2】ETH／JPY　日足チャート
            
            出所：MONEX TRADER CRYPTO（iPhoneアプリ）
            続いて、ETH／JPY日足チャートです。 地合いが悪くなってきました。並行チャネルレンジ内で推移しているものの、ディセンディングトライアングル形状も形成しており、下値ブレイクは時間の問題かもしれません。 
            
            アルトコイン市場は全般的に盛り上がりに欠け、ETHも勢いがない状況です。 MACDも0.00をやや下回ってマイナス圏で推移しているため、もう一段安もあり得るのではないでしょうか。
            
            44万円前後のサポートラインが要のため、ここを破るとSMA200（橙）を目指してもう一段安となるでしょう。 次のサポートは時間差も考慮して41万円前後でしょうか？ 週後半以降のサポートはSMA200が推移しているであろう41万円前後で意識しておくとよさそうです。よって押し目買いを狙うならば、この水準からではないでしょうか。 
             
            また、仮にこの水準から反発した場合、SMA30は47万5,000円付近、SMA90は50万円付近で推移しているため、これらもそれぞれレジスタンス要因となります。上がったところで戻り売り戦略の方が有利に働くのではないでしょうか。 個人的にはETHを短期トレードでショート狙いし、41万円手前で買い戻すようなトレードを意識してもよいのではないかと考えています。 
             
            今週は5月15日（水）に米CPIの発表が予定されています。市場予想を下回ればFRB（米連邦準備制度理事会）はハト派に傾斜し、金融緩和期待で株式市場が上昇しやすくなるため、暗号資産市場の反発も起こりやすいでしょう。このタイミングでETHは戻り売りを新規で狙うとよいかもしれません。15日の経済指標はぜひチェックしましょう。`},
        { role: "assistant", content: '{\
          "date": "2024-05-13",\
          "analysis": {\
            "bitcoin": {\
              "text": "Bitcoin (BTC) is in a recovery phase after experiencing a price drop to around 9.4 million yen. It has shown signs of reclaiming to 9.6 million yen and is expected to test the resistance levels between 9.75 to 9.85 million yen this week. Should BTC manage a close above these levels, it could establish strong support and potentially target near the 10 million yen mark. Short-term strategy could involve waiting for confirmation of this breakout before entering a buying position.",\
              "prediction": "9.75 million to 10 million yen in the short term, with support forming around 9.65 million to 9.75 million yen."\
            },\
            "ethereum": {\
              "text": "Ethereum (ETH) is currently facing bearish market sentiment, hovering around 440,000 yen but with risks of dropping to the 410,000 yen range due to a descending triangle pattern. The MACD indicator suggests further downside potential. Support is expected near the 410,000 yen level, and any rise towards the resistance levels at around 475,000 yen and 500,000 yen could be opportunities for short-selling.",\
              "prediction": "Expected to range between 410,000 yen and 440,000 yen in the short term, with potential rebounds facing resistance at 475,000 yen and 500,000 yen."\
            },\
            "overall": {\
              "text": "The cryptocurrency market is currently sluggish with Bitcoin showing signs of recovery and establishing support, while Ethereum risks further downside amid bearish sentiment. Key support and resistance levels will be crucial in determining the market\'s next moves. Markets are also awaiting the U.S. CPI data on May 15, which could influence both cryptocurrencies depending on macroeconomic outcomes.",\
              "market_trend": "Bitcoin shows recovery potential while Ethereum remains bearish; overall market sentiment is cautious ahead of key economic data."\
            }\
          }\
        }'},
        { role: "user", content: `The provided content analyzes the price movements of Bitcoin and Ethereum. Based on this information, please predict the future prices of Bitcoin and Ethereum in an easy-to-understand manner. I want the response to be in a JSON format, {"date": "text", "bitcoin": "text", "ethereum" : "text", "overall" : "text"} with a key of "analysis". Provided content: ${content}`}
    ];

    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: messages,
        response_format: {type: "json_object"}
    });
    const responseMessage = response.choices[0].message;
    return responseMessage;
}
router.get('/', async function(req, res, next) {
    try {
        res.render('feed', );
    } catch (error) {
        console.error(error);
    }
});

router.post('/', async function(req, res) {
    try {
        const data = req.body;
        console.log('Received data: ', data.data);
        const analysis = await runAnalyzeConversation(data.data);
        console.log("analysis: ", analysis);
        const jsonStr = JSON.stringify(analysis);
        res.send(jsonStr);
    } catch (error) {
        console.error(error);
        res.status(500).send('An error occurred');
    }
})

module.exports = router;