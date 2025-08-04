// IMMEDIATE INJECTION - Runs at document_start (EARLIEST POSSIBLE!)
(function() {
  'use strict';
  
  console.log('[Request Interceptor] Started');
  
  // Store original functions IMMEDIATELY
  const originalFetch = window.fetch;
  const OriginalXHR = window.XMLHttpRequest;
  
  // Global storage for rules
  window.INTERCEPT_RULES = [];
  window.INTERCEPT_INSTALLED = true;
  
  // Load rules immediately
  chrome.storage.sync.get('interceptRules').then(result => {
    window.INTERCEPT_RULES = result.interceptRules || [];
    console.log('[Request Interceptor] Rules loaded:', window.INTERCEPT_RULES.length);
  }).catch(error => {
    console.error('[Request Interceptor] Failed to load rules:', error);
  });
  
  // Listen for rule updates
  chrome.storage.onChanged.addListener((changes) => {
    if (changes.interceptRules) {
      window.INTERCEPT_RULES = changes.interceptRules.newValue || [];
      console.log('[Request Interceptor] Rules updated:', window.INTERCEPT_RULES.length);
    }
  });
  
  // Function to check if URL matches any rule
  function findMatchingRule(url, method) {
    return window.INTERCEPT_RULES.find(rule => {
      if (rule.enabled === false) return false;
      if (rule.method !== 'ANY' && rule.method !== method.toUpperCase()) return false;
      return url.includes(rule.urlPattern);
    });
  }
  
  // Override fetch IMMEDIATELY
  window.fetch = function(resource, options = {}) {
    const url = typeof resource === 'string' ? resource : resource.url;
    const method = options.method || 'GET';
    
    const matchingRule = findMatchingRule(url, method);
    if (matchingRule) {
      console.log(`🚫 [Request Interceptor] Intercepted: ${method} ${url}`);
      
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
  
  // Override XMLHttpRequest IMMEDIATELY
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
        console.log(`🚫 [Request Interceptor] Intercepted XHR: ${method} ${url}`);
        
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
  
})();
