// Background service worker for Social Media Data Donation extension
class BackgroundService {
    constructor() {
        this.dataBuffer = [];
        this.isCollecting = false;
        this.sessionId = null;
        this.init();
    }
    
    init() {
        this.setupMessageListeners();
        this.setupStorageListeners();
        this.setupPeriodicSync();
        this.loadState();
    }
    
    setupMessageListeners() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            this.handleMessage(message, sender, sendResponse);
            return true; // Keep message channel open for async responses
        });
    }
    
    setupStorageListeners() {
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (changes.isCollecting) {
                this.isCollecting = changes.isCollecting.newValue;
                this.handleCollectionStateChange();
            }
        });
    }
    
    setupPeriodicSync() {
        // Sync data every 5 minutes
        setInterval(() => {
            if (this.dataBuffer.length > 0) {
                this.syncData();
            }
        }, 5 * 60 * 1000);
    }
    
    async loadState() {
        try {
            const result = await chrome.storage.sync.get(['isCollecting']);
            this.isCollecting = result.isCollecting || false;
        } catch (error) {
            console.error('Error loading state:', error);
        }
    }
    
    async handleMessage(message, sender, sendResponse) {
        switch (message.action) {
            case 'startCollection':
                await this.startCollection();
                sendResponse({ success: true });
                break;
                
            case 'stopCollection':
                await this.stopCollection();
                sendResponse({ success: true });
                break;
                
            case 'dataPoint':
                console.log('Background received dataPoint:', message.data);
                await this.recordDataPoint(message.data, sender);
                sendResponse({ success: true });
                break;
                
            case 'getPlatformInfo':
                sendResponse(this.getPlatformInfo(sender.tab.url));
                break;
                
            default:
                sendResponse({ error: 'Unknown action' });
        }
    }
    
    async startCollection() {
        this.isCollecting = true;
        this.sessionId = this.generateSessionId();
        await this.updateUserStats('sessionsToday', 1);
        console.log('Data collection started');
    }
    
    async stopCollection() {
        this.isCollecting = false;
        if (this.dataBuffer.length > 0) {
            await this.syncData();
        }
        console.log('Data collection stopped');
    }
    
    handleCollectionStateChange() {
        if (this.isCollecting) {
            this.notifyContentScripts('startCollection');
        } else {
            this.notifyContentScripts('stopCollection');
        }
    }
    
    async recordDataPoint(data, sender) {
        if (!this.isCollecting) return;
        console.log('recordDataPoint received:', data);
        const anonymizedData = this.anonymizeData(data, sender);
        console.log('anonymizeData output:', anonymizedData);
        this.dataBuffer.push(anonymizedData);
        console.log('Pushed to buffer:', anonymizedData);
        // Update stats
        await this.updateUserStats('dataPoints', 1);
        await this.updateUserStats('points', this.calculatePoints(data));
        // Update current platform
        const platformInfo = this.getPlatformInfo(sender.tab.url);
        await this.updateCurrentPlatform(platformInfo.platform);
        // Auto-sync if buffer is getting large
        if (this.dataBuffer.length >= 50) {
            await this.syncData();
        }
    }
    
    anonymizeData(data, sender) {
        console.log('anonymizeData input:', data);
        const platformInfo = this.getPlatformInfo(sender.tab.url);
        
        return {
            sessionId: this.sessionId,
            timestamp: Date.now(),
            platform: platformInfo.platform,
            contentType: data.contentType,
            actionType: data.actionType,
            duration: data.duration,
            engagementLevel: data.engagementLevel,
            hasMedia: data.hasMedia,
            contentLength: data.contentLength,
            timeOfDay: new Date().getHours(),
            dayOfWeek: new Date().getDay(),
            userAgent: this.hashString(navigator.userAgent),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
            text: data.text || '',
            imageUrl: data.imageUrl || '',
            mediaUrl: data.mediaUrl || ''
        };
    }
    
    getPlatformInfo(url) {
        const platforms = {
            'twitter.com': 'Twitter',
            'x.com': 'X',
            'facebook.com': 'Facebook',
            'instagram.com': 'Instagram',
            'linkedin.com': 'LinkedIn'
        };
        
        for (const [domain, platform] of Object.entries(platforms)) {
            if (url.includes(domain)) {
                return { platform, domain };
            }
        }
        
        return { platform: 'Unknown', domain: 'unknown' };
    }
    
    calculatePoints(data) {
        let points = 1; // Base point for any interaction
        
        // Bonus points for different actions
        switch (data.actionType) {
            case 'like':
                points += 2;
                break;
            case 'share':
                points += 5;
                break;
            case 'comment':
                points += 10;
                break;
            case 'scroll':
                points += 0.5;
                break;
            case 'view':
                points += 1;
                break;
        }
        
        // Bonus for longer engagement
        if (data.duration > 5000) points += 2;
        if (data.duration > 15000) points += 5;
        
        return Math.round(points);
    }
    
    async updateUserStats(stat, increment) {
        try {
            const result = await chrome.storage.sync.get(['userStats']);
            const userStats = result.userStats || {};
            
            if (stat === 'sessionsToday') {
                const today = new Date().toDateString();
                const lastSessionDate = userStats.lastSessionDate;
                
                if (lastSessionDate !== today) {
                    userStats.sessionsToday = 0;
                    userStats.lastSessionDate = today;
                }
            }
            
            userStats[stat] = (userStats[stat] || 0) + increment;
            
            await chrome.storage.sync.set({ userStats });
        } catch (error) {
            console.error('Error updating user stats:', error);
        }
    }
    
    async updateCurrentPlatform(platform) {
        try {
            const result = await chrome.storage.sync.get(['userStats']);
            const userStats = result.userStats || {};
            userStats.currentPlatform = platform;
            await chrome.storage.sync.set({ userStats });
        } catch (error) {
            console.error('Error updating current platform:', error);
        }
    }
    
    async syncData() {
        if (this.dataBuffer.length === 0) return;
        
        try {
            // In a real implementation, this would send to your API
            console.log('Syncing data batch:', this.dataBuffer.length, 'items');
            
            // Simulate API call
            const response = await this.sendToAPI(this.dataBuffer);
            
            if (response.success) {
                this.dataBuffer = [];
                console.log('Data sync successful');
            } else {
                console.error('Data sync failed:', response.error);
            }
        } catch (error) {
            console.error('Error syncing data:', error);
        }
    }
    
    async sendToAPI(data) {
        console.log('Sending to backend:', data);
        try {
            const response = await fetch('http://127.0.0.1:5000/collect', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            if (response.ok) {
                console.log('Data sent to backend successfully');
                return { success: true };
            } else {
                console.error('Backend responded with error:', response.status);
                return { success: false, error: response.statusText };
            }
        } catch (error) {
            console.error('Error sending data to backend:', error);
            return { success: false, error: error.message };
        }
    }
    
    notifyContentScripts(action) {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                if (this.isSupportedPlatform(tab.url)) {
                    chrome.tabs.sendMessage(tab.id, { action }, (response) => {
                        // Handle response if needed
                    });
                }
            });
        });
    }
    
    isSupportedPlatform(url) {
        const supportedDomains = [
            'twitter.com',
            'x.com',
            'facebook.com',
            'instagram.com',
            'linkedin.com'
        ];
        
        return supportedDomains.some(domain => url && url.includes(domain));
    }
    
    generateSessionId() {
        return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }
    
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString(36);
    }
}

// Initialize background service
const backgroundService = new BackgroundService();