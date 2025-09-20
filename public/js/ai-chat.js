document.addEventListener('DOMContentLoaded', function() {
    initializeAIChat();
});

function initializeAIChat() {
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');
    const chatMessages = document.getElementById('chatMessages');
    
    sendChatBtn.addEventListener('click', sendAIMessage);
    
    chatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendAIMessage();
        }
    });
    
    chatInput.addEventListener('input', function() {
        this.style.height = 'auto';
        this.style.height = Math.min(this.scrollHeight, 120) + 'px';
    });
}

async function sendAIMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) {
        return;
    }
    
    chatInput.value = '';
    chatInput.style.height = 'auto';
    
    addMessageToChat('user', message);
    
    const typingId = addTypingIndicator();
    
    try {
        const response = await fetch('/api/ai/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        const result = await response.json();
        
        removeTypingIndicator(typingId);
        
        if (result.success) {
            addMessageToChat('ai', result.response);
        } else {
            addMessageToChat('ai', 'Maaf, terjadi kesalahan: ' + (result.message || 'Unknown error'));
        }
    } catch (error) {
        console.error('AI chat error:', error);
        removeTypingIndicator(typingId);
        addMessageToChat('ai', 'Maaf, koneksi bermasalah. Silakan coba lagi.');
    }
    
    chatInput.focus();
}

function addMessageToChat(sender, message) {
    const chatMessages = document.getElementById('chatMessages');
    
    const welcomeMessage = chatMessages.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}`;
    
    const timestamp = new Date().toLocaleTimeString('id-ID', {
        hour: '2-digit',
        minute: '2-digit'
    });
    
    messageDiv.innerHTML = `
        <div class="message-time">${timestamp}</div>
        <div class="message-content">${formatMessage(message)}</div>
    `;
    
    chatMessages.appendChild(messageDiv);
    
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addTypingIndicator() {
    const chatMessages = document.getElementById('chatMessages');
    const typingId = 'typing-' + Date.now();
    
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message ai';
    typingDiv.id = typingId;
    
    typingDiv.innerHTML = `
        <div class="message-content typing-indicator">
            <div class="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
            <span>AI sedang mengetik...</span>
        </div>
    `;
    
    chatMessages.appendChild(typingDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
    
    if (!document.querySelector('#typing-styles')) {
        const styles = document.createElement('style');
        styles.id = 'typing-styles';
        styles.textContent = `
            .typing-indicator {
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .typing-dots {
                display: flex;
                gap: 4px;
            }
            .typing-dots span {
                width: 6px;
                height: 6px;
                background-color: #5f6368;
                border-radius: 50%;
                animation: typing 1.4s ease-in-out infinite both;
            }
            .typing-dots span:nth-child(1) { animation-delay: -0.32s; }
            .typing-dots span:nth-child(2) { animation-delay: -0.16s; }
            .typing-dots span:nth-child(3) { animation-delay: 0s; }
            @keyframes typing {
                0%, 80%, 100% {
                    transform: scale(0.8);
                    opacity: 0.5;
                }
                40% {
                    transform: scale(1);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
    
    return typingId;
}

function removeTypingIndicator(typingId) {
    const typingElement = document.getElementById(typingId);
    if (typingElement) {
        typingElement.remove();
    }
}

function formatMessage(message) {
    message = message
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/`(.*?)`/g, '<code>$1</code>')
        .replace(/\n/g, '<br>');
    
    message = message.replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>');
    
    message = message.replace(/^\* (.+)$/gm, '<li>$1</li>');
    message = message.replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>');
    
    message = message.replace(/^\d+\. (.+)$/gm, '<li>$1</li>');
    
    return message;
}

function clearChat() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = `
        <div class="welcome-message">
            <h3>Selamat datang di AI Chat!</h3>
            <p>Mulai percakapan dengan mengetik pesan di bawah</p>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', function() {
    const aiPageHeader = document.querySelector('#aiPage .page-header');
    if (aiPageHeader) {
        const clearBtn = document.createElement('button');
        clearBtn.className = 'btn btn-secondary';
        clearBtn.textContent = 'Clear Chat';
        clearBtn.style.cssText = 'margin-left: auto; display: block; margin-top: 8px;';
        clearBtn.onclick = clearChat;
        
        aiPageHeader.appendChild(clearBtn);
    }
});