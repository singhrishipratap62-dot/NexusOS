import 'reflect-metadata';
import * as dotenv from 'dotenv';
import { resolve } from 'path';
dotenv.config({ path: resolve(__dirname, '.env') });

import { LlmService } from './src/ai/llm.service';

const testPrompt = async () => {
    const llm = new LlmService();
    console.log('Testing LlmService...', { baseURL: process.env.OPENAI_BASE_URL, model: process.env.OPENAI_MODEL });

    try {
        const response = await llm.complete({
            systemPrompt: 'You are a helpful AI assistant.',
            userPrompt: 'What are my top automation opportunities?',
            maxTokens: 50,
            temperature: 0.7
        });
        
        console.log('\n--- AI RESPONSE ---');
        console.log(response.content);
        console.log('-------------------\n');
    } catch (err) {
        console.error('LLM Test Failed:', err);
    }
};

testPrompt();
