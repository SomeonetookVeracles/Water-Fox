const express = require('express');
const path = require('path');
const FirefoxAPI = require('./api/firefox');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Firefox API
const firefoxAPI = new FirefoxAPI();

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Helper function to handle async routes
const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// File operations
app.post('/api/file/load', asyncHandler(async (req, res) => {
    const { filePath } = req.body;
    const result = await firefoxAPI.loadFile(filePath);
    res.json(result);
}));

app.post('/api/file/save', asyncHandler(async (req, res) => {
    const { fileId, content, filePath } = req.body;
    const result = await firefoxAPI.saveFile(fileId, content, filePath);
    res.json(result);
}));

app.post('/api/file/save-as', asyncHandler(async (req, res) => {
    const { content, filePath } = req.body;
    const result = await firefoxAPI.saveAsFile(content, filePath);
    res.json(result);
}));

// Firefox profile operations
app.get('/api/profiles', asyncHandler(async (req, res) => {
    const profiles = await firefoxAPI.findFirefoxProfiles();
    res.json(profiles);
}));

app.post('/api/firefox/quick-access', asyncHandler(async (req, res) => {
    const { profileName, cssType } = req.body;
    const result = await firefoxAPI.quickAccess(profileName, cssType);
    res.json(result);
}));

// userChrome.css enablement
app.post('/api/firefox/enable-userchrome', asyncHandler(async (req, res) => {
    const { profileName } = req.body;
    
    if (!profileName) {
        return res.status(400).json({ error: 'Profile name is required' });
    }

    const result = await firefoxAPI.enableUserChrome(profileName);
    res.json(result);
}));

app.get('/api/firefox/check-userchrome/:profileName', asyncHandler(async (req, res) => {
    const { profileName } = req.params;
    const result = await firefoxAPI.checkUserChromeEnabled(profileName);
    res.json(result);
}));

// Batch enable userChrome for all profiles
app.post('/api/firefox/enable-userchrome-all', asyncHandler(async (req, res) => {
    const profiles = await firefoxAPI.findFirefoxProfiles();
    const results = [];
    
    for (const profile of profiles) {
        try {
            const result = await firefoxAPI.enableUserChrome(profile.name);
            results.push({
                profile: profile.name,
                ...result
            });
        } catch (error) {
            results.push({
                profile: profile.name,
                enabled: false,
                action: 'error',
                message: error.message
            });
        }
    }
    
    res.json({
        success: true,
        results,
        summary: {
            total: profiles.length,
            enabled: results.filter(r => r.enabled).length,
            failed: results.filter(r => !r.enabled).length
        }
    });
}));

// Advanced Firefox configuration
app.post('/api/firefox/create-userjs', asyncHandler(async (req, res) => {
    const { profileName, additionalPrefs = [] } = req.body;
    
    if (!profileName) {
        return res.status(400).json({ error: 'Profile name is required' });
    }

    const result = await firefoxAPI.createUserJsFile(profileName, additionalPrefs);
    res.json(result);
}));

app.get('/api/firefox/validate/:profileName', asyncHandler(async (req, res) => {
    const { profileName } = req.params;
    const result = await firefoxAPI.validateProfile(profileName);
    res.json(result);
}));

app.get('/api/firefox/version/:profileName', asyncHandler(async (req, res) => {
    const { profileName } = req.params;
    const result = await firefoxAPI.getFirefoxVersion(profileName);
    res.json(result);
}));

app.get('/api/firefox/status', asyncHandler(async (req, res) => {
    const isRunning = await firefoxAPI.checkIfFirefoxRunning();
    res.json({ 
        firefoxRunning: isRunning,
        timestamp: new Date().toISOString()
    });
}));

// Template operations
app.get('/api/templates/:type', (req, res) => {
    try {
        const { type } = req.params;
        const templates = firefoxAPI.getTemplates(type);
        
        if (!templates || Object.keys(templates).length === 0) {
            return res.json({});
        }
        
        res.json(templates);
    } catch (error) {
        console.error('Error getting templates by type:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/templates', (req, res) => {
    try {
        const templates = firefoxAPI.getTemplates();
        res.json(templates);
    } catch (error) {
        console.error('Error getting all templates:', error);
        res.status(500).json({ error: error.message });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        platform: require('os').platform(),
        nodeVersion: process.version
    });
});

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('API Error:', error);
    
    if (error.message) {
        res.status(500).json({ error: error.message });
    } else {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Handle 404s
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🦊 Firefox CSS Customizer running at http://localhost:${PORT}`);
    console.log('📁 Make sure you have created the public/index.html file!');
    console.log('🌐 Open your web browser and navigate to the URL above to start customizing!');
    console.log('');
    console.log('🔧 New features:');
    console.log('  • Automatic userChrome.css enablement');
    console.log('  • Check userChrome.css status per profile');
    console.log('  • Enable userChrome.css for all profiles at once');
    console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('Server shutting down gracefully...');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nServer shutting down gracefully...');
    process.exit(0);
});

module.exports = app;