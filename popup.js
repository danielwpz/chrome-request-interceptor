// Popup script for Request Interceptor extension

class RuleManager {
  constructor() {
    this.rules = [];
    this.editingRuleIndex = -1;
    this.init();
  }

  async init() {
    this.bindEvents();
    await this.loadRules();
    this.renderRules();
  }

  bindEvents() {
    // Add rule button
    document.getElementById('addRuleBtn').addEventListener('click', () => {
      this.showModal();
    });

    // Modal controls
    document.getElementById('closeModal').addEventListener('click', () => {
      this.hideModal();
    });

    document.getElementById('cancelBtn').addEventListener('click', () => {
      this.hideModal();
    });

    // Form submission
    document.getElementById('ruleForm').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveRule();
    });

    // Close modal when clicking outside
    document.getElementById('ruleModal').addEventListener('click', (e) => {
      if (e.target.id === 'ruleModal') {
        this.hideModal();
      }
    });

    // JSON validation on textarea
    document.getElementById('responseBody').addEventListener('input', (e) => {
      this.validateJson(e.target);
    });
  }

  async loadRules() {
    try {
      const result = await chrome.storage.sync.get('interceptRules');
      this.rules = result.interceptRules || [];
    } catch (error) {
      console.error('Error loading rules:', error);
      this.rules = [];
    }
  }

  async saveRules() {
    try {
      await chrome.storage.sync.set({ interceptRules: this.rules });
    } catch (error) {
      console.error('Error saving rules:', error);
      alert('Error saving rules. Please try again.');
    }
  }

  renderRules() {
    const container = document.getElementById('rulesContainer');
    const emptyState = document.getElementById('emptyState');
    
    // Clear existing rules
    const existingRules = container.querySelectorAll('.rule-item');
    existingRules.forEach(rule => rule.remove());

    if (this.rules.length === 0) {
      emptyState.style.display = 'block';
      return;
    }

    emptyState.style.display = 'none';

    this.rules.forEach((rule, index) => {
      const ruleElement = this.createRuleElement(rule, index);
      container.appendChild(ruleElement);
    });
  }

  createRuleElement(rule, index) {
    const template = document.getElementById('ruleTemplate');
    const clone = template.content.cloneNode(true);
    const ruleElement = clone.querySelector('.rule-item');

    // Set rule data
    const methodBadge = clone.querySelector('.method-badge');
    const urlPattern = clone.querySelector('.url-pattern');
    const responsePreview = clone.querySelector('.response-preview');
    const enabledToggle = clone.querySelector('.rule-enabled');
    const editBtn = clone.querySelector('.edit-btn');
    const deleteBtn = clone.querySelector('.delete-btn');

    methodBadge.textContent = rule.method;
    methodBadge.className = `method-badge ${rule.method}`;
    urlPattern.textContent = rule.urlPattern;
    responsePreview.textContent = this.truncateJson(rule.responseBody);
    enabledToggle.checked = rule.enabled !== false;

    // Update visual state
    if (rule.enabled === false) {
      ruleElement.classList.add('disabled');
    }

    // Bind events
    enabledToggle.addEventListener('change', async (e) => {
      await this.toggleRule(index, e.target.checked);
    });

    editBtn.addEventListener('click', () => {
      this.editRule(index);
    });

    deleteBtn.addEventListener('click', () => {
      this.deleteRule(index);
    });

    return ruleElement;
  }

  showModal(rule = null) {
    const modal = document.getElementById('ruleModal');
    const title = document.getElementById('modalTitle');
    const form = document.getElementById('ruleForm');

    if (rule) {
      title.textContent = 'Edit Intercept Rule';
      document.getElementById('method').value = rule.method;
      document.getElementById('urlPattern').value = rule.urlPattern;
      document.getElementById('responseBody').value = rule.responseBody;
    } else {
      title.textContent = 'Add Intercept Rule';
      form.reset();
      this.editingRuleIndex = -1;
    }

    modal.style.display = 'block';
    document.getElementById('urlPattern').focus();
  }

  hideModal() {
    document.getElementById('ruleModal').style.display = 'none';
    document.getElementById('ruleForm').reset();
    this.editingRuleIndex = -1;
    this.clearValidationErrors();
  }

  async saveRule() {
    const method = document.getElementById('method').value;
    const urlPattern = document.getElementById('urlPattern').value.trim();
    const responseBody = document.getElementById('responseBody').value.trim();

    // Validate inputs
    if (!urlPattern) {
      this.showFieldError('urlPattern', 'URL pattern is required');
      return;
    }

    if (!responseBody) {
      this.showFieldError('responseBody', 'Response JSON is required');
      return;
    }

    // Validate JSON
    try {
      JSON.parse(responseBody);
    } catch (error) {
      this.showFieldError('responseBody', 'Invalid JSON format');
      return;
    }

    const rule = {
      method,
      urlPattern,
      responseBody,
      enabled: true,
      createdAt: new Date().toISOString()
    };

    if (this.editingRuleIndex >= 0) {
      // Edit existing rule
      rule.createdAt = this.rules[this.editingRuleIndex].createdAt;
      this.rules[this.editingRuleIndex] = rule;
    } else {
      // Add new rule
      this.rules.push(rule);
    }

    await this.saveRules();
    this.renderRules();
    this.hideModal();
  }

  editRule(index) {
    this.editingRuleIndex = index;
    this.showModal(this.rules[index]);
  }

  async deleteRule(index) {
    if (confirm('Are you sure you want to delete this rule?')) {
      this.rules.splice(index, 1);
      await this.saveRules();
      this.renderRules();
    }
  }

  async toggleRule(index, enabled) {
    this.rules[index].enabled = enabled;
    await this.saveRules();
    this.renderRules();
  }

  validateJson(textarea) {
    const value = textarea.value.trim();
    if (!value) return;

    try {
      JSON.parse(value);
      this.clearFieldError('responseBody');
    } catch (error) {
      this.showFieldError('responseBody', 'Invalid JSON format');
    }
  }

  showFieldError(fieldId, message) {
    this.clearFieldError(fieldId);
    const field = document.getElementById(fieldId);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'field-error';
    errorDiv.style.color = '#dc3545';
    errorDiv.style.fontSize = '12px';
    errorDiv.style.marginTop = '4px';
    errorDiv.textContent = message;
    field.parentNode.appendChild(errorDiv);
    field.style.borderColor = '#dc3545';
  }

  clearFieldError(fieldId) {
    const field = document.getElementById(fieldId);
    const existingError = field.parentNode.querySelector('.field-error');
    if (existingError) {
      existingError.remove();
    }
    field.style.borderColor = '#ced4da';
  }

  clearValidationErrors() {
    const errors = document.querySelectorAll('.field-error');
    errors.forEach(error => error.remove());
    
    const fields = ['urlPattern', 'responseBody'];
    fields.forEach(fieldId => {
      document.getElementById(fieldId).style.borderColor = '#ced4da';
    });
  }

  truncateJson(json) {
    if (json.length <= 50) return json;
    
    // Try to truncate at a logical point
    const truncated = json.substring(0, 47);
    const lastSpace = truncated.lastIndexOf(' ');
    const lastComma = truncated.lastIndexOf(',');
    const cutPoint = Math.max(lastSpace, lastComma);
    
    if (cutPoint > 20) {
      return truncated.substring(0, cutPoint) + '...';
    }
    
    return truncated + '...';
  }
}

// Initialize the rule manager when the popup loads
document.addEventListener('DOMContentLoaded', () => {
  new RuleManager();
});
