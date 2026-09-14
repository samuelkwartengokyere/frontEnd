const CAMPAIGN_CONFIG_KEY = 'tha_campaign_studio_config';
const PLACEHOLDER_KEYS = new Set(['YOUR_PUBLIC_KEY', 'YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', '']);

function loadCampaignConfig() {
    try {
        return JSON.parse(localStorage.getItem(CAMPAIGN_CONFIG_KEY) || '{}');
    } catch {
        localStorage.removeItem(CAMPAIGN_CONFIG_KEY);
        return {};
    }
}

function saveCampaignConfig(partial) {
    const next = { ...loadCampaignConfig(), ...partial };
    localStorage.setItem(CAMPAIGN_CONFIG_KEY, JSON.stringify(next));
    return next;
}

function isEmailJsConfigured(config = loadCampaignConfig()) {
    return [config.publicKey, config.serviceId, config.templateId].every(
        (value) => value && !PLACEHOLDER_KEYS.has(String(value).trim())
    );
}

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    const span = document.createElement('span');
    span.textContent = message;
    toast.appendChild(span);
    container.appendChild(toast);

    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}
