// whatsapp.js
import makeWASocket, {
    DisconnectReason,
    useMultiFileAuthState,
    fetchLatestBaileysVersion,
    Browsers
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import { config } from '../config/index.js';
import {
    cleanJid,
    getMessageText,
    isBroadcastJid,
    isStatusMessage,
    getSenderJid,
    isGroupJid,
    getBotJid,
    getBotPhone,
    getBotLid,
    isBotMentioned,
    shouldReplyInGroup,
    extractMentionedJids,
    isBotCommand
} from '../utils/messageHelper.js';
import { generateAIResponse } from './aiService.js';

// Constants for better maintainability
const CONSTANTS = {
    BOT_NAME: 'kaela',
    MESSAGE_CACHE_LIMIT: 2000,
    MAX_RECONNECT_ATTEMPTS: 10,
    CACHE_CLEANUP_RATIO: 0.5,
    RECONNECT_BASE_DELAY: 1000,
    RECONNECT_MAX_DELAY: 30000,
    RECONNECT_BACKOFF: 1.5,
    NEWSLETTER_JID: '120363422609224333@newsletter',
    NEWSLETTER_NAME: 'nimuthu randiya',
    DP_KEYWORDS: ['dp', 'profile picture'],
    FILE_KEYWORDS: ['download', 'file', 'pdf']
};

export class WhatsAppService {
    constructor() {
        this.sock = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.lastActivity = Date.now();
        this.processedMessages = new Set();
        this.botName = CONSTANTS.BOT_NAME;
        this.messageQueue = [];
        this.isProcessingQueue = false;
        this.saveCredsFn = null; // Store saveCreds function
        
        // Newsletter configuration
        this.newsletterConfig = {
            newsletterJid: CONSTANTS.NEWSLETTER_JID,
            newsletterName: CONSTANTS.NEWSLETTER_NAME,
            enabled: true
        };
        
        // Bind methods to avoid recreating functions
        this.handleConnectionUpdate = this.handleConnectionUpdate.bind(this);
        this.handleMessagesUpsert = this.handleMessagesUpsert.bind(this);
        // Remove this line - handleCredsUpdate no longer exists
        // this.handleCredsUpdate = this.handleCredsUpdate.bind(this);
    }

    // ============ Connection Management ============
    async connect() {
        try {
            const { state, saveCreds } = await useMultiFileAuthState(config.authDir);
            const { version } = await fetchLatestBaileysVersion();
            
            // Store saveCreds function
            this.saveCredsFn = saveCreds;
            
            console.log(`📱 Using WhatsApp Web v${version.join('.')}`);

            const sock = makeWASocket({
                version,
                auth: state,
                logger: pino({ level: 'silent' }),
                printQRInTerminal: false,
                browser: Browsers.macOS('Chrome'),
                syncFullHistory: false,
                markOnlineOnConnect: false,
                shouldSyncHistory: () => false, // Prevent unnecessary history sync
                patchMessageBeforeSending: (message) => {
                    // Optimize message sending by removing unnecessary fields
                    const { message: msg, ...rest } = message;
                    return rest;
                }
            });

            this.sock = sock;
            
            // Fix: Pass saveCreds as callback, not call it directly
            sock.ev.on('creds.update', () => {
                if (this.saveCredsFn) {
                    this.saveCredsFn();
                }
            });
            
            sock.ev.on('connection.update', this.handleConnectionUpdate);
            sock.ev.on('messages.upsert', this.handleMessagesUpsert);

            // Clean up old listeners on reconnect
            sock.ev.on('close', () => {
                sock.ev.removeAllListeners();
            });

            return sock;
        } catch (error) {
            console.error('❌ Failed to connect:', error);
            throw error;
        }
    }

    handleConnectionUpdate(update) {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log('\n📱 Scan QR Code:');
            qrcode.generate(qr, { small: true });
        }

        if (connection === 'close') {
            const statusCode = lastDisconnect?.error?.output?.statusCode;
            const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                  this.reconnectAttempts < CONSTANTS.MAX_RECONNECT_ATTEMPTS;
            
            this.isConnected = false;
            
            if (shouldReconnect) {
                this.reconnectAttempts++;
                const delay = Math.min(
                    CONSTANTS.RECONNECT_BASE_DELAY * Math.pow(CONSTANTS.RECONNECT_BACKOFF, this.reconnectAttempts),
                    CONSTANTS.RECONNECT_MAX_DELAY
                );
                setTimeout(() => this.connect().catch(console.error), delay);
            } else if (statusCode === DisconnectReason.loggedOut) {
                console.log('🔒 Logged out. Please restart to scan new QR.');
            }
        } else if (connection === 'open') {
            console.log('✅ Bot connected!');
            console.log(`   Bot JID: ${this.sock.user?.id}`);
            console.log(`   Bot Name: ${this.sock.user?.name || 'Kaela'}`);
            this.isConnected = true;
            this.reconnectAttempts = 0;
            this.processedMessages.clear();
            this.setOfflineStatus();
        }
    }

    // ============ Status Management ============
    async setOfflineStatus() {
        try {
            if (this.sock?.isConnected) {
                await this.sock.sendPresenceUpdate('unavailable');
            }
        } catch (error) {
            // Silent fail - no need to log every failure
        }
    }

    async sendTyping(remoteJid) {
        try {
            if (this.sock?.isConnected) {
                await this.sock.sendPresenceUpdate('composing', remoteJid);
            }
        } catch (error) {
            // Silent fail
        }
    }

    // ============ Message Processing ============
    createForwardedMessage(text, messageId) {
        const content = { text };
        
        // Only add newsletter context if enabled and configured
        if (this.newsletterConfig.enabled && 
            this.newsletterConfig.newsletterJid && 
            this.newsletterConfig.newsletterJid !== 'YOUR_CHANNEL_JID@newsletter') {
            content.contextInfo = {
                isForwarded: true,
                forwardingScore: 1,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: this.newsletterConfig.newsletterJid,
                    newsletterName: this.newsletterConfig.newsletterName,
                    serverMessageId: messageId || 'default'
                }
            };
        } else {
            content.contextInfo = {
                isForwarded: true,
                forwardingScore: 1
            };
        }
        
        return content;
    }

    async handleMessagesUpsert(chatUpdate) {
        try {
            const { messages } = chatUpdate;
            if (!messages?.length) return;

            const msg = messages[0];
            
            // Quick validation checks
            if (msg.key.fromMe || !msg.message) return;
            
            const remoteJid = msg.key.remoteJid;
            
            // Skip broadcasts and status messages
            if (isBroadcastJid(remoteJid) || isStatusMessage(msg)) return;

            const textContent = getMessageText(msg.message);
            if (!textContent) return;

            const messageId = msg.key.id;
            
            // Duplicate message check with cleanup
            if (this.processedMessages.has(messageId)) {
                return;
            }
            
            this.processedMessages.add(messageId);
            
            // Optimize cache cleanup
            if (this.processedMessages.size > CONSTANTS.MESSAGE_CACHE_LIMIT) {
                this.cleanupMessageCache();
            }

            this.lastActivity = Date.now();
            
            // Add to queue for processing
            this.enqueueMessage(msg, remoteJid, textContent);

        } catch (err) {
            console.error('❌ Error in messages.upsert:', err);
        }
    }

    cleanupMessageCache() {
        const entries = Array.from(this.processedMessages);
        const keepCount = Math.floor(CONSTANTS.MESSAGE_CACHE_LIMIT * CONSTANTS.CACHE_CLEANUP_RATIO);
        this.processedMessages = new Set(entries.slice(-keepCount));
    }

    // ============ Queue System ============
    enqueueMessage(msg, remoteJid, textContent) {
        const sender = getSenderJid(msg);
        const isGroup = isGroupJid(remoteJid);
        
        // Check authorization early
        if (!isGroup && !this.shouldReplyToSender(remoteJid)) {
            console.log(`🔇 Personal message from ${sender} ignored (not authorized)`);
            this.setOfflineStatus().catch(() => {});
            return;
        }

        this.messageQueue.push({
            msg,
            remoteJid,
            sender,
            textContent,
            isGroup,
            timestamp: Date.now()
        });

        // Process queue if not already processing
        if (!this.isProcessingQueue) {
            this.processQueue();
        }
    }

    async processQueue() {
        if (this.isProcessingQueue || this.messageQueue.length === 0) {
            return;
        }

        this.isProcessingQueue = true;

        try {
            while (this.messageQueue.length > 0) {
                // Process messages in batches
                const batchSize = Math.min(this.messageQueue.length, 5);
                const batch = this.messageQueue.splice(0, batchSize);

                await Promise.all(batch.map(async (item) => {
                    await this.processMessage(item);
                }));

                // Small delay between batches
                if (this.messageQueue.length > 0) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
            }
        } catch (error) {
            console.error('❌ Error processing queue:', error);
        } finally {
            this.isProcessingQueue = false;
            
            // Check if new messages were added while processing
            if (this.messageQueue.length > 0) {
                this.processQueue();
            }
        }
    }

    async processMessage(item) {
        const { msg, remoteJid, sender, textContent, isGroup } = item;
        const senderName = msg.pushName || 'User';
        const phoneNumber = sender.split('@')[0];

        console.log(`💬 Processing: "${textContent}" from ${senderName} (${phoneNumber})`);

        try {
            // Check for special commands
            const hasDPKeyword = this.hasKeyword(textContent, CONSTANTS.DP_KEYWORDS);
            const hasFileKeyword = this.hasKeyword(textContent, CONSTANTS.FILE_KEYWORDS);

            // Send status messages if needed
            if (hasDPKeyword || hasFileKeyword) {
                const statusMessage = hasDPKeyword ? 
                    "⏳ Please wait, I'm fetching the DP..." : 
                    "⏳ Please wait, I'm downloading the file...";
                await this.sock.sendMessage(remoteJid, { text: statusMessage }, { quoted: msg });
            }

            // Build context message
            const contextMessage = this.buildContextMessage(textContent, senderName, phoneNumber, isGroup, msg);

            // Generate response
            const response = await generateAIResponse(contextMessage, this.sock, remoteJid);

            // Handle response
            if (response === null) {
                console.log(`✅ File sent successfully to ${senderName} (${phoneNumber})`);
                return;
            }

            if (response && typeof response === 'object' && response.type === 'IMAGE') {
                await this.sendImageResponse(response, remoteJid, msg, senderName, phoneNumber);
            } else {
                await this.sendTextResponse(response, remoteJid, msg, senderName, phoneNumber);
            }

        } catch (error) {
            await this.handleError(error, remoteJid, msg);
        }
    }

    // ============ Helper Methods ============
    hasKeyword(text, keywords) {
        const lowerText = text.toLowerCase();
        return keywords.some(keyword => lowerText.includes(keyword));
    }

    buildContextMessage(textContent, senderName, phoneNumber, isGroup, msg) {
        if (isGroup) {
            const isMentioned = isBotMentioned(msg, this.sock);
            const isCommand = isBotCommand(textContent, this.botName);
            return `[Group Chat | User Name: ${senderName} | Number: ${phoneNumber} | Mentioned: ${isMentioned} | Command: ${isCommand}]\nMessage: ${textContent}`;
        }
        return `[Private Chat | User Name: ${senderName} | Number: ${phoneNumber}]\nMessage: ${textContent}\n\nInstruction: Greet the user by their name (${senderName}) in your response.`;
    }

    async sendImageResponse(response, remoteJid, msg, senderName, phoneNumber) {
        console.log(`📸 Sending DP image for: ${response.phone}`);
        await this.sock.sendMessage(
            remoteJid,
            {
                image: response.data,
                caption: response.caption || `📸 Profile picture for ${response.phone}`,
                contextInfo: {
                    isForwarded: true,
                    forwardingScore: 1
                }
            },
            { quoted: msg }
        );
        console.log(`✅ DP image sent to ${senderName} (${phoneNumber})`);
    }

    async sendTextResponse(response, remoteJid, msg, senderName, phoneNumber) {
        const replyText = typeof response === 'string' ? response : response.toString();
        await this.sock.sendMessage(
            remoteJid,
            this.createForwardedMessage(replyText, msg.key.id),
            { quoted: msg }
        );
        console.log(`✅ Replied to ${senderName} (${phoneNumber})`);
    }

    async handleError(error, remoteJid, msg) {
        console.error('❌ Error processing message:', error);
        try {
            await this.sock.sendMessage(
                remoteJid,
                { text: 'Sorry, there was an error 😅 Please try again later!' },
                { quoted: msg }
            );
        } catch (sendError) {
            console.error('❌ Send error:', sendError);
        }
    }

    shouldReplyToSender(remoteJid) {
        if (!config.ownerJid) return true;
        
        const senderClean = cleanJid(remoteJid);
        const allowedOwners = config.ownerJid.split(',').map(jid => cleanJid(jid.trim()));
        return allowedOwners.includes(senderClean);
    }

    // ============ Utility Methods ============
    updateNewsletterConfig(newsletterJid, newsletterName, enabled = true) {
        this.newsletterConfig.newsletterJid = newsletterJid;
        this.newsletterConfig.newsletterName = newsletterName;
        this.newsletterConfig.enabled = enabled;
        console.log(`📰 Newsletter config updated: ${newsletterName} (${newsletterJid})`);
    }

    async disconnect() {
        if (this.sock) {
            await this.setOfflineStatus();
            await this.sock.end();
            this.isConnected = false;
            this.processedMessages.clear();
            this.messageQueue = [];
            console.log('🔌 Disconnected');
        }
    }

    // Get connection status
    getConnectionStatus() {
        return {
            isConnected: this.isConnected,
            reconnectAttempts: this.reconnectAttempts,
            queueSize: this.messageQueue.length,
            cacheSize: this.processedMessages.size,
            lastActivity: this.lastActivity
        };
    }
}
