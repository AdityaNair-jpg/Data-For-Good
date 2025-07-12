// Content script for Social Media Data Donation extension
console.log('[DataForGood] content.js loaded');
// Add a visible marker to the page for debugging
(function() {
    const marker = document.createElement('div');
    marker.textContent = 'DataForGood content.js injected';
    marker.style.position = 'fixed';
    marker.style.bottom = '0';
    marker.style.right = '0';
    marker.style.background = 'rgba(0,0,0,0.7)';
    marker.style.color = 'white';
    marker.style.zIndex = '99999';
    marker.style.fontSize = '12px';
    marker.style.padding = '2px 8px';
    marker.style.borderRadius = '4px 0 0 0';
    marker.style.pointerEvents = 'none';
    marker.id = 'dfg-content-marker';
    document.body.appendChild(marker);
    setTimeout(() => marker.remove(), 5000);
})();
class ContentDataCollector {
    constructor() {
        this.isCollecting = false;
        this.platform = null;
        this.observers = [];
        this.scrollData = {
            startTime: null,
            maxScroll: 0,
            currentScroll: 0
        };
        this.viewedPosts = new Set();
        // --- Instagram session tracking ---
        this.currentInstagramPost = null;
        this.instagramPostStartTime = null;
        this.instagramPostInteractions = null;
        // --- End Instagram session tracking ---
        this.init();
    }
    
    async init() {
        await this.detectPlatform();
        this.setupMessageListener();
        this.setupEventListeners();
        this.injectHelperScript();
        await this.checkCollectionStatus();
        this.initSPAWatcher();
    }
    
    async detectPlatform() {
        const url = window.location.href;
        console.log('[DataForGood] detectPlatform url:', url);
        const platformMap = {
            'twitter.com': 'Twitter',
            'x.com': 'X',
            'facebook.com': 'Facebook',
            'instagram.com': 'Instagram',
            'linkedin.com': 'LinkedIn'
        };
        
        for (const [domain, platform] of Object.entries(platformMap)) {
            if (url.includes(domain)) {
                this.platform = platform;
                break;
            }
        }
        
        if (!this.platform) {
            console.log('Unsupported platform');
            return;
        }
        
        console.log(`Social Media Data Collector initialized for ${this.platform}`);
    }
    
    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            console.log('[DataForGood] content.js received message:', message);
            switch (message.action) {
                case 'startCollection':
                    this.startCollection();
                    sendResponse({ success: true });
                    break;
                case 'stopCollection':
                    this.stopCollection();
                    sendResponse({ success: true });
                    break;
            }
        });
    }
    
    async checkCollectionStatus() {
        try {
            const response = await chrome.runtime.sendMessage({ action: 'getPlatformInfo' });
            if (response && response.platform) {
                // Check if collection is active
                // This will be handled by the background script state
            }
        } catch (error) {
            console.error('Error checking collection status:', error);
        }
    }
    
    startCollection() {
        if (this.isCollecting) return;
        
        this.isCollecting = true;
        this.setupObservers();
        this.startScrollTracking();
        console.log('Data collection started on', this.platform);
        // Debug log
        console.log('[DataForGood] startCollection called in content script');
    }
    
    stopCollection() {
        if (!this.isCollecting) return;
        
        this.isCollecting = false;
        this.cleanupObservers();
        this.stopScrollTracking();
        console.log('Data collection stopped on', this.platform);
    }
    
    setupObservers() {
        console.log('[DataForGood] setupObservers called for platform:', this.platform, 'isCollecting:', this.isCollecting);
        this.cleanupObservers(); // Clean up any existing observers
        
        // Set up platform-specific observers
        switch (this.platform) {
            case 'Twitter':
            case 'X':
                this.setupTwitterObservers();
                break;
            case 'Facebook':
                this.setupFacebookObservers();
                break;
            case 'Instagram':
                this.setupInstagramObservers();
                break;
            case 'LinkedIn':
                this.setupLinkedInObservers();
                break;
        }
    }
    
    setupTwitterObservers() {
        // Twitter/X specific selectors
        const tweetSelector = 'article[data-testid="tweet"], [data-testid="tweet"]';
        // State for currently viewed tweet
        this.currentTweet = null;
        this.tweetStartTime = null;
        this.tweetInteractions = null;
        this.tweetObserver = new IntersectionObserver(this.handleTweetIntersect.bind(this), {
            root: null,
            threshold: 0.6 // Considered "viewed" if 60% visible
        });
        // Observe all tweets
        document.querySelectorAll(tweetSelector).forEach(article => {
            this.tweetObserver.observe(article);
        });
        // Observe new tweets as they load
        const timeline = document.querySelector('[aria-label*="Timeline"]');
        if (timeline) {
            const mutationObserver = new MutationObserver(() => {
                document.querySelectorAll(tweetSelector).forEach(article => {
                    this.tweetObserver.observe(article);
                });
            });
            mutationObserver.observe(timeline, { childList: true, subtree: true });
            this.observers.push(mutationObserver);
        }
        this.observers.push(this.tweetObserver);
    }

    handleTweetIntersect(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // User started viewing a tweet
                if (this.currentTweet !== entry.target) {
                    // If we were viewing another tweet, send its data
                    if (this.currentTweet) {
                        this.sendTweetSessionData(this.currentTweet);
                    }
                    this.currentTweet = entry.target;
                    this.tweetStartTime = Date.now();
                    this.tweetInteractions = {
                        liked: false,
                        retweeted: false,
                        replied: false
                    };
                    this.attachTweetInteractionListeners(this.currentTweet);
                }
            } else if (this.currentTweet === entry.target) {
                // User stopped viewing the tweet
                this.sendTweetSessionData(this.currentTweet);
                this.currentTweet = null;
                this.tweetStartTime = null;
                this.tweetInteractions = null;
            }
        });
    }

    attachTweetInteractionListeners(article) {
        // Like button
        const likeBtn = article.querySelector('div[data-testid="like"]');
        if (likeBtn) {
            likeBtn.addEventListener('click', () => {
                if (this.tweetInteractions) this.tweetInteractions.liked = true;
            }, { once: false });
        }
        // Retweet button
        const rtBtn = article.querySelector('div[data-testid="retweet"]');
        if (rtBtn) {
            rtBtn.addEventListener('click', () => {
                if (this.tweetInteractions) this.tweetInteractions.retweeted = true;
            }, { once: false });
        }
        // Reply button
        const replyBtn = article.querySelector('div[data-testid="reply"]');
        if (replyBtn) {
            replyBtn.addEventListener('click', () => {
                if (this.tweetInteractions) this.tweetInteractions.replied = true;
            }, { once: false });
        }
    }

    sendTweetSessionData(article) {
        if (!article || !this.tweetStartTime || !this.tweetInteractions) return;
        // Extract tweet ID
        let tweetId = null;
        const link = article.querySelector('a[href*="/status/"]');
        if (link) {
            const match = link.href.match(/status\/(\d+)/);
            tweetId = match ? match[1] : null;
        }
        // Extract tweet text
        let text = '';
        const textElem = article.querySelector('div[lang]');
        if (textElem) text = textElem.innerText.trim();
        const timeSpent = Date.now() - this.tweetStartTime;
        const data = {
            postId: tweetId || this.generatePostId(article),
            contentType: 'tweet',
            actionType: 'tweet-session',
            duration: timeSpent,
            interactions: { ...this.tweetInteractions },
            hasMedia: this.detectMediaContent(article),
            contentLength: this.estimateContentLength(article),
            engagementLevel: this.calculateEngagementLevel(timeSpent),
            text
        };
        this.sendDataPoint(data);
    }
    
    setupFacebookObservers() {
        // Facebook specific selectors
        const postSelectors = [
            '[data-pagelet="FeedUnit"]',
            '[role="article"]',
            '.userContentWrapper'
        ];
        
        this.observeElements(postSelectors, (element) => {
            this.setupFacebookPostInteractions(element);
        });
    }
    
    setupInstagramObservers() {
        // Instagram specific selectors
        const postSelector = 'article';
        // State for currently viewed Instagram post
        this.currentInstagramPost = null;
        this.instagramPostStartTime = null;
        this.instagramPostInteractions = null;
        this.instagramPostObserver = new IntersectionObserver(this.handleInstagramPostIntersect.bind(this), {
            root: null,
            threshold: 0.6 // Considered "viewed" if 60% visible
        });
        // Observe all posts
        document.querySelectorAll(postSelector).forEach(article => {
            this.instagramPostObserver.observe(article);
        });
        // Observe new posts as they load
        const feed = document.querySelector('main');
        if (feed) {
            const mutationObserver = new MutationObserver(() => {
                document.querySelectorAll(postSelector).forEach(article => {
                    this.instagramPostObserver.observe(article);
                });
            });
            mutationObserver.observe(feed, { childList: true, subtree: true });
            this.observers.push(mutationObserver);
        }
        this.observers.push(this.instagramPostObserver);

        // --- Reels page support ---
        if (window.location.pathname.startsWith('/reels/') && this.isCollecting) {
            // Find all Reel slides (each Reel in the horizontal scroll area)
            // This selector may need to be updated based on Instagram's DOM
            const reelSlides = document.querySelectorAll('main [style*="transform"] > div');
            if (reelSlides.length > 0) {
                this.currentInstagramPost = null;
                this.instagramPostStartTime = null;
                this.instagramPostInteractions = null;
                this.reelObserver = new IntersectionObserver((entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting && entry.intersectionRatio > 0.6) {
                            if (this.currentInstagramPost !== entry.target) {
                                // End previous session
                                if (this.currentInstagramPost) {
                                    this.sendInstagramPostSessionData(this.currentInstagramPost);
                                    console.log('[DataForGood] Reel session ended (new Reel in view)');
                                }
                                // Start new session
                                this.currentInstagramPost = entry.target;
                                this.instagramPostStartTime = Date.now();
                                this.instagramPostInteractions = { liked: false, commented: false, saved: false };
                                this.attachInstagramInteractionListeners(entry.target);
                                console.log('[DataForGood] Reel session started (new Reel in view)');
                            }
                        }
                    });
                }, { threshold: 0.6 });
                reelSlides.forEach(slide => this.reelObserver.observe(slide));
                this.observers.push(this.reelObserver);

                if (!window._dfgReelBeforeUnloadAdded) {
                    window.addEventListener('beforeunload', () => {
                        if (this.currentInstagramPost) {
                            this.sendInstagramPostSessionData(this.currentInstagramPost);
                            console.log('[DataForGood] Reel session ended (beforeunload)');
                        }
                    });
                    window._dfgReelBeforeUnloadAdded = true;
                }
            } else {
                console.log('[DataForGood] No Reel slides found on this Reels page.');
            }
        }

        // --- Direct post page support ---
        const articles = document.querySelectorAll(postSelector);
        if (articles.length === 1 && this.isCollecting) {
            // Start session for the single post
            this.currentInstagramPost = articles[0];
            this.instagramPostStartTime = Date.now();
            this.instagramPostInteractions = { liked: false, commented: false, saved: false };
            this.attachInstagramInteractionListeners(this.currentInstagramPost);
            console.log('[DataForGood] Direct post session started');
            // End session when user navigates away
            if (!window._dfgBeforeUnloadAdded) {
                window.addEventListener('beforeunload', () => {
                    this.sendInstagramPostSessionData(this.currentInstagramPost);
                    console.log('[DataForGood] Direct post session ended (beforeunload)');
                });
                window._dfgBeforeUnloadAdded = true;
            }
        }
        // --- Modal post support for Explore and overlays ---
        const modalObserver = new MutationObserver(() => {
            const modal = document.querySelector('div[role="dialog"]');
            if (modal && !modal.dataset.collectorProcessed) {
                modal.dataset.collectorProcessed = 'true';
                this.handleInstagramModalPost(modal);
            }
        });
        modalObserver.observe(document.body, { childList: true, subtree: true });
        this.observers.push(modalObserver);
    }

    handleInstagramPostIntersect(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // User started viewing a post
                if (this.currentInstagramPost !== entry.target) {
                    // If we were viewing another post, send its data
                    if (this.currentInstagramPost) {
                        this.sendInstagramPostSessionData(this.currentInstagramPost);
                    }
                    this.currentInstagramPost = entry.target;
                    this.instagramPostStartTime = Date.now();
                    this.instagramPostInteractions = {
                        liked: false,
                        commented: false,
                        saved: false
                    };
                    this.attachInstagramInteractionListeners(this.currentInstagramPost);
                }
            } else if (this.currentInstagramPost === entry.target) {
                // User stopped viewing the post
                this.sendInstagramPostSessionData(this.currentInstagramPost);
                this.currentInstagramPost = null;
                this.instagramPostStartTime = null;
                this.instagramPostInteractions = null;
            }
        });
    }

    handleInstagramModalPost(modal) {
        // Find the post content inside the modal
        const postContent = modal.querySelector('article') || modal;
        this.currentInstagramPost = postContent;
        this.instagramPostStartTime = Date.now();
        this.instagramPostInteractions = { liked: false, commented: false, saved: false };
        this.attachInstagramInteractionListeners(postContent);
        console.log('[DataForGood] Modal post session started');
        // Observe when the modal is closed
        const closeObserver = new MutationObserver(() => {
            if (!document.body.contains(modal)) {
                this.sendInstagramPostSessionData(postContent);
                console.log('[DataForGood] Modal post session ended (modal closed)');
                closeObserver.disconnect();
                this.currentInstagramPost = null;
                this.instagramPostStartTime = null;
                this.instagramPostInteractions = null;
            }
        });
        closeObserver.observe(document.body, { childList: true, subtree: true });
        this.observers.push(closeObserver);
    }

    attachInstagramInteractionListeners(article) {
        // Like button
        const likeBtn = article.querySelector('svg[aria-label="Like"], svg[aria-label="Unlike"]');
        if (likeBtn) {
            likeBtn.parentElement?.addEventListener('click', () => {
                if (this.instagramPostInteractions) this.instagramPostInteractions.liked = true;
            }, { once: false });
        }
        // Comment button
        const commentBtn = article.querySelector('svg[aria-label="Comment"]');
        if (commentBtn) {
            commentBtn.parentElement?.addEventListener('click', () => {
                if (this.instagramPostInteractions) this.instagramPostInteractions.commented = true;
            }, { once: false });
        }
        // Save button
        const saveBtn = article.querySelector('svg[aria-label="Save"], svg[aria-label="Remove"]');
        if (saveBtn) {
            saveBtn.parentElement?.addEventListener('click', () => {
                if (this.instagramPostInteractions) this.instagramPostInteractions.saved = true;
            }, { once: false });
        }
    }

    extractInstagramImageUrl(article) {
        // Try to find the main image in the post/reel
        // 1. Look for <img> with largest size in article
        let imgs = Array.from(article.querySelectorAll('img'));
        if (imgs.length === 0) {
            // 2. If not found, look in the main area
            imgs = Array.from(document.querySelectorAll('main img'));
        }
        if (imgs.length > 0) {
            // Return the image with the largest width
            let largestImg = imgs[0];
            for (const img of imgs) {
                if ((img.naturalWidth || 0) > (largestImg.naturalWidth || 0)) {
                    largestImg = img;
                }
            }
            return largestImg.src;
        }
        return '';
    }

    extractInstagramVideoUrl(article) {
        // Try to find the main video in the post/reel
        const video = article.querySelector('video[src]');
        if (video) return video.src;
        // Sometimes video is in a <source> tag
        const source = article.querySelector('video source[src]');
        if (source) return source.src;
        return '';
    }

    sendInstagramPostSessionData(article) {
        if (!article || !this.instagramPostStartTime || !this.instagramPostInteractions) return;
        // Generate postId
        const postId = this.generatePostId(article);
        // Extract post text
        let text = '';
        const textElem = article.querySelector('div[role="button"] > span, .C4VMK > span');
        if (textElem) text = textElem.innerText.trim();
        const timeSpent = Date.now() - this.instagramPostStartTime;
        const imageUrl = this.extractInstagramImageUrl(article);
        const mediaUrl = this.extractInstagramVideoUrl(article);
        console.log('[DataForGood] Extracted imageUrl:', imageUrl, 'mediaUrl:', mediaUrl);
        const data = {
            postId: postId,
            contentType: 'instagram-post',
            actionType: 'post-session',
            duration: timeSpent,
            interactions: { ...this.instagramPostInteractions },
            hasMedia: this.detectMediaContent(article),
            contentLength: this.estimateContentLength(article),
            engagementLevel: this.calculateEngagementLevel(timeSpent),
            text,
            imageUrl,
            mediaUrl
        };
        this.sendDataPoint(data);
    }
    
    setupLinkedInObservers() {
        // LinkedIn specific selectors
        const postSelectors = [
            '.feed-shared-update-v2',
            '.occludable-update',
            '[data-id]'
        ];
        
        this.observeElements(postSelectors, (element) => {
            this.setupLinkedInPostInteractions(element);
        });
    }
    
    observeElements(selectors, callback) {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        selectors.forEach((selector) => {
                            const elements = node.matches && node.matches(selector) ? [node] : node.querySelectorAll(selector);
                            elements.forEach(callback);
                        });
                    }
                });
            });
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        this.observers.push(observer);
        
        // Also process existing elements
        selectors.forEach((selector) => {
            document.querySelectorAll(selector).forEach(callback);
        });
    }
    
    setupTweetInteractions(element) {
        // No-op: replaced by new per-tweet session logic
    }
    
    setupFacebookPostInteractions(element) {
        if (element.dataset.collectorProcessed) return;
        element.dataset.collectorProcessed = 'true';
        const postId = this.generatePostId(element);
        // Extract Facebook post text
        let text = '';
        const textElem = element.querySelector('[data-ad-preview="message"], .userContent');
        if (textElem) text = textElem.innerText.trim();
        // Track view
        this.trackPostView(element, postId, 'facebook-post', text);
        // Track interactions
        this.trackClicks(element, postId, {
            like: '[data-testid="fb-ufi-likelink"]',
            comment: '[data-testid="fb-ufi-commentlink"]',
            share: '[data-testid="fb-ufi-sharelink"]'
        }, text);
    }
    
    setupInstagramPostInteractions(element) {
        // No-op: replaced by new per-post session logic
    }
    
    setupLinkedInPostInteractions(element) {
        if (element.dataset.collectorProcessed) return;
        element.dataset.collectorProcessed = 'true';
        const postId = this.generatePostId(element);
        // Extract LinkedIn post text
        let text = '';
        const textElem = element.querySelector('.feed-shared-update-v2__description, .break-words');
        if (textElem) text = textElem.innerText.trim();
        // Track view
        this.trackPostView(element, postId, 'linkedin-post', text);
        // Track interactions
        this.trackClicks(element, postId, {
            like: '.react-button__trigger',
            comment: '.comment-button',
            share: '.share-button'
        }, text);
    }
    
    trackPostView(element, postId, contentType, text = '') {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    if (!this.viewedPosts.has(postId)) {
                        this.viewedPosts.add(postId);
                        const startTime = Date.now();
                        const hasMedia = this.detectMediaContent(element);
                        const contentLength = this.estimateContentLength(element);
                        // Track initial view
                        this.sendDataPoint({
                            postId,
                            contentType,
                            actionType: 'view',
                            duration: 0,
                            hasMedia,
                            contentLength,
                            engagementLevel: 'low',
                            text
                        });
                        // Track view duration
                        const exitObserver = new IntersectionObserver((exitEntries) => {
                            exitEntries.forEach((exitEntry) => {
                                if (!exitEntry.isIntersecting) {
                                    const duration = Date.now() - startTime;
                                    this.sendDataPoint({
                                        postId,
                                        contentType,
                                        actionType: 'view-end',
                                        duration,
                                        hasMedia,
                                        contentLength,
                                        engagementLevel: this.calculateEngagementLevel(duration),
                                        text
                                    });
                                    exitObserver.disconnect();
                                }
                            });
                        });
                        exitObserver.observe(element);
                    }
                }
            });
        });
        observer.observe(element);
    }
    
    trackClicks(element, postId, selectors, text = '') {
        Object.entries(selectors).forEach(([action, selector]) => {
            const buttons = element.querySelectorAll(selector);
            buttons.forEach((button) => {
                button.addEventListener('click', (e) => {
                    this.sendDataPoint({
                        postId,
                        contentType: this.getContentType(element),
                        actionType: action,
                        duration: 0,
                        hasMedia: this.detectMediaContent(element),
                        contentLength: this.estimateContentLength(element),
                        engagementLevel: 'high',
                        text
                    });
                }, { once: false });
            });
        });
    }
    
    setupEventListeners() {
        // General scroll tracking
        this.setupScrollTracking();
        
        // Page navigation tracking
        this.setupNavigationTracking();
        
        // Focus/blur tracking
        this.setupFocusTracking();
    }
    
    setupScrollTracking() {
        let scrollTimeout;
        
        window.addEventListener('scroll', () => {
            if (!this.isCollecting) return;
            
            clearTimeout(scrollTimeout);
            scrollTimeout = setTimeout(() => {
                this.sendDataPoint({
                    contentType: 'scroll',
                    actionType: 'scroll',
                    duration: 0,
                    engagementLevel: 'medium'
                });
            }, 250);
        });
    }
    
    setupNavigationTracking() {
        // Track page changes (for SPAs)
        let currentUrl = window.location.href;
        
        const checkUrlChange = () => {
            if (window.location.href !== currentUrl) {
                currentUrl = window.location.href;
                this.sendDataPoint({
                    contentType: 'navigation',
                    actionType: 'page-change',
                    duration: 0,
                    engagementLevel: 'medium'
                });
            }
        };
        
        // Check for URL changes periodically
        setInterval(checkUrlChange, 1000);
    }
    
    setupFocusTracking() {
        let focusStartTime = Date.now();
        
        window.addEventListener('focus', () => {
            focusStartTime = Date.now();
        });
        
        window.addEventListener('blur', () => {
            if (!this.isCollecting) return;
            
            const duration = Date.now() - focusStartTime;
            this.sendDataPoint({
                contentType: 'session',
                actionType: 'focus-loss',
                duration,
                engagementLevel: this.calculateEngagementLevel(duration)
            });
        });
    }
    
    startScrollTracking() {
        this.scrollData.startTime = Date.now();
        this.scrollData.maxScroll = 0;
        this.scrollData.currentScroll = window.pageYOffset;
    }
    
    stopScrollTracking() {
        if (this.scrollData.startTime) {
            const duration = Date.now() - this.scrollData.startTime;
            this.sendDataPoint({
                contentType: 'session',
                actionType: 'scroll-session',
                duration,
                engagementLevel: this.calculateEngagementLevel(duration)
            });
        }
    }
    
    detectMediaContent(element) {
        const mediaSelectors = [
            'img',
            'video',
            'audio',
            '[data-testid="tweetPhoto"]',
            '[data-testid="videoPlayer"]',
            '.media-container'
        ];
        
        return mediaSelectors.some(selector => element.querySelector(selector));
    }
    
    estimateContentLength(element) {
        const textContent = element.textContent || '';
        return textContent.length;
    }
    
    calculateScrollDepth() {
        const scrollTop = window.pageYOffset;
        const documentHeight = document.documentElement.scrollHeight;
        const windowHeight = window.innerHeight;
        
        return Math.round((scrollTop / (documentHeight - windowHeight)) * 100);
    }
    
    calculateEngagementLevel(duration) {
        if (duration < 1000) return 'low';
        if (duration < 5000) return 'medium';
        return 'high';
    }
    
    getContentType(element) {
        // Determine content type based on element structure
        if (element.querySelector('video')) return 'video';
        if (element.querySelector('img')) return 'image';
        return 'text';
    }
    
    generatePostId(element) {
        // Generate a unique but anonymized post ID
        const timestamp = Date.now();
        const position = Array.from(element.parentNode.children).indexOf(element);
        return `post_${timestamp}_${position}`;
    }
    
    async sendDataPoint(data) {
        if (!this.isCollecting) return;

        // Only allow tweet, image, or video content types
        const allowedTypes = ['tweet', 'image', 'video', 'instagram-post'];
        if (!allowedTypes.includes(data.contentType)) {
            return; // Skip sending this data point
        }

        if (data.contentType === 'instagram-post') {
            console.log('[DataForGood] sendDataPoint called for instagram-post:', data);
        }
        // Ensure tweet data points always include interactions field
        if (data.contentType === 'tweet') {
            data.interactions = {
                liked: data.interactions?.liked || false,
                retweeted: data.interactions?.retweeted || false,
                replied: data.interactions?.replied || false
            };
        }
        // Ensure instagram post data points always include interactions field
        if (data.contentType === 'instagram-post') {
            data.interactions = {
                liked: data.interactions?.liked || false,
                commented: data.interactions?.commented || false,
                saved: data.interactions?.saved || false
            };
        }

        // Debug log for extracted data
        console.log('[DataForGood] Extracted data point:', {
            ...data,
            timestamp: Date.now(),
            platform: this.platform,
            url: window.location.href
        });
        try {
            await chrome.runtime.sendMessage({
                action: 'dataPoint',
                data: {
                    ...data,
                    timestamp: Date.now(),
                    platform: this.platform,
                    url: window.location.href
                }
            });
        } catch (error) {
            console.error('Error sending data point:', error);
        }
    }
    
    injectHelperScript() {
        // Inject a script to access page variables if needed
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('injected.js');
        script.onload = function() {
            this.remove();
        };
        (document.head || document.documentElement).appendChild(script);
    }
    
    cleanupObservers() {
        this.observers.forEach(observer => observer.disconnect());
        this.observers = [];
    }

    initSPAWatcher() {
        let lastPath = window.location.pathname;
        setInterval(() => {
            if (window.location.pathname !== lastPath) {
                lastPath = window.location.pathname;
                console.log('[DataForGood] Detected SPA navigation to', lastPath);
                this.detectPlatform();
                // Always re-setup observers for new view if collecting
                if (this.isCollecting) {
                    this.setupObservers();
                }
            }
        }, 1000);
    }
}

// Initialize content collector when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        new ContentDataCollector();
    });
} else {
    new ContentDataCollector();
}