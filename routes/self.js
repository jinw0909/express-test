var express = require('express');
var router = express.Router();

const OpenAi = require('openai');
const openai = new OpenAi({
    apiKey : process.env.API_KEY
});

router.get('/list', async function(req, res){
    try {
        const response = await openai.models.list();
        console.log("available models: ", response.data);
        res.status(200).json(response.data);
    } catch (error) {
        console.error("Error fetching model list: ", error.message);
        res.status(500).send('Failed to fetch model list');
    }
});

module.exports = router;