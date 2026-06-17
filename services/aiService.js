// aiService.js
import groqClient from '../config/groq.js';
import { config } from '../config/index.js';
import { SYSTEM_PROMPTS } from '../config/prompts.js';
import { createShortUrl } from '../config/shortener.js';
import { getProfilePicBuffer } from '../config/dpdownload.js';
import { getFileStream } from '../config/download.js';

/**
 * Generate AI response with retry logic and system prompt support
 * Includes automatic URL shortening detection, DP download, and file processing
 */
export const generateAIResponse = async (contextMessage, sock, remoteJid, systemPrompt = SYSTEM_PROMPTS.DEFAULT, options = {}) => {
    const {
        model = config.ai.model,
        maxTokens = config.ai.maxTokens,
        temperature = config.ai.temperature,
        retries = config.whatsapp?.maxRetries || 3,
        initialDelay = config.whatsapp?.retryDelay || 1000,
    } = options;

    let lastError;
    let delay = initialDelay;

    // Check if the message contains a URL shortening request
    const urlMatch = contextMessage.match(/https?:\/\/[^\s]+/);
    const isShortenRequest = contextMessage.toLowerCase().includes('shorten') && urlMatch;

    // If it's a shorten request, handle it directly without AI
    if (isShortenRequest) {
        try {
            const urlToShorten = urlMatch[0];
            console.log(`🔗 Shortening URL: ${urlToShorten}`);
            
            const shortUrl = await createShortUrl(urlToShorten);
            
            if (shortUrl) {
                return `🔗 Here is your shortened link:\n${shortUrl}`;
            } else {
                return '😅 Sorry, I could not shorten the link. Please try again.';
            }
        } catch (error) {
            console.error('❌ URL shortening error:', error);
            return '❌ An error occurred while shortening the link. Please try again later.';
        }
    }

    // For non-shortening requests, use AI
    const messages = [
        { 
            role: 'system', 
            content: `${systemPrompt}` 
        },
        { role: 'user', content: contextMessage }
    ];

    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const response = await groqClient.chat.completions.create({
                model: model,
                messages: messages,
                max_tokens: maxTokens,
                temperature: temperature,
            });

            let aiContent = response.choices[0]?.message?.content || 'No response generated';

            // Post-process AI response for URL shortening
            // In case AI tries to handle shortening but didn't
            if (aiContent.toLowerCase().includes('shorten') && urlMatch) {
                try {
                    const urlToShorten = urlMatch[0];
                    const shortUrl = await createShortUrl(urlToShorten);
                    
                    if (shortUrl) {
                        // Replace the AI's response with the actual shortened URL
                        return `🔗 Here is your shortened link:\n${shortUrl}`;
                    }
                } catch (error) {
                    console.error('❌ Post-processing shortening error:', error);
                }
            }

            // Check if AI response contains DP request or file processing
            try {
                // Try to parse as JSON for DP request or file processing
                const parsed = JSON.parse(aiContent);

                // DP request handling
                if (parsed.action === 'GET_DP' && parsed.phone) {
                    console.log(`📸 Getting DP for: ${parsed.phone}`);
                    const buffer = await getProfilePicBuffer(sock, parsed.phone);
                    
                    if (buffer) {
                        // Return image data with phone number for sending
                        return {
                            type: 'IMAGE',
                            data: buffer,
                            phone: parsed.phone,
                        };
                    } else {
                        return `❌ No profile picture found for ${parsed.phone}`;
                    }
                }

                // File processing (Stream) - UPDATED SECTION
                if (parsed.action === 'PROCESS_FILE' && parsed.url) {
                    console.log(`📥 Processing file from: ${parsed.url}`);
                    const fileData = await getFileStream(parsed.url);
                    
                    if (fileData) {
                        const { stream, mimetype } = fileData;
                        let messagePayload = {};

                        // mimetype එක අනුව පණිවිඩය සකස් කිරීම
                        if (mimetype.startsWith('image/')) {
                            messagePayload = { 
                                image: { stream: stream }, 
                            };
                        } else if (mimetype.startsWith('video/')) {
                            messagePayload = { 
                                video: { stream: stream }, 
                            };
                        } else if (mimetype === 'application/pdf') {
                            messagePayload = { 
                                document: { stream: stream }, 
                                mimetype: 'application/pdf', 
                                fileName: 'file.pdf' 
                            };
                        } else {
                            messagePayload = { 
                                document: { stream: stream }, 
                                mimetype: mimetype, 
                                fileName: 'downloaded_file' 
                            };
                        }

                        await sock.sendMessage(remoteJid, messagePayload);
                        return null; // Message already sent, return null
                    } else {
                        return '❌ Failed to download the file. Please try again.';
                    }
                }

            } catch (e) {
                // Not a JSON response, continue as normal text
                console.log("AI response is not JSON:", aiContent); // Mehema dammaama terminal eke penawa AI eka monawada ewanneth kiyala.
                return aiContent; // JSON nathnam AI eke normal message eka return karanna.
            }

            return aiContent;

        } catch (error) {
            lastError = error;
            
            const isRateLimit = error.status === 429 || 
                              error.message?.includes('overloaded') ||
                              error.message?.includes('rate limit');
            
            if (!isRateLimit || attempt === retries) {
                throw error;
            }

            console.warn(`[AI] Attempt ${attempt}/${retries} failed. Retrying in ${delay}ms...`);
            await new Promise(resolve => setTimeout(resolve, delay));
            delay *= 1.5;
        }
    }

    throw lastError;
};