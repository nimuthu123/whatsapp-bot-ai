import OpenAI from 'openai';

// Initialize Groq client with OpenAI-compatible interface
const groqClient = new OpenAI({
    apiKey: process.env.GROQ_API_KEY || "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",
    baseURL: "https://api.groq.com/openai/v1",
});

export default groqClient;