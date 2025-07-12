// Popup script for the Social Media Data Donation extension
class PopupManager {
    constructor() {
        this.isCollecting = false;
        this.userStats = {
            level: 1,
            points: 0,
            sessionsToday: 0,
            dataPoints: 0,
            currentPlatform: 'None'
        };
        this.init();
    }
    
    async init() {
        await this.loadUserData();
        await this.checkConsentStatus();
        this.bindEventListeners();
        this.updateDisplay();
        this.startStatsUpdater();
    }
    
    async loadUserData() {
        try {
            const result = await chrome.storage.sync.get([
                'userConsent',
                'isCollecting',
                'userStats',
                'privacyConsent'
            ]);
            
            this.isCollecting = result.isCollecting || false;
            this.userStats = { ...this.userStats, ...result.userStats };
            this.userConsent = result.userConsent || false;
            this.privacyConsent = result.privacyConsent || false;
        } catch (error) {
            console.error('Error loading user data:', error);
        }
    }
    
    async checkConsentStatus() {
        const consentSection = document.getElementById('consentSection');
        const mainInterface = document.getElementById('mainInterface');
        
        if (this.userConsent && this.privacyConsent) {
            consentSection.classList.add('hidden');
            mainInterface.classList.remove('hidden');
        } else {
            consentSection.classList.remove('hidden');
            mainInterface.classList.add('hidden');
        }
    }
    
    bindEventListeners() {
        // Consent checkboxes
        const consentCheck = document.getElementById('consentCheck');
        const privacyCheck = document.getElementById('privacyCheck');
        
        consentCheck.checked = this.userConsent;
        privacyCheck.checked = this.privacyConsent;
        
        consentCheck.addEventListener('change', () => this.handleConsentChange());
        privacyCheck.addEventListener('change', () => this.handleConsentChange());
        
        // Toggle button
        const toggleBtn = document.getElementById('toggleBtn');
        toggleBtn.addEventListener('click', () => this.toggleDataCollection());
    }
    
    async handleConsentChange() {
        const consentCheck = document.getElementById('consentCheck');
        const privacyCheck = document.getElementById('privacyCheck');
        
        this.userConsent = consentCheck.checked;
        this.privacyConsent = privacyCheck.checked;
        
        await chrome.storage.sync.set({
            userConsent: this.userConsent,
            privacyConsent: this.privacyConsent
        });
        
        if (this.userConsent && this.privacyConsent) {
            await this.checkConsentStatus();
        }
    }
    
    async toggleDataCollection() {
        this.isCollecting = !this.isCollecting;
        
        await chrome.storage.sync.set({ isCollecting: this.isCollecting });
        
        // Send message to background script
        chrome.runtime.sendMessage({
            action: this.isCollecting ? 'startCollection' : 'stopCollection'
        });
        
        this.updateDisplay();
    }
    
    updateDisplay() {
        const statusText = document.getElementById('statusText');
        const toggleBtn = document.getElementById('toggleBtn');
        
        if (this.isCollecting) {
            statusText.textContent = 'Collection Active';
            statusText.className = 'status active';
            toggleBtn.textContent = 'Stop Data Collection';
            toggleBtn.className = 'toggle-btn stop';
        } else {
            statusText.textContent = 'Collection Stopped';
            statusText.className = 'status inactive';
            toggleBtn.textContent = 'Start Data Collection';
            toggleBtn.className = 'toggle-btn';
        }
        
        this.updateStats();
        this.updateGamification();
    }
    
    updateStats() {
        document.getElementById('sessionsToday').textContent = this.userStats.sessionsToday;
        document.getElementById('dataPoints').textContent = this.userStats.dataPoints;
        document.getElementById('currentPlatform').textContent = this.userStats.currentPlatform;
    }
    
    updateGamification() {
        const level = Math.floor(this.userStats.points / 100) + 1;
        const progress = (this.userStats.points % 100);
        
        document.getElementById('levelBadge').textContent = `Level ${level}`;
        document.getElementById('pointsDisplay').textContent = `${this.userStats.points} pts`;
        document.getElementById('progressFill').style.width = `${progress}%`;
    }
    
    startStatsUpdater() {
        setInterval(async () => {
            await this.loadUserData();
            this.updateStats();
            this.updateGamification();
        }, 2000);
    }
}

// Initialize popup when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});