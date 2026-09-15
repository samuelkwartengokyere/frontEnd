/**
 * EmailJS keys used by the app.
 *
 * Paste your Public Key, Service ID, and Template ID here so campaign users
 * do not need the Settings page. Leave them empty only if you want each
 * browser to be configured manually instead.
 *
 * These values are visible to anyone who can open this file (or View Source).
 */
const BUILT_IN_EMAILJS = {
    publicKey: 'Ns9074-0p8Y91ACxx',
    serviceId: 'service_aexripc',
    templateId: 'template_wav50t7'
};

const DEFAULT_SENDER = {
    fromName: 'Tech Hub Africa',
    senderEmail: 'events@techhubafrica.org'
};
const CAMPAIGN_CONFIG_KEY = 'tha_campaign_studio_config';
const PLACEHOLDER_KEYS = new Set(['YOUR_PUBLIC_KEY', 'YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', '']);

function filledValue(value) {
    const trimmed = String(value || '').trim();
    return trimmed && !PLACEHOLDER_KEYS.has(trimmed) ? trimmed : '';
}

function hasBuiltInEmailJs() {
    return Boolean(
        filledValue(BUILT_IN_EMAILJS.publicKey) &&
        filledValue(BUILT_IN_EMAILJS.serviceId) &&
        filledValue(BUILT_IN_EMAILJS.templateId)
    );
}

function loadCampaignConfig() {
    let saved = {};
    try {
        saved = JSON.parse(localStorage.getItem(CAMPAIGN_CONFIG_KEY) || '{}');
    } catch {
        localStorage.removeItem(CAMPAIGN_CONFIG_KEY);
        saved = {};
    }

    return {
        ...saved,
        publicKey: filledValue(BUILT_IN_EMAILJS.publicKey) || filledValue(saved.publicKey),
        serviceId: filledValue(BUILT_IN_EMAILJS.serviceId) || filledValue(saved.serviceId),
        templateId: filledValue(BUILT_IN_EMAILJS.templateId) || filledValue(saved.templateId)
    };
}

function saveCampaignConfig(partial) {
    const current = (() => {
        try {
            return JSON.parse(localStorage.getItem(CAMPAIGN_CONFIG_KEY) || '{}');
        } catch {
            return {};
        }
    })();

    const next = { ...current, ...partial };

    if (hasBuiltInEmailJs()) {
        delete next.publicKey;
        delete next.serviceId;
        delete next.templateId;
    }

    localStorage.setItem(CAMPAIGN_CONFIG_KEY, JSON.stringify(next));
    return loadCampaignConfig();
}

function isEmailJsConfigured(config = loadCampaignConfig()) {
    return Boolean(
        filledValue(config.publicKey) &&
        filledValue(config.serviceId) &&
        filledValue(config.templateId)
    );
}

function isPublicLogoUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
}

function recipientTemplateParams(recipient, extra = {}) {
    const message = extra.message || '';
    const rawLogo = String(extra.logo_url || '').trim();
    const publicLogo = isPublicLogoUrl(rawLogo) ? rawLogo : '';
    const html = extra.message_html || buildMessageHtml(message, rawLogo);
    return {
        to_email: recipient,
        to_name: extra.to_name || recipient,
        from_name: extra.from_name || 'Tech Hub Africa',
        from_email: extra.from_email || extra.reply_to || '',
        from: extra.from_email || extra.reply_to || '',
        sender_email: extra.from_email || extra.reply_to || '',
        reply_to: extra.reply_to || extra.from_email || '',
        subject: extra.subject || '',
        message,
        message_html: html,
        logo_url: publicLogo,
        event_name: extra.event_name || ''
    };
}

async function sendCampaignEmail(recipient, extra = {}) {
    const config = loadCampaignConfig();
    const templateParams = recipientTemplateParams(recipient, extra);

    if (typeof emailjs !== 'undefined') {
        try {
            emailjs.init({ publicKey: config.publicKey });
            await emailjs.send(config.serviceId, config.templateId, templateParams, {
                publicKey: config.publicKey,
                limitRate: { throttle: 0 }
            });
            return 'OK';
        } catch (sdkError) {
            console.warn('EmailJS SDK send failed, trying REST API.', sdkError);
        }
    }

    const payload = {
        service_id: config.serviceId,
        template_id: config.templateId,
        user_id: config.publicKey,
        template_params: templateParams
    };

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    const text = (await response.text()).trim();
    if (!response.ok) {
        const message = text || `EmailJS request failed (${response.status})`;
        const error = new Error(message);
        error.text = message;
        throw error;
    }

    return text;
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
