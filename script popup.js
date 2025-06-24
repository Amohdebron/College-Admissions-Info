// Popup script for College Analyzer Extension
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize popup
    await initializePopup();
    
    // Set up event listeners
    setupEventListeners();
    
    // Load current page info
    await loadCurrentPageInfo();
    
    // Load stats and recent colleges
    await loadStats();
    await loadRecentColleges();
});

async function initializePopup() {
    console.log('College Analyzer popup initialized');
}

function setupEventListeners() {
    // Analyze button
    document.getElementById('analyzeBtn').addEventListener('click', async () => {
        await analyzeCurrentPage();
    });
    
    // Dashboard button
    document.getElementById('dashboardBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('analyzer.html') });
        window.close();
    });
    
    // Compare button
    document.getElementById('compareBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('compare.html') });
        window.close();
    });
    
    // Watchlist button
    document.getElementById('watchlistBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: chrome.runtime.getURL('analyzer.html#watchlist') });
        window.close();
    });
    
    // Options button
    document.getElementById('optionsBtn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });
    
    // Help button
    document.getElementById('helpBtn').addEventListener('click', () => {
        chrome.tabs.create({ url: 'https://github.com/hebron/college-analyzer/wiki' });
        window.close();
    });
}

async function loadCurrentPageInfo() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (tab) {
            document.getElementById('pageTitle').textContent = tab.title || 'Unknown Page';
            document.getElementById('pageUrl').textContent = formatUrl(tab.url);
            
            // Check if current page is a college website
            const isCollegePage = detectCollegePage(tab.url);
            if (isCollegePage) {
                document.getElementById('analyzeBtn').style.display = 'flex';
                await loadCollegePreview(tab);
            } else {
                document.getElementById('analyzeBtn').textContent = '🔍 Search Colleges';
                document.getElementById('analyzeBtn').onclick = () => {
                    chrome.tabs.create({ url: 'https://www.google.com/search?q=college+rankings' });
                    window.close();
                };
            }
        }
    } catch (error) {
        console.error('Error loading current page info:', error);
        document.getElementById('pageTitle').textContent = 'Error loading page';
    }
}

function detectCollegePage(url) {
    const collegeKeywords = [
        'usnews.com/best-colleges',
        'niche.com/colleges',
        'bigfuture.collegeboard.org',
        'princetonreview.com/college',
        'collegedata.com',
        'cappex.com/colleges',
        'petersons.com/college',
        '.edu'
    ];
    
    return collegeKeywords.some(keyword => url.includes(keyword));
}

function formatUrl(url) {
    try {
        const urlObj = new URL(url);
        return urlObj.hostname + urlObj.pathname;
    } catch {
        return url;
    }
}

async function loadCollegePreview(tab) {
    try {
        // Try to extract college info from current page
        const results = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: extractBasicCollegeInfo
        });
        
        if (results && results[0] && results[0].result) {
            const collegeInfo = results[0].result;
            showCollegePreview(collegeInfo);
        }
    } catch (error) {
        console.error('Error loading college preview:', error);
    }
}

function extractBasicCollegeInfo() {
    const url = window.location.href;
    let info = {
        name: '',
        location: '',
        type: '',
        acceptance: ''
    };

    // US News extraction
    if (url.includes('usnews.com')) {
        info.name = document.querySelector('h1')?.textContent?.trim() || '';
        info.location = document.querySelector('[data-testid="school-location"]')?.textContent?.trim() || '';
        
        const statsElements = document.querySelectorAll('[data-testid*="stat"]');
        statsElements.forEach(el => {
            const text = el.textContent.toLowerCase();
            if (text.includes('acceptance rate')) {
                info.acceptance = el.textContent.replace(/.*acceptance rate:?\s*/i, '');
            }
        });
    }
    
    // Niche extraction
    else if (url.includes('niche.com')) {
        info.name = document.querySelector('h1')?.textContent?.trim() || '';
        info.location = document.querySelector('.profile__address')?.textContent?.trim() || '';
        
        const gradeElement = document.querySelector('[class*="grade"]');
        if (gradeElement) {
            info.type = gradeElement.textContent.trim();
        }
    }
    
    // College Board extraction
    else if (url.includes('bigfuture.collegeboard.org')) {
        info.name = document.querySelector('h1')?.textContent?.trim() || '';
        info.location = document.querySelector('[data-testid="location"]')?.textContent?.trim() || '';
    }
    
    // Generic .edu site extraction
    else if (url.includes('.edu')) {
        info.name = document.title.replace(/\s*\|\s*.*$/, '');
        const metaDescription = document.querySelector('meta[name="description"]');
        if (metaDescription) {
            info.type = metaDescription.content.substring(0, 100) + '...';
        }
    }

    return info;
}

function showCollegePreview(info) {
    if (info.name) {
        document.getElementById('previewName').textContent = info.name;
        document.getElementById('previewLocation').textContent = info.location || '-';
        document.getElementById('previewType').textContent = info.type || '-';
        document.getElementById('previewAcceptance').textContent = info.acceptance || '-';
        document.getElementById('collegePreview').style.display = 'block';
    }
}

async function analyzeCurrentPage() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const originalText = analyzeBtn.innerHTML;
    
    try {
        // Show loading state
        analyzeBtn.innerHTML = '<span class="icon">⏳</span>Analyzing...';
        analyzeBtn.disabled = true;
        
        // Send message to background script to analyze
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        await chrome.runtime.sendMessage({
            type: 'ANALYZE_PAGE',
            tabId: tab.id
        });
        
        // Update UI
        analyzeBtn.innerHTML = '<span class="icon">✅</span>Analyzed!';
        
        // Refresh stats and recent colleges
        setTimeout(async () => {
            await loadStats();
            await loadRecentColleges();
            analyzeBtn.innerHTML = originalText;
            analyzeBtn.disabled = false;
        }, 2000);
        
    } catch (error) {
        console.error('Error analyzing page:', error);
        analyzeBtn.innerHTML = '<span class="icon">❌</span>Error';
        setTimeout(() => {
            analyzeBtn.innerHTML = originalText;
            analyzeBtn.disabled = false;
        }, 2000);
    }
}

async function loadStats() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_COLLEGE_DATA'
        });
        
        if (response && !response.error) {
            const totalColleges = response.colleges ? response.colleges.length : 0;
            const watchlistCount = response.watchlist ? response.watchlist.length : 0;
            
            document.getElementById('totalColleges').textContent = totalColleges;
            document.getElementById('watchlistCount').textContent = watchlistCount;
            
            if (totalColleges > 0 || watchlistCount > 0) {
                document.getElementById('quickStats').style.display = 'flex';
            }
        }
    } catch (error) {
        console.error('Error loading stats:', error);
    }
}

async function loadRecentColleges() {
    try {
        const response = await chrome.runtime.sendMessage({
            type: 'GET_COLLEGE_DATA'
        });
        
        if (response && response.colleges && response.colleges.length > 0) {
            const recentColleges = response.colleges
                .sort((a, b) => new Date(b.analyzedAt) - new Date(a.analyzedAt))
                .slice(0, 5);
            
            const recentList = document.getElementById('recentList');
            recentList.innerHTML = '';
            
            recentColleges.forEach(college => {
                const item = document.createElement('div');
                item.className = 'recent-item';
                item.innerHTML = `
                    <div>
                        <div class="recent-name">${college.name}</div>
                        <div class="recent-source">${college.source || 'Unknown'}</div>
                    </div>
                    <div class="recent-date">${formatDate(college.analyzedAt)}</div>
                `;
                
                item.addEventListener('click', () => {
                    if (college.url) {
                        chrome.tabs.create({ url: college.url });
                        window.close();
                    }
                });
                
                recentList.appendChild(item);
            });
        } else {
            document.getElementById('recentList').innerHTML = '<div class="no-data">No colleges analyzed yet</div>';
        }
    } catch (error) {
        console.error('Error loading recent colleges:', error);
    }
}

function formatDate(dateString) {
    try {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (minutes < 60) {
            return `${minutes}m ago`;
        } else if (hours < 24) {
            return `${hours}h ago`;
        } else if (days < 7) {
            return `${days}d ago`;
        } else {
            return date.toLocaleDateString();
        }
    } catch {
        return 'Recently';
    }
}

// Handle messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'ANALYSIS_COMPLETE':
            loadStats();
            loadRecentColleges();
            break;
        case 'UPDATE_POPUP':
            loadStats();
            loadRecentColleges();
            break;
    }
});
