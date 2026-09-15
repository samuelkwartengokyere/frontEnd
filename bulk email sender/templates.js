document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('templateForm');
    const templateId = document.getElementById('templateId');
    const templateName = document.getElementById('templateName');
    const templateSubject = document.getElementById('templateSubject');
    const templateMessage = document.getElementById('templateMessage');
    const templateLogoUrl = document.getElementById('templateLogoUrl');
    const templateLogoFile = document.getElementById('templateLogoFile');
    const logoBrowseBtn = document.getElementById('logoBrowseBtn');
    const logoClearBtn = document.getElementById('logoClearBtn');
    const logoPreview = document.getElementById('logoPreview');
    const logoPreviewWrap = document.getElementById('logoPreviewWrap');
    const templateList = document.getElementById('templateList');
    const updateBtn = document.getElementById('updateTemplateBtn');
    const resetBtn = document.getElementById('resetTemplateBtn');
    const downloadCurrentBtn = document.getElementById('downloadCurrentBtn');
    const downloadAllBtn = document.getElementById('downloadAllBtn');
    const importBtn = document.getElementById('importBtn');
    const importFile = document.getElementById('importFile');

    let logoDataUrl = '';

    const showLogoPreview = (src) => {
        if (!src) {
            logoPreview.removeAttribute('src');
            logoPreviewWrap.classList.add('hidden');
            return;
        }
        logoPreview.src = src;
        logoPreviewWrap.classList.remove('hidden');
    };

    const readForm = () => ({
        id: templateId.value || undefined,
        name: templateName.value.trim(),
        subject: templateSubject.value.trim(),
        message: templateMessage.value.trim(),
        logoUrl: templateLogoUrl.value.trim(),
        logoDataUrl
    });

    const resetForm = () => {
        templateId.value = '';
        form.reset();
        logoDataUrl = '';
        showLogoPreview('');
        updateBtn.classList.add('hidden');
        templateName.focus();
    };

    const loadTemplateIntoForm = (template) => {
        templateId.value = template.id;
        templateName.value = template.name;
        templateSubject.value = template.subject || '';
        templateMessage.value = template.message || '';
        templateLogoUrl.value = template.logoUrl || '';
        logoDataUrl = template.logoDataUrl || '';
        showLogoPreview(template.logoUrl || template.logoDataUrl || '');
        updateBtn.classList.remove('hidden');
        templateName.focus();
    };

    const renderList = () => {
        const templates = loadTemplates();
        templateList.innerHTML = '';

        if (!templates.length) {
            const empty = document.createElement('p');
            empty.className = 'field-hint';
            empty.textContent = 'No templates yet. Save one above to reuse it on campaigns.';
            templateList.appendChild(empty);
            return;
        }

        templates.forEach((template) => {
            const card = document.createElement('article');
            card.className = 'item-card';

            const title = document.createElement('h3');
            title.textContent = template.name;

            const meta = document.createElement('p');
            meta.className = 'item-meta';
            meta.textContent = template.subject || 'No subject';

            const logoSrc = template.logoUrl || template.logoDataUrl;
            if (logoSrc) {
                const img = document.createElement('img');
                img.className = 'logo-preview';
                img.alt = '';
                img.src = logoSrc;
                card.appendChild(img);
            }

            const actions = document.createElement('div');
            actions.className = 'row-actions';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn-secondary btn-small';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => loadTemplateIntoForm(template));

            const useBtn = document.createElement('a');
            useBtn.className = 'btn-secondary btn-small btn-link';
            useBtn.href = `index.html?template=${encodeURIComponent(template.id)}`;
            useBtn.textContent = 'Use in campaign';

            const downloadBtn = document.createElement('button');
            downloadBtn.type = 'button';
            downloadBtn.className = 'btn-secondary btn-small';
            downloadBtn.textContent = 'Download';
            downloadBtn.addEventListener('click', () => {
                downloadTemplate(template);
                showToast('Template downloaded.', 'success');
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-secondary btn-small danger-text';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                if (!confirm(`Delete template “${template.name}”?`)) return;
                deleteTemplate(template.id);
                if (templateId.value === template.id) resetForm();
                renderList();
                showToast('Template deleted.', 'info');
            });

            actions.append(editBtn, useBtn, downloadBtn, deleteBtn);
            card.append(title, meta, actions);
            templateList.appendChild(card);
        });
    };

    logoBrowseBtn.addEventListener('click', () => templateLogoFile.click());
    logoClearBtn.addEventListener('click', () => {
        logoDataUrl = '';
        templateLogoUrl.value = '';
        templateLogoFile.value = '';
        showLogoPreview('');
    });
    templateLogoFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            logoDataUrl = await fileToLogoDataUrl(file);
            showLogoPreview(logoDataUrl);
            showToast('Logo added to this template.', 'success');
        } catch (err) {
            showToast(err.message || 'Could not use that image.', 'error');
        }
        e.target.value = '';
    });
    templateLogoUrl.addEventListener('input', () => {
        showLogoPreview(templateLogoUrl.value.trim() || logoDataUrl);
    });

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = readForm();
        if (!payload.name || !payload.subject || !payload.message) {
            showToast('Name, subject, and message are required.', 'error');
            return;
        }
        const saved = upsertTemplate({
            name: payload.name,
            subject: payload.subject,
            message: payload.message,
            logoUrl: payload.logoUrl,
            logoDataUrl: payload.logoDataUrl
        });
        resetForm();
        renderList();
        showToast(`Added “${saved.name}”.`, 'success');
    });

    updateBtn.addEventListener('click', () => {
        const payload = readForm();
        if (!templateId.value) {
            showToast('Choose a template to update, or use Save template to add a new one.', 'error');
            return;
        }
        if (!payload.name || !payload.subject || !payload.message) {
            showToast('Name, subject, and message are required.', 'error');
            return;
        }
        const saved = upsertTemplate(payload);
        resetForm();
        renderList();
        showToast(`Updated “${saved.name}”.`, 'success');
    });

    resetBtn.addEventListener('click', resetForm);

    downloadCurrentBtn.addEventListener('click', () => {
        const payload = readForm();
        if (!payload.name || !payload.subject || !payload.message) {
            showToast('Fill in the template before downloading.', 'error');
            return;
        }
        downloadTemplate(payload);
        showToast('Template downloaded.', 'success');
    });

    downloadAllBtn.addEventListener('click', () => {
        if (!loadTemplates().length) {
            showToast('No templates to download.', 'error');
            return;
        }
        downloadAllTemplates();
        showToast('All templates downloaded as JSON.', 'success');
    });

    importBtn.addEventListener('click', () => importFile.click());
    importFile.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            try {
                const added = importTemplates(JSON.parse(reader.result));
                renderList();
                showToast(`Imported ${added} template${added !== 1 ? 's' : ''}.`, 'success');
            } catch {
                showToast('That JSON file could not be imported.', 'error');
            }
        };
        reader.readAsText(file);
        e.target.value = '';
    });

    const editId = new URLSearchParams(window.location.search).get('id');
    if (editId) {
        const existing = getTemplate(editId);
        if (existing) loadTemplateIntoForm(existing);
    }

    renderList();
});
