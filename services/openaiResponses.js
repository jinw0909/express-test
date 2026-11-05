'use strict';

const OpenAI = require('openai');
const { withOpenAIRetry } = require('./openaiRetry');

const openai = new OpenAI({ apiKey: process.env.API_KEY });
const MODEL = 'gpt-6.1-sol';

function validateText(response) {
    if (response.status === 'incomplete') {
        throw new Error(`OpenAI response incomplete: ${JSON.stringify(response.incomplete_details)}`);
    }
    const text = response.output_text?.trim();
    if (!text) {
        throw new Error('OpenAI returned no final text output');
    }
    return text;
}

async function responseText(messages) {
    const response = await withOpenAIRetry(() => openai.responses.create({
        model: MODEL,
        input: messages,
        reasoning: { effort: 'medium' }
    }));
    return validateText(response);
}

/**
 * Responses API: tool calls and strict JSON schema outputs.
 * Tool definitions must be Responses-format (flat type/name/parameters/strict).
 * Handlers are async functions accepting parsed tool arguments.
 */
async function responseJson({ messages, name, schema, tools = [], handlers = {}, forcedTool = null }) {
    if (!name || !schema) throw new Error('name and schema are required');
    let response = await withOpenAIRetry(() => openai.responses.create({
        model: MODEL,
        input: messages,
        reasoning: { effort: 'medium' },
        ...(tools.length ? {
            tools,
            tool_choice: forcedTool ? { type: 'function', name: forcedTool } : 'auto'
        } : {}),
        text: { format: { type: 'json_schema', name, strict: true, schema } }
    }));

    for (let round = 0; round < 6; round++) {
        const calls = (response.output || []).filter(item => item.type === 'function_call');
        if (!calls.length) {
            return JSON.parse(validateText(response));
        }
        const outputs = [];
        for (const call of calls) {
            const handler = handlers[call.name];
            if (typeof handler !== 'function') throw new Error(`Unknown tool: ${call.name}`);
            const args = JSON.parse(call.arguments || '{}');
            const result = await handler(args);
            outputs.push({
                type: 'function_call_output',
                call_id: call.call_id,
                output: typeof result === 'string' ? result : JSON.stringify(result)
            });
        }
        response = await withOpenAIRetry(() => openai.responses.create({
            model: MODEL,
            previous_response_id: response.id,
            input: outputs,
            reasoning: { effort: 'medium' },
            ...(tools.length ? { tools, tool_choice: 'auto' } : {}),
            text: { format: { type: 'json_schema', name, strict: true, schema } }
        }));
    }
    throw new Error('Exceeded maximum Responses tool rounds');
}

const idListTool = (name, description) => ({
    type: 'function',
    name,
    description,
    strict: true,
    parameters: {
        type: 'object',
        properties: { indexList: { type: 'array', items: { type: 'integer' } } },
        required: ['indexList'],
        additionalProperties: false
    }
});

const noArgsTool = (name, description) => ({
    type: 'function',
    name,
    description,
    strict: true,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false }
});

const candidateSchema = {
    type: 'object',
    properties: { candidates: { type: 'array', items: {
                type: 'object',
                properties: { id: { type: 'number' }, summary: { type: 'string' }, reason: { type: 'string' } },
                required: ['id', 'summary', 'reason'],
                additionalProperties: false
            } } },
    required: ['candidates'],
    additionalProperties: false
};

const finalSchema = {
    type: 'object',
    properties: { finals: { type: 'array', items: {
                type: 'object',
                properties: { id: { type: 'number' }, summary: { type: 'string' }, reason: { type: 'string' } },
                required: ['id', 'summary', 'reason'],
                additionalProperties: false
            } } },
    required: ['finals'],
    additionalProperties: false
};

const analysisSchema = {
    type: 'object',
    properties: { summaries_and_analyses: { type: 'array', items: {
                type: 'object',
                properties: { id: { type: 'number' }, analysis: { type: 'string' }, summary: { type: 'string' } },
                required: ['id', 'analysis', 'summary'],
                additionalProperties: false
            } } },
    required: ['summaries_and_analyses'],
    additionalProperties: false
};

const viewpointSchema = {
    type: 'object',
    properties: { viewpoint: { type: 'string' }, refs: { type: 'array', items: { type: 'number' } } },
    required: ['viewpoint', 'refs'],
    additionalProperties: false
};

module.exports = {
    responseText, responseJson, idListTool, noArgsTool,
    candidateSchema, finalSchema, analysisSchema, viewpointSchema
};