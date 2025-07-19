// Background service worker for Social Media Data Donation extension
const DEV_MODE = true;
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
        try {
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
        } catch (error) {
            console.error('Error in handleMessage:', error);
            sendResponse({ success: false, error: error.message });
        }
    }
    
    async startCollection() {
        if (this.isCollecting) return; // Prevent duplicate starts
        this.isCollecting = true;
        this.sessionId = this.generateSessionId();
        await this.updateUserStats('sessionsToday', 1);
        console.log('Data collection started');
        // Sync state with storage
        await chrome.storage.sync.set({ isCollecting: true });
    }
    
    async stopCollection() {
        if (!this.isCollecting) return; // Prevent duplicate stops
        this.isCollecting = false;
        if (this.dataBuffer.length > 0) {
            await this.syncData();
        }
        console.log('Data collection stopped');
        // Sync state with storage
        await chrome.storage.sync.set({ isCollecting: false });
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
        if (this.dataBuffer.length >= 3) {
            await this.syncData();
        }
    }
    
    anonymizeData(data, sender) {
        if (!this.sessionId) {
            this.sessionId = this.generateSessionId();
            if (DEV_MODE) {
                console.warn('SessionId was null, generated a new one:', this.sessionId);
            }
        }
        const platformInfo = this.getPlatformInfo(sender.tab.url);
        // Extract interaction fields
        const interactions = data.interactions || {};
        const liked = interactions.liked || false;
        const commented = interactions.commented || false;
        const shared = interactions.shared || interactions.retweeted || false;
        
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
            mediaUrl: data.mediaUrl || '',
            liked,
            commented,
            shared
        };
    }
    
    getPlatformInfo(url) {
        const platforms = {
            'twitter.com': 'Twitter',
            'x.com': 'X',
            'instagram.com': 'Instagram'
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
    
    // Helper function to log array in multi-line compact format
    logArrayMultiLine(arr) {
        if (!Array.isArray(arr)) {
            console.log(JSON.stringify(arr));
            return;
        }
        let lines = ['['];
        for (let i = 0; i < arr.length; i++) {
            let line = JSON.stringify(arr[i]);
            if (i < arr.length - 1) line += ',';
            lines.push(line);
        }
        lines.push(']');
        console.log(lines.join('\n'));
    }

    // Helper function to log array with each object on a single line (no pretty-printing)
    logArrayObjectsSingleLine(arr) {
        if (!Array.isArray(arr)) {
            console.log(JSON.stringify(arr));
            return;
        }
        // If array is short, log as a single line
        const singleLine = '[' + arr.map(obj => JSON.stringify(obj)).join(',') + ']';
        if (singleLine.length < 200) {
            console.log(singleLine);
        } else {
            // Otherwise, log as multi-line, each object on a single line
            console.log('[\n' + arr.map(obj => JSON.stringify(obj)).join(',\n') + '\n]');
        }
    }

    async sendToAPI(data) {
        // Log arrays with each object on a single line, no pretty-printing
        if (Array.isArray(data)) {
            this.logArrayObjectsSingleLine(data);
        } else {
            console.log(JSON.stringify(data));
        }
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
                        if (chrome.runtime.lastError) {
                            if (DEV_MODE) {
                                console.warn('No content script in tab:', tab.id, chrome.runtime.lastError.message);
                            }
                            return;
                        }
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
            'instagram.com'
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