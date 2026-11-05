
const { withOpenAIRetry } = require('./services/openaiRetry');

let attempts = 0;

async function mockOpenAICall() {
    attempts++;

    console.log(`API 호출 시도: ${attempts}`);

    if (attempts <= 2) {
        const error = new Error('Insufficient quota');
        error.status = 429;
        error.code = 'insufficient_quota';
        throw error;
    }

    return {
        choices: [
            {
                message: {
                    content: 'Bitcoin market analysis completed'
                }
            }
        ]
    };
}

async function main() {
    const response = await withOpenAIRetry(
        mockOpenAICall,
        {
            maxRetries: 3,
            delayMs: 1000
        }
    );

    console.log(
        '최종 결과:',
        response.choices[0].message.content
    );
}

main().catch(console.error);
