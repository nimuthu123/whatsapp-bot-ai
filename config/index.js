import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

dotenv.config();

export const config = {
    // Owner configuration
    ownerJid: process.env.OWNER_JID,
    
    // Auth directory
    authDir: path.join(rootDir, 'auth_info_baileys'),
    
    // AI configuration
    ai: {
        model: process.env.AI_MODEL || "openai/gpt-oss-20b",
        maxTokens: parseInt(process.env.AI_MAX_TOKENS) || 500,
        temperature: parseFloat(process.env.AI_TEMPERATURE) || 0.7,
    },
    
    // WhatsApp configuration
    whatsapp: {
        retryDelay: parseInt(process.env.WHATSAPP_RETRY_DELAY) || 2000,
        maxRetries: parseInt(process.env.WHATSAPP_MAX_RETRIES) || 3,
    }
};
