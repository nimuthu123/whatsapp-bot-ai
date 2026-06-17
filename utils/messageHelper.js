/**
 * Helper to get clean JID (phone number digits only)
 */
export const cleanJid = (jid) => {
    return jid ? jid.split('@')[0].split(':')[0] : '';
};

/**
 * Helper to extract text content from WhatsApp message structure
 */
export const getMessageText = (message) => {
    if (!message) return '';
    if (message.conversation) return message.conversation;
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    if (message.imageMessage?.caption) return message.imageMessage.caption;
    if (message.videoMessage?.caption) return message.videoMessage.caption;
    if (message.buttonsResponseMessage?.selectedButtonId) return message.buttonsResponseMessage.selectedButtonId;
    if (message.templateButtonReplyMessage?.selectedId) return message.templateButtonReplyMessage.selectedId;
    if (message.ephemeralMessage?.message) return getMessageText(message.ephemeralMessage.message);
    if (message.viewOnceMessage?.message) return getMessageText(message.viewOnceMessage.message);
    if (message.documentMessage?.caption) return message.documentMessage.caption;
    if (message.audioMessage?.caption) return message.audioMessage.caption;
    return '';
};

/**
 * Check if message is a command for the bot
 * @param {string} text - The message text to check
 * @param {string} botName - The bot's name to look for (default: 'kaela')
 * @returns {boolean} - True if the message is a command for the bot
 */
export const isBotCommand = (text, botName = 'kaela') => {
    if (!text) return false;
    const lowerText = text.toLowerCase();
    return lowerText.includes(botName) || 
           lowerText.includes('la') ||
           lowerText.includes('@');
};

/**
 * Extract mention from message
 * @param {object} message - The WhatsApp message object
 * @returns {array} - Array of mentioned JIDs
 */
export const extractMentionedJids = (message) => {
    return message.extendedTextMessage?.contextInfo?.mentionedJid || [];
};

/**
 * Check if a JID is a group
 * @param {string} jid - The JID to check
 * @returns {boolean} - True if it's a group
 */
export const isGroupJid = (jid) => {
    return jid?.endsWith('@g.us') || false;
};

/**
 * Check if a JID is a broadcast/status
 * @param {string} jid - The JID to check
 * @returns {boolean} - True if it's a broadcast or status
 */
export const isBroadcastJid = (jid) => {
    return jid?.includes('@broadcast') || 
           jid?.includes('@status') || 
           jid?.includes('@newsletter') || false;
};

/**
 * Extract the actual sender JID from a message
 * @param {object} msg - The WhatsApp message object
 * @returns {string} - The sender's JID
 */
export const getSenderJid = (msg) => {
    return msg.key.participant || msg.key.remoteJid || '';
};

/**
 * Check if a message is a status/view-once message
 * @param {object} msg - The WhatsApp message object
 * @returns {boolean} - True if it's a status or view-once message
 */
export const isStatusMessage = (msg) => {
    if (!msg?.message) return false;
    return !!(msg.message.protocolMessage || 
              msg.message.senderKeyDistributionMessage ||
              msg.message.statusMessage ||
              msg.message.viewOnceMessage);
};

/**
 * Extract the bot's JID from the socket
 * @param {object} sock - The WhatsApp socket
 * @returns {string} - The bot's JID
 */
export const getBotJid = (sock) => {
    return sock.user?.id ? sock.user.id.split(':')[0] + '@s.whatsapp.net' : '';
};

/**
 * Extract the bot's phone number from the socket
 * @param {object} sock - The WhatsApp socket
 * @returns {string} - The bot's phone number (clean)
 */
export const getBotPhone = (sock) => {
    return cleanJid(sock.user?.id);
};

/**
 * Extract the bot's LID from the socket
 * @param {object} sock - The WhatsApp socket
 * @returns {string} - The bot's LID
 */
export const getBotLid = (sock) => {
    return cleanJid(sock.user?.lid);
};

/**
 * Check if the bot is mentioned in a message
 * @param {object} msg - The WhatsApp message object
 * @param {object} sock - The WhatsApp socket
 * @returns {boolean} - True if the bot is mentioned
 */
export const isBotMentioned = (msg, sock) => {
    const mentionedJids = extractMentionedJids(msg.message);
    const botPhone = getBotPhone(sock);
    const botLid = getBotLid(sock);
    
    return mentionedJids.some(jid => {
        const cleanMention = cleanJid(jid);
        return cleanMention === botPhone || (botLid && cleanMention === botLid);
    });
};

/**
 * Check if a message should trigger a reply in a group
 * @param {object} msg - The WhatsApp message object
 * @param {object} sock - The WhatsApp socket
 * @param {string} textContent - The message text
 * @param {string} botName - The bot's name
 * @returns {boolean} - True if the bot should reply
 */
export const shouldReplyInGroup = (msg, sock, textContent, botName = 'kaela') => {
    const isMentioned = isBotMentioned(msg, sock);
    const nameCalled = isBotCommand(textContent, botName);
    return isMentioned || nameCalled;
};
