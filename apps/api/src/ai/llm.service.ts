import { Injectable, Logger } from '@nestjs/common';
import Groq from 'groq-sdk';
import OpenAI from 'openai';

export interface LlmResponse {
    content: string;
    parsed: Record<string, unknown> | null;
    tokensUsed: { prompt: number; completion: number; total: number };
    model: string;
    durationMs: number;
}

type Provider = 'groq' | 'openai' | 'none';

@Injectable()
export class LlmService {
    private readonly logger = new Logger(LlmService.name);
    private groqClient: Groq | null = null;
    private openaiClient: OpenAI | null = null;
    private readonly provider: Provider;
    private readonly MAX_RETRIES = 3;
    private readonly BACKOFF_BASE_MS = 1000;

    constructor() {
        const groqKey = process.env.GROQ_API_KEY;
        const openaiKey = process.env.OPENAI_API_KEY;
        const baseURL = process.env.OPENAI_BASE_URL;

        if (groqKey) {
            this.groqClient = new Groq({ apiKey: groqKey });
            this.provider = 'groq';
            this.logger.log('Groq client initialized');
        } else if (openaiKey) {
            this.openaiClient = new OpenAI({
                apiKey: openaiKey,
                ...(baseURL ? { baseURL } : {})
            });
            this.provider = 'openai';
            this.logger.log(`OpenAI client initialized ${baseURL ? `(baseURL: ${baseURL})` : ''}`);
        } else {
            this.provider = 'none';
            this.logger.warn('No AI API key set — AI features will use fallback mode');
        }
    }

    get isAvailable(): boolean {
        return this.provider !== 'none';
    }

    get modelId(): string {
        if (this.provider === 'groq') {
            return 'llama-3.1-8b-instant';
        }
        return process.env.OPENAI_MODEL || 'gpt-4o';
    }

    async complete(opts: {
        systemPrompt: string;
        userPrompt: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<LlmResponse> {
        if (this.provider === 'none') {
            throw new Error('LLM not available — no API key configured');
        }

        if (this.provider === 'groq') {
            return this.completeGroq(opts);
        }
        return this.completeOpenAI(opts);
    }

    private async completeGroq(opts: {
        systemPrompt: string;
        userPrompt: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<LlmResponse> {
        if (!this.groqClient) {
            throw new Error('Groq client not initialized');
        }

        const start = Date.now();
        let lastError: Error | null = null;
        const model = 'llama-3.1-8b-instant';

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                this.logger.log(`[LLM:Groq] Attempt ${attempt + 1}/${this.MAX_RETRIES} — model ${model}`);
                const response = await this.groqClient.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: opts.systemPrompt },
                        { role: 'user', content: opts.userPrompt }
                    ],
                    max_tokens: opts.maxTokens ?? 1024,
                    temperature: opts.temperature ?? 0.7
                });

                this.logger.log('[LLM:Groq] Request succeeded');

                const content = response.choices[0]?.message?.content ?? '{}';
                const usage = response.usage;

                let parsed: Record<string, unknown> | null = null;
                try {
                    parsed = JSON.parse(content);
                } catch {
                    this.logger.warn('Failed to parse Groq JSON response, returning raw content');
                }

                return {
                    content,
                    parsed,
                    tokensUsed: {
                        prompt: usage?.prompt_tokens ?? 0,
                        completion: usage?.completion_tokens ?? 0,
                        total: usage?.total_tokens ?? 0
                    },
                    model: model,
                    durationMs: Date.now() - start
                };
            } catch (err: any) {
                lastError = err;
                this.logger.error(`[LLM:Groq] Error: ${err.message} (status: ${err.status})`);

                const isRetryable =
                    err?.status === 429 ||
                    err?.status === 500 ||
                    err?.status === 503 ||
                    err?.status === 529 ||
                    err?.code === 'ECONNRESET';

                if (!isRetryable || attempt === this.MAX_RETRIES - 1) {
                    break;
                }

                const delay = this.BACKOFF_BASE_MS * Math.pow(2, attempt);
                this.logger.warn(
                    `Groq call failed (attempt ${attempt + 1}/${this.MAX_RETRIES}), retrying in ${delay}ms`
                );
                await new Promise((r) => setTimeout(r, delay));
            }
        }

        this.logger.error(`Groq call failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
        throw lastError ?? new Error('Groq call failed');
    }

    private async completeOpenAI(opts: {
        systemPrompt: string;
        userPrompt: string;
        temperature?: number;
        maxTokens?: number;
    }): Promise<LlmResponse> {
        if (!this.openaiClient) {
            throw new Error('OpenAI client not initialized');
        }

        const start = Date.now();
        let lastError: Error | null = null;
        const model = process.env.OPENAI_MODEL || 'gpt-4o';

        for (let attempt = 0; attempt < this.MAX_RETRIES; attempt++) {
            try {
                this.logger.log(`[LLM:OpenAI] Attempt ${attempt + 1}/${this.MAX_RETRIES} — model ${model}`);
                const response = await this.openaiClient.chat.completions.create({
                    model,
                    messages: [
                        { role: 'system', content: opts.systemPrompt },
                        { role: 'user', content: opts.userPrompt }
                    ],
                    temperature: opts.temperature ?? 0.3,
                    max_tokens: opts.maxTokens ?? 2000
                }, { timeout: 30000 });

                this.logger.log('[LLM:OpenAI] Request succeeded');

                const content = response.choices[0]?.message?.content ?? '{}';
                const usage = response.usage;

                let parsed: Record<string, unknown> | null = null;
                try {
                    parsed = JSON.parse(content);
                } catch {
                    this.logger.warn('Failed to parse OpenAI JSON response, returning raw content');
                }

                return {
                    content,
                    parsed,
                    tokensUsed: {
                        prompt: usage?.prompt_tokens ?? 0,
                        completion: usage?.completion_tokens ?? 0,
                        total: usage?.total_tokens ?? 0
                    },
                    model: response.model,
                    durationMs: Date.now() - start
                };
            } catch (err: any) {
                lastError = err;
                this.logger.error(`[LLM:OpenAI] Error: ${err.message} (status: ${err.status}, code: ${err.code})`);

                const isRetryable =
                    err?.status === 429 ||
                    err?.status === 500 ||
                    err?.status === 503 ||
                    err?.status === 408 ||
                    err?.code === 'ECONNRESET';

                if (!isRetryable || attempt === this.MAX_RETRIES - 1) {
                    break;
                }

                const delay = this.BACKOFF_BASE_MS * Math.pow(2, attempt);
                this.logger.warn(
                    `OpenAI call failed (attempt ${attempt + 1}/${this.MAX_RETRIES}), retrying in ${delay}ms`
                );
                await new Promise((r) => setTimeout(r, delay));
            }
        }

        this.logger.error(`OpenAI call failed after ${this.MAX_RETRIES} attempts: ${lastError?.message}`);
        throw lastError ?? new Error('OpenAI call failed');
    }

    /**
     * Convenience: complete and parse JSON, with optional fallback value.
     */
    async completeJSON<T = Record<string, unknown>>(opts: {
        systemPrompt: string;
        userPrompt: string;
        temperature?: number;
        fallback?: T;
    }): Promise<{ data: T; meta: Omit<LlmResponse, 'content' | 'parsed'> }> {
        try {
            const response = await this.complete(opts);
            return {
                data: (response.parsed as T) ?? (opts.fallback as T),
                meta: {
                    tokensUsed: response.tokensUsed,
                    model: response.model,
                    durationMs: response.durationMs
                }
            };
        } catch (err) {
            if (opts.fallback !== undefined) {
                this.logger.warn('LLM call failed, using fallback');
                return {
                    data: opts.fallback,
                    meta: { tokensUsed: { prompt: 0, completion: 0, total: 0 }, model: 'fallback', durationMs: 0 }
                };
            }
            throw err;
        }
    }
}
