document.addEventListener('DOMContentLoaded', function() {
  const audioElements = document.querySelectorAll('audio');
  
  audioElements.forEach(audio => {
    // Tambahkan loading state
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'audio-loading';
    loadingDiv.innerHTML = 'Loading...';
    audio.parentNode.insertBefore(loadingDiv, audio);
    
    // Ketika audio siap diputar
    audio.addEventListener('loadeddata', () => {
      loadingDiv.style.display = 'none';
      audio.style.display = 'block';
    });
    
    // Jika terjadi error
    audio.addEventListener('error', (e) => {
      console.error('Error loading audio:', e);
      loadingDiv.innerHTML = 'Error loading audio. Please try again.';
      loadingDiv.classList.add('audio-error');
    });
    
    // Tambahkan controls jika belum ada
    if (!audio.hasAttribute('controls')) {
      audio.controls = true;
    }
  });
});

document.addEventListener('DOMContentLoaded', function() {
    initializeMusicPlayer();
});

let currentTrack = null;
let audioPlayer = null;

function initializeMusicPlayer() {
    const searchBtn = document.getElementById('searchBtn');
    const musicSearch = document.getElementById('musicSearch');
    const musicPlayer = document.getElementById('musicPlayer');
    
    searchBtn.addEventListener('click', searchMusic);
    musicSearch.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            searchMusic();
        }
    });
    
    audioPlayer = document.getElementById('audioPlayer');
    audioPlayer.addEventListener('ended', onTrackEnded);
    audioPlayer.addEventListener('play', onTrackPlay);
    audioPlayer.addEventListener('pause', onTrackPause);
    
    const playBtn = document.getElementById('playBtn');
    playBtn.addEventListener('click', togglePlayPause);
}

async function searchMusic() {
    const query = document.getElementById('musicSearch').value.trim();
    const resultsContainer = document.getElementById('musicResults');
    
    if (!query) {
        showNotification('Masukkan kata kunci pencarian', 'warning');
        return;
    }
    
    resultsContainer.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Mencari musik...</p>
        </div>
    `;
    
    try {
        const response = await fetch(`/api/music/search?query=${encodeURIComponent(query)}`);
        const result = await response.json();
        
        if (result.success && result.tracks.length > 0) {
            displaySearchResults(result.tracks);
        } else {
            resultsContainer.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="11" cy="11" r="8"></circle>
                        <path d="m21 21-4.35-4.35"></path>
                    </svg>
                    <p>Tidak ada hasil untuk "${query}"</p>
                    <small>${result.message || 'Coba kata kunci lain'}</small>
                </div>
            `;
        }
    } catch (error) {
        console.error('Music search error:', error);
        resultsContainer.innerHTML = `
            <div class="empty-state">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>
                    <line x1="12" y1="9" x2="12" y2="13"></line>
                    <line x1="12" y1="17" x2="12.01" y2="17"></line>
                </svg>
                <p>Koneksi bermasalah</p>
                <small>Periksa koneksi internet atau konfigurasi Spotify API</small>
            </div>
        `;
    }
}

function displaySearchResults(tracks) {
    const resultsContainer = document.getElementById('musicResults');
    
    resultsContainer.innerHTML = tracks.map(track => `
        <div class="track-item" onclick="playTrack('${track.id}')">
            <img src="${track.image || '/placeholder-album.png'}" alt="${track.album}" class="track-image" 
                 onerror="this.src='/placeholder-album.png'">
            <div class="track-info">
                <div class="track-title">${escapeHtml(track.name)}</div>
                <div class="track-artist">${escapeHtml(track.artist)} • ${escapeHtml(track.album)}</div>
            </div>
            <div class="track-duration">${track.duration}</div>
            <div class="track-actions">
                ${track.preview_url ? 
                    '<button class="play-preview-btn" onclick="event.stopPropagation(); playPreview(\'' + track.id + '\')">Preview</button>' : 
                    '<span class="no-preview">No Preview</span>'
                }
                <button class="open-spotify-btn" onclick="event.stopPropagation(); openSpotify(\'' + track.external_url + '\')">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z"/>
                    </svg>
                </button>
            </div>
        </div>
    `).join('');
    
    if (!document.querySelector('#track-styles')) {
        const styles = document.createElement('style');
        styles.id = 'track-styles';
        styles.textContent = `
            .track-item {
                position: relative;
            }
            .track-actions {
                display: flex;
                align-items: center;
                gap: 8px;
                margin-left: auto;
            }
            .play-preview-btn, .open-spotify-btn {
                padding: 6px 12px;
                border: 1px solid var(--border-color);
                border-radius: 4px;
                background: white;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.3s ease;
            }
            .play-preview-btn:hover {
                background: var(--primary-color);
                color: white;
                border-color: var(--primary-color);
            }
            .open-spotify-btn {
                background: #1DB954;
                color: white;
                border-color: #1DB954;
                display: flex;
                align-items: center;
                padding: 6px 8px;
            }
            .open-spotify-btn:hover {
                background: #1ed760;
            }
            .no-preview {
                font-size: 12px;
                color: var(--text-secondary);
            }
            .loading-state {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                height: 200px;
                color: var(--text-secondary);
            }
            .loading-state .spinner {
                width: 32px;
                height: 32px;
                border: 3px solid var(--border-color);
                border-top: 3px solid var(--primary-color);
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin-bottom: 16px;
            }
        `;
        document.head.appendChild(styles);
    }
}

async function playTrack(trackId) {
    try {
        const response = await fetch(`/api/music/track/${trackId}`);
        const result = await response.json();
        
        if (result.success) {
            currentTrack = result.track;
            updateMusicPlayer(currentTrack);
            
            if (currentTrack.preview_url) {
                audioPlayer.src = currentTrack.preview_url;
                audioPlayer.play();
            } else {
                showNotification('Preview tidak tersedia untuk lagu ini', 'warning');
            }
        } else {
            showNotification('Gagal memuat track', 'error');
        }
    } catch (error) {
        console.error('Play track error:', error);
        showNotification('Gagal memuat track', 'error');
    }
}

function playPreview(trackId) {
    playTrack(trackId);
}

function openSpotify(url) {
    window.open(url, '_blank');
}

function updateMusicPlayer(track) {
    const musicPlayer = document.getElementById('musicPlayer');
    const playerImage = document.getElementById('playerImage');
    const playerTitle = document.getElementById('playerTitle');
    const playerArtist = document.getElementById('playerArtist');
    
    playerImage.src = track.image || '/placeholder-album.png';
    playerImage.onerror = () => playerImage.src = '/placeholder-album.png';
    playerTitle.textContent = track.name;
    playerArtist.textContent = track.artist;
    
    musicPlayer.classList.remove('hidden');
}

function togglePlayPause() {
    if (!audioPlayer || !currentTrack) {
        showNotification('Pilih lagu terlebih dahulu', 'warning');
        return;
    }
    
    if (audioPlayer.paused) {
        audioPlayer.play();
    } else {
        audioPlayer.pause();
    }
}

function onTrackPlay() {
    const playBtn = document.getElementById('playBtn');
    playBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16"></rect>
            <rect x="14" y="4" width="4" height="16"></rect>
        </svg>
    `;
}

function onTrackPause() {
    const playBtn = document.getElementById('playBtn');
    playBtn.innerHTML = `
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5,3 19,12 5,21"></polygon>
        </svg>
    `;
}

function onTrackEnded() {
    onTrackPause();
    showNotification('Preview selesai. Buka di Spotify untuk mendengar full track.', 'success');
}

function escapeHtml(text) {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

document.addEventListener('keydown', function(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return; 
    }
    
    switch(e.code) {
        case 'Space':
            e.preventDefault();
            togglePlayPause();
            break;
    }
});
