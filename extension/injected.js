// Injected script for accessing page-level variables and events
(function() {
    'use strict';
    
    // Helper functions for platform-specific data extraction
    const PlatformHelpers = {
        twitter: {
            // Extract tweet metadata
            getTweetData: function(element) {
                const tweetText = element.querySelector('[data-testid="tweetText"]');
                const author = element.querySelector('[data-testid="User-Name"]');
                const timestamp = element.querySelector('time');
                
                return {
                    hasText: !!tweetText,
                    textLength: tweetText ? tweetText.textContent.length : 0,
                    hasAuthor: !!author,
                    hasTimestamp: !!timestamp,
                    isRetweet: element.querySelector('[data-testid="socialContext"]') !== null,
                    hasThreadIndicator: element.querySelector('[data-testid="threadIndicator"]') !== null
                };
            },
            
            // Monitor for dynamic content loads
            observeTimeline: function() {
                const timeline = document.querySelector('[data-testid="primaryColumn"]');
                if (timeline) {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.addedNodes.length > 0) {
                                // Signal content script about new content
                                window.dispatchEvent(new CustomEvent('twitterContentLoaded', {
                                    detail: { type: 'timeline_update' }
                                }));
                            }
                        });
                    });
                    
                    observer.observe(timeline, { childList: true, subtree: true });
                }
            }
        },
        
        facebook: {
            // Extract Facebook post metadata
            getPostData: function(element) {
                const postText = element.querySelector('[data-testid="post_message"]');
                const author = element.querySelector('[data-hovercard-prefer-more-content-show="1"]');
                const timestamp = element.querySelector('[data-testid="story-subtitle"]');
                
                return {
                    hasText: !!postText,
                    textLength: postText ? postText.textContent.length : 0,
                    hasAuthor: !!author,
                    hasTimestamp: !!timestamp,
                    isShared: element.querySelector('[data-testid="story-subtitle"]')?.textContent.includes('shared') || false,
                    hasReactions: element.querySelector('[data-testid="UFI2ReactionBar"]') !== null
                };
            },
            
            // Monitor feed updates
            observeFeed: function() {
                const feed = document.querySelector('[role="feed"]');
                if (feed) {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.addedNodes.length > 0) {
                                window.dispatchEvent(new CustomEvent('facebookContentLoaded', {
                                    detail: { type: 'feed_update' }
                                }));
                            }
                        });
                    });
                    
                    observer.observe(feed, { childList: true, subtree: true });
                }
            }
        },
        
        instagram: {
            // Extract Instagram post metadata
            getPostData: function(element) {
                const caption = element.querySelector('[data-testid="caption"]');
                const author = element.querySelector('h2');
                const timestamp = element.querySelector('time');
                
                return {
                    hasCaption: !!caption,
                    captionLength: caption ? caption.textContent.length : 0,
                    hasAuthor: !!author,
                    hasTimestamp: !!timestamp,
                    isStory: element.closest('[data-testid="story"]') !== null,
                    isReel: element.closest('[data-testid="reel"]') !== null
                };
            },
            
            // Monitor for story/reel changes
            observeStories: function() {
                const storiesContainer = document.querySelector('[data-testid="story-viewer"]');
                if (storiesContainer) {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.addedNodes.length > 0) {
                                window.dispatchEvent(new CustomEvent('instagramContentLoaded', {
                                    detail: { type: 'story_update' }
                                }));
                            }
                        });
                    });
                    
                    observer.observe(storiesContainer, { childList: true, subtree: true });
                }
            }
        },
        
        linkedin: {
            // Extract LinkedIn post metadata
            getPostData: function(element) {
                const postText = element.querySelector('.feed-shared-text');
                const author = element.querySelector('.feed-shared-actor__name');
                const timestamp = element.querySelector('.feed-shared-actor__sub-description');
                
                return {
                    hasText: !!postText,
                    textLength: postText ? postText.textContent.length : 0,
                    hasAuthor: !!author,
                    hasTimestamp: !!timestamp,
                    isSponsored: element.querySelector('.feed-shared-actor__sub-description')?.textContent.includes('Promoted') || false,
                    hasDocument: element.querySelector('.feed-shared-article') !== null
                };
            },
            
            // Monitor feed updates
            observeFeed: function() {
                const feed = document.querySelector('.feed-container');
                if (feed) {
                    const observer = new MutationObserver((mutations) => {
                        mutations.forEach((mutation) => {
                            if (mutation.addedNodes.length > 0) {
                                window.dispatchEvent(new CustomEvent('linkedinContentLoaded', {
                                    detail: { type: 'feed_update' }
                                }));
                            }
                        });
                    });
                    
                    observer.observe(feed, { childList: true, subtree: true });
                }
            }
        }
    };
    
    // Detect current platform and initialize appropriate helpers
    function initializePlatformHelpers() {
        const url = window.location.href;
        
        if (url.includes('twitter.com') || url.includes('x.com')) {
            PlatformHelpers.twitter.observeTimeline();
            window.platformHelper = PlatformHelpers.twitter;
        } else if (url.includes('facebook.com')) {
            PlatformHelpers.facebook.observeFeed();
            window.platformHelper = PlatformHelpers.facebook;
        } else if (url.includes('instagram.com')) {
            PlatformHelpers.instagram.observeStories();
            window.platformHelper = PlatformHelpers.instagram;
        } else if (url.includes('linkedin.com')) {
            PlatformHelpers.linkedin.observeFeed();
            window.platformHelper = PlatformHelpers.linkedin;
        }
    }
    
    // Enhanced interaction tracking
    function setupInteractionTracking() {
        // Track keyboard interactions
        document.addEventListener('keydown', (e) => {
            if (e.key === 'l' || e.key === 'L') {
                // Like shortcut on many platforms
                window.dispatchEvent(new CustomEvent('platformInteraction', {
                    detail: { type: 'keyboard_like', key: e.key }
                }));
            }
        });
        
        // Track mouse movements for engagement analysis
        let mouseMovements = 0;
        let lastMouseTime = Date.now();
        
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastMouseTime > 100) { // Throttle to every 100ms
                mouseMovements++;
                lastMouseTime = now;
                
                // Dispatch periodic mouse activity updates
                if (mouseMovements % 10 === 0) {
                    window.dispatchEvent(new CustomEvent('platformInteraction', {
                        detail: { 
                            type: 'mouse_activity', 
                            movements: mouseMovements,
                            x: e.clientX,
                            y: e.clientY
                        }
                    }));
                }
            }
        });
        
        // Track copy/paste actions
        document.addEventListener('copy', (e) => {
            window.dispatchEvent(new CustomEvent('platformInteraction', {
                detail: { type: 'copy', length: e.clipboardData?.getData('text/plain').length || 0 }
            }));
        });
        
        document.addEventListener('paste', (e) => {
            window.dispatchEvent(new CustomEvent('platformInteraction', {
                detail: { type: 'paste', length: e.clipboardData?.getData('text/plain').length || 0 }
            }));
        });
    }
    
    // Performance monitoring
    function setupPerformanceMonitoring() {
        // Track page load performance
        window.addEventListener('load', () => {
            const perfData = performance.getEntriesByType('navigation')[0];
            if (perfData) {
                window.dispatchEvent(new CustomEvent('performanceData', {
                    detail: {
                        loadTime: perfData.loadEventEnd - perfData.loadEventStart,
                        domContentLoaded: perfData.domContentLoadedEventEnd - perfData.domContentLoadedEventStart,
                        firstPaint: performance.getEntriesByType('paint').find(p => p.name === 'first-paint')?.startTime || 0
                    }
                }));
            }
        });
        
        // Monitor for long tasks (performance issues)
        if ('PerformanceObserver' in window) {
            const observer = new PerformanceObserver((list) => {
                list.getEntries().forEach((entry) => {
                    if (entry.duration > 50) { // Tasks longer than 50ms
                        window.dispatchEvent(new CustomEvent('performanceData', {
                            detail: {
                                type: 'long_task',
                                duration: entry.duration,
                                startTime: entry.startTime
                            }
                        }));
                    }
                });
            });
            
            observer.observe({ entryTypes: ['longtask'] });
        }
    }
    
    // Content analysis helpers
    function setupContentAnalysis() {
        // Function to analyze content sentiment (basic implementation)
        window.analyzeContentSentiment = function(text) {
            const positiveWords = ['good', 'great', 'amazing', 'love', 'excellent', 'awesome', 'fantastic', 'wonderful'];
            const negativeWords = ['bad', 'terrible', 'hate', 'awful', 'horrible', 'disgusting', 'annoying', 'frustrating'];
            
            const words = text.toLowerCase().split(/\s+/);
            let positive = 0;
            let negative = 0;
            
            words.forEach(word => {
                if (positiveWords.includes(word)) positive++;
                if (negativeWords.includes(word)) negative++;
            });
            
            if (positive > negative) return 'positive';
            if (negative > positive) return 'negative';
            return 'neutral';
        };
        
        // Function to detect potential AI-generated content markers
        window.detectAIContentMarkers = function(text) {
            const aiMarkers = [
                'as an ai',
                'i am an ai',
                'generated by ai',
                'artificial intelligence',
                'machine learning',
                'this is ai generated'
            ];
            
            const lowercaseText = text.toLowerCase();
            return aiMarkers.some(marker => lowercaseText.includes(marker));
        };
        
        // Function to analyze content complexity
        window.analyzeContentComplexity = function(text) {
            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const words = text.split(/\s+/);
            const avgWordsPerSentence = words.length / sentences.length;
            
            if (avgWordsPerSentence > 20) return 'complex';
            if (avgWordsPerSentence > 10) return 'medium';
            return 'simple';
        };
    }
    
    // Initialize all helpers
    function initialize() {
        initializePlatformHelpers();
        setupInteractionTracking();
        setupPerformanceMonitoring();
        setupContentAnalysis();
        
        // Signal that injected script is ready
        window.dispatchEvent(new CustomEvent('injectedScriptReady'));
    }
    
    // Run initialization
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();