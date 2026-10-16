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

/**
 * Public URL of track.php after you upload this folder to cPanel (or another host).
 * Example: https://techhubafrica.org/campaign/track.php
 * Leave empty to set it on the Settings page instead.
 */
const BUILT_IN_OPEN_TRACK_URL = '';

const DEFAULT_SENDER = {
    fromName: 'Tech Hub Africa',
    senderEmail: 'events@techhubafrica.org',
    noreplyEmail: 'noreply@techhubafrica.org'
};

/** EmailJS Free: 200 requests/month. Each recipient uses one request. */
const EMAILJS_FREE_MONTHLY_REQUESTS = 200;
/** Space each send so later inboxes are less likely to drop a fast burst. */
const EMAILJS_REQUEST_GAP_MS = 3000;
/** Extra pause after this many accepted messages. */
const EMAILJS_INBOX_PAUSE_EVERY = 10;
const EMAILJS_INBOX_PAUSE_MS = 12000;
/** Retry when the provider is busy so lists larger than 30 still finish. */
const EMAILJS_MAX_ATTEMPTS = 8;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_BATCH_INTERVAL_MINUTES = 2;
const CAMPAIGN_CONFIG_KEY = 'tha_campaign_studio_config';
const AUTH_SESSION_KEY = 'tha_studio_session';
const AUTH_CREDENTIALS_KEY = 'tha_studio_credentials';
/** Must match LIBRARY_WRITE_KEY in library.php. Sent with shared template and event saves. */
const LIBRARY_WRITE_KEY = 'tha-campaign-library';

/**
 * Default workspace login. After a save on Settings, this browser uses the
 * stored email and password instead. This is not a server login.
 */
const STUDIO_AUTH = {
    email: 'events@techhubafrica.org',
    password: 'AfricaTech2026'
};
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

function readStoredCampaignConfig() {
    try {
        const parsed = JSON.parse(localStorage.getItem(CAMPAIGN_CONFIG_KEY) || '{}');
        return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
    } catch {
        localStorage.removeItem(CAMPAIGN_CONFIG_KEY);
        return {};
    }
}

function readStoredStudioAuth() {
    try {
        const parsed = JSON.parse(localStorage.getItem(AUTH_CREDENTIALS_KEY) || 'null');
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.email) return null;
        return parsed;
    } catch {
        localStorage.removeItem(AUTH_CREDENTIALS_KEY);
        return null;
    }
}

function loadCampaignConfig() {
    const saved = readStoredCampaignConfig();

    return {
        ...saved,
        publicKey: filledValue(BUILT_IN_EMAILJS.publicKey) || filledValue(saved.publicKey),
        serviceId: filledValue(BUILT_IN_EMAILJS.serviceId) || filledValue(saved.serviceId),
        templateId: filledValue(BUILT_IN_EMAILJS.templateId) || filledValue(saved.templateId),
        openTrackUrl: filledValue(BUILT_IN_OPEN_TRACK_URL) || filledValue(saved.openTrackUrl)
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

    const next = { ...current, ...partial, updatedAt: Date.now() };

    if (hasBuiltInEmailJs()) {
        delete next.publicKey;
        delete next.serviceId;
        delete next.templateId;
    }
    if (filledValue(BUILT_IN_OPEN_TRACK_URL)) {
        delete next.openTrackUrl;
    }

    localStorage.setItem(CAMPAIGN_CONFIG_KEY, JSON.stringify(next));
    publishWorkspaceSettings('config');
    return loadCampaignConfig();
}

function loadStudioAuth() {
    const saved = readStoredStudioAuth() || {};

    return {
        email: filledValue(saved.email) || String(STUDIO_AUTH.email || '').trim().toLowerCase(),
        password: Object.prototype.hasOwnProperty.call(saved, 'password') && saved.password != null
            ? String(saved.password)
            : String(STUDIO_AUTH.password || '')
    };
}

function saveStudioAuth({ email, password }, options = {}) {
    localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify({
        email: String(email || '').trim().toLowerCase(),
        password: String(password || ''),
        updatedAt: Date.now()
    }));
    if (!options.skipPublish) publishWorkspaceSettings('auth');
    return loadStudioAuth();
}

function workspaceLibraryUrl() {
    if (typeof window === 'undefined' || !window.location) return '';
    if (!/^https?:$/i.test(window.location.protocol)) return '';
    try {
        return new URL('library.php', window.location.href).href;
    } catch {
        return '';
    }
}

function compactLogoForShare(value) {
    const logo = String(value || '').trim();
    return /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(logo) && logo.length < 28000 ? logo : '';
}

function campaignConfigForShare(source) {
    const raw = source || readStoredCampaignConfig();
    const item = { scope: 'config', updatedAt: raw.updatedAt || Date.now() };
    ['publicKey', 'serviceId', 'templateId', 'openTrackUrl', 'logoUrl', 'fromName', 'fromEmail', 'senderEmail', 'sendMode'].forEach((key) => {
        if (raw[key] != null && String(raw[key]).trim() !== '') item[key] = raw[key];
    });
    const logoDataUrl = compactLogoForShare(raw.logoDataUrl);
    if (logoDataUrl) item.logoDataUrl = logoDataUrl;
    if (typeof raw.repliesEnabled === 'boolean') item.repliesEnabled = raw.repliesEnabled;
    if (raw.batchSize != null && raw.batchSize !== '') item.batchSize = raw.batchSize;
    if (raw.batchIntervalMinutes != null && raw.batchIntervalMinutes !== '') {
        item.batchIntervalMinutes = raw.batchIntervalMinutes;
    }
    return item;
}

function studioAuthForShare(source) {
    const raw = source || readStoredStudioAuth();
    if (!raw || !raw.email || raw.password == null || String(raw.password) === '') return null;
    return {
        scope: 'auth',
        email: String(raw.email).trim().toLowerCase(),
        password: String(raw.password),
        updatedAt: raw.updatedAt || Date.now()
    };
}

function sharedSettingsSignature() {
    const config = readStoredCampaignConfig();
    const auth = readStoredStudioAuth() || {};
    return [
        config.updatedAt || 0,
        config.fromName || '',
        config.fromEmail || '',
        config.senderEmail || '',
        config.openTrackUrl || '',
        config.logoUrl || '',
        config.logoDataUrl ? String(config.logoDataUrl).length : 0,
        config.sendMode || '',
        config.batchSize || '',
        config.batchIntervalMinutes || '',
        config.repliesEnabled === false ? 0 : 1,
        auth.updatedAt || 0,
        auth.email || '',
        auth.password ? String(auth.password).length : 0
    ].join(':');
}

function applySharedSettings(settings, options = {}) {
    if (!settings || typeof settings !== 'object') return false;
    const force = Boolean(options.force);
    let changed = false;
    const remoteConfig = settings.config && typeof settings.config === 'object' ? settings.config : null;
    const remoteAuth = settings.auth && typeof settings.auth === 'object' ? settings.auth : null;

    if (remoteConfig && (remoteConfig.updatedAt || 0) > 0) {
        const local = readStoredCampaignConfig();
        const localStamp = local.updatedAt || (Object.keys(local).some((key) => key !== 'updatedAt') ? 1 : 0);
        if (force || (remoteConfig.updatedAt || 0) >= localStamp) {
            const next = { ...remoteConfig };
            delete next.scope;
            if (JSON.stringify(next) !== JSON.stringify(local)) {
                localStorage.setItem(CAMPAIGN_CONFIG_KEY, JSON.stringify(next));
                changed = true;
            }
        }
    }

    if (remoteAuth && remoteAuth.email && (remoteAuth.updatedAt || 0) > 0) {
        const local = readStoredStudioAuth();
        const localStamp = local ? (local.updatedAt || 1) : 0;
        const remotePassword = remoteAuth.password != null && String(remoteAuth.password) !== ''
            ? String(remoteAuth.password)
            : (local ? String(local.password) : '');
        if ((remotePassword !== '' || remoteAuth.password == null || String(remoteAuth.password) === '') && (force || (remoteAuth.updatedAt || 0) >= localStamp)) {
            const next = {
                email: String(remoteAuth.email).trim().toLowerCase(),
                password: remotePassword,
                updatedAt: remoteAuth.updatedAt
            };
            if (!local || local.email !== next.email || String(local.password) !== next.password || local.updatedAt !== next.updatedAt) {
                if (next.password !== '' || !local) {
                    localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify(next));
                    changed = true;
                } else if (local.email !== next.email || local.updatedAt !== next.updatedAt) {
                    localStorage.setItem(AUTH_CREDENTIALS_KEY, JSON.stringify({
                        ...local,
                        email: next.email,
                        updatedAt: next.updatedAt
                    }));
                    changed = true;
                }
            }
        }
    }

    return changed;
}

function publishWorkspaceSettings(scope) {
    if (!workspaceLibraryUrl()) return;
    const item = scope === 'auth' ? studioAuthForShare() : campaignConfigForShare();
    if (!item) return;
    const task = () => (
        typeof postLibrary === 'function'
            ? postLibrary({ kind: 'settings', action: 'upsert', item }, { announce: true })
            : null
    );
    if (typeof queueLibraryPush === 'function') queueLibraryPush(task);
    else task();
}

async function refreshSharedSettings() {
    const url = workspaceLibraryUrl();
    if (!url || typeof LIBRARY_WRITE_KEY !== 'string' || !LIBRARY_WRITE_KEY) return;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
    try {
        const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'X-Studio-Key': LIBRARY_WRITE_KEY },
            signal: controller ? controller.signal : undefined
        });
        if (!response.ok) return;
        const payload = await response.json();
        if (payload && payload.settings) applySharedSettings(payload.settings);
    } catch {
        /* Sign in still works with this browser's saved login. */
    } finally {
        if (timer) clearTimeout(timer);
    }
}

function isStudioLoggedIn() {
    try {
        const raw = sessionStorage.getItem(AUTH_SESSION_KEY) || localStorage.getItem(AUTH_SESSION_KEY);
        const session = JSON.parse(raw || 'null');
        return Boolean(session && session.email);
    } catch {
        return false;
    }
}

function writeStudioSession(email, remember) {
    const payload = JSON.stringify({
        email: String(email || '').trim().toLowerCase(),
        at: Date.now()
    });
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
    (remember ? localStorage : sessionStorage).setItem(AUTH_SESSION_KEY, payload);
}

function refreshStudioSession(email) {
    const payload = JSON.stringify({
        email: String(email || '').trim().toLowerCase(),
        at: Date.now()
    });
    if (localStorage.getItem(AUTH_SESSION_KEY)) {
        localStorage.setItem(AUTH_SESSION_KEY, payload);
    }
    if (sessionStorage.getItem(AUTH_SESSION_KEY)) {
        sessionStorage.setItem(AUTH_SESSION_KEY, payload);
    }
}

async function requestStudioLogin(email, password) {
    const url = workspaceLibraryUrl();
    if (!url || typeof LIBRARY_WRITE_KEY !== 'string' || !LIBRARY_WRITE_KEY) return null;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Studio-Key': LIBRARY_WRITE_KEY
            },
            body: JSON.stringify({
                kind: 'auth',
                action: 'login',
                email,
                password: String(password || '')
            })
        });
        if (response.status === 404 || response.status === 405 || response.status >= 500) return null;
        const payload = await response.json().catch(() => null);
        if (!payload) return null;
        if (payload.ok && payload.email) return true;
        if (response.status === 400 && /unknown library/i.test(String(payload.error || ''))) return null;
        if (payload.ok === false || response.status === 401) return false;
        return null;
    } catch {
        return null;
    }
}

async function updateWorkspaceLogin({ email, currentPassword, newPassword }) {
    const url = workspaceLibraryUrl();
    if (!url || typeof LIBRARY_WRITE_KEY !== 'string' || !LIBRARY_WRITE_KEY) return null;
    const nextPassword = String(newPassword || '');
    const current = String(currentPassword || '');
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Studio-Key': LIBRARY_WRITE_KEY
            },
            body: JSON.stringify({
                kind: 'settings',
                action: 'upsert',
                item: {
                    scope: 'auth',
                    email,
                    currentPassword: current,
                    password: nextPassword || current
                }
            })
        });
        if (response.status === 404 || response.status === 405 || response.status >= 500) return null;
        const payload = await response.json().catch(() => null);
        if (!payload) return null;
        if (response.status === 400 && /unknown library/i.test(String(payload.error || ''))) return null;
        if (payload.ok) {
            const remoteEmail = payload.settings && payload.settings.auth && payload.settings.auth.email;
            return { ok: true, email: remoteEmail || email };
        }
        return { ok: false, error: payload.error || 'Could not update the login.' };
    } catch {
        return null;
    }
}

async function loginStudio(email, password, remember) {
    const normalized = String(email || '').trim().toLowerCase();
    const remote = await requestStudioLogin(normalized, password);
    if (remote === true) {
        writeStudioSession(normalized, remember);
        saveStudioAuth({ email: normalized, password: String(password || '') }, { skipPublish: true });
        return true;
    }
    if (remote === false) return false;

    const expected = loadStudioAuth();
    const expectedEmail = String(expected.email || '').trim().toLowerCase();
    if (normalized !== expectedEmail || String(password || '') !== String(expected.password || '')) {
        return false;
    }

    writeStudioSession(expectedEmail, remember);
    return true;
}

function logoutStudio() {
    localStorage.removeItem(AUTH_SESSION_KEY);
    sessionStorage.removeItem(AUTH_SESSION_KEY);
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

function normalizeOpenTrackUrl(value) {
    return String(value || '').trim().replace(/\/+$/, '');
}

function suggestedOpenTrackUrl() {
    if (typeof window === 'undefined' || !window.location) return '';
    if (!/^https?:$/i.test(window.location.protocol)) return '';
    try {
        return new URL('track.php', window.location.href).href;
    } catch {
        return '';
    }
}

function getOpenTrackUrl(config = loadCampaignConfig()) {
    return normalizeOpenTrackUrl(config.openTrackUrl);
}

function isOpenTrackingConfigured(config = loadCampaignConfig()) {
    return /^https?:\/\//i.test(getOpenTrackUrl(config));
}

function openPixelUrlForToken(token, config = loadCampaignConfig()) {
    const base = getOpenTrackUrl(config);
    const id = String(token || '').trim();
    if (!base || !id) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}t=${encodeURIComponent(id)}`;
}

function openReportUrl(config = loadCampaignConfig()) {
    const base = getOpenTrackUrl(config);
    if (!base) return '';
    const sep = base.includes('?') ? '&' : '?';
    return `${base}${sep}report=1`;
}

const NOREPLY_SUBJECT_PREFIX = 'NoReply:';
const NOREPLY_INBOX_NOTICE = 'This inbox is not monitored. You will not receive a reply.';

function resolveCampaignSender({ repliesEnabled = true, fromName = '', fromEmail = '', replyTo = '' } = {}) {
    const name = String(fromName || DEFAULT_SENDER.fromName).trim() || DEFAULT_SENDER.fromName;
    const from = String(fromEmail || DEFAULT_SENDER.senderEmail).trim() || DEFAULT_SENDER.senderEmail;
    if (repliesEnabled) {
        return {
            from_name: name,
            from_email: from,
            reply_to: String(replyTo || from).trim() || from
        };
    }

    const noreply = DEFAULT_SENDER.noreplyEmail;
    return {
        from_name: name,
        from_email: noreply,
        reply_to: noreply
    };
}

function applyNoReplyInboxCues(repliesEnabled, subject, message) {
    let nextSubject = String(subject || '').trim();
    let nextMessage = String(message || '').trim();
    if (repliesEnabled) {
        return { subject: nextSubject, message: nextMessage };
    }

    nextSubject = nextSubject.replace(/^noreply\s*:\s*/i, '');
    nextSubject = `${NOREPLY_SUBJECT_PREFIX} ${nextSubject}`.trim();
    if (!nextMessage.toLowerCase().startsWith(NOREPLY_INBOX_NOTICE.toLowerCase())) {
        nextMessage = `${NOREPLY_INBOX_NOTICE}\n\n${nextMessage}`;
    }
    return { subject: nextSubject, message: nextMessage };
}

/** EmailJS Personal plan allows attachments up to 500 KB. Free has no attachments. */
const EMAILJS_ATTACHMENT_MAX_BYTES = 500 * 1024;
const EMAILJS_MAX_ATTACHMENTS = 5;
/** Stay under EmailJS's 50KB template-variable cap. */
const EMAILJS_VARIABLES_BUDGET = 46000;
let emailjsFitNotice = '';

function lastEmailjsFitNotice() {
    return emailjsFitNotice;
}

function emailjsValueSize(params) {
    const json = JSON.stringify(params);
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(json).length;
    return json.length;
}

function htmlWithoutDataLogo(html) {
    return String(html || '').replace(/<p><img src="data:image\/[^"]+"[^>]*><\/p>/gi, '');
}

function fitEmailjsTemplateParams(params) {
    const budget = EMAILJS_VARIABLES_BUDGET;
    let next = { ...params };
    let omittedLogo = false;
    if (emailjsValueSize(next) <= budget) {
        return { params: next, notice: '', tooBig: false };
    }

    const strippedHtml = htmlWithoutDataLogo(next.message_html);
    if (strippedHtml !== String(next.message_html || '') || (next.logo_url && !isPublicLogoUrl(next.logo_url))) {
        omittedLogo = true;
        next = {
            ...next,
            message_html: strippedHtml,
            logo_url: isPublicLogoUrl(next.logo_url) ? next.logo_url : ''
        };
    }
    if (emailjsValueSize(next) <= budget) {
        return {
            params: next,
            tooBig: false,
            notice: 'The logo was left out of this send so EmailJS can accept it. Use a short https logo URL to include the image.'
        };
    }

    if (next.message && emailjsValueSize({ ...next, message: '' }) <= budget) {
        return {
            params: { ...next, message: '' },
            tooBig: false,
            notice: omittedLogo
                ? 'The logo was left out of this send so EmailJS can accept it. Use a short https logo URL to include the image.'
                : ''
        };
    }

    const textOnly = {
        ...next,
        message_html: '',
        logo_url: isPublicLogoUrl(next.logo_url) ? next.logo_url : ''
    };
    if (emailjsValueSize(textOnly) <= budget) {
        return {
            params: textOnly,
            tooBig: false,
            notice: 'The formatted copy was too large, so this send uses the plain message.'
        };
    }

    return { params: textOnly, tooBig: true, notice: '' };
}

function attachmentFieldName(index) {
    return index === 0 ? 'attachment' : `attachment_${index + 1}`;
}

function attachmentFilenameField(index) {
    return index === 0 ? 'filename' : `filename_${index + 1}`;
}

function recipientTemplateParams(recipient, extra = {}) {
    const message = extra.message || '';
    const rawLogo = String(extra.logo_url || '').trim();
    const publicLogo = isPublicLogoUrl(rawLogo) ? rawLogo : '';
    const html = extra.message_html || buildMessageHtml(message, rawLogo, extra.open_pixel_url);
    const fromEmail = extra.from_email || extra.reply_to || '';
    const files = Array.isArray(extra.files) ? extra.files.filter(Boolean) : [];
    const attachmentNames = Array.isArray(extra.attachment_names)
        ? extra.attachment_names.filter(Boolean).join(', ')
        : (files.map((file) => file.name).filter(Boolean).join(', ') || String(extra.attachment_names || ''));
    const params = {
        to_email: recipient,
        to_name: extra.to_name || recipient,
        from_name: extra.from_name || 'Tech Hub Africa',
        from_email: fromEmail,
        from: fromEmail,
        sender_email: fromEmail,
        reply_to: extra.reply_to || fromEmail,
        subject: extra.subject || '',
        message,
        message_html: html,
        logo_url: publicLogo,
        event_name: extra.event_name || '',
        attachment_names: attachmentNames
    };
    files.forEach((file, index) => {
        params[attachmentFilenameField(index)] = file.name;
    });
    const fitted = fitEmailjsTemplateParams(params);
    emailjsFitNotice = fitted.notice || '';
    if (fitted.tooBig) {
        const error = new Error('This message is larger than EmailJS allows (50KB). Shorten it and send again.');
        error.text = error.message;
        throw error;
    }
    return fitted.params;
}

function buildEmailjsFormData(templateParams, files = []) {
    const formData = new FormData();
    Object.entries(templateParams).forEach(([key, value]) => {
        formData.append(key, value == null ? '' : String(value));
    });
    files.forEach((file, index) => {
        formData.append(attachmentFieldName(index), file, file.name);
    });
    return formData;
}

async function sendEmailjsFormData(config, formData) {
    formData.append('service_id', config.serviceId);
    formData.append('template_id', config.templateId);
    formData.append('user_id', config.publicKey);

    const response = await fetch('https://api.emailjs.com/api/v1.0/email/send-form', {
        method: 'POST',
        body: formData
    });
    const text = (await response.text()).trim();
    if (!response.ok) {
        throw emailjsHttpError(response, text);
    }
    return text || 'OK';
}

function emailjsHttpError(response, text) {
    const message = text || `EmailJS request failed (${response.status})`;
    const error = new Error(message);
    error.status = response.status;
    error.text = message;
    return error;
}

function emailjsErrorText(err) {
    if (!err) return '';
    if (typeof err === 'string') return err;
    return String(err.text || err.message || '');
}

function isRetryableEmailjsError(err) {
    const status = Number(err && err.status || 0);
    const text = emailjsErrorText(err).toLowerCase();
    if (/quota|monthly limit|invalid public|template id|service id|user_id|recipient address|parameter is required/.test(text)) {
        return false;
    }
    if (status === 429 || status === 408 || status === 425 || status >= 500) return true;
    if (/too many|rate limit|try again|timeout|temporar|421|450|451|452|busy|throttl/.test(text)) return true;
    if (err && err.name === 'TypeError') return true;
    if (!status && /failed to fetch|network|load failed|networkerror/.test(text)) return true;
    return false;
}

let emailjsSlot = Promise.resolve();
let emailjsNextAt = 0;

function waitForEmailjsSlot() {
    const gap = typeof EMAILJS_REQUEST_GAP_MS === 'number' ? EMAILJS_REQUEST_GAP_MS : 1100;
    const ticket = emailjsSlot.then(async () => {
        const wait = Math.max(0, emailjsNextAt - Date.now());
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        emailjsNextAt = Date.now() + gap;
    });
    emailjsSlot = ticket.then(() => {}, () => {});
    return ticket;
}

async function dispatchCampaignEmail(recipient, extra) {
    const config = loadCampaignConfig();
    const files = Array.isArray(extra.files) ? extra.files.filter(Boolean) : [];
    const templateParams = recipientTemplateParams(recipient, extra);

    if (files.length) {
        return sendEmailjsFormData(config, buildEmailjsFormData(templateParams, files));
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
    if (!response.ok) throw emailjsHttpError(response, text);
    return text || 'OK';
}

async function sendCampaignEmail(recipient, extra = {}, hooks = {}) {
    const maxAttempts = typeof EMAILJS_MAX_ATTEMPTS === 'number' ? EMAILJS_MAX_ATTEMPTS : 8;
    let lastError = null;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
        await waitForEmailjsSlot();
        try {
            return await dispatchCampaignEmail(recipient, extra);
        } catch (err) {
            lastError = err;
            if (attempt >= maxAttempts || !isRetryableEmailjsError(err)) throw err;
            const waitMs = Math.min(30000, 1500 * attempt);
            if (hooks && typeof hooks.onRetry === 'function') {
                hooks.onRetry(attempt, maxAttempts, waitMs, err);
            }
            await new Promise((resolve) => setTimeout(resolve, waitMs));
        }
    }
    throw lastError || new Error('EmailJS request failed');
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
