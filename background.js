chrome.runtime.onInstalled.addListener(() => {
  console.log('[Request Interceptor] Extension installed');
});

// SUPER EARLY INJECTION using webNavigation API
chrome.webNavigation.onBeforeNavigate.addListener((details) => {
  if (details.frameId === 0 && !details.url.startsWith('chrome://')) {
    setTimeout(() => injectIntoTab(details.tabId), 10);
  }
});

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.frameId === 0 && !details.url.startsWith('chrome://')) {
    injectIntoTab(details.tabId);
  }
});

async function injectIntoTab(tabId) {
  try {
    // Get current rules
    const { interceptRules = [] } = await chrome.storage.sync.get('interceptRules');
    
    await chrome.scripting.executeScript({
      target: { tabId },
      func: (rules) => {
        // Check if content script already did the job
        if (window.INTERCEPT_INSTALLED) {
          window.INTERCEPT_RULES = rules;
          return;
        }
        
        window.INTERCEPT_INSTALLED = true;
        
        // Store rules globally
        window.INTERCEPT_RULES = rules;
        
        // Function to check if URL matches any rule
        function findMatchingRule(url, method) {
          return window.INTERCEPT_RULES.find(rule => {
            if (rule.enabled === false) return false;
            if (rule.method !== 'ANY' && rule.method !== method.toUpperCase()) return false;
            return url.includes(rule.urlPattern);
          });
        }
        
        // Override fetch with REAL interception
        const originalFetch = window.fetch;
        window.fetch = function(resource, options = {}) {
          const url = typeof resource === 'string' ? resource : resource.url;
          const method = options.method || 'GET';
          
          const matchingRule = findMatchingRule(url, method);
          if (matchingRule) {
            console.log(`🚫 [Request Interceptor] BLOCKED: ${method} ${url}`);
            console.log(`✅ [Request Interceptor] RETURNING FAKE:`, matchingRule.responseBody);
            
            // Return fake response
            return Promise.resolve(new Response(matchingRule.responseBody, {
              status: 200,
              statusText: 'OK',
              headers: {
                'Content-Type': 'application/json'
              }
            }));
          }
          
          return originalFetch.apply(this, arguments);
        };
        
        // Override XMLHttpRequest too
        const OriginalXHR = window.XMLHttpRequest;
        window.XMLHttpRequest = function() {
          const xhr = new OriginalXHR();
          const originalOpen = xhr.open;
          const originalSend = xhr.send;
          
          let method, url;
          
          xhr.open = function(m, u, ...args) {
            method = m;
            url = u;
            return originalOpen.apply(this, arguments);
          };
          
          xhr.send = function(...args) {
            const matchingRule = findMatchingRule(url, method);
            if (matchingRule) {
              console.log(`🚫 [Request Interceptor] BLOCKED XHR: ${method} ${url}`);
              console.log(`✅ [Request Interceptor] RETURNING FAKE:`, matchingRule.responseBody);
              
              setTimeout(() => {
                Object.defineProperty(xhr, 'readyState', { writable: true });
                Object.defineProperty(xhr, 'status', { writable: true });
                Object.defineProperty(xhr, 'statusText', { writable: true });
                Object.defineProperty(xhr, 'responseText', { writable: true });
                Object.defineProperty(xhr, 'response', { writable: true });
                
                xhr.readyState = 4;
                xhr.status = 200;
                xhr.statusText = 'OK';
                xhr.responseText = matchingRule.responseBody;
                xhr.response = matchingRule.responseBody;
                
                if (xhr.onreadystatechange) xhr.onreadystatechange();
                if (xhr.onload) xhr.onload();
              }, 0);
              
              return;
            }
            
            return originalSend.apply(this, arguments);
          };
          
          return xhr;
        };
        
        window.XMLHttpRequest.prototype = OriginalXHR.prototype;
        
        window.TEST_INJECTION_COMPLETE = true;
      },
      args: [interceptRules],
      world: 'MAIN'
    });
  } catch (error) {
    // Silently ignore injection errors
  }
}

// Inject on tab changes
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if ((changeInfo.status === 'loading' || changeInfo.url) && tab.url && !tab.url.startsWith('chrome://')) {
    injectIntoTab(tabId);
  }
});

// Inject on new tab creation
chrome.tabs.onCreated.addListener((tab) => {
  if (tab.url && !tab.url.startsWith('chrome://')) {
    injectIntoTab(tab.id);
  }
});

// Update rules in all tabs when storage changes
chrome.storage.onChanged.addListener(async (changes) => {
  if (changes.interceptRules) {
    const newRules = changes.interceptRules.newValue || [];
    
    try {
      const tabs = await chrome.tabs.query({});
      for (const tab of tabs) {
        if (tab.url && !tab.url.startsWith('chrome://')) {
          try {
            await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: (rules) => {
                window.INTERCEPT_RULES = rules;
                console.log(`📋 [Request Interceptor] Rules updated: ${rules.length} active`);
              },
              args: [newRules],
              world: 'MAIN'
            });
          } catch (error) {
            // Ignore errors for tabs we can't access
          }
        }
      }
    } catch (error) {
      // Silently ignore errors
    }
  }
});



// Initialize storage
chrome.storage.sync.get('interceptRules').then(result => {
  if (!result.interceptRules) {
    chrome.storage.sync.set({ interceptRules: [] });
  }
});
