var express = require('express');
var router = express.Router();
const fs = require('fs');
const path = require('path');
const OpenAi = require('openai');
const axios = require('axios');

const openai = new OpenAi({
    apiKey : process.env.API_KEY
});

async function getSummary() {
    try {
        const response = await axios.get(`${process.env.API_BASE_URL}/function/article`);
        console.log("response: ", response);
        const result = response.data[0].message['content'].replace(/\n|\+/g, ' ');
        console.log(result);
        return result;
    } catch (err) {
        console.error(err);
        throw err;  // Allows the caller to handle the error appropriately
    }
}

const speechFile = path.resolve(`./speech${Date.now()}.mp3`);
async function main() {
    const summary = await getSummary();
    const mp3 = await openai.audio.speech.create({
        model: 'tts-1-hd',
        voice: 'alloy',
        input: summary,
    });
    console.log(speechFile);
    const buffer = Buffer.from(await mp3.arrayBuffer());
    await fs.promises.writeFile(speechFile, buffer);
    console.log("done!");
}
/* GET users listing. */
router.get('/', async function(req, res, next) {
    main();
    res.render('voice');
});

module.exports = router;
