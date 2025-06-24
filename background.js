// Background service worker for College Analyzer Extension
console.log("College Analyzer Extension Installed");

// Initialize extension on install
chrome.runtime.onInstalled.addListener((details) => {
  console.log("College Analyzer Extension Installed", details);
  
  // Set up default storage
  chrome.storage.local.set({
    colleges: [],
    preferences: {
      autoAnalyze: true,
      showNotifications: true,
      theme: 'light'
    },
    lastSync: Date.now()
  });

  // Create context menus
  chrome.contextMenus.create({
    id: "analyze-college",
    title: "Analyze this college",
    contexts: ["page", "selection"]
  });

  chrome.contextMenus.create({
    id: "add-to-watchlist",
    title: "Add to college watchlist",
    contexts: ["page", "selection"]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  switch (info.menuItemId) {
    case "analyze-college":
      analyzeCurrentPage(tab);
      break;
    case "add-to-watchlist":
      addToWatchlist(tab);
      break;
  }
});

// Handle keyboard shortcuts
chrome.commands.onCommand.addListener((command) => {
  switch (command) {
    case "analyze-page":
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        analyzeCurrentPage(tabs[0]);
      });
      break;
    case "quick-compare":
      chrome.tabs.create({url: chrome.runtime.getURL("compare.html")});
      break;
    case "open-dashboard":
      chrome.tabs.create({url: chrome.runtime.getURL("analyzer.html")});
      break;
  }
});

// Handle omnibox input
chrome.omnibox.onInputEntered.addListener((text, disposition) => {
  let url = `https://www.google.com/search?q=${encodeURIComponent(text + " college")}`;
  
  switch (disposition) {
    case "currentTab":
      chrome.tabs.update({url});
      break;
    case "newForegroundTab":
      chrome.tabs.create({url});
      break;
    case "newBackgroundTab":
      chrome.tabs.create({url, active: false});
      break;
  }
});

// College data API functions
async function fetchCollegeData(collegeName) {
  try {
    // College Scorecard API
    const scorecardUrl = `https://api.collegescorecard.ed.gov/v1/schools.json?school.name=${encodeURIComponent(collegeName)}&_fields=school.name,school.city,school.state,latest.admissions.admission_rate.overall,latest.cost.tuition.in_state,latest.cost.tuition.out_of_state,latest.student.size`;
    
    const response = await fetch(scorecardUrl);
    const data = await response.json();
    
    return data.results[0] || null;
  } catch (error) {
    console.error("Error fetching college data:", error);
    return null;
  }
}

// Analyze current page
async function analyzeCurrentPage(tab) {
  if (!tab) return;
  
  try {
    // Inject content script to extract college data
    const results = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      function: extractCollegeInfo
    });
    
    if (results && results[0] && results[0].result) {
      const collegeData = results[0].result;
      
      // Fetch additional data from APIs
      const apiData = await fetchCollegeData(collegeData.name);
      
      // Merge data
      const completeData = {
        ...collegeData,
        ...apiData,
        url: tab.url,
        analyzedAt: new Date().toISOString()
      };
      
      // Store in local storage
      await saveCollegeData(completeData);
      
      // Show notification
      chrome.notifications.create({
        type: 'basic',
        iconUrl: 'icons/icon48.png',
        title: 'College Analyzed',
        message: `${collegeData.name} has been analyzed and saved!`
      });
    }
  } catch (error) {
    console.error("Error analyzing page:", error);
  }
}

// Extract college information from page
function extractCollegeInfo() {
  const url = window.location.href;
  let collegeData = {
    name: '',
    location: '',
    type: '',
    size: '',
    tuition: '',
    acceptanceRate: '',
    source: ''
  };

  // US News extraction
  if (url.includes('usnews.com')) {
    collegeData.source = 'US News';
    collegeData.name = document.querySelector('h1')?.textContent?.trim() || '';
    collegeData.location = document.querySelector('[data-testid="school-location"]')?.textContent?.trim() || '';
    
    // Extract rankings and stats
    const statsElements = document.querySelectorAll('[data-testid*="stat"]');
    statsElements.forEach(el => {
      const text = el.textContent.toLowerCase();
      if (text.includes('acceptance rate')) {
        collegeData.acceptanceRate = el.textContent;
      } else if (text.includes('tuition')) {
        collegeData.tuition = el.textContent;
      }
    });
  }
  
  // Niche extraction
  else if (url.includes('niche.com')) {
    collegeData.source = 'Niche';
    collegeData.name = document.querySelector('h1')?.textContent?.trim() || '';
    collegeData.location = document.querySelector('.profile__address')?.textContent?.trim() || '';
  }
  
  // College Board extraction
  else if (url.includes('bigfuture.collegeboard.org')) {
    collegeData.source = 'College Board';
    collegeData.name = document.querySelector('h1')?.textContent?.trim() || '';
  }
  
  // Generic extraction for other sites
  else {
    collegeData.source = 'Generic';
    collegeData.name = document.title;
  }

  return collegeData;
}

// Save college data
async function saveCollegeData(collegeData) {
  try {
    const result = await chrome.storage.local.get(['colleges']);
    const colleges = result.colleges || [];
    
    // Check if college already exists
    const existingIndex = colleges.findIndex(c => c.name === collegeData.name);
    
    if (existingIndex >= 0) {
      colleges[existingIndex] = collegeData; // Update existing
    } else {
      colleges.push(collegeData); // Add new
    }
    
    await chrome.storage.local.set({colleges});
    console.log("College data saved:", collegeData.name);
  } catch (error) {
    console.error("Error saving college data:", error);
  }
}

// Add to watchlist
async function addToWatchlist(tab) {
  try {
    const results = await chrome.scripting.executeScript({
      target: {tabId: tab.id},
      function: () => {
        return {
          name: document.querySelector('h1')?.textContent?.trim() || document.title,
          url: window.location.href
        };
      }
    });
    
    if (results && results[0] && results[0].result) {
      const college = results[0].result;
      
      const result = await chrome.storage.local.get(['watchlist']);
      const watchlist = result.watchlist || [];
      
      if (!watchlist.find(c => c.url === college.url)) {
        watchlist.push({
          ...college,
          addedAt: new Date().toISOString()
        });
        
        await chrome.storage.local.set({watchlist});
        
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'icons/icon48.png',
          title: 'Added to Watchlist',
          message: `${college.name} has been added to your watchlist!`
        });
      }
    }
  } catch (error) {
    console.error("Error adding to watchlist:", error);
  }
}

// Set up alarms for periodic data updates
chrome.alarms.create("updateCollegeData", { periodInMinutes: 1440 }); // Daily

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "updateCollegeData") {
    console.log("Updating college data...");
    // Implement periodic data updates here
  }
});

// Message handling from content scripts and popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case 'GET_COLLEGE_DATA':
      handleGetCollegeData(message.data, sendResponse);
      return true; // Keep message channel open for async response
      
    case 'SAVE_COLLEGE_DATA':
      saveCollegeData(message.data);
      sendResponse({success: true});
      break;
      
    case 'ANALYZE_PAGE':
      if (sender.tab) {
        analyzeCurrentPage(sender.tab);
      }
      break;
      
    default:
      console.log("Unknown message type:", message.type);
  }
});

async function handleGetCollegeData(query, sendResponse) {
  try {
    const result = await chrome.storage.local.get(['colleges', 'watchlist']);
    sendResponse({
      colleges: result.colleges || [],
      watchlist: result.watchlist || []
    });
  } catch (error) {
    sendResponse({error: error.message});
  }
}
