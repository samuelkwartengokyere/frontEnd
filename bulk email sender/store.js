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

function uniqueEmails(list) {
    return [...new Set((list || []).map((email) => String(email || '').toLowerCase().trim()).filter(Boolean))];
}

function headerKey(value) {
    return String(value || '')
        .toLowerCase()
        .replace(/[_-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function cleanPersonName(value) {
    return String(value || '')
        .replace(EMAIL_REGEX, ' ')
        .replace(/[<>"]/g, ' ')
        .replace(/^[\s,;:\-\/|]+|[\s,;:\-\/|]+$/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function looksLikeName(value) {
    const name = cleanPersonName(value);
    if (!name || name.length < 2) return false;
    if (/https?:\/\//i.test(name)) return false;
    if (/^\d+$/.test(name)) return false;
    return /[a-zA-ZÀ-ÿ]/.test(name);
}

function uniquePeople(list) {
    const map = new Map();
    (list || []).forEach((item) => {
        const email = String((item && item.email) || item || '').toLowerCase().trim();
        if (!email) return;
        const name = looksLikeName(item && item.name) ? cleanPersonName(item.name) : '';
        const prev = map.get(email);
        if (!prev) {
            map.set(email, { name, email });
        } else if (!prev.name && name) {
            prev.name = name;
        }
    });
    return [...map.values()];
}

function formatRecipientLine(person) {
    const email = String((person && person.email) || '').toLowerCase().trim();
    if (!email) return '';
    const name = looksLikeName(person && person.name) ? cleanPersonName(person.name) : '';
    return name ? `${name}, ${email}` : email;
}

function formatPeopleList(people) {
    return uniquePeople(people).map(formatRecipientLine).filter(Boolean).join('\n');
}

function parseRecipientLine(line) {
    const text = String(line || '').trim();
    if (!text) return [];

    const emails = extractEmails(text);
    if (!emails.length) return [];

    const compact = text.replace(/[<>]/g, '').trim();
    if (emails.length === 1 && compact.toLowerCase() === emails[0]) {
        return [{ name: '', email: emails[0] }];
    }

    const comma = text.lastIndexOf(',');
    if (comma >= 0) {
        const left = text.slice(0, comma).trim();
        const right = text.slice(comma + 1).trim();
        const rightEmails = extractEmails(right);
        const leftEmails = extractEmails(left);
        if (rightEmails.length === 1 && !leftEmails.length) {
            return [{
                name: looksLikeName(left) ? cleanPersonName(left) : '',
                email: rightEmails[0]
            }];
        }
    }

    let hyphen = text.lastIndexOf('-');
    while (hyphen >= 0) {
        const left = text.slice(0, hyphen).trim();
        const right = text.slice(hyphen + 1).trim();
        const rightEmails = extractEmails(right);
        const rightIsBareEmail = rightEmails.length === 1
            && right.replace(/[<>]/g, '').trim().toLowerCase() === rightEmails[0];
        if (rightIsBareEmail && looksLikeName(left) && !extractEmails(left).length) {
            return [{ name: cleanPersonName(left), email: rightEmails[0] }];
        }
        hyphen = text.lastIndexOf('-', hyphen - 1);
    }

    if (emails.length === 1) {
        const name = cleanPersonName(text);
        return [{ name: looksLikeName(name) ? name : '', email: emails[0] }];
    }

    return emails.map((email) => ({ name: '', email }));
}

function parseRecipients(text) {
    const source = String(text || '');
    const fromLines = source.split(/\r?\n/).flatMap(parseRecipientLine);
    if (fromLines.length) return uniquePeople(fromLines);
    return uniquePeople(extractEmails(source).map((email) => ({ name: '', email })));
}

function recipientDisplayName(person) {
    return looksLikeName(person && person.name) ? cleanPersonName(person.name) : '';
}

function isEmailHeader(value) {
    const name = headerKey(value);
    if (!name) return false;
    return (
        name === 'mail' ||
        name === 'email' ||
        name === 'emails' ||
        name === 'e mail' ||
        name === 'email address' ||
        name === 'email addresses' ||
        name === 'mail address' ||
        /e-?mail/.test(name)
    );
}

function isNameHeader(value) {
    const name = headerKey(value);
    return (
        name === 'name' ||
        name === 'full name' ||
        name === 'fullname' ||
        name === 'recipient' ||
        name === 'recipient name' ||
        name === 'contact' ||
        name === 'contact name' ||
        name === 'attendee' ||
        name === 'attendee name' ||
        name === 'participant' ||
        name === 'participant name' ||
        name === 'person' ||
        name === 'display name'
    );
}

function isFirstNameHeader(value) {
    const name = headerKey(value);
    return name === 'first name' || name === 'firstname' || name === 'given name' || name === 'first' || name === 'fname';
}

function isLastNameHeader(value) {
    const name = headerKey(value);
    return name === 'last name' || name === 'lastname' || name === 'surname' || name === 'family name' || name === 'last' || name === 'lname';
}

function looksLikeEmailCell(value) {
    return extractEmails(value).length > 0;
}

function detectDelimiter(text) {
    const first = String(text || '').split(/\r?\n/).find((line) => line.trim()) || '';
    const options = [
        [',', (first.match(/,/g) || []).length],
        [';', (first.match(/;/g) || []).length],
        ['\t', (first.match(/\t/g) || []).length],
        ['|', (first.match(/\|/g) || []).length]
    ].sort((a, b) => b[1] - a[1]);
    return options[0][1] > 0 ? options[0][0] : ',';
}

function parseDelimitedRows(text) {
    const source = String(text || '').replace(/^\uFEFF/, '');
    if (!source.trim()) return [];
    const delim = detectDelimiter(source);
    const rows = [];
    let row = [];
    let cell = '';
    let inQuotes = false;

    for (let i = 0; i < source.length; i++) {
        const ch = source[i];
        if (inQuotes) {
            if (ch === '"') {
                if (source[i + 1] === '"') {
                    cell += '"';
                    i += 1;
                } else {
                    inQuotes = false;
                }
            } else {
                cell += ch;
            }
            continue;
        }
        if (ch === '"') {
            inQuotes = true;
            continue;
        }
        if (ch === delim) {
            row.push(cell);
            cell = '';
            continue;
        }
        if (ch === '\n') {
            row.push(cell);
            rows.push(row);
            row = [];
            cell = '';
            continue;
        }
        if (ch === '\r') continue;
        cell += ch;
    }
    if (cell.length || row.length) {
        row.push(cell);
        rows.push(row);
    }
    return rows.filter((item) => item.some((value) => String(value || '').trim()));
}

function bestEmailColumnIndex(rows, preferredIndex = -1) {
    if (!rows.length) return -1;
    const colCount = rows.reduce((max, row) => Math.max(max, row.length), 0);
    let bestIndex = preferredIndex;
    let bestCount = -1;
    for (let col = 0; col < colCount; col++) {
        let count = 0;
        rows.forEach((row) => {
            if (looksLikeEmailCell(row[col])) count += 1;
        });
        if (count > bestCount) {
            bestCount = count;
            bestIndex = col;
        }
    }
    return bestCount > 0 ? bestIndex : preferredIndex;
}

function emptyPeopleResult() {
    return { emails: [], people: [], columnLabel: '' };
}

function nameFromRow(row, { nameIndex, firstIndex, lastIndex, emailIndex }) {
    if (nameIndex >= 0) {
        const named = cleanPersonName(row[nameIndex]);
        if (looksLikeName(named)) return named;
    }
    const first = firstIndex >= 0 ? cleanPersonName(row[firstIndex]) : '';
    const last = lastIndex >= 0 ? cleanPersonName(row[lastIndex]) : '';
    const combined = [first, last].filter(Boolean).join(' ');
    if (looksLikeName(combined)) return combined;

    const fromEmailCell = parseRecipientLine(row[emailIndex] || '')[0];
    if (fromEmailCell && fromEmailCell.name) return fromEmailCell.name;

    for (let i = 0; i < (row || []).length; i++) {
        if (i === emailIndex || i === firstIndex || i === lastIndex || i === nameIndex) continue;
        if (looksLikeEmailCell(row[i])) continue;
        const candidate = cleanPersonName(row[i]);
        if (looksLikeName(candidate)) return candidate;
    }
    return '';
}

function extractEmailsFromRows(rows) {
    if (!Array.isArray(rows) || !rows.length) {
        return emptyPeopleResult();
    }

    const header = (rows[0] || []).map((cell) => String(cell || '').trim());
    const namedIndex = header.findIndex((cell) => isEmailHeader(cell));
    let columnIndex = namedIndex;
    let startRow = namedIndex >= 0 && !looksLikeEmailCell(header[namedIndex]) ? 1 : 0;

    if (columnIndex < 0) {
        columnIndex = bestEmailColumnIndex(rows);
        startRow = 0;
        if (columnIndex >= 0 && isEmailHeader(header[columnIndex])) startRow = 1;
    }

    if (columnIndex < 0) {
        const people = parseRecipients(rows.map((row) => (row || []).join(' ')).join('\n'));
        return {
            emails: people.map((person) => person.email),
            people,
            columnLabel: people.length ? 'the file' : ''
        };
    }

    let nameIndex = header.findIndex((cell) => isNameHeader(cell));
    let firstIndex = header.findIndex((cell) => isFirstNameHeader(cell));
    let lastIndex = header.findIndex((cell) => isLastNameHeader(cell));
    if (startRow === 0 && nameIndex < 0 && firstIndex < 0) {
        const other = (rows[0] || []).map((_, index) => index).filter((index) => index !== columnIndex);
        if (other.length === 1) nameIndex = other[0];
    }

    const people = uniquePeople(rows.slice(startRow).flatMap((row) => {
        const emailCell = String(row[columnIndex] || '');
        const parsedCell = parseRecipientLine(emailCell);
        const columnName = nameFromRow(row, { nameIndex, firstIndex, lastIndex, emailIndex: columnIndex });
        if (parsedCell.length === 1) {
            return [{ name: columnName || parsedCell[0].name, email: parsedCell[0].email }];
        }
        if (parsedCell.length > 1) return parsedCell;

        const joined = (row || []).map((cell) => String(cell || '').trim()).filter(Boolean).join(', ');
        return parseRecipientLine(joined);
    }));

    if (!people.length) {
        const fallback = parseRecipients(rows.map((row) => (row || []).join(' ')).join('\n'));
        return {
            emails: fallback.map((person) => person.email),
            people: fallback,
            columnLabel: fallback.length ? 'the file' : ''
        };
    }

    const label = header[columnIndex] && isEmailHeader(header[columnIndex])
        ? header[columnIndex]
        : `column ${columnIndex + 1}`;
    return { emails: people.map((person) => person.email), people, columnLabel: label };
}

function extractEmailsFromSpreadsheetText(text) {
    const rows = parseDelimitedRows(text);
    if (rows.length > 1 || (rows[0] && rows[0].length > 1)) {
        return extractEmailsFromRows(rows);
    }
    const people = parseRecipients(text);
    return {
        emails: people.map((person) => person.email),
        people,
        columnLabel: people.length ? 'the file' : ''
    };
}

function extractEmailsFromWorkbook(workbook) {
    if (!workbook || !workbook.SheetNames || !workbook.SheetNames.length) {
        return emptyPeopleResult();
    }
    const collected = [];
    let columnLabel = '';
    workbook.SheetNames.forEach((name) => {
        const sheet = workbook.Sheets[name];
        if (!sheet || typeof XLSX === 'undefined') return;
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
        const result = extractEmailsFromRows(rows);
        if (result.people.length && !columnLabel) {
            columnLabel = result.columnLabel ? `${result.columnLabel} (${name})` : name;
        }
        collected.push(...result.people);
    });
    const people = uniquePeople(collected);
    return { emails: people.map((person) => person.email), people, columnLabel };
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsText(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read that file.'));
        reader.readAsArrayBuffer(file);
    });
}

async function extractEmailsFromUpload(file) {
    const name = String(file && file.name || '').toLowerCase();
    if (!file) return emptyPeopleResult();

    if (/\.(xlsx|xls|ods)$/i.test(name)) {
        if (typeof XLSX === 'undefined') {
            throw new Error('Excel support failed to load. Save the sheet as CSV and try again.');
        }
        const buffer = await readFileAsArrayBuffer(file);
        const workbook = XLSX.read(buffer, { type: 'array' });
        return extractEmailsFromWorkbook(workbook);
    }

    if (!/\.(csv|txt|tsv)$/i.test(name) && file.type && !/csv|text|excel|spreadsheet/i.test(file.type)) {
        throw new Error('Please upload a .csv, .txt, or Excel file.');
    }

    const text = await readFileAsText(file);
    return extractEmailsFromSpreadsheetText(text);
}

function chunkList(list, size) {
    const n = Math.max(1, Math.floor(Number(size) || 1));
    const chunks = [];
    const items = Array.isArray(list) ? list : [];
    for (let i = 0; i < items.length; i += n) {
        chunks.push(items.slice(i, i + n));
    }
    return chunks;
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
    return String(text || '').replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
        return Object.prototype.hasOwnProperty.call(vars, key) ? String(vars[key] != null ? vars[key] : '') : match;
    });
}

function personalizeCampaignCopy(subject, message, person) {
    const name = recipientDisplayName(person);
    const vars = {
        to_name: name || 'there',
        recipient_name: name || 'there',
        name: name || 'there'
    };
    let nextSubject = applyTemplateVars(subject, vars);
    let nextMessage = applyTemplateVars(message, vars);
    const usedNamePlaceholder = /\{\{\s*(to_name|recipient_name|name)\s*\}\}/i.test(String(message || ''));
    if (!usedNamePlaceholder && name) {
        const parts = splitNoReplyNotice(nextMessage);
        if (!/^\s*(dear|hi\b|hello\b)/i.test(parts.body)) {
            const greeted = `Dear ${name},\n\n${parts.body}`;
            nextMessage = parts.notice ? `${parts.notice}\n\n${greeted}` : greeted;
        }
    }
    return { subject: nextSubject, message: nextMessage };
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

function isCompactLogoDataUrl(value) {
    const logo = String(value || '').trim();
    return /^data:image\/(jpeg|jpg|png|gif|webp);base64,/i.test(logo) && logo.length < 28000;
}

function isEmbeddableLogo(value) {
    return isPublicLogoUrl(value) || isCompactLogoDataUrl(value);
}

function splitNoReplyNotice(message) {
    const notice = typeof NOREPLY_INBOX_NOTICE === 'string'
        ? NOREPLY_INBOX_NOTICE
        : 'This inbox is not monitored. You will not receive a reply.';
    const text = String(message || '');
    if (!text.toLowerCase().startsWith(notice.toLowerCase())) {
        return { notice: '', body: text };
    }
    return {
        notice,
        body: text.slice(notice.length).replace(/^\s+/, '')
    };
}

function trackingPixelHtml(pixelUrl) {
    const src = String(pixelUrl || '').trim();
    if (!/^https?:\/\//i.test(src)) return '';
    return `<img src="${escapeHtml(src)}" width="1" height="1" alt="" style="display:block;width:1px;height:1px;border:0;opacity:0;max-height:1px;" />`;
}

function buildMessageHtml(message, logoUrl, pixelUrl) {
    const parts = splitNoReplyNotice(message);
    const noticeHtml = parts.notice
        ? `<p style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#0f172a;margin:0 0 16px 0;">${escapeHtml(parts.notice)}</p>`
        : '';
    const body = escapeHtml(parts.body).replace(/\n/g, '<br>');
    let image = '';
    const logo = String(logoUrl || '').trim();
    if (isPublicLogoUrl(logo)) {
        image = `<p><img src="${escapeHtml(logo)}" alt="Tech Hub Africa" style="max-width:220px;height:auto;margin:0 0 16px 0;display:block;" /></p>`;
    } else if (isCompactLogoDataUrl(logo)) {
        image = `<p><img src="${logo}" alt="Tech Hub Africa" style="max-width:220px;height:auto;margin:0 0 16px 0;display:block;" /></p>`;
    }
    return `${noticeHtml}${image}<div style="font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.55;color:#0f172a;">${body}</div>${trackingPixelHtml(pixelUrl)}`;
}

function resolveLogo(template) {
    const org = typeof loadCampaignConfig === 'function' ? loadCampaignConfig() : {};
    return (
        (template && (template.logoUrl || template.logoDataUrl)) ||
        org.logoUrl ||
        org.logoDataUrl ||
        'assets/tha-logo.png'
    );
}

let brandLogoDataUrlPromise = null;

function getBrandLogoDataUrl() {
    if (!brandLogoDataUrlPromise) {
        brandLogoDataUrlPromise = fetch('assets/tha-logo-email.jpg')
            .then((response) => {
                if (!response.ok) throw new Error('Logo file missing');
                return response.blob();
            })
            .then((blob) => new Promise((resolve, reject) => {
                const image = new Image();
                const objectUrl = URL.createObjectURL(blob);
                image.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve(compressLogoImage(image));
                };
                image.onerror = () => {
                    URL.revokeObjectURL(objectUrl);
                    reject(new Error('Could not read logo'));
                };
                image.src = objectUrl;
            }))
            .catch(() => '');
    }
    return brandLogoDataUrlPromise;
}

async function resolveSendableLogo(template) {
    const org = typeof loadCampaignConfig === 'function' ? loadCampaignConfig() : {};
    const candidates = [
        template && template.logoUrl,
        org.logoUrl,
        template && template.logoDataUrl,
        org.logoDataUrl
    ];
    const hosted = candidates.find((value) => isPublicLogoUrl(value));
    if (hosted) return hosted.trim();
    const compact = candidates.find((value) => isCompactLogoDataUrl(value));
    if (compact) return compact.trim();
    return getBrandLogoDataUrl();
}

function compressLogoImage(image) {
    let max = 200;
    let quality = 0.6;
    let best = '';
    for (let attempt = 0; attempt < 6; attempt += 1) {
        const longest = Math.max(image.width, image.height, 1);
        const scale = Math.min(1, max / longest);
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        best = canvas.toDataURL('image/jpeg', quality);
        if (best.length < 12000) return best;
        max = Math.round(max * 0.72);
        quality = Math.max(0.32, quality - 0.08);
    }
    return best.length < 18000 ? best : '';
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
            URL.revokeObjectURL(objectUrl);
            const compact = compressLogoImage(image);
            if (!compact) {
                reject(new Error('That image is too large for EmailJS. Use a smaller logo or a public https URL.'));
                return;
            }
            resolve(compact);
        };
        image.onerror = () => {
            URL.revokeObjectURL(objectUrl);
            reject(new Error('Could not read that image.'));
        };
        image.src = objectUrl;
    });
}

const LIBRARY_TOMBSTONE_KEY = 'tha_library_tombstones';
const LIBRARY_SEEDED_KEY = 'tha_library_seeded';
const pendingLibraryUpserts = new Map();
let libraryPushDepth = 0;
let libraryPushChain = Promise.resolve();
let sharedLibraryAvailable = null;
let sharedLibraryOfflineNotice = false;
let sharedLibrarySignature = '';
let sharedLibraryReadyPromise = null;
let refreshInFlight = null;
let librarySyncTimer = null;

function sharedLibraryUrl() {
    if (typeof window === 'undefined' || !window.location) return '';
    if (!/^https?:$/i.test(window.location.protocol)) return '';
    try {
        return new URL('library.php', window.location.href).href;
    } catch {
        return '';
    }
}

function libraryWriteKey() {
    return typeof LIBRARY_WRITE_KEY === 'string' ? LIBRARY_WRITE_KEY : '';
}

function emptyLibraryTombstones() {
    return { templates: {}, events: {} };
}

function loadLibraryTombstones() {
    try {
        const parsed = JSON.parse(localStorage.getItem(LIBRARY_TOMBSTONE_KEY) || '{}');
        return {
            templates: parsed && parsed.templates && typeof parsed.templates === 'object' ? parsed.templates : {},
            events: parsed && parsed.events && typeof parsed.events === 'object' ? parsed.events : {}
        };
    } catch {
        return emptyLibraryTombstones();
    }
}

function saveLibraryTombstones(tombstones) {
    localStorage.setItem(LIBRARY_TOMBSTONE_KEY, JSON.stringify(tombstones));
}

function rememberLibraryTombstone(kind, id) {
    const tombstones = loadLibraryTombstones();
    if (!tombstones[kind]) tombstones[kind] = {};
    tombstones[kind][id] = Date.now();
    saveLibraryTombstones(tombstones);
}

function clearLibraryTombstone(kind, id) {
    const tombstones = loadLibraryTombstones();
    if (!tombstones[kind] || !tombstones[kind][id]) return;
    delete tombstones[kind][id];
    saveLibraryTombstones(tombstones);
}

function librarySignature(templates, events) {
    const part = (list) => (list || [])
        .map((item) => [
            item && item.id,
            item && item.updatedAt,
            item && item.name,
            item && item.message ? item.message.length : 0,
            item && item.emails ? item.emails.length : 0
        ].join(':'))
        .sort()
        .join('|');
    const settings = typeof sharedSettingsSignature === 'function' ? sharedSettingsSignature() : '';
    return `${part(templates)}#${part(events)}#${settings}`;
}

function applySharedLists(templates, events, settings, options = {}) {
    const nextTemplates = Array.isArray(templates) ? templates : [];
    const nextEvents = Array.isArray(events) ? events : [];
    if (settings && typeof applySharedSettings === 'function') applySharedSettings(settings, options);
    const signature = librarySignature(nextTemplates, nextEvents);
    localStorage.setItem(TEMPLATES_KEY, JSON.stringify(nextTemplates));
    localStorage.setItem(EVENTS_KEY, JSON.stringify(nextEvents));
    if (signature === sharedLibrarySignature) return false;
    sharedLibrarySignature = signature;
    document.dispatchEvent(new CustomEvent('tha-library-changed'));
    return true;
}

function templateForShare(item) {
    const logoDataUrl = isCompactLogoDataUrl(item && item.logoDataUrl) ? item.logoDataUrl : '';
    return {
        id: item.id,
        name: item.name || '',
        subject: item.subject || '',
        message: item.message || '',
        logoUrl: item.logoUrl || '',
        logoDataUrl,
        createdAt: item.createdAt || 0,
        updatedAt: item.updatedAt || 0
    };
}

function eventForShare(item) {
    const people = uniquePeople(item && (item.people || item.emails) || []).map((person) => ({
        name: person.name || '',
        email: person.email
    }));
    return {
        id: item.id,
        name: item.name || '',
        description: item.description || '',
        people,
        emails: people.map((person) => person.email),
        createdAt: item.createdAt || 0,
        updatedAt: item.updatedAt || 0
    };
}

function markSharedLibraryOffline(announce) {
    sharedLibraryAvailable = false;
    if (librarySyncTimer) {
        window.clearInterval(librarySyncTimer);
        librarySyncTimer = null;
    }
    if (!announce || sharedLibraryOfflineNotice) return;
    sharedLibraryOfflineNotice = true;
    if (typeof showToast === 'function') {
        showToast('Saved in this browser. Upload library.php with the site so other users can see it.', 'info');
    }
}

async function postLibrary(body, options = {}) {
    const url = sharedLibraryUrl();
    if (!url || !libraryWriteKey()) return null;
    let response;
    try {
        response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Studio-Key': libraryWriteKey()
            },
            body: JSON.stringify(body)
        });
    } catch {
        markSharedLibraryOffline(Boolean(options.announce));
        return null;
    }
    if (response.status === 404 || response.status === 405) {
        markSharedLibraryOffline(Boolean(options.announce));
        return null;
    }
    let payload = null;
    try {
        payload = await response.json();
    } catch {
        payload = null;
    }
    if (!response.ok || !payload || payload.ok === false) {
        if (options.announce && typeof showToast === 'function') {
            showToast((payload && payload.error) || 'Could not share that save with other users.', 'error');
        }
        return null;
    }
    sharedLibraryAvailable = true;
    if (body.action === 'delete') clearLibraryTombstone(body.kind, body.id);
    if (body.action === 'upsert' && body.item && body.item.id) {
        pendingLibraryUpserts.delete(`${body.kind}:${body.item.id}`);
    }
    return payload;
}

function queueLibraryPush(task) {
    libraryPushDepth += 1;
    libraryPushChain = libraryPushChain.then(async () => {
        try {
            const data = await task();
            if (
                libraryPushDepth === 1 &&
                data &&
                Array.isArray(data.templates) &&
                Array.isArray(data.events)
            ) {
                applySharedLists(data.templates, data.events, data.settings, { force: true });
            }
        } catch (err) {
            console.warn('Shared library save failed.', err);
        } finally {
            libraryPushDepth -= 1;
        }
    });
}

function shareLibraryUpsert(kind, item) {
    if (!item || !item.id || !sharedLibraryUrl()) return;
    clearLibraryTombstone(kind, item.id);
    const payload = kind === 'events' ? eventForShare(item) : templateForShare(item);
    pendingLibraryUpserts.set(`${kind}:${item.id}`, payload);
    queueLibraryPush(() => postLibrary({ kind, action: 'upsert', item: payload }, { announce: true }));
}

function shareLibraryDelete(kind, id) {
    if (!id) return;
    rememberLibraryTombstone(kind, id);
    if (!sharedLibraryUrl()) return;
    queueLibraryPush(() => postLibrary({ kind, action: 'delete', id }, { announce: true }));
}

function libraryIsSeeded() {
    return localStorage.getItem(LIBRARY_SEEDED_KEY) === '1';
}

function markLibrarySeeded() {
    localStorage.setItem(LIBRARY_SEEDED_KEY, '1');
}

function planLibrarySync(kind, localList, remoteList, tombstones) {
    const removed = tombstones || {};
    const remoteIds = new Set();
    const keep = [];
    const ops = [];
    const shareItem = kind === 'events' ? eventForShare : templateForShare;

    (remoteList || []).forEach((item) => {
        if (!item || !item.id) return;
        remoteIds.add(item.id);
        if (removed[item.id]) {
            ops.push({ kind, action: 'delete', id: item.id });
            return;
        }
        const pending = pendingLibraryUpserts.get(`${kind}:${item.id}`);
        const local = (localList || []).find((row) => row && row.id === item.id);
        const newer = pending || local;
        if (newer && (newer.updatedAt || 0) > (item.updatedAt || 0)) {
            keep.push(newer);
            ops.push({ kind, action: 'upsert', item: shareItem(newer) });
            return;
        }
        keep.push(item);
    });

    (localList || []).forEach((item) => {
        if (!item || !item.id || remoteIds.has(item.id) || removed[item.id]) return;
        const pending = pendingLibraryUpserts.get(`${kind}:${item.id}`);
        if (libraryIsSeeded() && !pending) return;
        const source = pending || item;
        keep.push(source);
        ops.push({ kind, action: 'upsert', item: shareItem(source) });
    });

    Object.keys(removed).forEach((id) => {
        if (!remoteIds.has(id)) clearLibraryTombstone(kind, id);
    });

    return { keep, ops };
}

function planSettingsSync(remoteSettings) {
    const remote = remoteSettings && typeof remoteSettings === 'object' ? remoteSettings : {};
    const remoteConfig = remote.config || {};
    const ops = [];
    if (typeof readStoredCampaignConfig !== 'function' || typeof campaignConfigForShare !== 'function') return ops;

    const localConfig = readStoredCampaignConfig();
    const localConfigStamp = localConfig.updatedAt || (Object.keys(localConfig).some((key) => key !== 'updatedAt') ? 1 : 0);
    if (localConfigStamp > (remoteConfig.updatedAt || 0)) {
        ops.push({ kind: 'settings', action: 'upsert', item: campaignConfigForShare(localConfig) });
    }
    return ops;
}

async function reconcileSharedLibrary(remote) {
    if (libraryPushDepth > 0) return;
    try {
        await reconcileSharedLibraryBody(remote);
    } finally {
        if (libraryPushDepth === 0 && remote && Array.isArray(remote.history)) {
            adoptServerHistory(remote.history);
        }
    }
}

async function reconcileSharedLibraryBody(remote) {
    const remoteTemplates = Array.isArray(remote && remote.templates) ? remote.templates : [];
    const remoteEvents = Array.isArray(remote && remote.events) ? remote.events : [];
    const tombstones = loadLibraryTombstones();
    const templatesPlan = planLibrarySync('templates', loadJsonList(TEMPLATES_KEY), remoteTemplates, tombstones.templates);
    const eventsPlan = planLibrarySync('events', loadJsonList(EVENTS_KEY), remoteEvents, tombstones.events);
    const ops = templatesPlan.ops.concat(eventsPlan.ops, planSettingsSync(remote && remote.settings));

    if (!ops.length) {
        if (libraryPushDepth > 0) return;
        applySharedLists(remoteTemplates, remoteEvents, remote && remote.settings);
        markLibrarySeeded();
        return;
    }

    let latest = null;
    for (let i = 0; i < ops.length; i += 1) {
        if (libraryPushDepth > 0) return;
        latest = await postLibrary(ops[i], { announce: false });
        if (!latest) {
            if (libraryPushDepth === 0) applySharedLists(templatesPlan.keep, eventsPlan.keep);
            return;
        }
    }
    if (libraryPushDepth === 0 && latest && Array.isArray(latest.templates) && Array.isArray(latest.events)) {
        applySharedLists(latest.templates, latest.events, latest.settings, { force: true });
        if (!pendingLibraryUpserts.size) markLibrarySeeded();
    }
}

async function pullSharedLibrary() {
    if (sharedLibraryAvailable === false || libraryPushDepth > 0) return;
    const url = sharedLibraryUrl();
    if (!url || !libraryWriteKey()) return;
    if (typeof isStudioLoggedIn === 'function' && !isStudioLoggedIn()) return;

    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 4000) : null;
    let response;
    try {
        response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
            cache: 'no-store',
            headers: { 'X-Studio-Key': libraryWriteKey() },
            signal: controller ? controller.signal : undefined
        });
    } catch {
        return;
    } finally {
        if (timer) clearTimeout(timer);
    }
    if (response.status === 404 || response.status === 405) {
        markSharedLibraryOffline(false);
        return;
    }
    if (!response.ok) return;
    let payload = null;
    try {
        payload = await response.json();
    } catch {
        return;
    }
    if (!payload || payload.ok === false) return;
    sharedLibraryAvailable = true;
    await reconcileSharedLibrary(payload);
}

function refreshSharedLibrary() {
    if (sharedLibraryAvailable === false || libraryPushDepth > 0) return Promise.resolve();
    if (refreshInFlight) return refreshInFlight;
    refreshInFlight = pullSharedLibrary().finally(() => {
        refreshInFlight = null;
    });
    return refreshInFlight;
}

function whenSharedLibraryReady() {
    if (!sharedLibraryReadyPromise) {
        if (!sharedLibraryUrl() || (typeof isStudioLoggedIn === 'function' && !isStudioLoggedIn())) {
            sharedLibraryReadyPromise = Promise.resolve();
        } else {
            sharedLibraryReadyPromise = refreshSharedLibrary();
        }
    }
    return sharedLibraryReadyPromise;
}

function startSharedLibrarySync() {
    if (!sharedLibraryUrl() || librarySyncTimer) return;
    if (typeof isStudioLoggedIn === 'function' && !isStudioLoggedIn()) return;
    whenSharedLibraryReady();
    librarySyncTimer = window.setInterval(() => {
        refreshSharedLibrary();
    }, 5000);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') refreshSharedLibrary();
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
            shareLibraryUpsert('templates', list[index]);
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
    shareLibraryUpsert('templates', created);
    return created;
}

function deleteTemplate(id) {
    shareLibraryDelete('templates', id);
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

function peopleFromEventItem(item) {
    return uniquePeople([
        ...(item && item.people ? item.people : []),
        ...parseRecipients(
            Array.isArray(item && item.emails) ? (item.emails || []).join('\n') : (item && item.emails) || ''
        )
    ]);
}

function loadEvents() {
    return loadJsonList(EVENTS_KEY)
        .filter((item) => item && item.id)
        .map((item) => {
            const people = peopleFromEventItem(item);
            return {
                ...item,
                people,
                emails: people.map((person) => person.email)
            };
        })
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
    const people = uniquePeople([
        ...(payload.people || []),
        ...parseRecipients(
            Array.isArray(payload.emails) ? payload.emails.join('\n') : payload.emails
        )
    ]);
    const emails = people.map((person) => person.email);

    if (payload.id) {
        const index = list.findIndex((item) => item.id === payload.id);
        if (index >= 0) {
            list[index] = {
                ...list[index],
                name,
                description,
                people,
                emails,
                updatedAt: now
            };
            saveEvents(list);
            shareLibraryUpsert('events', list[index]);
            return getEvent(payload.id);
        }
    }

    const created = {
        id: newId(),
        name,
        description,
        people,
        emails,
        createdAt: now,
        updatedAt: now
    };
    list.push(created);
    saveEvents(list);
    shareLibraryUpsert('events', created);
    return created;
}

function deleteEvent(id) {
    shareLibraryDelete('events', id);
    saveEvents(loadJsonList(EVENTS_KEY).filter((item) => item.id !== id));
}

function downloadEventPeople(event) {
    const people = peopleFromEventItem(event);
    downloadFile(`${slugify(event.name)}-people.txt`, formatPeopleList(people) || '');
}

const HISTORY_KEY = 'tha_campaign_history';
let historySyncState = new Map();

function historyForShare(entry) {
    if (!entry || !entry.id) return null;
    return {
        id: entry.id,
        createdAt: entry.createdAt || 0,
        updatedAt: entry.updatedAt || entry.createdAt || 0,
        eventName: entry.eventName || '',
        subject: entry.subject || '',
        message: entry.message || '',
        fromName: entry.fromName || '',
        fromEmail: entry.fromEmail || '',
        replyTo: entry.replyTo || '',
        logoUrl: historyLogoForStorage(entry.logoUrl),
        attachmentNames: Array.isArray(entry.attachmentNames) ? entry.attachmentNames : [],
        recipients: Array.isArray(entry.recipients) ? entry.recipients : [],
        succeededEmails: succeededEmailsFromEntry(entry),
        failedEmails: failedEmailsFromEntry(entry),
        recipientOpens: recipientOpensFromEntry(entry),
        success: Number(entry.success || 0),
        failed: Number(entry.failed || 0),
        failedDetails: Array.isArray(entry.failedDetails) ? entry.failedDetails : [],
        sendMode: entry.sendMode === 'batch' ? 'batch' : 'immediate',
        batchSize: Number(entry.batchSize || 0),
        batchCount: Number(entry.batchCount || 0),
        batchesDone: Number(entry.batchesDone || 0),
        stopped: Boolean(entry.stopped)
    };
}

function shareHistorySnapshot(list, options = {}) {
    if (typeof sharedLibraryUrl !== 'function' || !sharedLibraryUrl()) return;
    const prune = options.prune !== false;
    const items = (list || []).map((entry) => historyForShare(entry)).filter((entry) => entry && entry.id);
    const seen = new Set();
    const ops = [];
    items.forEach((item) => {
        seen.add(item.id);
        const signature = JSON.stringify(item);
        if (historySyncState.get(item.id) === signature) return;
        ops.push({ op: { kind: 'history', action: 'upsert', item }, id: item.id, signature });
    });
    if (prune) {
        [...historySyncState.keys()].forEach((id) => {
            if (seen.has(id)) return;
            ops.push({ op: { kind: 'history', action: 'delete', id }, id, signature: null });
        });
    }
    if (!ops.length) return;
    queueLibraryPush(async () => {
        let latest = null;
        for (let i = 0; i < ops.length; i += 1) {
            const step = ops[i];
            latest = await postLibrary(step.op, { announce: false });
            if (!latest) return latest;
            if (step.signature == null) historySyncState.delete(step.id);
            else historySyncState.set(step.id, step.signature);
        }
        return latest;
    });
}

function mergeHistoryEntries(remote, local) {
    const remoteRev = Number(remote.updatedAt || remote.createdAt || 0);
    const localRev = Number(local.updatedAt || local.createdAt || 0);
    const primary = localRev >= remoteRev ? local : remote;
    const secondary = primary === local ? remote : local;
    const primaryOpens = recipientOpensFromEntry(primary);
    const secondaryOpens = recipientOpensFromEntry(secondary);
    const emails = new Set([...Object.keys(primaryOpens), ...Object.keys(secondaryOpens)]);
    const recipientOpens = {};
    emails.forEach((email) => {
        const a = primaryOpens[email];
        const b = secondaryOpens[email];
        if (a && b) {
            const last = Math.max(Number(a.lastOpenedAt || 0), Number(b.lastOpenedAt || 0));
            recipientOpens[email] = {
                token: a.token || b.token,
                openedAt: a.openedAt || b.openedAt,
                lastOpenedAt: last || null,
                openCount: Math.max(Number(a.openCount || 0), Number(b.openCount || 0))
            };
        } else {
            recipientOpens[email] = a || b;
        }
    });
    return {
        ...secondary,
        ...primary,
        id: primary.id || secondary.id,
        recipientOpens
    };
}

function adoptServerHistory(remoteList) {
    if (!Array.isArray(remoteList) || libraryPushDepth > 0) return;
    const local = loadJsonList(HISTORY_KEY);
    const remoteById = new Map();
    remoteList.forEach((item) => {
        if (item && item.id) remoteById.set(String(item.id), item);
    });
    const merged = new Map(remoteById);
    local.forEach((item, index) => {
        const id = historyEntryId(item, index);
        const normalized = item && item.id ? item : { ...item, id };
        const remote = remoteById.get(id);
        merged.set(id, remote ? mergeHistoryEntries(remote, normalized) : normalized);
    });
    const next = [...merged.values()]
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
        .slice(0, 500);
    const previous = JSON.stringify(local);
    const serialized = JSON.stringify(next);
    if (serialized !== previous) {
        localStorage.setItem(HISTORY_KEY, serialized);
        document.dispatchEvent(new CustomEvent('tha-library-changed'));
    }
    historySyncState = new Map();
    remoteList.forEach((item) => {
        const share = historyForShare(item);
        if (share && share.id) historySyncState.set(share.id, JSON.stringify(share));
    });
    shareHistorySnapshot(next);
}

function historyEntryId(entry, index = 0) {
    return (entry && entry.id) ? entry.id : `legacy_${(entry && entry.createdAt) || index}`;
}

function loadHistory() {
    return loadJsonList(HISTORY_KEY)
        .map((item, index) => (item && item.id ? item : { ...item, id: historyEntryId(item, index) }))
        .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
}

function failedEmailsFromEntry(entry) {
    const fromDetails = (entry.failedDetails || []).map((line) => {
        const text = String(line || '');
        const cut = text.includes(' — ') ? text.split(' — ')[0] : text.split(' - ')[0];
        return cut.trim().toLowerCase();
    }).filter(Boolean);

    if (Array.isArray(entry.failedEmails) && entry.failedEmails.length) {
        return [...new Set(entry.failedEmails.map((email) => String(email).toLowerCase().trim()).filter(Boolean))];
    }

    return [...new Set(fromDetails)];
}

function succeededEmailsFromEntry(entry) {
    if (Array.isArray(entry.succeededEmails) && entry.succeededEmails.length) {
        return [...new Set(entry.succeededEmails.map((email) => String(email).toLowerCase().trim()).filter(Boolean))];
    }
    const failed = new Set(failedEmailsFromEntry(entry));
    return (entry.recipients || [])
        .map((email) => String(email).toLowerCase().trim())
        .filter((email) => email && !failed.has(email));
}

function recipientOpensFromEntry(entry) {
    const source = entry && entry.recipientOpens && typeof entry.recipientOpens === 'object'
        ? entry.recipientOpens
        : {};
    const next = {};
    Object.keys(source).forEach((email) => {
        const key = historyEmailKey(email);
        const rec = source[email] || {};
        if (!key) return;
        next[key] = {
            token: String(rec.token || '').trim(),
            openedAt: rec.openedAt || rec.firstOpenedAt || null,
            lastOpenedAt: rec.lastOpenedAt || rec.openedAt || null,
            openCount: Number(rec.openCount || rec.count || 0) || 0
        };
    });
    return next;
}

function openedEmailsFromEntry(entry) {
    const opens = recipientOpensFromEntry(entry);
    return Object.keys(opens).filter((email) => opens[email].openedAt || opens[email].openCount > 0);
}

function openInfoForEmail(entry, email) {
    return recipientOpensFromEntry(entry)[historyEmailKey(email)] || null;
}

function historyLogoForStorage(logoUrl) {
    const logo = String(logoUrl || '').trim();
    return isPublicLogoUrl(logo) ? logo : '';
}

function addHistoryEntry(entry) {
    const list = loadJsonList(HISTORY_KEY);
    const now = Date.now();
    const stored = {
        ...entry,
        id: newId(),
        createdAt: now,
        updatedAt: now,
        logoUrl: historyLogoForStorage(entry.logoUrl)
    };
    const next = [stored, ...list].slice(0, 500);
    try {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
        shareHistorySnapshot(next);
    } catch {
        stored.logoUrl = '';
        const smaller = [stored, ...list].slice(0, 80);
        localStorage.setItem(HISTORY_KEY, JSON.stringify(smaller));
        shareHistorySnapshot([stored], { prune: false });
    }
    return loadHistory();
}

function saveHistoryList(list) {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
    shareHistorySnapshot(list);
    return loadHistory();
}

function historyEmailKey(email) {
    return String(email || '').toLowerCase().trim();
}

function deleteHistoryMessages(targets) {
    const removeByEntry = new Map();
    (targets || []).forEach((target) => {
        const entryId = String(target.id || '');
        const email = historyEmailKey(target.email);
        if (!entryId || !email) return;
        if (!removeByEntry.has(entryId)) removeByEntry.set(entryId, new Set());
        removeByEntry.get(entryId).add(email);
    });

    if (!removeByEntry.size) return loadHistory();

    const next = loadJsonList(HISTORY_KEY).map((entry, index) => {
        const id = historyEntryId(entry, index);
        const remove = removeByEntry.get(id);
        if (!remove) return { ...entry, id };

        const keepEmail = (email) => !remove.has(historyEmailKey(email));
        const recipients = (entry.recipients || []).filter(keepEmail);
        const succeededEmails = succeededEmailsFromEntry({ ...entry, id }).filter(keepEmail);
        const failedEmails = failedEmailsFromEntry({ ...entry, id }).filter(keepEmail);
        const failedDetails = (entry.failedDetails || []).filter((line) => {
            const text = String(line || '');
            const cut = text.includes(' — ') ? text.split(' — ')[0] : text.split(' - ')[0];
            return keepEmail(cut);
        });
        const recipientOpens = {};
        Object.entries(recipientOpensFromEntry({ ...entry, id })).forEach(([email, rec]) => {
            if (keepEmail(email)) recipientOpens[email] = rec;
        });

        if (!recipients.length && !succeededEmails.length && !failedEmails.length) {
            return null;
        }

        return {
            ...entry,
            id,
            updatedAt: Date.now(),
            recipients,
            succeededEmails,
            failedEmails,
            failedDetails,
            recipientOpens,
            success: succeededEmails.length,
            failed: failedEmails.length
        };
    }).filter(Boolean);

    return saveHistoryList(next);
}

function clearHistory() {
    localStorage.removeItem(HISTORY_KEY);
    historySyncState = new Map();
    if (typeof sharedLibraryUrl === 'function' && sharedLibraryUrl()) {
        queueLibraryPush(() => postLibrary({ kind: 'history', action: 'clear' }, { announce: false }));
    }
}

function parseOpenReport(payload) {
    const source = payload && payload.opens && typeof payload.opens === 'object'
        ? payload.opens
        : (payload && typeof payload === 'object' ? payload : {});
    const byToken = new Map();
    Object.keys(source).forEach((token) => {
        const rec = source[token] || {};
        const first = rec.firstOpenedAt || rec.openedAt || rec.lastOpenedAt || null;
        const last = rec.lastOpenedAt || rec.openedAt || first;
        const count = Number(rec.count || rec.openCount || 0) || (first ? 1 : 0);
        if (!token || (!first && !count)) return;
        byToken.set(String(token), {
            openedAt: first,
            lastOpenedAt: last,
            openCount: count || 1
        });
    });
    return byToken;
}

function applyOpenReportToHistory(report) {
    const byToken = parseOpenReport(report);
    if (!byToken.size) return false;

    let changed = false;
    const next = loadJsonList(HISTORY_KEY).map((entry, index) => {
        const id = historyEntryId(entry, index);
        const recipientOpens = recipientOpensFromEntry({ ...entry, id });
        let entryChanged = false;
        Object.keys(recipientOpens).forEach((email) => {
            const rec = recipientOpens[email];
            if (!rec.token || !byToken.has(rec.token)) return;
            const hit = byToken.get(rec.token);
            if (
                rec.openedAt !== hit.openedAt ||
                rec.lastOpenedAt !== hit.lastOpenedAt ||
                rec.openCount !== hit.openCount
            ) {
                recipientOpens[email] = {
                    ...rec,
                    openedAt: hit.openedAt,
                    lastOpenedAt: hit.lastOpenedAt,
                    openCount: hit.openCount
                };
                entryChanged = true;
            }
        });
        if (!entryChanged) return { ...entry, id };
        changed = true;
        return { ...entry, id, updatedAt: Date.now(), recipientOpens };
    });

    if (changed) saveHistoryList(next);
    return changed;
}

async function refreshHistoryOpens() {
    if (typeof openReportUrl !== 'function') {
        throw new Error('Open tracking is not available.');
    }
    const url = openReportUrl();
    if (!url) {
        throw new Error('Set the open tracking URL in Settings.');
    }
    const response = await fetch(`${url}${url.includes('?') ? '&' : '?'}_=${Date.now()}`, {
        cache: 'no-store'
    });
    if (!response.ok) {
        throw new Error(`Open report failed (${response.status})`);
    }
    const payload = await response.json();
    return applyOpenReportToHistory(payload);
}

document.addEventListener('DOMContentLoaded', () => {
    startSharedLibrarySync();
});
