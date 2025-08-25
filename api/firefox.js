const fs = require('fs').promises;
const path = require('path');
const os = require('os');

class FirefoxAPI {
    constructor() {
        this.loadedFiles = new Map();
        this.templates = {
            chrome: {
                'Hide Tab Bar': `/* Hide the tab bar */
#TabsToolbar {
    visibility: collapse !important;
}`,
                'Compact Toolbar': `/* Make toolbar more compact */
:root {
    --toolbarbutton-border-radius: 2px !important;
    --tab-border-radius: 0px !important;
}

#nav-bar {
    padding: 2px 4px !important;
}`,
                'Dark Theme': `/* Dark theme for Firefox UI */
:root {
    --toolbar-bgcolor: #2b2a33 !important;
    --toolbar-color: #fbfbfe !important;
    --tab-selected-bgcolor: #42414d !important;
}

#main-window {
    background-color: #1c1b22 !important;
}`,
                'Minimal UI': `/* Minimal Firefox UI */
#main-window[tabsintitlebar="true"]:not([extradragspace="true"]) #TabsToolbar {
    opacity: 0;
    pointer-events: none;
}
#main-window[tabsintitlebar="true"]:not([extradragspace="true"]) #TabsToolbar:hover {
    opacity: 1;
    pointer-events: auto;
}`,
                'Vertical Tabs': `/* Move tabs to sidebar */
#TabsToolbar {
    position: fixed !important;
    top: 0 !important;
    left: 0 !important;
    width: 200px !important;
    height: 100vh !important;
    background: var(--toolbar-bgcolor) !important;
    flex-direction: column !important;
}

#navigator-toolbox {
    margin-left: 200px !important;
}`
            },
            content: {
                'Dark Websites': `/* Dark theme for websites */
@-moz-document url-prefix("http://"), url-prefix("https://") {
    * {
        background-color: #1a1a1a !important;
        color: #e6e6e6 !important;
        border-color: #444444 !important;
    }
    
    a, a * {
        color: #6ab7ff !important;
    }
    
    a:visited, a:visited * {
        color: #d19ad1 !important;
    }
    
    img {
        opacity: 0.8 !important;
    }
}`,
                'Custom Fonts': `/* Custom fonts for all websites */
@-moz-document url-prefix("http://"), url-prefix("https://") {
    * {
        font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif !important;
    }
    
    code, pre {
        font-family: "Consolas", "Monaco", monospace !important;
    }
}`,
                'Hide Ads': `/* Hide common ad containers */
@-moz-document url-prefix("http://"), url-prefix("https://") {
    [class*="ad-"], [id*="ad-"], [class*="ads"], [id*="ads"],
    .advertisement, .banner, .sponsor, .promoted,
    [class*="google-ad"], [id*="google-ad"] {
        display: none !important;
    }
}`,
                'Reading Mode': `/* Comfortable reading mode */
@-moz-document url-prefix("http://"), url-prefix("https://") {
    body {
        max-width: 800px !important;
        margin: 0 auto !important;
        line-height: 1.6 !important;
        font-size: 16px !important;
        padding: 20px !important;
        background: #fafafa !important;
        color: #333 !important;
    }
}`,
                'YouTube Dark': `/* Dark theme specifically for YouTube */
@-moz-document domain("youtube.com") {
    :root {
        --yt-spec-base-background: #0f0f0f !important;
        --yt-spec-raised-background: #212121 !important;
        --yt-spec-text-primary: #ffffff !important;
    }
}`
            },
            general: {
                'Reset All': `/* Reset/Clear all custom styles */
/* Add your custom CSS below this line */

`,
                'Template Structure': `/* 
   CSS Template Structure
   
   For userChrome.css (Firefox UI):
   - Target Firefox interface elements
   - Use Firefox-specific selectors
   
   For userContent.css (Web content):
   - Use @-moz-document rules to target websites
   - Apply styles to web page content
*/

/* Your custom CSS here */`
            }
        };
    }

    getFirefoxProfilesPath() {
        const platform = os.platform();
        
        switch (platform) {
            case 'win32':
                return path.join(os.homedir(), 'AppData', 'Roaming', 'Mozilla', 'Firefox', 'Profiles');
            case 'darwin':
                return path.join(os.homedir(), 'Library', 'Application Support', 'Firefox', 'Profiles');
            case 'linux':
                return path.join(os.homedir(), '.mozilla', 'firefox');
            default:
                throw new Error('Unsupported platform');
        }
    }

    async findFirefoxProfiles() {
        try {
            const profilesPath = this.getFirefoxProfilesPath();
            const profiles = await fs.readdir(profilesPath);
            
            const profileData = [];
            for (const profile of profiles) {
                const profilePath = path.join(profilesPath, profile);
                const stat = await fs.stat(profilePath);
                
                if (stat.isDirectory() && !profile.startsWith('.')) {
                    const chromePath = path.join(profilePath, 'chrome');
                    const prefsPath = path.join(profilePath, 'prefs.js');
                    
                    // Check if this looks like a valid Firefox profile
                    try {
                        await fs.access(prefsPath);
                        profileData.push({
                            name: profile,
                            path: profilePath,
                            chromePath: chromePath,
                            prefsPath: prefsPath,
                            hasChrome: await fs.access(chromePath).then(() => true).catch(() => false),
                            userChrome: path.join(chromePath, 'userChrome.css'),
                            userContent: path.join(chromePath, 'userContent.css')
                        });
                    } catch (error) {
                        // Skip directories that don't look like Firefox profiles
                        continue;
                    }
                }
            }
            
            return profileData;
        } catch (error) {
            console.error('Error finding Firefox profiles:', error);
            return [];
        }
    }

    async enableUserChrome(profileName) {
        try {
            const profiles = await this.findFirefoxProfiles();
            const profile = profiles.find(p => p.name === profileName);
            
            if (!profile) {
                throw new Error('Profile not found');
            }

            // Check if Firefox is running (optional safety check)
            const isFirefoxRunning = await this.checkIfFirefoxRunning();
            if (isFirefoxRunning) {
                console.warn('Firefox appears to be running. Changes may not take effect until restart.');
            }

            // Try multiple config files in order of preference
            const configResults = await this.updateFirefoxConfigs(profile);
            
            return {
                enabled: true,
                action: configResults.action,
                message: configResults.message,
                filesModified: configResults.filesModified,
                backupCreated: configResults.backupCreated
            };
        } catch (error) {
            console.error('Error enabling userChrome:', error);
            throw new Error(`Failed to enable userChrome.css: ${error.message}`);
        }
    }

    async updateFirefoxConfigs(profile) {
        const targetPref = 'user_pref("toolkit.legacyUserProfileCustomizations.stylesheets", true);';
        const prefPattern = /user_pref\("toolkit\.legacyUserProfileCustomizations\.stylesheets",\s*(true|false)\);/;
        
        const configFiles = [
            { path: profile.prefsPath, name: 'prefs.js', primary: true },
            { path: path.join(profile.path, 'user.js'), name: 'user.js', primary: false }
        ];

        let filesModified = [];
        let backupCreated = false;
        let action = 'none';
        let alreadyEnabled = false;

        // Process each config file
        for (const configFile of configFiles) {
            try {
                let content = '';
                let fileExists = false;

                // Try to read existing file
                try {
                    content = await fs.readFile(configFile.path, 'utf8');
                    fileExists = true;
                } catch (error) {
                    if (error.code !== 'ENOENT') {
                        throw error; // Re-throw if it's not a "file not found" error
                    }
                    // File doesn't exist, we'll create it
                }

                // Create backup of existing file
                if (fileExists && !backupCreated) {
                    const backupPath = `${configFile.path}.backup.${Date.now()}`;
                    await fs.copyFile(configFile.path, backupPath);
                    backupCreated = true;
                    console.log(`Created backup: ${backupPath}`);
                }

                // Check current state
                const currentlyEnabled = content.includes('toolkit.legacyUserProfileCustomizations.stylesheets", true');
                const currentlyDisabled = content.includes('toolkit.legacyUserProfileCustomizations.stylesheets", false');

                if (currentlyEnabled) {
                    alreadyEnabled = true;
                    continue; // Already enabled, skip this file
                }

                // Update or add the preference
                let newContent;
                if (prefPattern.test(content)) {
                    // Setting exists but is disabled, update it
                    newContent = content.replace(prefPattern, targetPref);
                    action = 'updated';
                } else {
                    // Setting doesn't exist, add it
                    const header = configFile.name === 'user.js' ? 
                        '// Firefox CSS Customizer - User preferences\n// This file is used to override default Firefox settings\n\n' : 
                        '';
                    
                    if (content.trim()) {
                        newContent = content.trim() + '\n\n// Enable userChrome.css support\n' + targetPref + '\n';
                    } else {
                        newContent = header + '// Enable userChrome.css support\n' + targetPref + '\n';
                    }
                    action = fileExists ? 'added' : 'created';
                }

                // Write the updated content
                await fs.writeFile(configFile.path, newContent, 'utf8');
                filesModified.push(configFile.name);

                console.log(`Updated ${configFile.name}: userChrome.css support enabled`);
                
                // If this is the primary file (prefs.js), we can stop here
                if (configFile.primary) {
                    break;
                }

            } catch (error) {
                console.error(`Error processing ${configFile.name}:`, error);
                // Continue with next file if one fails
            }
        }

        // Determine final result
        if (alreadyEnabled && filesModified.length === 0) {
            return {
                action: 'already_enabled',
                message: 'userChrome.css support was already enabled',
                filesModified: [],
                backupCreated
            };
        }

        if (filesModified.length === 0) {
            throw new Error('Could not enable userChrome.css support in any config file');
        }

        const message = `userChrome.css support enabled in ${filesModified.join(', ')}`;
        return {
            action,
            message,
            filesModified,
            backupCreated
        };
    }

    async checkIfFirefoxRunning() {
        try {
            const platform = os.platform();
            let command;

            switch (platform) {
                case 'win32':
                    command = 'tasklist /FI "IMAGENAME eq firefox.exe" 2>NUL | find /I "firefox.exe"';
                    break;
                case 'darwin':
                    command = 'pgrep -f "Firefox" > /dev/null';
                    break;
                case 'linux':
                    command = 'pgrep -f "firefox" > /dev/null';
                    break;
                default:
                    return false; // Unknown platform, assume not running
            }

            const { exec } = require('child_process');
            const { promisify } = require('util');
            const execAsync = promisify(exec);

            try {
                await execAsync(command);
                return true; // Command succeeded, Firefox is running
            } catch (error) {
                return false; // Command failed, Firefox is not running
            }
        } catch (error) {
            console.error('Error checking Firefox status:', error);
            return false; // Assume not running if we can't check
        }
    }

    async checkUserChromeEnabled(profileName) {
        try {
            const profiles = await this.findFirefoxProfiles();
            const profile = profiles.find(p => p.name === profileName);
            
            if (!profile) {
                return { enabled: false, error: 'Profile not found' };
            }

            const configFiles = [
                { path: profile.prefsPath, name: 'prefs.js' },
                { path: path.join(profile.path, 'user.js'), name: 'user.js' }
            ];

            let isEnabled = false;
            let foundIn = [];
            let conflictingSettings = false;

            for (const configFile of configFiles) {
                try {
                    const content = await fs.readFile(configFile.path, 'utf8');
                    
                    if (content.includes('toolkit.legacyUserProfileCustomizations.stylesheets", true')) {
                        isEnabled = true;
                        foundIn.push(configFile.name);
                    } else if (content.includes('toolkit.legacyUserProfileCustomizations.stylesheets", false')) {
                        foundIn.push(`${configFile.name} (disabled)`);
                        if (isEnabled) {
                            conflictingSettings = true;
                        }
                    }
                } catch (error) {
                    // File doesn't exist or can't be read, skip
                    continue;
                }
            }

            return { 
                enabled: isEnabled, 
                foundIn,
                conflictingSettings,
                details: foundIn.length > 0 ? `Found in: ${foundIn.join(', ')}` : 'Not configured'
            };
        } catch (error) {
            return { enabled: false, error: error.message };
        }
    }

    async createUserJsFile(profileName, additionalPrefs = []) {
        try {
            const profiles = await this.findFirefoxProfiles();
            const profile = profiles.find(p => p.name === profileName);
            
            if (!profile) {
                throw new Error('Profile not found');
            }

            const userJsPath = path.join(profile.path, 'user.js');
            
            // Default preferences for CSS customization
            const defaultPrefs = [
                {
                    key: 'toolkit.legacyUserProfileCustomizations.stylesheets',
                    value: true,
                    comment: 'Enable userChrome.css and userContent.css support'
                },
                {
                    key: 'browser.tabs.drawInTitlebar',
                    value: true,
                    comment: 'Enable drawing tabs in titlebar (required for many userChrome themes)'
                },
                {
                    key: 'svg.context-properties.content.enabled',
                    value: true,
                    comment: 'Enable SVG context properties (helps with custom icons)'
                }
            ];

            const allPrefs = [...defaultPrefs, ...additionalPrefs];
            
            const userJsContent = `// Firefox CSS Customizer - User preferences
// This file contains user preferences that override Firefox defaults
// Generated on: ${new Date().toISOString()}
//
// IMPORTANT: Restart Firefox after making changes to this file

${allPrefs.map(pref => {
    const value = typeof pref.value === 'string' ? `"${pref.value}"` : pref.value;
    return `// ${pref.comment}\nuser_pref("${pref.key}", ${value});`;
}).join('\n\n')}

// Add your custom preferences below this line
`;

            await fs.writeFile(userJsPath, userJsContent, 'utf8');
            
            return {
                success: true,
                path: userJsPath,
                prefsAdded: allPrefs.length,
                message: `Created user.js with ${allPrefs.length} preferences`
            };
        } catch (error) {
            throw new Error(`Failed to create user.js: ${error.message}`);
        }
    }

    async getFirefoxVersion(profileName) {
        try {
            const profiles = await this.findFirefoxProfiles();
            const profile = profiles.find(p => p.name === profileName);
            
            if (!profile) {
                throw new Error('Profile not found');
            }

            // Try to read compatibility.ini for version info
            const compatPath = path.join(profile.path, 'compatibility.ini');
            
            try {
                const content = await fs.readFile(compatPath, 'utf8');
                const versionMatch = content.match(/LastVersion=(.+)/);
                if (versionMatch) {
                    return { version: versionMatch[1], source: 'compatibility.ini' };
                }
            } catch (error) {
                // File doesn't exist, try prefs.js
            }

            // Try to get version from prefs.js
            try {
                const prefsContent = await fs.readFile(profile.prefsPath, 'utf8');
                const versionMatch = prefsContent.match(/user_pref\("browser\.startup\.homepage_override\.mstone", "(.+)"\)/);
                if (versionMatch) {
                    return { version: versionMatch[1], source: 'prefs.js' };
                }
            } catch (error) {
                // Can't determine version
            }

            return { version: 'unknown', source: 'none' };
        } catch (error) {
            return { version: 'error', source: 'error', error: error.message };
        }
    }

    async validateProfile(profileName) {
        try {
            const profiles = await this.findFirefoxProfiles();
            const profile = profiles.find(p => p.name === profileName);
            
            if (!profile) {
                return { valid: false, error: 'Profile not found' };
            }

            const checks = {
                prefsExists: false,
                chromeDirectoryExists: false,
                userChromeExists: false,
                userContentExists: false,
                userJsExists: false,
                isWritable: false
            };

            // Check if prefs.js exists
            try {
                await fs.access(profile.prefsPath, fs.constants.R_OK);
                checks.prefsExists = true;
            } catch (error) {
                // File doesn't exist or not readable
            }

            // Check chrome directory
            try {
                await fs.access(profile.chromePath, fs.constants.R_OK);
                checks.chromeDirectoryExists = true;
            } catch (error) {
                // Directory doesn't exist
            }

            // Check CSS files
            try {
                await fs.access(profile.userChrome, fs.constants.R_OK);
                checks.userChromeExists = true;
            } catch (error) {
                // File doesn't exist
            }

            try {
                await fs.access(profile.userContent, fs.constants.R_OK);
                checks.userContentExists = true;
            } catch (error) {
                // File doesn't exist
            }

            // Check user.js
            const userJsPath = path.join(profile.path, 'user.js');
            try {
                await fs.access(userJsPath, fs.constants.R_OK);
                checks.userJsExists = true;
            } catch (error) {
                // File doesn't exist
            }

            // Check if profile directory is writable
            try {
                await fs.access(profile.path, fs.constants.W_OK);
                checks.isWritable = true;
            } catch (error) {
                // Not writable
            }

            const valid = checks.prefsExists && checks.isWritable;
            
            return {
                valid,
                profile: profile.name,
                path: profile.path,
                checks,
                recommendations: this.getProfileRecommendations(checks)
            };
        } catch (error) {
            return { valid: false, error: error.message };
        }
    }

    getProfileRecommendations(checks) {
        const recommendations = [];
        
        if (!checks.chromeDirectoryExists) {
            recommendations.push('Create chrome directory for CSS files');
        }
        
        if (!checks.userJsExists) {
            recommendations.push('Consider creating user.js for advanced configuration');
        }
        
        if (!checks.isWritable) {
            recommendations.push('Check file permissions - profile directory is not writable');
        }
        
        return recommendations;
    }

    async loadFile(filePath) {
        try {
            if (!filePath) {
                throw new Error('File path is required');
            }

            try {
                await fs.access(filePath, fs.constants.R_OK);
            } catch {
                throw new Error('File not found or not readable');
            }

            const content = await fs.readFile(filePath, 'utf8');
            const fileName = path.basename(filePath);
            const directory = path.dirname(filePath);
            const fileId = Date.now().toString();
            
            this.loadedFiles.set(fileId, {
                path: filePath,
                name: fileName,
                directory: directory,
                lastModified: (await fs.stat(filePath)).mtime
            });

            return {
                fileId,
                content,
                fileName,
                directory,
                fullPath: filePath
            };
        } catch (error) {
            throw error;
        }
    }

    async saveFile(fileId, content, filePath = null) {
        try {
            let targetPath = filePath;
            
            if (fileId && this.loadedFiles.has(fileId)) {
                targetPath = this.loadedFiles.get(fileId).path;
            }

            if (!targetPath) {
                throw new Error('File path or file ID is required');
            }

            const directory = path.dirname(targetPath);
            
            try {
                await fs.access(directory);
            } catch {
                await fs.mkdir(directory, { recursive: true });
            }

            await fs.writeFile(targetPath, content, 'utf8');

            if (fileId && this.loadedFiles.has(fileId)) {
                const fileInfo = this.loadedFiles.get(fileId);
                fileInfo.lastModified = new Date();
            }

            return {
                success: true,
                filePath: targetPath,
                message: 'File saved successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    async saveAsFile(content, filePath) {
        try {
            if (!filePath || !content) {
                throw new Error('File path and content are required');
            }

            const directory = path.dirname(filePath);
            
            try {
                await fs.access(directory);
            } catch {
                await fs.mkdir(directory, { recursive: true });
            }

            await fs.writeFile(filePath, content, 'utf8');

            const fileId = Date.now().toString();
            this.loadedFiles.set(fileId, {
                path: filePath,
                name: path.basename(filePath),
                directory: directory,
                lastModified: new Date()
            });

            return {
                success: true,
                fileId,
                filePath,
                fileName: path.basename(filePath),
                message: 'File saved successfully'
            };
        } catch (error) {
            throw error;
        }
    }

    async quickAccess(profileName, cssType) {
        try {
            const profiles = await this.findFirefoxProfiles();
            const profile = profiles.find(p => p.name === profileName);
            
            if (!profile) {
                throw new Error('Profile not found');
            }

            const filePath = cssType === 'chrome' ? profile.userChrome : profile.userContent;

            if (!profile.hasChrome) {
                await fs.mkdir(profile.chromePath, { recursive: true });
            }

            let content = '';
            try {
                content = await fs.readFile(filePath, 'utf8');
            } catch {
                // File doesn't exist, start with empty content
            }

            const fileId = Date.now().toString();
            this.loadedFiles.set(fileId, {
                path: filePath,
                name: path.basename(filePath),
                directory: path.dirname(filePath),
                lastModified: new Date()
            });

            return {
                fileId,
                content,
                fileName: path.basename(filePath),
                directory: path.dirname(filePath),
                fullPath: filePath
            };
        } catch (error) {
            throw error;
        }
    }

    getTemplates(type = null) {
        if (type && this.templates[type]) {
            return this.templates[type];
        }
        return this.templates;
    }
}

module.exports = FirefoxAPI;