document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const loginBtn = loginForm.querySelector('.login-btn');
    const btnText = loginBtn.querySelector('.btn-text');
    const btnLoader = loginBtn.querySelector('.btn-loader');
    const errorModal = document.getElementById('errorModal');

    loginForm.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const username = document.getElementById('username').value.trim();
        const password = document.getElementById('password').value.trim();
        
        if (!username || !password) {
            showError('Username dan password harus diisi');
            return;
        }
        
        setLoadingState(true);
        
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, password })
            });
            
            const result = await response.json();
            
            if (result.success) {
                localStorage.setItem('nocturne_user', JSON.stringify(result.user));
                localStorage.setItem('nocturne_login_time', Date.now().toString());
                
                window.location.href = '/dashboard';
            } else {
                showError(result.message || 'Login gagal');
            }
        } catch (error) {
            console.error('Login error:', error);
            showError('Koneksi gagal. Periksa internet Anda.');
        } finally {
            setLoadingState(false);
        }
    });

    function setLoadingState(loading) {
        if (loading) {
            loginBtn.disabled = true;
            btnText.classList.add('hidden');
            btnLoader.classList.remove('hidden');
        } else {
            loginBtn.disabled = false;
            btnText.classList.remove('hidden');
            btnLoader.classList.add('hidden');
        }
    }

    function showError(message) {
        const modalBody = errorModal.querySelector('.modal-body p');
        modalBody.textContent = message;
        errorModal.classList.remove('hidden');
    }

    document.getElementById('username').focus();
    
    document.getElementById('password').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            loginForm.dispatchEvent(new Event('submit'));
        }
    });
});

function closeModal() {
    document.getElementById('errorModal').classList.add('hidden');
}

document.getElementById('errorModal').addEventListener('click', function(e) {
    if (e.target === this) {
        closeModal();
    }
});

if (localStorage.getItem('nocturne_user')) {
    const loginTime = parseInt(localStorage.getItem('nocturne_login_time') || '0');
    const currentTime = Date.now();
    const sessionDuration = 24 * 60 * 60 * 1000; 
    
    if (currentTime - loginTime < sessionDuration) {
        window.location.href = '/dashboard';
    } else {
        localStorage.removeItem('nocturne_user');
        localStorage.removeItem('nocturne_login_time');
    }
}