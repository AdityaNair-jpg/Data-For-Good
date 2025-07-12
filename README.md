# Social Media Data Donation Browser Extension

## Overview

This open-source browser extension allows users to voluntarily donate their anonymized social media interaction data to help researchers understand user engagement patterns across different platforms. The extension is designed to be privacy-focused, transparent, and community-driven.

## Features

- **Multi-platform support**: Works on Twitter/X, Facebook, Instagram, and LinkedIn
- **Privacy-first**: All data is anonymized before collection
- **Explicit consent**: Users must explicitly consent before any data collection begins
- **Gamification**: Optional point system and levels to encourage participation
- **Cross-browser compatibility**: Supports Chrome and Safari using WebExtension standards
- **Open source**: Fully transparent codebase for community contributions

## Installation

### From Source

1. Clone this repository:
   ```bash
   git clone https://github.com/your-org/social-media-data-donation.git
   cd social-media-data-donation
   ```

2. **For Chrome:**
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode"
   - Click "Load unpacked" and select the project directory

3. **For Safari:**
   - Open Safari and go to Safari → Preferences → Advanced
   - Enable "Show Develop menu in menu bar"
   - Go to Develop → Allow Unsigned Extensions
   - Go to Safari → Preferences → Extensions
   - Click "Load Unpacked Extension" and select the project directory

## Usage

### Initial Setup

1. Click the extension icon in your browser toolbar
2. Read and accept the data donation consent agreement
3. Confirm your understanding of data anonymization
4. Start data collection by clicking "Start Data Collection"

### Data Collection

The extension automatically collects anonymized data about:

- **Post interactions**: Likes, shares, comments, and views
- **Content engagement**: Time spent viewing posts, scroll behavior
- **Content types**: Text, images, videos, and their engagement patterns
- **Platform behavior**: Navigation patterns and session duration
- **Performance metrics**: Page load times and interaction responsiveness

### Gamification Features

- **Points system**: Earn points for different types of interactions
- **Levels**: Progress through levels based on accumulated points
- **Stats tracking**: View your daily sessions and data contribution statistics

## Privacy & Security

### Data Anonymization

All collected data is automatically anonymized:

- **No personal identifiers**: Names, usernames, and profile information are excluded
- **Content anonymization**: Actual post content is not collected, only metadata
- **Hashed user agents**: Browser fingerprints are hashed for privacy
- **Randomized session IDs**: Each session gets a unique, non-traceable identifier

### Data Transmitted

The extension only transmits:
- Content type (text, image, video)
- Interaction type (like, share, comment, view)
- Timing information (duration, timestamp)
- Platform information (Twitter, Facebook, etc.)
- Engagement metrics (scroll depth, view duration)

### Data NOT Transmitted

- Personal information (names, emails, profiles)
- Actual post content or comments
- Private messages or conversations
- Location data
- Friends/followers lists
- Account credentials

## Technical Architecture

### Core Components

1. **Manifest (manifest.json)**: Extension configuration and permissions
2. **Background Script (background.js)**: Data processing and API communication
3. **Content Script (content.js)**: Platform-specific data collection
4. **Popup Interface (popup.html/js)**: User interface and consent management
5. **Injected Script (injected.js)**: Deep platform integration helpers

### Data Flow

```
User Interaction → Content Script → Background Script → API Endpoint
                ↓
        Anonymization → Storage Buffer → Periodic Sync
```

### Platform Support

#### Twitter/X
- Tweet interactions (likes, retweets, replies)
- Timeline scrolling behavior
- Media content engagement
- Thread reading patterns

#### Facebook
- Post interactions (likes, comments, shares)
- Feed scrolling behavior
- Story and reel engagement
- News feed navigation

#### Instagram
- Post interactions (likes, comments, saves)
- Story viewing patterns
- Reel engagement
- Explore page behavior

#### LinkedIn
- Post interactions (likes, comments, shares)
- Article reading behavior
- Professional content engagement
- Feed navigation patterns

## API Integration

### Data Submission Format

```json
{
  "sessionId": "session_1234567890_abc123",
  "timestamp": 1641234567890,
  "platform": "Twitter",
  "contentType": "tweet",
  "actionType": "like",
  "duration": 2500,
  "scrollDepth": 45,
  "engagementLevel": "medium",
  "hasMedia": true,
  "contentLength": 280,
  "timeOfDay": 14,
  "dayOfWeek": 2,
  "userAgent": "hashed_value",
  "screenResolution": "1920x1080",
  "timezone": "America/New_York"
}
```

### API Endpoints

Replace the `sendToAPI` function in `background.js` with your actual API endpoint:

```javascript
async sendToAPI(data) {
    const response = await fetch('https://your-api-endpoint.com/data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_API_KEY'
        },
        body: JSON.stringify(data)
    });
    
    return response.json();
}
```

## Development

### Project Structure

```
social-media-data-donation/
├── manifest.json          # Extension manifest
├── background.js          # Background service worker
├── content.js            # Content script
├── popup.html            # Extension popup interface
├── popup.js              # Popup logic
├── injected.js           # Injected helper script
├── icons/                # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md             # This file
```

### Adding New Platforms

1. Add platform URL patterns to `manifest.json`
2. Implement platform-specific observers in