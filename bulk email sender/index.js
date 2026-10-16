class BulkMailerApp {
    constructor() {
        this.DOM = {
            form: document.getElementById('emailForm'),
            fromName: document.getElementById('fromName'),
            fromEmail: document.getElementById('fromEmail'),
            repliesEnabled: document.getElementById('repliesEnabled'),
            replyToSection: document.getElementById('replyToSection'),
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
            sendModeImmediate: document.getElementById('sendModeImmediate'),
            sendModeBatch: document.getElementById('sendModeBatch'),
            batchSettings: document.getElementById('batchSettings'),
            batchSize: document.getElementById('batchSize'),
            batchInterval: document.getElementById('batchInterval'),
            batchPreview: document.getElementById('batchPreview'),
            batchSizeHint: document.getElementById('batchSizeHint'),
            batchIntervalHint: document.getElementById('batchIntervalHint'),
            batchGroupsHeading: document.getElementById('batchGroupsHeading'),
            batchGroupCount: document.getElementById('batchGroupCount'),
            pauseBatchBtn: document.getElementById('pauseBatchBtn'),
            stopBatchBtn: document.getElementById('stopBatchBtn'),
            batchProgressActions: document.getElementById('batchProgressActions'),
            batchList: document.getElementById('batchList'),
            statBatchesWrap: document.getElementById('statBatchesWrap'),
            statBatches: document.getElementById('statBatches'),
            progressTrack: document.getElementById('progressTrack'),
            clearBtn: document.getElementById('clearBtn'),
            dropzone: document.getElementById('dropzone'),
            fileInput: document.getElementById('fileInput'),
            browseBtn: document.getElementById('browseBtn'),
            attachmentDropzone: document.getElementById('attachmentDropzone'),
            attachmentInput: document.getElementById('attachmentInput'),
            attachmentBrowseBtn: document.getElementById('attachmentBrowseBtn'),
            attachmentList: document.getElementById('attachmentList'),
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
        this.attachments = [];
        this.batchPaused = false;
        this.batchCancelled = false;
        this.campaignBatches = [];
        this.init();
    }

    async init() {
        if (window.location.protocol === 'file:') {
            showToast('Open this app through a local server, not as a file. EmailJS blocks file:// pages.', 'error');
        }
        this.loadCampaignFields();
        this.initEmailJS();
        this.bindEvents();
        this.updateRecipientCount();
        this.renderAttachments();
        this.updateConfigStatus();
        document.addEventListener('tha-library-changed', () => {
            this.populateSelects();
            this.loadCampaignFieldsIfIdle();
        });
        if (typeof whenSharedLibraryReady === 'function') {
            await whenSharedLibraryReady();
        }
        this.populateSelects();
        this.applyQueryParams();
        this.loadCampaignFieldsIfIdle();
    }

    loadCampaignFieldsIfIdle() {
        const active = document.activeElement;
        const editing = active && (
            active === this.DOM.fromName ||
            active === this.DOM.fromEmail ||
            active === this.DOM.senderEmail ||
            active === this.DOM.repliesEnabled ||
            active === this.DOM.batchSize ||
            active === this.DOM.batchInterval
        );
        if (!editing) this.loadCampaignFields();
    }

    loadCampaignFields() {
        const saved = loadCampaignConfig();
        this.DOM.fromName.value = saved.fromName || DEFAULT_SENDER.fromName;
        this.DOM.fromEmail.value = saved.fromEmail || DEFAULT_SENDER.senderEmail;
        this.DOM.senderEmail.value = saved.senderEmail || saved.fromEmail || DEFAULT_SENDER.senderEmail;
        this.DOM.repliesEnabled.checked = saved.repliesEnabled !== false;
        if (saved.sendMode === 'batch' && this.DOM.sendModeBatch) {
            this.DOM.sendModeBatch.checked = true;
        } else if (this.DOM.sendModeImmediate) {
            this.DOM.sendModeImmediate.checked = true;
        }
        if (this.DOM.batchSize) {
            const size = Number(saved.batchSize);
            this.DOM.batchSize.value = Number.isFinite(size) && size >= 1
                ? String(Math.min(1000, Math.floor(size)))
                : String(DEFAULT_BATCH_SIZE);
        }
        if (this.DOM.batchInterval) {
            const minutes = Number(saved.batchIntervalMinutes);
            this.DOM.batchInterval.value = Number.isFinite(minutes) && minutes >= 1
                ? String(Math.min(120, Math.floor(minutes)))
                : String(DEFAULT_BATCH_INTERVAL_MINUTES);
        }
        this.syncReplyToField();
        this.syncSendMode();
    }

    persistCampaignFields() {
        saveCampaignConfig({
            fromName: this.DOM.fromName.value.trim(),
            fromEmail: this.DOM.fromEmail.value.trim(),
            senderEmail: this.DOM.senderEmail.value.trim(),
            repliesEnabled: this.DOM.repliesEnabled.checked,
            sendMode: this.batchModeEnabled() ? 'batch' : 'immediate',
            batchSize: this.readBatchSize(),
            batchIntervalMinutes: this.readBatchIntervalMinutes()
        });
    }

    repliesAreEnabled() {
        return this.DOM.repliesEnabled.checked;
    }

    syncReplyToField() {
        const enabled = this.repliesAreEnabled();
        this.DOM.replyToSection.classList.toggle('hidden', !enabled);
        this.DOM.senderEmail.required = enabled;
        this.DOM.senderEmail.disabled = !enabled;
    }

    campaignSender(fromName, fromEmail, senderEmail) {
        return resolveCampaignSender({
            repliesEnabled: this.repliesAreEnabled(),
            fromName,
            fromEmail,
            replyTo: senderEmail
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
        this.DOM.recipients.value = formatPeopleList(event.people || event.emails || []);
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
        const people = parseRecipients(this.DOM.recipients.value);
        upsertEvent({
            id: event.id,
            name: event.name,
            description: event.description || '',
            people,
            emails: people.map((person) => person.email)
        });
        this.populateSelects();
        this.DOM.eventSelect.value = event.id;
        showToast(`Saved ${people.length} people to “${event.name}”.`, 'success');
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
            fromEmail: this.DOM.fromEmail.value.trim(),
            senderEmail: this.DOM.senderEmail.value.trim(),
            repliesEnabled: this.repliesAreEnabled()
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
        this.bindAttachmentEvents();
        this.DOM.senderEmail.addEventListener('change', () => this.persistCampaignFields());
        this.DOM.fromEmail.addEventListener('change', () => this.persistCampaignFields());
        this.DOM.fromName.addEventListener('change', () => this.persistCampaignFields());
        this.DOM.repliesEnabled.addEventListener('change', () => {
            this.syncReplyToField();
            this.persistCampaignFields();
        });
        [this.DOM.sendModeImmediate, this.DOM.sendModeBatch].forEach((input) => {
            if (!input) return;
            input.addEventListener('change', () => {
                this.syncSendMode();
                this.persistCampaignFields();
            });
        });
        if (this.DOM.batchSize) {
            this.DOM.batchSize.addEventListener('input', () => this.updateBatchPreview());
            this.DOM.batchSize.addEventListener('change', () => {
                this.fillBatchDefaults();
                this.persistCampaignFields();
                this.updateBatchPreview();
            });
            this.DOM.batchSize.addEventListener('blur', () => this.fillBatchDefaults());
        }
        if (this.DOM.batchInterval) {
            this.DOM.batchInterval.addEventListener('input', () => this.updateBatchPreview({ regroup: false }));
            this.DOM.batchInterval.addEventListener('change', () => {
                this.fillBatchDefaults();
                this.persistCampaignFields();
                this.updateBatchPreview({ regroup: false });
            });
            this.DOM.batchInterval.addEventListener('blur', () => this.fillBatchDefaults());
        }
        if (this.DOM.pauseBatchBtn) {
            this.DOM.pauseBatchBtn.addEventListener('click', () => this.toggleBatchPause());
        }
        if (this.DOM.stopBatchBtn) {
            this.DOM.stopBatchBtn.addEventListener('click', () => {
                this.batchCancelled = true;
                this.batchPaused = false;
                this.DOM.progressStatus.textContent = 'Stopping after the current email…';
            });
        }
        window.addEventListener('beforeunload', (event) => {
            if (!this.sending) return;
            event.preventDefault();
            event.returnValue = '';
        });
    }

    updateRecipientCount() {
        const people = parseRecipients(this.DOM.recipients.value);
        const named = people.filter((person) => person.name).length;
        this.DOM.recipientCount.textContent = named
            ? `${people.length} recipient${people.length !== 1 ? 's' : ''} (${named} named)`
            : `${people.length} valid email${people.length !== 1 ? 's' : ''}`;
        this.fillBatchDefaults();
        this.updateBatchPreview();
    }

    batchModeEnabled() {
        return Boolean(this.DOM.sendModeBatch && this.DOM.sendModeBatch.checked);
    }

    fillBatchDefaults() {
        if (this.sending) return;
        if (this.DOM.batchSize && !String(this.DOM.batchSize.value || '').trim()) {
            this.DOM.batchSize.value = String(DEFAULT_BATCH_SIZE);
        }
        if (this.DOM.batchInterval && !String(this.DOM.batchInterval.value || '').trim()) {
            this.DOM.batchInterval.value = String(DEFAULT_BATCH_INTERVAL_MINUTES);
        }
    }

    readBatchSize() {
        const value = Number(this.DOM.batchSize && this.DOM.batchSize.value);
        if (!Number.isFinite(value) || value < 1) return DEFAULT_BATCH_SIZE;
        return Math.min(1000, Math.floor(value));
    }

    readBatchIntervalMinutes() {
        const value = Number(this.DOM.batchInterval && this.DOM.batchInterval.value);
        if (!Number.isFinite(value) || value < 1) return DEFAULT_BATCH_INTERVAL_MINUTES;
        return Math.min(120, Math.floor(value));
    }

    syncSendMode() {
        const batch = this.batchModeEnabled();
        if (this.DOM.batchSettings) {
            this.DOM.batchSettings.classList.toggle('hidden', !batch);
        }
        if (this.DOM.batchSize) {
            this.DOM.batchSize.required = false;
            this.DOM.batchSize.readOnly = false;
            this.DOM.batchSize.disabled = this.sending;
        }
        if (this.DOM.batchInterval) {
            this.DOM.batchInterval.required = false;
            this.DOM.batchInterval.readOnly = false;
            this.DOM.batchInterval.disabled = this.sending;
        }
        this.fillBatchDefaults();
        this.updateBatchPreview();
    }

    plannedBatches(people = parseRecipients(this.DOM.recipients.value), size = this.readBatchSize()) {
        return chunkList(people, size).map((group, index) => ({
            number: index + 1,
            status: 'pending',
            recipients: group.map((person) => ({
                email: person.email,
                name: person.name || '',
                status: 'pending',
                reason: ''
            }))
        }));
    }

    updateBatchPreview({ regroup = true } = {}) {
        if (!this.DOM.batchPreview) return;

        const people = parseRecipients(this.DOM.recipients.value);
        const emails = people.map((person) => person.email);
        const size = this.readBatchSize();
        const interval = this.readBatchIntervalMinutes();
        const batchCount = emails.length ? Math.ceil(emails.length / size) : 0;
        const waitCount = Math.max(0, batchCount - 1);
        const waitLabel = waitCount
            ? ` About ${waitCount * interval} minute${waitCount * interval !== 1 ? 's' : ''} of waiting between batches.`
            : '';
        const quotaNote = emails.length > EMAILJS_FREE_MONTHLY_REQUESTS
            ? ` This list is larger than the EmailJS Free monthly cap of ${EMAILJS_FREE_MONTHLY_REQUESTS} requests.`
            : ` EmailJS Free allows ${EMAILJS_FREE_MONTHLY_REQUESTS} requests per month.`;

        if (!this.batchModeEnabled()) {
            if (!this.sending) {
                this.campaignBatches = [];
                this.renderBatchList();
            }
            return;
        }

        if (!emails.length) {
            this.DOM.batchPreview.textContent = `Add recipients, then set emails per batch. Addresses are grouped automatically into Batch 1, Batch 2, and so on. After a batch is sent, the next starts in ${interval} minute${interval !== 1 ? 's' : ''}.${quotaNote}`;
            if (this.DOM.batchSizeHint) {
                this.DOM.batchSizeHint.textContent = `This is how many addresses go in each batch. It fills in after you add recipients. Default is ${DEFAULT_BATCH_SIZE}.`;
            }
            if (this.DOM.batchIntervalHint) {
                this.DOM.batchIntervalHint.textContent = `Wait this many minutes after a batch is sent before the next one starts. You can change this anytime before launch.`;
            }
            if (!this.sending) {
                this.campaignBatches = [];
                this.renderBatchList();
            }
            return;
        }

        this.DOM.batchPreview.textContent = `${emails.length} recipient${emails.length !== 1 ? 's' : ''} grouped into ${batchCount} batch${batchCount !== 1 ? 'es' : ''} of up to ${size}.${waitLabel} Keep this tab open until every batch is marked done.${quotaNote}`;

        if (this.DOM.batchSizeHint) {
            const remainder = emails.length % size;
            const lastCount = remainder === 0 ? size : remainder;
            this.DOM.batchSizeHint.textContent = batchCount === 1
                ? `This list fits in 1 batch of ${emails.length} email${emails.length !== 1 ? 's' : ''}. Change the number above to split it further.`
                : `Each full batch has ${size} emails. The last batch has ${lastCount}.`;
        }
        if (this.DOM.batchIntervalHint) {
            this.DOM.batchIntervalHint.textContent = `After a batch is sent, wait ${interval} minute${interval !== 1 ? 's' : ''} before the next batch. You can change this number.`;
        }

        if (!this.sending && regroup) {
            this.campaignBatches = this.plannedBatches(people, size);
            this.renderBatchList();
        }
    }

    formatWait(ms) {
        const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    }

    batchesDoneCount() {
        return this.campaignBatches.filter((batch) => batch.status === 'done').length;
    }

    updateOverallProgress(processed, total) {
        const safeTotal = Math.max(1, total);
        const percent = Math.min(100, Math.round((processed / safeTotal) * 100));
        this.DOM.progressFill.style.width = `${percent}%`;
        this.DOM.progressPercent.textContent = `${percent}%`;
        if (this.DOM.progressTrack) {
            this.DOM.progressTrack.setAttribute('aria-valuenow', String(percent));
        }
        if (this.DOM.statBatches) {
            this.DOM.statBatches.textContent = `${this.batchesDoneCount()}/${this.campaignBatches.length || 0}`;
        }
    }

    batchStatusLabel(status) {
        if (status === 'sending') return 'Sending';
        if (status === 'waiting') return 'Waiting';
        if (status === 'done') return 'Done';
        if (status === 'stopped') return 'Stopped';
        return 'Pending';
    }

    recipientStatusLabel(status) {
        if (status === 'sent') return 'Sent';
        if (status === 'failed') return 'Failed';
        if (status === 'sending') return 'Sending';
        return 'Pending';
    }

    renderBatchList() {
        if (!this.DOM.batchList) return;
        const hadCards = this.DOM.batchList.querySelectorAll('details.batch-card').length > 0;
        const previouslyOpen = new Set();
        this.DOM.batchList.querySelectorAll('details.batch-card').forEach((card, index) => {
            if (card.open && this.campaignBatches[index]) {
                previouslyOpen.add(this.campaignBatches[index].number);
            }
        });

        this.DOM.batchList.innerHTML = '';
        if (!this.campaignBatches.length) {
            this.DOM.batchList.classList.add('hidden');
            if (this.DOM.batchGroupsHeading) this.DOM.batchGroupsHeading.classList.add('hidden');
            return;
        }

        this.DOM.batchList.classList.remove('hidden');
        if (this.DOM.batchGroupsHeading) this.DOM.batchGroupsHeading.classList.remove('hidden');
        if (this.DOM.batchGroupCount) {
            const count = this.campaignBatches.length;
            this.DOM.batchGroupCount.textContent = `${count} batch${count !== 1 ? 'es' : ''}`;
        }
        this.campaignBatches.forEach((batch) => {
            const card = document.createElement('details');
            card.className = 'batch-card';
            const openFirstPreview = !this.sending && !hadCards && batch.number === 1;
            if (batch.status === 'sending' || batch.status === 'waiting' || previouslyOpen.has(batch.number) || openFirstPreview) {
                card.open = true;
            }

            const summary = document.createElement('summary');
            const title = document.createElement('span');
            const doneInBatch = batch.recipients.filter((item) => item.status === 'sent' || item.status === 'failed').length;
            title.textContent = `Batch ${batch.number}`;
            const meta = document.createElement('span');
            meta.className = 'batch-card-meta';
            meta.textContent = doneInBatch
                ? `${doneInBatch}/${batch.recipients.length} emails`
                : `${batch.recipients.length} email${batch.recipients.length !== 1 ? 's' : ''}`;
            const badge = document.createElement('span');
            badge.className = `batch-status ${batch.status}`;
            badge.textContent = this.batchStatusLabel(batch.status);
            summary.append(title, meta, badge);

            const list = document.createElement('ul');
            list.className = 'batch-emails';
            batch.recipients.forEach((item) => {
                const row = document.createElement('li');
                row.className = 'batch-email-row';
                const address = document.createElement('span');
                address.className = 'email';
                address.textContent = item.name ? `${item.name} <${item.email}>` : item.email;
                const status = document.createElement('span');
                status.className = `status-badge ${item.status === 'sent' ? 'sent' : item.status === 'failed' ? 'failed' : 'unknown'}`;
                status.textContent = this.recipientStatusLabel(item.status);
                row.append(address, status);
                if (item.reason) {
                    const reason = document.createElement('span');
                    reason.className = 'recipient-reason';
                    reason.textContent = item.reason;
                    row.append(reason);
                }
                list.appendChild(row);
            });

            card.append(summary, list);
            this.DOM.batchList.appendChild(card);
        });
    }

    toggleBatchPause() {
        if (!this.sending || !this.batchModeEnabled()) return;
        this.batchPaused = !this.batchPaused;
        if (this.DOM.pauseBatchBtn) {
            this.DOM.pauseBatchBtn.textContent = this.batchPaused ? 'Resume' : 'Pause';
        }
        this.DOM.progressStatus.textContent = this.batchPaused
            ? 'Paused. Resume to continue remaining batches.'
            : 'Resuming…';
    }

    async waitWhilePaused() {
        while (this.batchPaused && !this.batchCancelled) {
            this.DOM.progressStatus.textContent = 'Paused. Resume to continue remaining batches.';
            await this.sleep(250);
        }
    }

    async waitBetweenBatches(ms, nextBatchNumber) {
        const end = Date.now() + ms;
        while (Date.now() < end) {
            if (this.batchCancelled) return;
            await this.waitWhilePaused();
            if (this.batchCancelled) return;
            const left = end - Date.now();
            if (left <= 0) break;
            this.DOM.progressStatus.textContent = `Batch done. Next batch (${nextBatchNumber}) in ${this.formatWait(left)}. Keep this tab open.`;
            await this.sleep(Math.min(250, left));
        }
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
        if (this.DOM.batchSize) this.DOM.batchSize.disabled = isLoading;
        if (this.DOM.batchInterval) this.DOM.batchInterval.disabled = isLoading;
        if (this.DOM.sendModeImmediate) this.DOM.sendModeImmediate.disabled = isLoading;
        if (this.DOM.sendModeBatch) this.DOM.sendModeBatch.disabled = isLoading;
        this.DOM.recipients.disabled = isLoading;
    }

    resetProgress() {
        this.batchPaused = false;
        this.batchCancelled = false;
        this.DOM.progressFill.style.width = '0%';
        this.DOM.progressPercent.textContent = '0%';
        this.DOM.progressStatus.textContent = 'Initializing...';
        this.DOM.statSuccess.textContent = '0';
        this.DOM.statFailed.textContent = '0';
        if (this.DOM.statBatches) this.DOM.statBatches.textContent = '0/0';
        if (this.DOM.progressTrack) this.DOM.progressTrack.setAttribute('aria-valuenow', '0');
        this.DOM.failedList.innerHTML = '';
        this.DOM.failedList.classList.add('hidden');
        if (this.DOM.statBatchesWrap) this.DOM.statBatchesWrap.classList.add('hidden');
        if (this.DOM.batchProgressActions) this.DOM.batchProgressActions.classList.add('hidden');
        if (this.DOM.pauseBatchBtn) this.DOM.pauseBatchBtn.textContent = 'Pause';
    }

    clearForm() {
        this.DOM.form.reset();
        this.loadCampaignFields();
        this.populateSelects();
        this.DOM.recipients.value = '';
        this.DOM.subject.value = '';
        this.DOM.message.value = '';
        this.attachments = [];
        this.renderAttachments();
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

    async processFile(file) {
        try {
            const result = await extractEmailsFromUpload(file);
            const people = uniquePeople([
                ...parseRecipients(this.DOM.recipients.value),
                ...(result.people || result.emails.map((email) => ({ name: '', email })))
            ]);
            this.DOM.recipients.value = formatPeopleList(people);
            this.fillBatchDefaults();
            this.updateRecipientCount();
            if (!people.length) {
                showToast(`No email addresses were found in ${file.name}. Use Name and Email columns.`, 'error');
                return;
            }
            const named = people.filter((person) => person.name).length;
            const via = result.columnLabel ? ` from “${result.columnLabel}”` : '';
            showToast(
                `Loaded ${result.emails.length} recipient${result.emails.length !== 1 ? 's' : ''}${via} in ${file.name}${named ? ` (${named} with names)` : ''}.`,
                'success'
            );
        } catch (err) {
            showToast(err && err.message ? err.message : 'Could not read that file.', 'error');
        }
    }

    bindAttachmentEvents() {
        if (!this.DOM.attachmentDropzone || !this.DOM.attachmentInput) return;

        this.DOM.attachmentBrowseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.DOM.attachmentInput.click();
        });

        this.DOM.attachmentDropzone.addEventListener('click', (e) => {
            if (e.target.closest('#attachmentBrowseBtn')) return;
            this.DOM.attachmentInput.click();
        });

        this.DOM.attachmentInput.addEventListener('change', (e) => {
            this.addAttachments(e.target.files);
            e.target.value = '';
        });

        this.DOM.attachmentDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            this.DOM.attachmentDropzone.classList.add('dragover');
        });
        this.DOM.attachmentDropzone.addEventListener('dragleave', () => {
            this.DOM.attachmentDropzone.classList.remove('dragover');
        });
        this.DOM.attachmentDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            this.DOM.attachmentDropzone.classList.remove('dragover');
            this.addAttachments(e.dataTransfer.files);
        });
    }

    formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    addAttachments(fileList) {
        const incoming = [...(fileList || [])];
        if (!incoming.length) return;

        const maxFiles = typeof EMAILJS_MAX_ATTACHMENTS === 'number' ? EMAILJS_MAX_ATTACHMENTS : 5;
        const maxBytes = typeof EMAILJS_ATTACHMENT_MAX_BYTES === 'number'
            ? EMAILJS_ATTACHMENT_MAX_BYTES
            : 500 * 1024;
        let added = 0;

        incoming.forEach((file) => {
            if (this.attachments.length >= maxFiles) return;
            const duplicate = this.attachments.some((item) => (
                item.name === file.name && item.size === file.size && item.lastModified === file.lastModified
            ));
            if (duplicate) return;
            if (file.size > maxBytes) {
                showToast(`${file.name} is larger than 500 KB. EmailJS will drop bigger files from the inbox.`, 'error');
                return;
            }
            this.attachments.push(file);
            added += 1;
        });

        if (incoming.length && this.attachments.length >= maxFiles && added === 0) {
            showToast('You can attach up to 5 files.', 'error');
        } else if (added) {
            showToast(added === 1 ? 'Attachment added.' : `${added} attachments added.`, 'success');
        }
        this.renderAttachments();
    }

    removeAttachment(index) {
        this.attachments.splice(index, 1);
        this.renderAttachments();
    }

    renderAttachments() {
        if (!this.DOM.attachmentList) return;
        this.DOM.attachmentList.innerHTML = '';
        if (!this.attachments.length) {
            const empty = document.createElement('li');
            empty.className = 'field-hint';
            empty.textContent = 'No files attached.';
            this.DOM.attachmentList.appendChild(empty);
            return;
        }

        this.attachments.forEach((file, index) => {
            const item = document.createElement('li');
            item.className = 'attachment-item';
            const name = document.createElement('span');
            name.className = 'attachment-name';
            name.textContent = `${file.name} (${this.formatFileSize(file.size)})`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'btn-secondary btn-small';
            remove.textContent = 'Remove';
            remove.addEventListener('click', () => this.removeAttachment(index));
            item.append(name, remove);
            this.DOM.attachmentList.appendChild(item);
        });
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

        const { fromName, fromEmail, senderEmail, repliesEnabled } = this.readSendFields();
        const sender = this.campaignSender(fromName, fromEmail, senderEmail);
        const people = parseRecipients(this.DOM.recipients.value);
        const emails = people.map((person) => person.email);
        const event = this.selectedEvent();
        const vars = this.templateVars();
        const composed = applyNoReplyInboxCues(
            repliesEnabled,
            applyTemplateVars(this.DOM.subject.value.trim(), vars),
            applyTemplateVars(this.DOM.message.value.trim(), vars)
        );
        const subject = composed.subject;
        const message = composed.message;

        if (!fromName) {
            showToast('Please enter a sender name.', 'error');
            this.DOM.fromName.focus();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) {
            showToast('Please enter a valid From email.', 'error');
            this.DOM.fromEmail.focus();
            return;
        }

        if (!repliesEnabled) {
            showToast('No-reply mail uses a NoReply: subject and an inbox preview that the mailbox is not monitored.', 'info');
        } else if (fromEmail.toLowerCase() !== DEFAULT_SENDER.senderEmail.toLowerCase()) {
            showToast('From will stay events@ until EmailJS From Email is {{from_email}} and Use Default is unchecked.', 'info');
        }

        if (repliesEnabled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
            showToast('Please enter a valid Reply-To email.', 'error');
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

        this.fillBatchDefaults();
        const batchMode = this.batchModeEnabled();
        const batchSize = this.readBatchSize();
        const batchIntervalMinutes = this.readBatchIntervalMinutes();

        if (emails.length > EMAILJS_FREE_MONTHLY_REQUESTS) {
            const proceed = window.confirm(
                `EmailJS Free allows ${EMAILJS_FREE_MONTHLY_REQUESTS} requests per month. This list has ${emails.length} recipients, so extra sends will be ignored after the quota. Continue anyway?`
            );
            if (!proceed) return;
        }

        this.persistCampaignFields();
        const logoUrl = await resolveSendableLogo(this.selectedTemplate());
        if (!logoUrl) {
            showToast('No logo could be attached. Add a compact image or a public https URL on Templates.', 'info');
        }
        if (event) {
            upsertEvent({
                id: event.id,
                name: event.name,
                description: event.description || '',
                people,
                emails
            });
            this.populateSelects();
            this.DOM.eventSelect.value = event.id;
        }

        const payload = {
            from_name: sender.from_name,
            from_email: sender.from_email,
            reply_to: sender.reply_to,
            subject,
            message,
            logo_url: logoUrl,
            message_html: buildMessageHtml(message, logoUrl),
            event_name: vars.event_name,
            files: this.attachments,
            attachment_names: this.attachments.map((file) => file.name)
        };
        if (this.attachments.length) {
            showToast(`Sending ${this.attachments.length} attachment${this.attachments.length !== 1 ? 's' : ''}. EmailJS Free accounts deliver the mail without files.`, 'info');
        }

        try {
            recipientTemplateParams(emails[0], {
                ...payload,
                message_html: buildMessageHtml(message, logoUrl)
            });
        } catch (err) {
            showToast((err && err.message) || 'This message is too large for EmailJS.', 'error');
            return;
        }
        if (typeof lastEmailjsFitNotice === 'function' && lastEmailjsFitNotice()) {
            showToast(lastEmailjsFitNotice(), 'info');
        } else if (logoUrl && !isPublicLogoUrl(logoUrl) && isCompactLogoDataUrl(logoUrl)) {
            showToast('Logo included. In EmailJS, Content must be {{{message_html}}} (three braces) or the image will not show.', 'info');
        }

        this.setLoading(true);
        this.resetProgress();
        this.DOM.progressSection.classList.remove('hidden');

        const trackOpens = typeof isOpenTrackingConfigured === 'function' && isOpenTrackingConfigured();
        const groups = batchMode ? this.plannedBatches(people, batchSize) : [{
            number: 1,
            status: 'pending',
            recipients: people.map((person) => ({
                email: person.email,
                name: person.name || '',
                status: 'pending',
                reason: ''
            }))
        }];
        if (trackOpens) {
            groups.forEach((batch) => {
                batch.recipients.forEach((item) => {
                    item.openToken = newId();
                });
            });
        }
        this.campaignBatches = groups;
        this.renderBatchList();

        if (this.DOM.pauseBatchBtn) this.DOM.pauseBatchBtn.classList.toggle('hidden', !batchMode);
        if (this.DOM.batchProgressActions) this.DOM.batchProgressActions.classList.remove('hidden');
        if (batchMode) {
            if (this.DOM.statBatchesWrap) this.DOM.statBatchesWrap.classList.remove('hidden');
            showToast(`Sending ${this.campaignBatches.length} batch${this.campaignBatches.length !== 1 ? 'es' : ''}. Keep this tab open.`, 'info');
        } else if (emails.length > 1) {
            showToast(`Sending ${emails.length} emails with a short pause between each so inboxes are more likely to keep them. Keep this tab open.`, 'info');
        }

        let result = null;
        try {
            result = await this.runCampaign(payload, {
                batchMode,
                batchIntervalMinutes
            });
        } catch (err) {
            console.error(err);
            result = this.campaignResultFromState();
            showToast('The campaign stopped early. Messages that already went out were saved.', 'error');
        } finally {
            this.setLoading(false);
            if (this.DOM.batchProgressActions) this.DOM.batchProgressActions.classList.add('hidden');
        }

        const stopped = this.batchCancelled;

        const remaining = this.campaignBatches.reduce((count, batch) => (
            count + batch.recipients.filter((item) => item.status === 'pending' || item.status === 'sending').length
        ), 0);

        this.DOM.progressStatus.textContent = stopped
            ? (event ? `Campaign stopped for ${event.name}` : 'Campaign stopped')
            : (event ? `Campaign complete for ${event.name}` : 'Campaign complete');

        addHistoryEntry({
            eventName: event ? event.name : 'One-off list',
            subject,
            message,
            fromName: sender.from_name,
            fromEmail: sender.from_email,
            replyTo: sender.reply_to,
            logoUrl,
            attachmentNames: this.attachments.map((file) => file.name),
            recipients: emails,
            succeededEmails: result.succeededEmails,
            recipientOpens: this.recipientOpensFromCampaign(result.succeededEmails),
            failedEmails: result.failedEmails,
            success: result.success,
            failed: result.failed,
            failedDetails: result.failedDetails,
            sendMode: batchMode ? 'batch' : 'immediate',
            batchSize: batchMode ? batchSize : emails.length,
            batchCount: this.campaignBatches.length,
            batchesDone: this.batchesDoneCount(),
            stopped
        });

        if (result.failedDetails.length) {
            this.DOM.failedList.classList.remove('hidden');
            result.failedDetails.forEach((item) => {
                const li = document.createElement('li');
                li.textContent = item;
                this.DOM.failedList.appendChild(li);
            });
        }

        if (stopped) {
            showToast(`Stopped. ${result.success} sent, ${result.failed} failed, ${remaining} not sent.`, 'info');
        } else if (result.failed === 0) {
            showToast(`The mail service accepted all ${result.success} message${result.success !== 1 ? 's' : ''}.`, 'success');
            showToast('If someone cannot find it, ask them to check Spam and Promotions, or search from:techhubafrica.org. cPanel Track Delivery shows whether their server accepted it.', 'info');
            if (trackOpens) {
                showToast('Open tracking is on. History will show who opened the email.', 'info');
            }
        } else {
            showToast(`Finished. ${result.success} sent, ${result.failed} failed.`, 'error');
        }
    }

    noteEmailjsFailure(reason) {
        if (/50\s*kb|variables size/i.test(reason)) {
            showToast('EmailJS rejected the send because the payload was over 50KB. Use a public logo URL instead of an uploaded image.', 'error');
        }
        if (/attachment/i.test(reason) && this.attachments.length) {
            showToast('EmailJS could not send the attachment. Use a paid plan and add Form File Attachment fields named attachment, attachment_2, and so on.', 'error');
        }
        if (/recipient/i.test(reason) || /to email/i.test(reason) || /empty/i.test(reason)) {
            showToast('EmailJS To Email must be {{to_email}} so each person on the list receives the message. Open Settings for the steps.', 'error');
        }
    }

    async runCampaign(payload, { batchMode, batchIntervalMinutes }) {
        let success = 0;
        let failed = 0;
        let processed = 0;
        const succeededEmails = [];
        const failedEmails = [];
        const failedDetails = [];
        const total = this.campaignBatches.reduce((sum, batch) => sum + batch.recipients.length, 0);
        this.updateOverallProgress(0, total);

        for (let batchIndex = 0; batchIndex < this.campaignBatches.length; batchIndex++) {
            if (this.batchCancelled) {
                this.campaignBatches.slice(batchIndex).forEach((batch) => {
                    if (batch.status !== 'done') batch.status = 'stopped';
                });
                this.renderBatchList();
                break;
            }

            await this.waitWhilePaused();
            if (this.batchCancelled) {
                this.campaignBatches.slice(batchIndex).forEach((batch) => {
                    if (batch.status !== 'done') batch.status = 'stopped';
                });
                this.renderBatchList();
                break;
            }

            const batch = this.campaignBatches[batchIndex];
            batch.status = 'sending';
            this.renderBatchList();

            for (let i = 0; i < batch.recipients.length; i++) {
                if (this.batchCancelled) {
                    batch.status = 'stopped';
                    this.campaignBatches.slice(batchIndex + 1).forEach((item) => {
                        item.status = 'stopped';
                    });
                    this.renderBatchList();
                    return { success, failed, succeededEmails, failedEmails, failedDetails };
                }

                await this.waitWhilePaused();
                if (this.batchCancelled) {
                    batch.status = 'stopped';
                    this.campaignBatches.slice(batchIndex + 1).forEach((item) => {
                        item.status = 'stopped';
                    });
                    this.renderBatchList();
                    return { success, failed, succeededEmails, failedEmails, failedDetails };
                }

                const recipient = batch.recipients[i];
                recipient.status = 'sending';
                const recipientLabel = recipient.name || recipient.email;
                const position = processed + 1;
                this.DOM.progressStatus.textContent = batchMode
                    ? `Batch ${batch.number}/${this.campaignBatches.length}: sending ${position} of ${total} (${recipientLabel})…`
                    : `Sending ${position} of ${total} to ${recipientLabel}…`;
                this.renderBatchList();

                try {
                    const pixelUrl = recipient.openToken
                        ? openPixelUrlForToken(recipient.openToken)
                        : '';
                    const personalized = personalizeCampaignCopy(payload.subject, payload.message, recipient);
                    await sendCampaignEmail(recipient.email, {
                        ...payload,
                        subject: personalized.subject,
                        message: personalized.message,
                        to_name: recipient.name || recipient.email,
                        open_pixel_url: pixelUrl,
                        message_html: buildMessageHtml(personalized.message, payload.logo_url, pixelUrl)
                    }, {
                        onRetry: (attempt, maxAttempts) => {
                            this.DOM.progressStatus.textContent = `Mail service is busy. Retrying ${position} of ${total} (${recipientLabel}), attempt ${attempt + 1} of ${maxAttempts}…`;
                        }
                    });
                    recipient.status = 'sent';
                    success += 1;
                    succeededEmails.push(recipient.email);
                    this.DOM.statSuccess.textContent = String(success);
                } catch (err) {
                    console.error(`Failed to send to ${recipient.email}:`, err);
                    const reason = this.emailjsErrorMessage(err);
                    recipient.status = 'failed';
                    recipient.reason = reason;
                    failed += 1;
                    failedEmails.push(recipient.email);
                    failedDetails.push(`${recipient.email} — ${reason}`);
                    this.DOM.statFailed.textContent = String(failed);
                    this.noteEmailjsFailure(reason);
                }

                processed += 1;
                this.updateOverallProgress(processed, total);
                this.renderBatchList();

                const pauseEvery = typeof EMAILJS_INBOX_PAUSE_EVERY === 'number' ? EMAILJS_INBOX_PAUSE_EVERY : 10;
                const pauseMs = typeof EMAILJS_INBOX_PAUSE_MS === 'number' ? EMAILJS_INBOX_PAUSE_MS : 12000;
                if (!this.batchCancelled && processed < total && success > 0 && success % pauseEvery === 0) {
                    this.DOM.progressStatus.textContent = 'Pausing so the next inboxes are more likely to accept the message…';
                    await this.sleep(pauseMs);
                }
            }

            if (!this.batchCancelled) {
                batch.status = 'done';
                this.updateOverallProgress(processed, total);
                this.renderBatchList();
            }

            if (batchMode && batchIndex < this.campaignBatches.length - 1 && !this.batchCancelled) {
                this.campaignBatches[batchIndex + 1].status = 'waiting';
                this.renderBatchList();
                await this.waitBetweenBatches(batchIntervalMinutes * 60 * 1000, batchIndex + 2);
            }
        }

        return { success, failed, succeededEmails, failedEmails, failedDetails };
    }

    campaignResultFromState() {
        const succeededEmails = [];
        const failedEmails = [];
        const failedDetails = [];
        this.campaignBatches.forEach((batch) => {
            (batch.recipients || []).forEach((item) => {
                if (item.status === 'sent') succeededEmails.push(item.email);
                if (item.status === 'failed') {
                    failedEmails.push(item.email);
                    failedDetails.push(`${item.email} — ${item.reason || 'Failed'}`);
                }
            });
        });
        return {
            success: succeededEmails.length,
            failed: failedEmails.length,
            succeededEmails,
            failedEmails,
            failedDetails
        };
    }

    recipientOpensFromCampaign(succeededEmails) {
        const allowed = new Set((succeededEmails || []).map((email) => String(email).toLowerCase().trim()));
        const recipientOpens = {};
        this.campaignBatches.forEach((batch) => {
            (batch.recipients || []).forEach((item) => {
                const email = String(item.email || '').toLowerCase().trim();
                if (!email || !item.openToken || !allowed.has(email)) return;
                recipientOpens[email] = {
                    token: item.openToken,
                    openedAt: null,
                    lastOpenedAt: null,
                    openCount: 0
                };
            });
        });
        return recipientOpens;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BulkMailerApp();
});
