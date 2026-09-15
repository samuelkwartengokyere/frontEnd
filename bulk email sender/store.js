const TEMPLATES_KEY = 'tha_message_templates';
const EVENTS_KEY = 'tha_events';
const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

function newId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function extractEmails(text) {
    const matches = String(text || '').match(EMAIL_REGEX);
    if (!matches) return [];
    return [...new Set(matches.map((email) => email.toLowerCase().trim()))];
}

function loadJsonList(key) {
    try {
        const parsed = JSON.parse(localStorage.getItem(key) || '[]');
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        localStorage.removeItem(key);
        return [];
    }
}

function slugify(name) {
    return String(name || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'item';
}

function downloadFile(filename, content, mime = 'text/plain') {
    const blob = new Blob([content], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

function applyTemplateVars(text, vars = {}) {
    return String(text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => {
        return vars[key] != null ? String(vars[key]) : '';
    });
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function isPublicLogoUrl(value) {
    return /^https?:\/\//i.test(String(value || '').trim());
}

function buildMessageHtml(message, logoUrl) {
    const body = escapeHtml(message).replace(/\n/g, '<br>');
    const safeLogo = isPublicLogoUrl(logoUrl) ? escapeHtml(logoUrl.trim()) : '';
    const image = safeLogo
        ? `<p><img src="${safeLogo}" alt="Organization logo" style="max-width:180px;height:auto;margin:0 0 16px 0;display:block;" /></p>`
        : '';
    return `${image}<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#0f172a;">${body}</div>`;
}

function resolveLogo(template) {
    const org = typeof loadCampaignConfig === 'function' ? loadCampaignConfig() : {};
    return (
        (template && (template.logoUrl || template.logoDataUrl)) ||
        org.logoUrl ||
        org.logoDataUrl ||
        ''
    );
}

function resolveSendableLogo(template) {
    const org = typeof loadCampaignConfig === 'function' ? loadCampaignConfig() : {};
    const candidates = [
        template && template.logoUrl,
        org.logoUrl
    ];
    return candidates.find((value) => isPublicLogoUrl(value)) || '';
}

function fileToLogoDataUrl(file) {
    return new Promise((resolve, reject) => {
        if (!file || !file.type.startsWith('image/')) {
            reject(new Error('Please choose a PNG, JPG, or SVG image.'));
            return;
        }
        const image = new Image();
        const objectUrl = URL.createObjectURL(file);
        image.onload = () => {
            const max = 360;
            const scale = Math.min(1, max / Math.max(image.width, 1));
            const canvas = document.createElement('canvas');
            canvas.width = Math.max(1, Math.round(image.width * scale));
            canvas.height = Math.max(1, Math.round(image.height * scale));
            canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(objectUrl);
            resolve(canvas.toDataURL('image/png'));
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Could not read that image.'));
        };
        image.src = objectUrl;
    });
}

function loadTemplates() {
    return loadJsonList(TEMPLATES_KEY)
        .filter((item) => item && item.id)
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function saveTemplates(list) {
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(list));
    return loadTemplates();
}

function getTemplate(id) {
    return loadTemplates().find((item) => item.id === id) || null;
}

function upsertTemplate(payload) {
    const list = loadJsonList(TEMPLATES_KEY);
    const now = Date.now();
    const name = String(payload.name || '').trim();
    const subject = String(payload.subject || '').trim();
    const message = String(payload.message || '').trim();
    const logoUrl = String(payload.logoUrl || '').trim();
    const logoDataUrl = payload.logoDataUrl || '';

    if (payload.id) {
        const index = list.findIndex((item) => item.id === payload.id);
        if (index >= 0) {
            list[index] = {
                ...list[index],
                name,
                subject,
                message,
                logoUrl,
                logoDataUrl: Object.prototype.hasOwnProperty.call(payload, 'logoDataUrl')
                    ? (logoDataUrl || '')
                    : (list[index].logoDataUrl || ''),
                updatedAt: now
            };
            saveTemplates(list);
            return list[index];
        }
    }

    const created = {
        id: newId(),
        name,
        subject,
        message,
        logoUrl,
        logoDataUrl,
        createdAt: now,
        updatedAt: now
    };
    list.push(created);
    saveTemplates(list);
    return created;
}

function deleteTemplate(id) {
    saveTemplates(loadJsonList(TEMPLATES_KEY).filter((item) => item.id !== id));
}

function templateDownloadText(template) {
    return [
        `Name: ${template.name}`,
        `Subject: ${template.subject}`,
        '',
        template.message || ''
    ].join('\n');
}

function downloadTemplate(template) {
    downloadFile(`${slugify(template.name)}.txt`, templateDownloadText(template));
}

function downloadAllTemplates() {
    downloadFile('message-templates.json', JSON.stringify(loadTemplates(), null, 2), 'application/json');
}

function importTemplates(payload) {
    const incoming = Array.isArray(payload) ? payload : [payload];
    let added = 0;
    incoming.forEach((item) => {
        if (!item || !String(item.name || '').trim()) return;
        upsertTemplate({
            name: item.name,
            subject: item.subject || '',
            message: item.message || '',
            logoUrl: item.logoUrl || '',
            logoDataUrl: item.logoDataUrl || ''
        });
        added += 1;
    });
    return added;
}

function loadEvents() {
    return loadJsonList(EVENTS_KEY)
        .filter((item) => item && item.id)
        .map((item) => ({
            ...item,
            emails: extractEmails((item.emails || []).join('\n'))
        }))
        .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
}

function saveEvents(list) {
    localStorage.setItem(EVENTS_KEY, JSON.stringify(list));
    return loadEvents();
}

function getEvent(id) {
    return loadEvents().find((item) => item.id === id) || null;
}

function upsertEvent(payload) {
    const list = loadJsonList(EVENTS_KEY);
    const now = Date.now();
    const name = String(payload.name || '').trim();
    const description = String(payload.description || '').trim();
    const emails = extractEmails(
        Array.isArray(payload.emails) ? payload.emails.join('\n') : payload.emails
    );

    if (payload.id) {
        const index = list.findIndex((item) => item.id === payload.id);
        if (index >= 0) {
            list[index] = {
                ...list[index],
                name,
                description,
                emails,
                updatedAt: now
            };
            saveEvents(list);
            return getEvent(payload.id);
        }
    }

    const created = {
        id: newId(),
        name,
        description,
        emails,
        createdAt: now,
        updatedAt: now
    };
    list.push(created);
    saveEvents(list);
    return created;
}

function deleteEvent(id) {
    saveEvents(loadJsonList(EVENTS_KEY).filter((item) => item.id !== id));
}

function downloadEventPeople(event) {
    const emails = extractEmails((event.emails || []).join('\n'));
    downloadFile(`${slugify(event.name)}-people.txt`, emails.join('\n') || '');
}

const HISTORY_KEY = 'tha_campaign_history';

function loadHistory() {
    return loadJsonList(HISTORY_KEY).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function addHistoryEntry(entry) {
    const list = loadJsonList(HISTORY_KEY);
    list.unshift({
        id: newId(),
        createdAt: Date.now(),
        ...entry
    });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 150)));
    return loadHistory();
}

function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
}
