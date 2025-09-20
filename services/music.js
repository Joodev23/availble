const axios = require('axios');

class MusicService {
    constructor() {
        this.clientId = process.env.SPOTIFY_CLIENT_ID || '143ec5635a1f4638bb13046f1917b5be';
        this.clientSecret = process.env.SPOTIFY_CLIENT_SECRET || '63215bd95c38425381d3638d14f5b721';
        this.accessToken = null;
        this.tokenExpiry = null;
    }

    async getAccessToken() {
        if (this.accessToken && this.tokenExpiry && Date.now() < this.tokenExpiry) {
            return this.accessToken;
        }

        try {
            const credentials = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
            
            const response = await axios.post('https://accounts.spotify.com/api/token', 
                'grant_type=client_credentials', {
                headers: {
                    'Authorization': `Basic ${credentials}`,
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = response.data.access_token;
            this.tokenExpiry = Date.now() + (response.data.expires_in * 1000);
            
            return this.accessToken;
        } catch (error) {
            console.error('Spotify auth error:', error.response?.data || error.message);
            throw new Error('Failed to authenticate with Spotify');
        }
    }

    async searchTracks(query, limit = 20) {
        try {
            const token = await this.getAccessToken();
            
            const response = await axios.get('https://api.spotify.com/v1/search', {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                params: {
                    q: query,
                    type: 'track',
                    limit: limit
                }
            });

            const tracks = response.data.tracks.items.map(track => ({
                id: track.id,
                name: track.name,
                artist: track.artists.map(a => a.name).join(', '),
                album: track.album.name,
                duration: this.msToTime(track.duration_ms),
                preview_url: track.preview_url,
                external_url: track.external_urls.spotify,
                image: track.album.images[0]?.url,
                popularity: track.popularity
            }));

            return {
                success: true,
                tracks: tracks,
                total: response.data.tracks.total
            };
        } catch (error) {
            console.error('Music search error:', error.response?.data || error.message);
            return {
                success: false,
                message: 'Gagal mencari musik. Pastikan Spotify API credentials sudah dikonfigurasi.'
            };
        }
    }

    async getTrack(trackId) {
        try {
            const token = await this.getAccessToken();
            
            const response = await axios.get(`https://api.spotify.com/v1/tracks/${trackId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            const track = response.data;
            
            return {
                success: true,
                track: {
                    id: track.id,
                    name: track.name,
                    artist: track.artists.map(a => a.name).join(', '),
                    album: track.album.name,
                    duration: this.msToTime(track.duration_ms),
                    preview_url: track.preview_url,
                    external_url: track.external_urls.spotify,
                    image: track.album.images[0]?.url,
                    popularity: track.popularity
                }
            };
        } catch (error) {
            console.error('Get track error:', error.response?.data || error.message);
            return {
                success: false,
                message: 'Gagal mengambil data track'
            };
        }
    }

    msToTime(duration) {
        const minutes = Math.floor(duration / 60000);
        const seconds = ((duration % 60000) / 1000).toFixed(0);
        return minutes + ":" + (seconds < 10 ? '0' : '') + seconds;
    }

    async searchYouTube(query) {
        return {
            success: false,
            message: 'YouTube integration not implemented yet'
        };
    }
}

module.exports = MusicService;