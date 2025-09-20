document.addEventListener('DOMContentLoaded', function() {
    initializeWhatsApp();
    checkConnectionStatus();    
    setInterval(checkConnectionStatus, 5000);
});

function initializeWhatsApp() {
    const connectBtn = document.getElementById('connectBtn');
    const sendBtn = document.getElementById('sendBtn');
    
    connectBtn.removeEventListener('click', requestPairingCode);
    sendBtn.removeEventListener('click', sendWhatsAppMessage);
    
    connectBtn.addEventListener('click', requestPairingCode);
    sendBtn.addEventListener('click', sendWhatsAppMessage);
    
    const targetInput = document.getElementById('targetNumber');
    targetInput.addEventListener('input', formatPhoneNumber);
}

async function requestPairingCode() {
 
    let phoneNumber = prompt('Masukkan nomor WhatsApp Anda (contoh: 628123456789 atau 08123456789):');
    
    if (!phoneNumber) {
        return;
    }
    
    let cleanNumber = phoneNumber.replace(/\D/g, '');
    
    if (cleanNumber.startsWith('08')) {
        cleanNumber = '62' + cleanNumber.substring(1);
    } else if (cleanNumber.startsWith('8') && cleanNumber.length >= 9) {
        cleanNumber = '62' + cleanNumber;
    }
    
    if (cleanNumber.length < 10 || cleanNumber.length > 15) {
        showNotification('Format nomor tidak valid. Gunakan format: 628123456789', 'error');
        return;
    }
    
    if (!cleanNumber.startsWith('62')) {
        showNotification('Nomor harus diawali dengan 62 (kode negara Indonesia)', 'error');
        return;
    }
    
    const connectBtn = document.getElementById('connectBtn');
    const originalText = connectBtn.textContent;
    
    try {
        connectBtn.textContent = 'Generating Code...';
        connectBtn.disabled = true;
        showLoading();
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);  
        
        const response = await fetch('/api/whatsapp/connect', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ phoneNumber: cleanNumber }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.success && result.pairingCode) {
            showPairingCode(result.pairingCode, cleanNumber);
            showNotification('Kode pairing berhasil dibuat! Masukkan kode ke WhatsApp Anda dalam 2 menit.', 'success');
            
            setTimeout(() => {
                hidePairingCode();
                showNotification('Kode pairing expired. Request kode baru jika diperlukan.', 'warning');
            }, 120000);
        } else {
            throw new Error(result.message || 'Gagal membuat kode pairing');
        }
    } catch (error) {
        console.error('Pairing code error:', error);
        
        if (error.name === 'AbortError') {
            showNotification('Request timeout. Periksa koneksi internet dan coba lagi.', 'error');
        } else if (error.message.includes('HTTP 500')) {
            showNotification('Server error. Restart aplikasi dan coba lagi.', 'error');
        } else {
            showNotification(error.message || 'Koneksi gagal. Periksa internet Anda.', 'error');
        }
    } finally {
        connectBtn.textContent = originalText;
        connectBtn.disabled = false;
        hideLoading();
    }
}

function showPairingCode(code, phoneNumber) {
    const codeContainer = document.getElementById('codeContainer');
    const pairingCodeDisplay = document.getElementById('pairingCodeDisplay');
    
    pairingCodeDisplay.textContent = code;
    codeContainer.classList.remove('hidden');
    
    if (!codeContainer.querySelector('.pairing-instructions')) {
        const instructions = document.createElement('div');
        instructions.className = 'pairing-instructions';
        instructions.innerHTML = `
            <div style="margin-top: 16px; padding: 12px; background: #e8f0fe; border-radius: 8px; font-size: 13px;">
                <strong>Langkah-langkah:</strong>
                <ol style="margin: 8px 0 0 20px; padding: 0;">
                    <li>Buka WhatsApp di HP (${phoneNumber})</li>
                    <li>Tap menu ⋮ → "Perangkat Tertaut"</li>
                    <li>Tap "Tautkan Perangkat"</li>
                    <li>Pilih "Tautkan dengan Nomor Telepon"</li>
                    <li>Masukkan kode: <strong>${code}</strong></li>
                </ol>
                <p style="margin: 8px 0 0; color: #d93025;"><strong>Kode berlaku 2 menit</strong></p>
            </div>
        `;
        codeContainer.appendChild(instructions);
    }
}

function hidePairingCode() {
    const codeContainer = document.getElementById('codeContainer');
    codeContainer.classList.add('hidden');
    
    const instructions = codeContainer.querySelector('.pairing-instructions');
    if (instructions) {
        instructions.remove();
    }
}

async function checkConnectionStatus() {
    try {
        const response = await fetch('/api/whatsapp/status', {
            timeout: 5000
        });
        
        if (!response.ok) {
            throw new Error('Status check failed');
        }
        
        const status = await response.json();
        updateUI(status);
        
    } catch (error) {
        console.error('Status check error:', error);
        
        updateUI({
            connected: false,
            error: true,
            message: 'Cannot connect to server'
        });
    }
}

function updateUI(status) {
    const statusIndicator = document.getElementById('connectionStatus');
    const statusDot = statusIndicator.querySelector('.status-dot');
    const statusText = statusIndicator.querySelector('span');
    const connectBtn = document.getElementById('connectBtn');
    const sendBtn = document.getElementById('sendBtn');
    
    if (status.error) {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Server Error';
        connectBtn.textContent = 'Retry Connection';
        connectBtn.disabled = false;
        sendBtn.disabled = true;
        return;
    }
    
    if (status.connected) {
        statusDot.className = 'status-dot online';
        statusText.textContent = `Connected${status.phoneNumber ? ` (${status.phoneNumber})` : ''}`;
        connectBtn.textContent = 'Reconnect';
        connectBtn.classList.remove('btn-primary');
        connectBtn.classList.add('btn-success');
        sendBtn.disabled = false;
        
        if (!document.getElementById('codeContainer').classList.contains('hidden')) {
            hidePairingCode();
            showNotification('WhatsApp berhasil terhubung!', 'success');
        }
    } else if (status.isInitializing) {
        statusDot.className = 'status-dot connecting';
        statusText.textContent = 'Connecting...';
        connectBtn.textContent = 'Connecting...';
        connectBtn.disabled = true;
        sendBtn.disabled = true;
    } else {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Disconnected';
        connectBtn.textContent = 'Connect WhatsApp';
        connectBtn.classList.remove('btn-success');
        connectBtn.classList.add('btn-primary');
        connectBtn.disabled = false;
        sendBtn.disabled = true;
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
    
    if (!confirm(`Yakin ingin mengirim bug ${messageVersion.toUpperCase()} ke ${targetNumber}?\n\n⚠️ Gunakan dengan bertanggung jawab!`)) {
        return;
    }
    
    const sendBtn = document.getElementById('sendBtn');
    const originalText = sendBtn.textContent;
    
    try {
        sendBtn.textContent = 'Sending Bugs...';
        sendBtn.disabled = true;
        showLoading();
        
        const user = JSON.parse(localStorage.getItem('nocturne_user') || '{}');
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); 
        
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
            }),
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`Bug ${messageVersion.toUpperCase()} berhasil dikirim ke ${targetNumber}`, 'success');
            
            document.getElementById('targetNumber').value = '';
            
            if (result.nextAvailable) {
                showRateLimit(result.nextAvailable);
            }
        } else {
            throw new Error(result.message || 'Gagal mengirim pesan');
        }
    } catch (error) {
        console.error('Send message error:', error);
        
        if (error.name === 'AbortError') {
            showNotification('Request timeout. Proses memakan waktu terlalu lama.', 'error');
        } else {
            showNotification(error.message || 'Gagal mengirim pesan', 'error');
        }
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