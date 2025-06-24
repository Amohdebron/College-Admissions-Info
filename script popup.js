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
                    chrome.tabs.create({ url: 'https://www.google.
