
const sleep = (ms) =>
    new Promise(resolve => setTimeout(resolve, ms));

const QUOTA_ERROR_CODES = new Set([
    'insufficient_quota',
    'credit_balance_exhausted'
]);

function isQuotaError(error) {
    const code = error?.code ?? error?.error?.code;

    return error?.status === 429 &&
        QUOTA_ERROR_CODES.has(code);
}

async function withOpenAIRetry(
    apiCall,
    {
        maxRetries = 10,
        delayMs = 60_000
    } = {}
) {
    for (let attempt = 0; ; attempt++) {
        try {
            return await apiCall();

        } catch (error) {
            if (!isQuotaError(error)) {
                throw error;
            }

            if (attempt >= maxRetries) {
                console.error(
                    '[OpenAI] Quota retry limit exceeded'
                );
                throw error;
            }

            console.warn(
                `[OpenAI] Insufficient quota. ` +
                `Retry ${attempt + 1}/${maxRetries} ` +
                `after ${delayMs / 1000} seconds.`
            );

            await sleep(delayMs);
        }
    }
}

module.exports = {
    withOpenAIRetry,
    isQuotaError
};
