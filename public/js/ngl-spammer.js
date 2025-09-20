document.addEventListener('DOMContentLoaded', function() {
    initializeNGLSpammer();
});

function initializeNGLSpammer() {
    const sendNglBtn = document.getElementById('sendNglBtn');
    sendNglBtn.addEventListener('click', sendNGLMessages);
    
    const nglMessage = document.getElementById('nglMessage');
    addCharacterCounter(nglMessage, 300);
}

function addCharacterCounter(textarea, maxLength) {
    const counter = document.createElement('div');
    counter.className = 'character-counter';
    counter.style.cssText = `
        text-align: right;
        font-size: 12px;
        color: var(--text-secondary);
        margin-top: 4px;
    `;
    
    textarea.parentNode.appendChild(counter);
    
    const updateCounter = () => {
        const remaining = maxLength - textarea.value.length;
        counter.textContent = `${textarea.value.length}/${maxLength}`;
        
        if (remaining < 0) {
            counter.style.color = 'var(--error-color)';
            textarea.value = textarea.value.substring(0, maxLength);
        } else if (remaining < 50) {
            counter.style.color = 'var(--warning-color)';
        } else {
            counter.style.color = 'var(--text-secondary)';
        }
    };
    
    textarea.addEventListener('input', updateCounter);
    updateCounter();
}

async function sendNGLMessages() {
    const username = document.getElementById('nglUsername').value.trim();
    const message = document.getElementById('nglMessage').value.trim();
    const count = parseInt(document.getElementById('nglCount').value) || 1;
    
    if (!username) {
        showNotification('Username NGL harus diisi', 'error');
        return;
    }
    
    if (!message) {
        showNotification('Pesan harus diisi', 'error');
        return;
    }
    
    if (count < 1 || count > 50) {
        showNotification('Jumlah pesan harus antara 1-50', 'error');
        return;
    }
    
    if (!confirm(`Yakin ingin mengirim ${count} pesan ke @${username}?\n\nPeringatan: Gunakan fitur ini dengan bijak dan bertanggung jawab!`)) {
        return;
    }
    
    const sendBtn = document.getElementById('sendNglBtn');
    const originalText = sendBtn.textContent;
    const resultsContainer = document.getElementById('nglResults');
    
    try {
        sendBtn.textContent = 'Sending...';
        sendBtn.disabled = true;
        showLoading();
        
        resultsContainer.innerHTML = `
            <div class="progress-info">
                <h4>Mengirim pesan ke @${username}</h4>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: 0%"></div>
                </div>
                <div class="progress-text">0 / ${count} pesan</div>
            </div>
        `;
        
        const response = await fetch('/api/ngl/spam', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username,
                message,
                count
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            displayNGLResults(result.results, username);
            
            const successCount = result.results.filter(r => r.success).length;
            const failCount = result.results.length - successCount;
            
            if (successCount > 0) {
                showNotification(`Berhasil mengirim ${successCount} pesan ke @${username}`, 'success');
            }
            
            if (failCount > 0) {
                showNotification(`${failCount} pesan gagal dikirim`, 'warning');
            }
        } else {
            resultsContainer.innerHTML = `
                <div class="error-message">
                    <h4>Gagal mengirim pesan</h4>
                    <p>${result.message || 'Terjadi kesalahan tidak diketahui'}</p>
                </div>
            `;
            showNotification(result.message || 'Gagal mengirim pesan', 'error');
        }
    } catch (error) {
        console.error('NGL spam error:', error);
        resultsContainer.innerHTML = `
            <div class="error-message">
                <h4>Koneksi Bermasalah</h4>
                <p>Periksa koneksi internet Anda dan coba lagi</p>
            </div>
        `;
        showNotification('Koneksi gagal. Periksa internet Anda.', 'error');
    } finally {
        sendBtn.textContent = originalText;
        sendBtn.disabled = false;
        hideLoading();
    }
}

function displayNGLResults(results, username) {
    const resultsContainer = document.getElementById('nglResults');
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    
    let html = `
        <div class="results-summary">
            <h4>Hasil Pengiriman ke @${username}</h4>
            <div class="summary-stats">
                <div class="stat success">
                    <span class="stat-number">${successCount}</span>
                    <span class="stat-label">Berhasil</span>
                </div>
                <div class="stat error">
                    <span class="stat-number">${failCount}</span>
                    <span class="stat-label">Gagal</span>
                </div>
                <div class="stat total">
                    <span class="stat-number">${results.length}</span>
                    <span class="stat-label">Total</span>
                </div>
            </div>
        </div>
        
        <div class="results-details">
            <h5>Detail Hasil:</h5>
            <div class="results-list">
    `;
    
    results.forEach((result, index) => {
        html += `
            <div class="result-item ${result.success ? 'success' : 'error'}">
                <span class="result-index">#${result.index}</span>
                <span class="result-status">
                    ${result.success ? 
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 12l2 2 4-4"></path><circle cx="12" cy="12" r="10"></circle></svg> Berhasil' : 
                        '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Gagal'
                    }
                </span>
                ${!result.success && result.error ? `<span class="result-error">${result.error}</span>` : ''}
            </div>
        `;
    });
    
    html += `
            </div>
        </div>
        
        <div class="results-footer">
            <button class="btn btn-secondary" onclick="clearNGLResults()">Clear Results</button>
            <small class="disclaimer">Gunakan fitur ini dengan bijak dan bertanggung jawab. Spam berlebihan dapat melanggar Terms of Service NGL.</small>
        </div>
    `;
    
    resultsContainer.innerHTML = html;
    
    if (!document.querySelector('#ngl-results-styles')) {
        const styles = document.createElement('style');
        styles.id = 'ngl-results-styles';
        styles.textContent = `
            .progress-info {
                text-align: center;
                padding: 20px;
            }
            .progress-bar {
                width: 100%;
                height: 8px;
                background: var(--border-color);
                border-radius: 4px;
                margin: 16px 0;
                overflow: hidden;
            }
            .progress-fill {
                height: 100%;
                background: var(--primary-color);
                transition: width 0.3s ease;
            }
            .progress-text {
                color: var(--text-secondary);
                font-size: 14px;
            }
            .results-summary {
                margin-bottom: 24px;
            }
            .results-summary h4 {
                margin-bottom: 16px;
                color: var(--text-primary);
            }
            .summary-stats {
                display: flex;
                gap: 16px;
                justify-content: center;
            }
            .stat {
                display: flex;
                flex-direction: column;
                align-items: center;
                padding: 12px 16px;
                border-radius: 8px;
                background: var(--surface-color);
            }
            .stat.success { border-left: 4px solid var(--success-color); }
            .stat.error { border-left: 4px solid var(--error-color); }
            .stat.total { border-left: 4px solid var(--primary-color); }
            .stat-number {
                font-size: 24px;
                font-weight: 600;
                line-height: 1;
            }
            .stat.success .stat-number { color: var(--success-color); }
            .stat.error .stat-number { color: var(--error-color); }
            .stat.total .stat-number { color: var(--primary-color); }
            .stat-label {
                font-size: 12px;
                color: var(--text-secondary);
                margin-top: 4px;
            }
            .results-details h5 {
                margin-bottom: 12px;
                color: var(--text-primary);
            }
            .results-list {
                max-height: 300px;
                overflow-y: auto;
                border: 1px solid var(--border-color);
                border-radius: 8px;
            }
            .result-item {
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 8px 16px;
                border-bottom: 1px solid var(--border-color);
                font-size: 14px;
            }
            .result-item:last-child {
                border-bottom: none;
            }
            .result-item.success {
                background: rgba(52, 168, 83, 0.05);
            }
            .result-item.error {
                background: rgba(234, 67, 53, 0.05);
            }
            .result-index {
                font-weight: 500;
                min-width: 30px;
            }
            .result-status {
                display: flex;
                align-items: center;
                gap: 6px;
                flex: 1;
            }
            .result-item.success .result-status {
                color: var(--success-color);
            }
            .result-item.error .result-status {
                color: var(--error-color);
            }
            .result-error {
                font-size: 12px;
                color: var(--text-secondary);
                background: rgba(234, 67, 53, 0.1);
                padding: 2px 6px;
                border-radius: 4px;
            }
            .results-footer {
                margin-top: 20px;
                text-align: center;
            }
            .disclaimer {
                display: block;
                margin-top: 12px;
                color: var(--warning-color);
                font-style: italic;
            }
            .error-message {
                text-align: center;
                padding: 40px 20px;
                color: var(--error-color);
            }
            .error-message h4 {
                margin-bottom: 8px;
            }
        `;
        document.head.appendChild(styles);
    }
}

function clearNGLResults() {
    document.getElementById('nglResults').innerHTML = '';
    
    document.getElementById('nglUsername').value = '';
    document.getElementById('nglMessage').value = '';
    document.getElementById('nglCount').value = '5';
    
    const messageTextarea = document.getElementById('nglMessage');
    messageTextarea.dispatchEvent(new Event('input'));
}

document.addEventListener('DOMContentLoaded', function() {
    const nglPage = document.getElementById('nglPage');
    if (nglPage) {
        const warningDiv = document.createElement('div');
        warningDiv.className = 'safety-warning';
        warningDiv.innerHTML = `
            <div class="warning-content">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <div>
                    <strong>Peringatan Penting:</strong>
                    <p>NGL Spammer hanya untuk testing dan edukasi. Penggunaan berlebihan dapat melanggar terms of service dan merugikan pengguna lain. Gunakan dengan bijak dan bertanggung jawab!</p>
                </div>
            </div>
        `;
        
        warningDiv.style.cssText = `
            background: rgba(251, 188, 4, 0.1);
            border: 1px solid var(--warning-color);
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
        `;
        
        const style = document.createElement('style');
        style.textContent = `
            .warning-content {
                display: flex;
                align-items: flex-start;
                gap: 12px;
            }
            .warning-content svg {
                color: var(--warning-color);
                flex-shrink: 0;
                margin-top: 2px;
            }
            .warning-content strong {
                color: var(--warning-color);
            }
            .warning-content p {
                margin: 4px 0 0;
                font-size: 14px;
                line-height: 1.5;
            }
        `;
        document.head.appendChild(style);
        
        const pageHeader = nglPage.querySelector('.page-header');
        pageHeader.after(warningDiv);
    }
});