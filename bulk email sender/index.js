class BulkMailerApp {
    constructor() {
        this.DOM = {
            form: document.getElementById('emailForm'),
            fromName: document.getElementById('fromName'),
            senderEmail: document.getElementById('senderEmail'),
            eventSelect: document.getElementById('eventSelect'),
            templateSelect: document.getElementById('templateSelect'),
            applyTemplateBtn: document.getElementById('applyTemplateBtn'),
            campaignLogoPreview: document.getElementById('campaignLogoPreview'),
            campaignLogoPreviewWrap: document.getElementById('campaignLogoPreviewWrap'),
            saveTemplateBtn: document.getElementById('saveTemplateBtn'),
            updateTemplateBtn: document.getElementById('updateTemplateBtn'),
            downloadTemplateBtn: document.getElementById('downloadTemplateBtn'),
            savePeopleBtn: document.getElementById('savePeopleBtn'),
            recipients: document.getElementById('recipients'),
            subject: document.getElementById('subject'),
            message: document.getElementById('message'),
            sendBtn: document.getElementById('sendBtn'),
            clearBtn: document.getElementById('clearBtn'),
            dropzone: document.getElementById('dropzone'),
            fileInput: document.getElementById('fileInput'),
            browseBtn: document.getElementById('browseBtn'),
            recipientCount: document.getElementById('recipientCount'),
            progressSection: document.getElementById('progressSection'),
            progressFill: document.getElementById('progressFill'),
            progressStatus: document.getElementById('progressStatus'),
            progressPercent: document.getElementById('progressPercent'),
            statSuccess: document.getElementById('statSuccess'),
            statFailed: document.getElementById('statFailed'),
            failedList: document.getElementById('failedList'),
            configStatus: document.getElementById('configStatus'),
            settingsLink: document.getElementById('settingsLink')
        };

        this.sending = false;
        this.init();
    }

    init() {
        if (window.location.protocol === 'file:') {
            showToast('Open this app through a local server, not as a file. EmailJS blocks file:// pages.', 'error');
        }
        this.loadCampaignFields();
        this.populateSelects();
        this.applyQueryParams();
        this.initEmailJS();
        this.bindEvents();
        this.updateRecipientCount();
        this.updateConfigStatus();
    }

    loadCampaignFields() {
        const saved = loadCampaignConfig();
        this.DOM.fromName.value = saved.fromName || DEFAULT_SENDER.fromName;
        this.DOM.senderEmail.value = saved.senderEmail || DEFAULT_SENDER.senderEmail;
    }

    persistCampaignFields() {
        saveCampaignConfig({
            fromName: this.DOM.fromName.value.trim(),
            senderEmail: this.DOM.senderEmail.value.trim()
        });
    }

    populateSelects() {
        const eventValue = this.DOM.eventSelect.value;
        const templateValue = this.DOM.templateSelect.value;

        this.DOM.eventSelect.innerHTML = '<option value="">One-off list (not saved to an event)</option>';
        loadEvents().forEach((event) => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = `${event.name} (${(event.emails || []).length})`;
            this.DOM.eventSelect.appendChild(option);
        });

        this.DOM.templateSelect.innerHTML = '<option value="">Write a new message</option>';
        loadTemplates().forEach((template) => {
            const option = document.createElement('option');
            option.value = template.id;
            option.textContent = template.name;
            this.DOM.templateSelect.appendChild(option);
        });

        if ([...this.DOM.eventSelect.options].some((opt) => opt.value === eventValue)) {
            this.DOM.eventSelect.value = eventValue;
        }
        if ([...this.DOM.templateSelect.options].some((opt) => opt.value === templateValue)) {
            this.DOM.templateSelect.value = templateValue;
        }
        enhanceSelect(this.DOM.eventSelect);
        enhanceSelect(this.DOM.templateSelect);
    }

    applyQueryParams() {
        const params = new URLSearchParams(window.location.search);
        const eventId = params.get('event');
        const templateId = params.get('template');

        if (eventId && getEvent(eventId)) {
            this.DOM.eventSelect.value = eventId;
            this.loadSelectedEvent();
        }
        if (templateId && getTemplate(templateId)) {
            this.DOM.templateSelect.value = templateId;
            this.applySelectedTemplate();
        }
    }

    selectedEvent() {
        return getEvent(this.DOM.eventSelect.value);
    }

    selectedTemplate() {
        return getTemplate(this.DOM.templateSelect.value);
    }

    templateVars() {
        const event = this.selectedEvent();
        return { event_name: event ? event.name : '' };
    }

    loadSelectedEvent() {
        const event = this.selectedEvent();
        if (!event) return;
        this.DOM.recipients.value = (event.emails || []).join('\n');
        this.updateRecipientCount();
        this.reapplyTemplateVars();
    }

    reapplyTemplateVars() {
        const template = this.selectedTemplate();
        if (!template) return;
        this.DOM.subject.value = applyTemplateVars(template.subject, this.templateVars());
        this.DOM.message.value = applyTemplateVars(template.message, this.templateVars());
    }

    applySelectedTemplate() {
        const template = this.selectedTemplate();
        if (!template) {
            showToast('Choose a template first.', 'error');
            return;
        }
        this.DOM.subject.value = applyTemplateVars(template.subject, this.templateVars());
        this.DOM.message.value = applyTemplateVars(template.message, this.templateVars());
        const logo = resolveLogo(template);
        if (this.DOM.campaignLogoPreviewWrap) {
            if (logo) {
                this.DOM.campaignLogoPreview.src = logo;
                this.DOM.campaignLogoPreviewWrap.classList.remove('hidden');
            } else {
                this.DOM.campaignLogoPreviewWrap.classList.add('hidden');
            }
        }
        showToast(`Applied “${template.name}”.`, 'success');
    }

    savePeopleToEvent() {
        const event = this.selectedEvent();
        if (!event) {
            showToast('Select an event first, or create one on the Events page.', 'error');
            return;
        }
        const emails = extractEmails(this.DOM.recipients.value);
        upsertEvent({
            id: event.id,
            name: event.name,
            description: event.description || '',
            emails
        });
        this.populateSelects();
        this.DOM.eventSelect.value = event.id;
        showToast(`Saved ${emails.length} people to “${event.name}”.`, 'success');
    }

    saveCurrentAsTemplate(updateExisting) {
        const subject = this.DOM.subject.value.trim();
        const message = this.DOM.message.value.trim();
        if (!subject || !message) {
            showToast('Subject and message are required to save a template.', 'error');
            return;
        }

        if (updateExisting) {
            const current = this.selectedTemplate();
            if (!current) {
                showToast('Select a template to update, or save as a new template.', 'error');
                return;
            }
            const saved = upsertTemplate({
                id: current.id,
                name: current.name,
                subject,
                message
            });
            this.populateSelects();
            this.DOM.templateSelect.value = saved.id;
            showToast(`Updated “${saved.name}”.`, 'success');
            return;
        }

        const name = window.prompt('Name this template:');
        if (!name || !name.trim()) return;
        const saved = upsertTemplate({ name: name.trim(), subject, message });
        this.populateSelects();
        this.DOM.templateSelect.value = saved.id;
        showToast(`Saved “${saved.name}”.`, 'success');
    }

    downloadCurrentTemplate() {
        const current = this.selectedTemplate();
        const payload = current || {
            name: this.DOM.subject.value.trim() || 'campaign-message',
            subject: this.DOM.subject.value.trim(),
            message: this.DOM.message.value.trim()
        };
        if (!payload.subject || !payload.message) {
            showToast('Add a subject and message before downloading.', 'error');
            return;
        }
        downloadTemplate(payload);
        showToast('Template downloaded.', 'success');
    }

    readSendFields() {
        const saved = loadCampaignConfig();
        return {
            publicKey: (saved.publicKey || '').trim(),
            serviceId: (saved.serviceId || '').trim(),
            templateId: (saved.templateId || '').trim(),
            fromName: this.DOM.fromName.value.trim(),
            senderEmail: this.DOM.senderEmail.value.trim()
        };
    }

    updateConfigStatus() {
        const ready = isEmailJsConfigured();
        if (this.DOM.configStatus) {
            this.DOM.configStatus.textContent = ready ? 'Configured' : 'Not configured';
            this.DOM.configStatus.classList.toggle('ok', ready);
        }
    }

    initEmailJS() {
        if (typeof emailjs === 'undefined') {
            showToast('EmailJS failed to load. Check your internet connection.', 'error');
            return false;
        }

        const { publicKey } = loadCampaignConfig();
        if (!publicKey || !isEmailJsConfigured()) {
            return false;
        }

        try {
            emailjs.init({ publicKey: publicKey.trim() });
            return true;
        } catch (err) {
            console.error(err);
            showToast('Could not initialize EmailJS. Check your Public Key in Settings.', 'error');
            return false;
        }
    }

    bindEvents() {
        this.DOM.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.DOM.clearBtn.addEventListener('click', () => this.clearForm());
        this.DOM.eventSelect.addEventListener('change', () => this.loadSelectedEvent());
        this.DOM.templateSelect.addEventListener('change', () => {
            if (this.DOM.templateSelect.value) this.applySelectedTemplate();
        });
        this.DOM.applyTemplateBtn.addEventListener('click', () => this.applySelectedTemplate());
        this.DOM.saveTemplateBtn.addEventListener('click', () => this.saveCurrentAsTemplate(false));
        this.DOM.updateTemplateBtn.addEventListener('click', () => this.saveCurrentAsTemplate(true));
        this.DOM.downloadTemplateBtn.addEventListener('click', () => this.downloadCurrentTemplate());
        this.DOM.savePeopleBtn.addEventListener('click', () => this.savePeopleToEvent());

        this.DOM.browseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.DOM.fileInput.click();
        });

        this.DOM.dropzone.addEventListener('click', (e) => {
            if (e.target.closest('#browseBtn')) return;
            this.DOM.fileInput.click();
        });

        this.DOM.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.processFile(e.target.files[0]);
                e.target.value = '';
            }
        });

        this.DOM.dropzone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.DOM.dropzone.addEventListener('dragleave', () => this.DOM.dropzone.classList.remove('dragover'));
        this.DOM.dropzone.addEventListener('drop', (e) => this.handleDrop(e));
        this.DOM.recipients.addEventListener('input', () => this.updateRecipientCount());
        this.DOM.senderEmail.addEventListener('change', () => this.persistCampaignFields());
        this.DOM.fromName.addEventListener('change', () => this.persistCampaignFields());
    }

    updateRecipientCount() {
        const emails = extractEmails(this.DOM.recipients.value);
        this.DOM.recipientCount.textContent = `${emails.length} valid email${emails.length !== 1 ? 's' : ''}`;
    }

    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    setLoading(isLoading) {
        this.sending = isLoading;
        const btnText = this.DOM.sendBtn.querySelector('.btn-text');
        const btnLoader = this.DOM.sendBtn.querySelector('.btn-loader');
        this.DOM.sendBtn.disabled = isLoading;
        btnText.classList.toggle('hidden', isLoading);
        btnLoader.classList.toggle('hidden', !isLoading);
    }

    resetProgress() {
        this.DOM.progressFill.style.width = '0%';
        this.DOM.progressPercent.textContent = '0%';
        this.DOM.progressStatus.textContent = 'Initializing...';
        this.DOM.statSuccess.textContent = '0';
        this.DOM.statFailed.textContent = '0';
        this.DOM.failedList.innerHTML = '';
        this.DOM.failedList.classList.add('hidden');
    }

    clearForm() {
        this.DOM.form.reset();
        this.loadCampaignFields();
        this.populateSelects();
        this.DOM.recipients.value = '';
        this.DOM.subject.value = '';
        this.DOM.message.value = '';
        this.updateRecipientCount();
        this.DOM.progressSection.classList.add('hidden');
        this.resetProgress();
        showToast('Form cleared', 'info');
    }

    handleDragOver(e) {
        e.preventDefault();
        this.DOM.dropzone.classList.add('dragover');
    }

    handleDrop(e) {
        e.preventDefault();
        this.DOM.dropzone.classList.remove('dragover');
        const file = e.dataTransfer.files[0];
        if (file) this.processFile(file);
    }

    processFile(file) {
        if (!file.name.match(/\.(csv|txt)$/i)) {
            showToast('Please upload a .csv or .txt file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const currentText = this.DOM.recipients.value;
            const combinedText = currentText ? `${currentText}\n${content}` : content;
            const cleanEmailsArray = extractEmails(combinedText);
            this.DOM.recipients.value = cleanEmailsArray.join('\n');
            this.updateRecipientCount();
            showToast(`Extracted ${cleanEmailsArray.length} valid emails from ${file.name}`, 'success');
        };
        reader.onerror = () => showToast('Could not read that file.', 'error');
        reader.readAsText(file);
    }

    emailjsErrorMessage(err) {
        if (!err) return 'Unknown EmailJS error';
        if (typeof err === 'string') return err;
        if (err.text) return err.text;
        if (err.message) return err.message;
        return JSON.stringify(err);
    }

    async handleSubmit(e) {
        e.preventDefault();
        if (this.sending) return;

        if (typeof emailjs === 'undefined') {
            showToast('EmailJS is not loaded. Refresh the page and try again.', 'error');
            return;
        }

        if (!isEmailJsConfigured() || !this.initEmailJS()) {
            if (hasBuiltInEmailJs()) {
                showToast('EmailJS keys in config.js could not be initialized. Check the Public Key.', 'error');
                return;
            }
            showToast('Open Settings and save your EmailJS keys first.', 'error');
            window.location.href = 'settings.html';
            return;
        }

        const { fromName, senderEmail } = this.readSendFields();
        const emails = extractEmails(this.DOM.recipients.value);
        const event = this.selectedEvent();
        const vars = this.templateVars();
        const subject = applyTemplateVars(this.DOM.subject.value.trim(), vars);
        const message = applyTemplateVars(this.DOM.message.value.trim(), vars);

        if (!fromName) {
            showToast('Please enter a sender name.', 'error');
            this.DOM.fromName.focus();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
            showToast('Please enter a valid sender (Reply-To) email.', 'error');
            this.DOM.senderEmail.focus();
            return;
        }

        if (emails.length === 0) {
            showToast('No valid recipient emails found. Please check your list.', 'error');
            return;
        }

        if (!subject || !message) {
            showToast('Subject and message are required.', 'error');
            return;
        }

        this.persistCampaignFields();
        const logoUrl = resolveSendableLogo(this.selectedTemplate());
        const previewLogo = resolveLogo(this.selectedTemplate());
        if (previewLogo && !logoUrl) {
            showToast('Uploaded logos cannot be emailed (EmailJS 50KB limit). The message will send without the image unless you add a public https logo URL.', 'info');
        }
        if (event) {
            upsertEvent({
                id: event.id,
                name: event.name,
                description: event.description || '',
                emails
            });
            this.populateSelects();
            this.DOM.eventSelect.value = event.id;
        }

        this.setLoading(true);
        this.resetProgress();
        this.DOM.progressSection.classList.remove('hidden');

        let success = 0;
        let failed = 0;
        const failedEmails = [];

        for (let i = 0; i < emails.length; i++) {
            const email = emails[i];
            const progress = ((i + 1) / emails.length) * 100;

            this.DOM.progressFill.style.width = `${progress}%`;
            this.DOM.progressPercent.textContent = `${Math.round(progress)}%`;
            this.DOM.progressStatus.textContent = `Sending to ${email}...`;

            try {
                await sendCampaignEmail(email, {
                    to_name: email,
                    from_name: fromName,
                    from_email: senderEmail,
                    reply_to: senderEmail,
                    subject,
                    message,
                    logo_url: logoUrl,
                    message_html: buildMessageHtml(message, logoUrl),
                    event_name: vars.event_name
                });
                success++;
                this.DOM.statSuccess.textContent = String(success);
            } catch (err) {
                console.error(`Failed to send to ${email}:`, err);
                failed++;
                const reason = this.emailjsErrorMessage(err);
                failedEmails.push(`${email} — ${reason}`);
                this.DOM.statFailed.textContent = String(failed);
                if (/50\s*kb|variables size/i.test(reason)) {
                    showToast('EmailJS rejected the send because the payload was over 50KB. Use a public logo URL instead of an uploaded image.', 'error');
                }
                if (/recipient/i.test(reason) || /to email/i.test(reason) || /empty/i.test(reason)) {
                    showToast('EmailJS To Email must be {{to_email}} so each person on the list receives the message. Open Settings for the steps.', 'error');
                }
            }

            if (i < emails.length - 1) await this.sleep(1500);
        }

        this.DOM.progressStatus.textContent = event
            ? `Campaign complete for ${event.name}`
            : 'Campaign complete';
        this.setLoading(false);

        addHistoryEntry({
            eventName: event ? event.name : 'One-off list',
            subject,
            recipients: emails,
            success,
            failed,
            failedDetails: failedEmails
        });

        if (failedEmails.length) {
            this.DOM.failedList.classList.remove('hidden');
            failedEmails.forEach((item) => {
                const li = document.createElement('li');
                li.textContent = item;
                this.DOM.failedList.appendChild(li);
            });
        }

        if (failed === 0) {
            showToast(`Successfully sent to ${success} recipient${success !== 1 ? 's' : ''}.`, 'success');
            if (emails.includes(senderEmail.toLowerCase())) {
                showToast('Mail to the same Gmail that sends usually shows in Sent or Spam, not Inbox. Check EmailJS Email History too.', 'info');
            }
        } else {
            showToast(`Finished. ${success} sent, ${failed} failed.`, 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BulkMailerApp();
});
