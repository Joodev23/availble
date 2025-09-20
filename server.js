const express = require('express');
const cors = require('cors');
const path = require('path');
const axios = require('axios');
const fs = require('fs-extra');
const WhatsAppService = require('./services/whatsapp');
const MusicService = require('./services/music');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const userLimits = new Map();

const whatsappService = new WhatsAppService();
const musicService = new MusicService();

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
});

app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/ai-chat', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ai-chat.html'));
});

app.get('/music', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'music.html'));
});

app.get('/ngl-spammer', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'ngl-spammer.html'));
});

app.post('/api/login', async (req, res) => {
    try {
        const { username, password } = req.body;
        
        const response = await axios.get('https://raw.githubusercontent.com/Joodev65/availble/refs/heads/main/database.json');
        const users = response.data.users;
        
        const user = users.find(u => u.username === username && u.password === password);
        
        if (user) {
            res.json({ success: true, user: { username: user.username, role: user.role } });
        } else {
            res.json({ success: false, message: 'Anda harus membeli akses untuk menggunakan aplikasi ini' });
        }
    } catch (error) {
        res.json({ success: false, message: 'Error connecting to database' });
    }
});

app.post('/api/whatsapp/connect', async (req, res) => {
    try {
        const { phoneNumber } = req.body;
        
        if (!phoneNumber) {
            return res.json({ success: false, message: 'Nomor telepon diperlukan' });
        }
        
        const pairingCode = await whatsappService.requestPairingCode(phoneNumber);
        res.json({ success: true, pairingCode });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.post('/api/whatsapp/send', async (req, res) => {
    try {
        const { target, version, message } = req.body;
        const userId = req.body.userId || 'anonymous';
        
        const now = Date.now();
        const userLimit = userLimits.get(userId);
        
        if (userLimit && (now - userLimit) < 15 * 60 * 1000) {
            return res.json({ 
                success: false, 
                message: 'Tunggu 15 menit sebelum mengirim pesan lagi',
                nextAvailable: new Date(userLimit + 15 * 60 * 1000).toLocaleTimeString()
            });
        }
        
        const result = await whatsappService.sendMessage(target, version, message);
        
        if (result.success) {
            userLimits.set(userId, now);
        }
        
        res.json(result);
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.get('/api/whatsapp/status', (req, res) => {
    const status = whatsappService.getConnectionStatus();
    res.json(status);
});

app.post('/api/ai/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const API_KEY = "AIzaSyBqxmXKOnC143trXp04VCpjG3aedCRr8ME";
        const API_URL = `https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
        
        const response = await axios.post(API_URL, {
            contents: [{ parts: [{ text: message }] }]
        }, {
            headers: { 'Content-Type': 'application/json' }
        });
        
        if (response.data.candidates && response.data.candidates[0].content.parts[0].text) {
            res.json({ 
                success: true, 
                response: response.data.candidates[0].content.parts[0].text 
            });
        } else {
            res.json({ success: false, message: 'AI response error' });
        }
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.get('/api/music/search', async (req, res) => {
    try {
        const { query } = req.query;
        const results = await musicService.searchTracks(query);
        res.json(results);
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.get('/api/music/track/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const track = await musicService.getTrack(id);
        res.json(track);
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

app.post('/api/ngl/spam', async (req, res) => {
    try {
        const { username, message, count } = req.body;
        
        const results = [];
        for (let i = 0; i < count; i++) {
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            try {
                const response = await axios.post(`https://ngl.link/api/submit`, {
                    username: username,
                    question: message,
                    deviceId: `device_${Math.random().toString(36).substr(2, 9)}`
                });
                
                results.push({ success: true, index: i + 1 });
            } catch (error) {
                results.push({ success: false, index: i + 1, error: error.message });
            }
        }
        
        res.json({ success: true, results });
    } catch (error) {
        res.json({ success: false, message: error.message });
    }
});

cron.schedule('0 * * * *', () => {
    const now = Date.now();
    for (const [userId, timestamp] of userLimits.entries()) {
        if (now - timestamp > 60 * 60 * 1000) { 
            userLimits.delete(userId);
        }
    }
});

app.listen(PORT, () => {
    console.log(`Nocturne Executor running on port ${PORT}`);
    console.log('Starting WhatsApp service...');
    console.log('WhatsApp service ready. Use /api/whatsapp/connect to start.');
});
