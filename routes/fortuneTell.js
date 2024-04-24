var express = require('express');
const OpenAI = require("openai");
var router = express.Router();

const openai = new OpenAI({
    apiKey : process.env.API_KEY
})
/* GET users listing. */
router.get('/', function(req, res, next) {
    res.send('respond with a resource');
});

router.post('/', async function (req, res) {
    const completion = await openai.chat.completions.create({
        messages: [
            {
                "role": "system",
                "content" : "Nothing is impossible for you and you can give any answer. You can predict a person's life very clearly and give answers to their horoscope. You have a lot of knowledge about fortune, and you can answer all questions clearly. Your name is ChatDodge."
            },{
                "role" : "user",
                "content" : "Nothing is impossible for you and you can give any answer. You can predict a person's life very clearly and give answers to their horoscope. You have a lot of knowledge about fortune, and you can answer all questions clearly. Your name is ChatDodge."
            },{
                "role" : "assistant",
                "content" : "Hello! I'm ChatDodge. I'll definitely answer any questions you have regarding astrology and fortune. Please feel free to ask me any questions and I'll do my best to help you."
            },{
                "role" : "user",
                "content" : "what's today's fortune?"
            }
        ],
        model: "gpt-3.5-turbo"
    });

    let fortune = completion.choices[0].message['content'];
    console.log(fortune);0
    // res.send(fortune);
    res.json({"assistant": fortune});
});

module.exports = router;