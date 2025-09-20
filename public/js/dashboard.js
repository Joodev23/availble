document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    
    initializeUI();
    
    loadUserInfo();
    
    setupNavigation();
    
    setupSidebar();
});

function checkAuth() {
    const user = localStorage.getItem('nocturne_user');
    const loginTime = parseInt(localStorage.getItem('nocturne_login_time') || '0');
    const currentTime = Date.now();
    const sessionDuration = 24 * 60 * 60 * 1000; 
    
    if (!user || currentTime - loginTime > sessionDuration) {
        localStorage.removeItem('nocturne_user');
        localStorage.removeItem('nocturne_login_time');
        window.location.href = '/';
        return;
    }
}

function loadUserInfo() {
    const userStr = localStorage.getItem('nocturne_user');
    if (userStr) {
        const user = JSON.parse(userStr);
        document.getElementById('currentUser').textContent = user.username;
    }
}

function initializeUI() {
    const hash = window.location.hash.substr(1) || 'main';
    setActivePage(hash);
}

function setupNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const page = this.getAttribute('data-page');
            setActivePage(page);
            
            if (window.innerWidth <= 768) {
                closeSidebar();
            }
        });
    });
}

function setupSidebar() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('open');
        mainContent.classList.toggle('sidebar-open');
    });
    
    document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768) {
            if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
                closeSidebar();
            }
        }
    });
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    
    sidebar.classList.remove('open');
    mainContent.classList.remove('sidebar-open');
}

function setActivePage(pageName) {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-page') === pageName) {
            item.classList.add('active');
        }
    });
    
    document.querySelectorAll('.page').forEach(page => {
        page.classList.remove('active');
    });
    
    const targetPage = document.getElementById(pageName + 'Page');
    if (targetPage) {
        targetPage.classList.add('active');
    }
    
    window.location.hash = pageName;
}

function logout() {
    if (confirm('Yakin ingin logout?')) {
        localStorage.removeItem('nocturne_user');
        localStorage.removeItem('nocturne_login_time');
        window.location.href = '/';
    }
}

function showLoading() {
    document.getElementById('loadingOverlay').classList.remove('hidden');
}

function hideLoading() {
    document.getElementById('loadingOverlay').classList.add('hidden');
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span>${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;
    
    if (!document.querySelector('#notification-styles')) {
        const styles = document.createElement('style');
        styles.id = 'notification-styles';
        styles.textContent = `
            .notification {
                position: fixed;
                top: 80px;
                right: 20px;
                background: white;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                z-index: 1001;
                min-width: 300px;
                animation: slideIn 0.3s ease;
            }
            .notification.success { border-left: 4px solid #34a853; }
            .notification.error { border-left: 4px solid #ea4335; }
            .notification.warning { border-left: 4px solid #fbbc04; }
            .notification-content {
                padding: 16px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .notification-close {
                background: none;
                border: none;
                font-size: 18px;
                cursor: pointer;
                color: #5f6368;
            }
            @keyframes slideIn {
                from { transform: translateX(100%); opacity: 0; }
                to { transform: translateX(0); opacity: 1; }
            }
        `;
        document.head.appendChild(styles);
    }
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

window.addEventListener('hashchange', function() {
    const hash = window.location.hash.substr(1) || 'main';
    setActivePage(hash);
});

window.addEventListener('resize', function() {
    if (window.innerWidth > 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('mainContent').classList.remove('sidebar-open');
    }
});