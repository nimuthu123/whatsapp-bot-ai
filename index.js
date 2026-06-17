import { WhatsAppService } from './services/whatsapp.js';

console.log('🤖 Starting Kaela WhatsApp Bot...');
console.log('📖 Loading configuration...');

const whatsappService = new WhatsAppService();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down gracefully...');
    await whatsappService.disconnect();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n👋 Shutting down gracefully...');
    await whatsappService.disconnect();
    process.exit(0);
});

// Start the bot
whatsappService.connect().catch(err => {
    console.error('❌ Critical initialization error:', err);
    process.exit(1);
});