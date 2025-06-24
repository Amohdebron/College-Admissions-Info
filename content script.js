// College Scraper Content Script
console.log('College Scraper loaded on:', window.location.href);

// Initialize scraper
let collegeData = null;
let scrapingActive = false;

// Inject overlay UI
injectOverlayUI();

// Auto-detect and extract college data
setTimeout(() => {
    extractCollegeData();
}, 2000);

function injectOverlayUI() {
    // Create floating action button
    const fab = document.createElement('div');
    fab.id = 'college-analyzer-fab';
    fab.innerHTML = `
        <div class="fab-button" id="analyzerFab" title="Analyze College">
            <span class="fab-icon">🎓</span>
        </div>
        <div class="fab-menu" id="fabMenu" style="display: none;">
            <button class="fab-menu-item" id="analyzePage">
                <span class="icon">🔍</span>
                Analyze Page
            </button>
            <button class="fab-menu-item" id="addToWatchlist">
                <span class="icon">⭐</span>
                Add to Watchlist
            </button>
            <button class="fab-menu-item" id="quickCompare">
                <span class="icon">⚖️</span>
                Quick Compare
            </button>
        </div>
    `;
    
    document.body.appendChild(fab);
    
    // Set up event listeners
    setupFABListeners();
}

function setupFABListeners() {
    const fab = document.getElementById('analyzerFab');
    const menu = document.getElementById('fabMenu');
    
    if (fab && menu) {
        fab.addEventListener('click', () => {
            const isVisible = menu.style.display !== 'none';
            menu.style.display = isVisible ? 'none' : 'block';
        });
        
        // Analyze page
        document.getElementById('analyzePage')?.addEventListener('click', () => {
            analyzeCurrentPage();
            menu.style.display = 'none';
        });
        
        // Add to watchlist
        document.getElementById('addToWatchlist')?.addEventListener('click', () => {
            addToWatchlist();
            menu.style.display = 'none';
        });
        
        // Quick compare
        document.getElementById('quickCompare')?.addEventListener('click', () => {
            openQuickCompare();
            menu.style.display = 'none';
        });
        
        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!fab.contains(e.target) && !menu.contains(e.target)) {
                menu.style.display = 'none';
            }
        });
    }
}

function extractCollegeData() {
    const url = window.location.href;
    collegeData = {
        name: '',
        location: '',
        type: '',
        size: '',
        tuition: {
            inState: '',
            outOfState: ''
        },
        acceptanceRate: '',
        satRange: '',
        actRange: '',
        gpa: '',
        rankings: {},
        demographics: {},
        majors: [],
        financialAid: {},
        campusLife: {},
        source: '',
        url: url,
        scrapedAt: new Date().toISOString()
    };

    // US News extraction
    if (url.includes('usnews.com')) {
        extractUSNewsData();
    }
    // Niche extraction
    else if (url.includes('niche.com')) {
        extractNicheData();
    }
    // College Board extraction
    else if (url.includes('bigfuture.collegeboard.org')) {
        extractCollegeBoardData();
    }
    // Princeton Review extraction
    else if (url.includes('princetonreview.com')) {
        extractPrincetonReviewData();
    }
    // CollegeData extraction
    else if (url.includes('collegedata.com')) {
        extractCollegeDataInfo();
    }
    // Generic .edu extraction
    else if (url.includes('.edu')) {
        extractEduSiteData();
    }

    console.log('Extracted college data:', collegeData);
    return collegeData;
}

function extractUSNewsData() {
    collegeData.source = 'US News';
    
    // Basic info
    collegeData.name = document.querySelector('h1')?.textContent?.trim() || '';
    collegeData.location = document.querySelector('[data-testid="school-location"]')?.textContent?.trim() || '';
    
    // Rankings
    const rankingElement = document.querySelector('[data-testid="hero-ranking"]');
    if (rankingElement) {
        collegeData.rankings.overall = rankingElement.textContent.trim();
    }
    
    // Stats extraction
    const statsElements = document.querySelectorAll('[data-testid*="stat"], .stat-value, .school-stat');
    statsElements.forEach(el => {
        const text = el.textContent.toLowerCase();
        const value = el.textContent.trim();
        
        if (text.includes('acceptance rate')) {
            collegeData.acceptanceRate = value.replace(/.*acceptance rate:?\s*/i, '');
        } else if (text.includes('tuition') && text.includes('state')) {
            if (text.includes('in-state') || text.includes('in state')) {
                collegeData.tuition.inState = value;
            } else if (text.includes('out-of-state') || text.includes('out of state')) {
                collegeData.tuition.outOfState = value;
            }
        } else if (text.includes('enrollment') || text.includes('students')) {
            collegeData.size = value;
        } else if (text.includes('sat')) {
            collegeData.satRange = value;
        } else if (text.includes('act')) {
            collegeData.actRange = value;
        } else if (text.includes('gpa')) {
            collegeData.gpa = value;
        }
    });
    
    // Extract majors
    const majorElements = document.querySelectorAll('.major-link, [data-testid*="major"]');
    majorElements.forEach(el => {
        const major = el.textContent.trim();
        if (major && !collegeData.majors.includes(major)) {
            collegeData.majors.push(major);
        }
    });
}

function extractNicheData() {
    collegeData.source = 'Niche';
    
    // Basic info
    collegeData.name = document.querySelector('h1')?.textContent?.trim() || '';
    collegeData.location = document.querySelector('.profile__address')?.textContent?.trim() || '';
    
    // Overall grade
    const gradeElement = document.querySelector('.niche__grade, [class*="grade"]');
    if (gradeElement) {
        collegeData.rankings.nicheGrade = gradeElement.textContent.trim();
    }
    
    // Stats from profile cards
    const profileCards = document.querySelectorAll('.profile-grade, .scalar, .profile__bucket');
    profileCards.forEach(card => {
        const label = card.querySelector('.scalar__label, .profile__bucket__title')?.textContent?.toLowerCase() || '';
        const value = card.querySelector('.scalar__value, .profile__bucket__item')?.textContent?.trim() || '';
        
        if (label.includes('acceptance rate')) {
            collegeData.acceptanceRate = value;
        } else if (label.includes('net price')) {
            collegeData.tuition.netPrice = value;
        } else if (label.includes('enrollment')) {
            collegeData.size = value;
        } else if (label.includes('sat')) {
            collegeData.satRange = value;
        } else if (label.includes('act')) {
            collegeData.actRange = value;
        }
    });
    
    // Campus life data
    const campusElements = document.querySelectorAll('[data-testid*="campus"], .campus-life');
    campusElements.forEach(el => {
        const text = el.textContent.toLowerCase();
        if (text.includes('dorm') || text.includes('housing')) {
            collegeData.campusLife.housing = el.textContent.trim();
        } else if (text.includes('dining')) {
            collegeData.campusLife.dining = el.textContent.trim();
        }
    });
}

function extractCollegeBoardData() {
    collegeData.source = 'College Board';
    
    // Basic info
    collegeData.name = document.querySelector('h1, .college-name')?.textContent?.trim() || '';
    collegeData.location = document.querySelector('[data-testid="location"], .location')?.textContent?.trim() || '';
    
    // Type and size
    const typeElement = document.querySelector('.college-type, [data-testid="type"]');
    if (typeElement) {
        collegeData.type = typeElement.textContent.trim();
    }
    
    const sizeElement = document.querySelector('.enrollment, [data-testid="enrollment"]');
    if (sizeElement) {
        collegeData.size = sizeElement.textContent.trim();
    }
    
    // Financial info
    const costElements = document.querySelectorAll('.cost-item, [data-testid*="cost"]');
    costElements.forEach(el => {
        const text = el.textContent.toLowerCase();
        if (text.includes('tuition')) {
            if (text.includes('in-state')) {
                collegeData.tuition.inState = el.textContent.trim();
            } else if (text.includes('out-of-state')) {
                collegeData.tuition.outOfState = el.textContent.trim();
            }
        }
    });
    
    // Test scores
    const testElements = document.querySelectorAll('.test-scores, [data-testid*="test"]');
    testElements.forEach(el => {
        const text = el.textContent.toLowerCase();
        if (text.includes('sat')) {
            collegeData.satRange = el.textContent.replace(/.*sat:?\s*/i, '').trim();
        } else if (text.includes('act')) {
            collegeData.actRange = el.textContent.replace(/.*act:?\s*/i, '').trim();
        }
    });
}

function extractPrincetonReviewData() {
    collegeData.source = 'Princeton Review';
    
    collegeData.name = document.querySelector('h1, .school-name')?.textContent?.trim() || '';
    collegeData.location = document.querySelector('.location, .school-location')?.textContent?.trim() || '';
    
    // Extract stats from various sections
    const statElements = document.querySelectorAll('.stat, .data-point, .school-stat');
    statElements.forEach(el => {
        const text = el.textContent.toLowerCase();
        const value = el.textContent.trim();
        
        if (text.includes('acceptance')) {
            collegeData.acceptanceRate = value;
        } else if (text.includes('enrollment')) {
            collegeData.size = value;
        }
    });
}

function extractCollegeDataInfo() {
    collegeData.source = 'CollegeData';
    
    collegeData.name = document.querySelector('h1, .college-name')?.textContent?.trim() || '';
    collegeData.location = document.querySelector('.location')?.textContent?.trim() || '';
    
    // Extract from data tables
    const dataRows = document.querySelectorAll('tr, .data-row');
    dataRows.forEach(row => {
        const cells = row.querySelectorAll('td, .data-cell');
        if (cells.length >= 2) {
            const label = cells[0].textContent.toLowerCase();
            const value = cells[1].textContent.trim();
            
            if (label.includes('acceptance rate')) {
                collegeData.acceptanceRate = value;
            } else if (label.includes('enrollment')) {
                collegeData.size = value;
            } else if (label.includes('tuition')) {
                if (label.includes('state')) {
                    collegeData.tuition.inState = value;
                } else {
                    collegeData.tuition.outOfState = value;
                }
            }
        }
    });
}

function extractEduSiteData() {
    collegeData.source = 'Official Website';
    
    // Basic extraction from official .edu sites
    collegeData.name = document.title.replace(/\s*\|\s*.*$/, '').replace(/\s*-\s*.*$/, '').trim();
    
    // Try to find location in meta tags or common selectors
    const metaDescription = document.querySelector('meta[name="description"]');
    if (metaDescription) {
        const description = metaDescription.content;
        const locationMatch = description.match(/(?:in|at)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s*[A-Z]{2})/);
        if (locationMatch) {
            collegeData.location = locationMatch[1];
        }
    }
    
    // Look for common admission/stats sections
    const admissionElements = document.querySelectorAll('[class*="admission"], [class*="stats"], [id*="admission"]');
    admissionElements.forEach(el => {
        const text = el.textContent.toLowerCase();
        if (text.includes('acceptance rate') || text.includes('admit rate')) {
            const rateMatch = text.match(/(\d+(?:\.\d+)?%)/);
            if (rateMatch) {
                collegeData.acceptanceRate = rateMatch[1];
            }
        }
    });
}

async function analyzeCurrentPage() {
    try {
        showAnalysisProgress();
        
        // Extract data if not already done
        if (!collegeData || !collegeData.name) {
            extractCollegeData();
        }
        
        // Send to background script for processing
        const response = await chrome.runtime.sendMessage({
            type: 'SAVE_COLLEGE_DATA',
            data: collegeData
        });
        
        if (response && response.success) {
            showSuccessMessage('College analyzed successfully!');
        } else {
            showErrorMessage('Failed to analyze college');
        }
        
    } catch (error) {
        console.error('Error analyzing page:', error);
        showErrorMessage('Error analyzing college');
    }
}

async function addToWatchlist() {
    try {
        const basicData = {
            name: collegeData?.name || document.querySelector('h1')?.textContent?.trim() || document.title,
            url: window.location.href,
            addedAt: new Date().toISOString()
        };
        
        const response = await chrome.runtime.sendMessage({
            type: 'ADD_TO_WATCHLIST',
            data: basicData
        });
        
        if (response && response.success) {
            showSuccessMessage('Added to watchlist!');
        }
    } catch (error) {
        console.error('Error adding to watchlist:', error);
        showErrorMessage('Failed to add to watchlist');
    }
}

function openQuickCompare() {
    const compareUrl = chrome.runtime.getURL('compare.html');
    window.open(compareUrl, '_blank');
}

function showAnalysisProgress() {
    showTemporaryMessage('🔍 Analyzing college...', 'info');
}

function showSuccessMessage(message) {
    showTemporaryMessage('✅ ' + message, 'success');
}

function showErrorMessage(message) {
    showTemporaryMessage('❌ ' + message, 'error');
}

function showTemporaryMessage(message, type = 'info') {
    // Remove existing message
    const existing = document.getElementById('analyzer-message');
    if (existing) {
        existing.remove();
    }
    
    // Create message element
    const messageEl = document.createElement('div');
    messageEl.id = 'analyzer-message';
    messageEl.className = `analyzer-message analyzer-message-${type}`;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    // Auto-remove after 3 seconds
    setTimeout(() => {
        if (messageEl.parentNode) {
            messageEl.remove();
        }
    }, 3000);
}

// Listen for messages from popup/background
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    switch (message.type) {
        case 'EXTRACT_COLLEGE_DATA':
            sendResponse(extractCollegeData());
            break;
        case 'ANALYZE_PAGE':
            analyzeCurrentPage();
            break;
        default:
            console.log('Unknown message:', message);
    }
});

// Auto-hide FAB on scroll
let scrollTimeout;
window.addEventListener('scroll', () => {
    const fab = document.getElementById('college-analyzer-fab');
    if (fab) {
        fab.style.opacity = '0.5';
        clearTimeout(scrollTimeout);
        scrollTimeout = setTimeout(() => {
            fab.style.opacity = '1';
        }, 150);
    }
});
