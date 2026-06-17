// index.js
import express from 'express';
import cors from 'cors';
import { WhatsAppService } from './services/whatsapp.js';

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

console.log('🤖 Starting Kaela WhatsApp Bot...');
console.log('📖 Loading configuration...');

const whatsappService = new WhatsAppService();
let currentQRResponse = null;
let connectionStatus = 'disconnected';

// Store QR callback
whatsappService.setQRCallback((qrResponse) => {
    currentQRResponse = qrResponse;
    connectionStatus = 'qr_ready';
    console.log('📱 QR Code generated and available via API');
});

// Start the bot connection
whatsappService.connect().catch(err => {
    console.error('❌ Critical initialization error:', err);
    connectionStatus = 'error';
});

// ============ API Routes ============

/**
 * GET /qr
 * Get QR code as JSON with base64 image
 * Optional query parameter: number
 * Example: /qr?number=1234567890
 */
app.get('/qr', (req, res) => {
    try {
        const phoneNumber = req.query.number;
        
        // Check if bot is already connected
        if (whatsappService.isConnected) {
            return res.status(200).json({
                status: 'already_connected',
                message: 'Bot is already connected to WhatsApp',
                connection: {
                    status: 'connected',
                    jid: whatsappService.sock?.user?.id,
                    name: whatsappService.sock?.user?.name || 'Kaela'
                },
                timestamp: new Date().toISOString()
            });
        }

        // Check if QR code is ready
        if (!currentQRResponse) {
            return res.status(202).json({
                status: 'waiting',
                message: 'QR code is being generated, please wait...',
                connection: {
                    status: connectionStatus
                },
                timestamp: new Date().toISOString()
            });
        }

        // Return QR code with base64 image
        const response = {
            status: 'qr_ready',
            message: 'QR code generated successfully',
            qr: {
                base64: currentQRResponse.qr.base64,
                data: currentQRResponse.qr.data
            },
            phoneNumber: phoneNumber || null,
            instructions: phoneNumber 
                ? `Scan this QR code with WhatsApp on phone number ${phoneNumber}`
                : 'Scan this QR code with WhatsApp',
            connection: {
                status: connectionStatus,
                isConnected: whatsappService.isConnected
            },
            timestamp: new Date().toISOString()
        };

        res.status(200).json(response);
        
    } catch (error) {
        console.error('❌ Error in /qr endpoint:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to generate QR code',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /qr/base64
 * Get QR code as base64 string only (for easy embedding)
 */
app.get('/qr/base64', (req, res) => {
    try {
        if (whatsappService.isConnected) {
            return res.status(400).json({
                status: 'error',
                message: 'Bot is already connected to WhatsApp'
            });
        }

        if (!currentQRResponse) {
            return res.status(202).json({
                status: 'waiting',
                message: 'QR code is being generated, please wait...'
            });
        }

        // Return only the base64 string
        res.status(200).json({
            status: 'success',
            base64: currentQRResponse.qr.base64,
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in /qr/base64 endpoint:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get QR base64',
            error: error.message
        });
    }
});

/**
 * GET /qr/image
 * Get QR code as base64 image data
 */
app.get('/qr/image', (req, res) => {
    try {
        if (whatsappService.isConnected) {
            return res.status(200).json({
                status: 'already_connected',
                message: 'Bot is already connected to WhatsApp'
            });
        }

        if (!currentQRResponse) {
            return res.status(202).json({
                status: 'waiting',
                message: 'QR code is being generated, please wait...'
            });
        }

        res.status(200).json({
            status: 'success',
            image: {
                base64: currentQRResponse.qr.base64,
                mimeType: 'image/png',
                dataUrl: `data:image/png;base64,${currentQRResponse.qr.base64}`
            },
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error in /qr/image endpoint:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to get QR image',
            error: error.message
        });
    }
});

/**
 * GET /qr/html
 * Simple HTML page to display QR code (for browser viewing)
 */
app.get('/qr/html', (req, res) => {
    try {
        const phoneNumber = req.query.number || '';
        
        if (whatsappService.isConnected) {
            return res.status(200).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WhatsApp Bot - Connected</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #075e54 0%, #128c7e 100%);
                            color: white;
                        }
                        .container {
                            text-align: center;
                            background: rgba(255,255,255,0.1);
                            padding: 40px;
                            border-radius: 20px;
                            backdrop-filter: blur(10px);
                        }
                        .icon {
                            font-size: 64px;
                            margin-bottom: 20px;
                        }
                        h1 { margin: 0 0 10px 0; }
                        .status { color: #4caf50; font-weight: bold; }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="icon">✅</div>
                        <h1>Bot Connected</h1>
                        <p class="status">WhatsApp is already connected</p>
                        <p>JID: ${whatsappService.sock?.user?.id || 'N/A'}</p>
                        <p>Name: ${whatsappService.sock?.user?.name || 'Kaela'}</p>
                    </div>
                </body>
                </html>
            `);
        }

        if (!currentQRResponse) {
            return res.status(202).send(`
                <!DOCTYPE html>
                <html>
                <head>
                    <title>WhatsApp Bot - Loading</title>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <style>
                        body {
                            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                            display: flex;
                            justify-content: center;
                            align-items: center;
                            height: 100vh;
                            margin: 0;
                            background: linear-gradient(135deg, #075e54 0%, #128c7e 100%);
                            color: white;
                        }
                        .container {
                            text-align: center;
                            background: rgba(255,255,255,0.1);
                            padding: 40px;
                            border-radius: 20px;
                            backdrop-filter: blur(10px);
                        }
                        .loader {
                            border: 4px solid rgba(255,255,255,0.3);
                            border-top: 4px solid white;
                            border-radius: 50%;
                            width: 50px;
                            height: 50px;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 20px;
                        }
                        @keyframes spin {
                            0% { transform: rotate(0deg); }
                            100% { transform: rotate(360deg); }
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="loader"></div>
                        <h1>Generating QR Code</h1>
                        <p>Please wait...</p>
                    </div>
                </body>
                </html>
            `);
        }

        // Display QR code
        const qrBase64 = currentQRResponse.qr.base64;
        res.status(200).send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>WhatsApp Bot - QR Code</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        min-height: 100vh;
                        margin: 0;
                        background: linear-gradient(135deg, #075e54 0%, #128c7e 100%);
                        color: white;
                        padding: 20px;
                    }
                    .container {
                        text-align: center;
                        background: rgba(255,255,255,0.95);
                        padding: 40px;
                        border-radius: 20px;
                        box-shadow: 0 20px 60px rgba(0,0,0,0.3);
                        max-width: 500px;
                        width: 100%;
                    }
                    .qr-image {
                        width: 100%;
                        max-width: 300px;
                        height: auto;
                        margin: 20px 0;
                        border-radius: 10px;
                        background: white;
                        padding: 10px;
                    }
                    h1 {
                        color: #075e54;
                        margin: 0 0 10px 0;
                        font-size: 24px;
                    }
                    .subtitle {
                        color: #666;
                        margin: 0 0 20px 0;
                    }
                    .instructions {
                        background: #f0f7f6;
                        padding: 15px;
                        border-radius: 10px;
                        color: #075e54;
                        margin: 20px 0;
                        font-size: 14px;
                    }
                    .phone {
                        color: #128c7e;
                        font-weight: bold;
                        font-size: 18px;
                    }
                    .refresh {
                        background: #075e54;
                        color: white;
                        border: none;
                        padding: 12px 30px;
                        border-radius: 50px;
                        font-size: 16px;
                        cursor: pointer;
                        margin-top: 10px;
                        transition: all 0.3s;
                    }
                    .refresh:hover {
                        background: #128c7e;
                        transform: scale(1.05);
                    }
                    .status-badge {
                        display: inline-block;
                        padding: 5px 15px;
                        background: #4caf50;
                        color: white;
                        border-radius: 20px;
                        font-size: 12px;
                        margin-top: 10px;
                    }
                    .footer {
                        margin-top: 20px;
                        color: #999;
                        font-size: 12px;
                    }
                    @media (max-width: 600px) {
                        .container { padding: 20px; }
                        h1 { font-size: 20px; }
                        .qr-image { max-width: 200px; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <h1>📱 Scan QR Code</h1>
                    <p class="subtitle">Connect your WhatsApp account</p>
                    
                    <img src="data:image/png;base64,${qrBase64}" alt="QR Code" class="qr-image"/>
                    
                    ${phoneNumber ? `<p class="phone">📞 Phone: +${phoneNumber}</p>` : ''}
                    
                    <div class="instructions">
                        <strong>Instructions:</strong><br>
                        1. Open WhatsApp on your phone<br>
                        2. Go to Settings → Linked Devices<br>
                        3. Scan this QR code
                        ${phoneNumber ? `<br>4. Using phone number: +${phoneNumber}` : ''}
                    </div>
                    
                    <button class="refresh" onclick="window.location.href='/qr/html${phoneNumber ? `?number=${phoneNumber}` : ''}'">
                        🔄 Refresh QR
                    </button>
                    
                    <div style="margin-top: 10px;">
                        <span class="status-badge">${connectionStatus === 'qr_ready' ? '🟢 Ready to Scan' : '⏳ Loading...'}</span>
                    </div>
                    
                    <div class="footer">
                        <a href="/status" style="color: #075e54; text-decoration: none;">Check Status</a>
                        &nbsp;|&nbsp;
                        <a href="/qr" style="color: #075e54; text-decoration: none;">JSON Data</a>
                    </div>
                </div>
                <script>
                    // Auto-refresh every 30 seconds if not connected
                    setInterval(() => {
                        fetch('/status')
                            .then(res => res.json())
                            .then(data => {
                                if (data.status === 'connected') {
                                    window.location.reload();
                                }
                            })
                            .catch(() => {});
                    }, 30000);
                </script>
            </body>
            </html>
        `);
        
    } catch (error) {
        console.error('❌ Error in /qr/html endpoint:', error);
        res.status(500).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Error</title></head>
            <body>
                <h1>Error</h1>
                <p>Failed to load QR code: ${error.message}</p>
            </body>
            </html>
        `);
    }
});

/**
 * GET /status
 * Get bot connection status
 */
app.get('/status', (req, res) => {
    const status = whatsappService.getConnectionStatus();
    res.json({
        status: whatsappService.isConnected ? 'connected' : connectionStatus,
        details: {
            isConnected: status.isConnected,
            reconnectAttempts: status.reconnectAttempts,
            queueSize: status.queueSize,
            cacheSize: status.cacheSize,
            lastActivity: status.lastActivity ? new Date(status.lastActivity).toISOString() : null
        },
        user: whatsappService.isConnected ? {
            jid: whatsappService.sock?.user?.id,
            name: whatsappService.sock?.user?.name || 'Kaela'
        } : null,
        timestamp: new Date().toISOString()
    });
});

/**
 * POST /refresh-qr
 * Force refresh QR code
 */
app.post('/refresh-qr', async (req, res) => {
    try {
        if (whatsappService.isConnected) {
            return res.status(400).json({
                status: 'error',
                message: 'Bot is already connected, cannot refresh QR'
            });
        }

        // Reset QR state
        currentQRResponse = null;
        connectionStatus = 'disconnected';
        
        // Force reconnection
        await whatsappService.disconnect();
        await whatsappService.connect();
        
        res.json({
            status: 'success',
            message: 'QR code refresh initiated',
            timestamp: new Date().toISOString()
        });
        
    } catch (error) {
        console.error('❌ Error refreshing QR:', error);
        res.status(500).json({
            status: 'error',
            message: 'Failed to refresh QR code',
            error: error.message
        });
    }
});

/**
 * GET /health
 * Health check endpoint
 */
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'kaela-whatsapp-bot',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

/**
 * GET /
 * Root endpoint with documentation
 */
app.get('/', (req, res) => {
    res.json({
        name: 'Kaela WhatsApp Bot API',
        version: '1.0.0',
        endpoints: {
            '/qr': 'Get QR code as JSON with base64 (optional ?number=PHONE)',
            '/qr/base64': 'Get QR as base64 string only',
            '/qr/image': 'Get QR as base64 image data with metadata',
            '/qr/html': 'View QR in browser (optional ?number=PHONE)',
            '/status': 'Get bot connection status',
            '/refresh-qr': 'Force refresh QR code (POST)',
            '/health': 'Health check'
        },
        status: whatsappService.isConnected ? 'connected' : connectionStatus,
        timestamp: new Date().toISOString()
    });
});

// ============ Error Handling Middleware ============
app.use((err, req, res, next) => {
    console.error('❌ Server error:', err);
    res.status(500).json({
        status: 'error',
        message: 'Internal server error',
        error: err.message
    });
});

// ============ Start Server ============
app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`\n📱 QR Code endpoints:`);
    console.log(`   • JSON with base64: http://localhost:${PORT}/qr?number=1234567890`);
    console.log(`   • Base64 only: http://localhost:${PORT}/qr/base64`);
    console.log(`   • Image data: http://localhost:${PORT}/qr/image`);
    console.log(`   • HTML view: http://localhost:${PORT}/qr/html?number=1234567890`);
    console.log(`   • Status: http://localhost:${PORT}/status`);
    console.log(`   • Refresh QR: POST http://localhost:${PORT}/refresh-qr`);
    console.log(`\n📖 API Documentation: http://localhost:${PORT}`);
    console.log('\n💡 Press Ctrl+C to stop\n');
});

// ============ Graceful Shutdown ============
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
