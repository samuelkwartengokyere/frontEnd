class BulkMailerApp {
    constructor() {
        this.STORAGE_KEY = 'tha_campaign_studio_config';
        this.PLACEHOLDER_KEYS = new Set(['YOUR_PUBLIC_KEY', 'YOUR_SERVICE_ID', 'YOUR_TEMPLATE_ID', '']);

        this.DOM = {
            form: document.getElementById('emailForm'),
            fromName: document.getElementById('fromName'),
            senderEmail: document.getElementById('senderEmail'),
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
            toastContainer: document.getElementById('toast-container'),
            setupPanel: document.getElementById('setupPanel'),
            configStatus: document.getElementById('configStatus'),
            emailjsPublicKey: document.getElementById('emailjsPublicKey'),
            emailjsServiceId: document.getElementById('emailjsServiceId'),
            emailjsTemplateId: document.getElementById('emailjsTemplateId'),
            saveConfigBtn: document.getElementById('saveConfigBtn')
        };

        this.emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        this.sending = false;

        this.init();
    }

    init() {
        this.loadConfig();
        this.initEmailJS();
        this.bindEvents();
        this.updateRecipientCount();
        this.updateConfigStatus();
    }

    loadConfig() {
        try {
            const saved = JSON.parse(localStorage.getItem(this.STORAGE_KEY) || '{}');
            this.DOM.emailjsPublicKey.value = saved.publicKey || '';
            this.DOM.emailjsServiceId.value = saved.serviceId || '';
            this.DOM.emailjsTemplateId.value = saved.templateId || '';
            this.DOM.fromName.value = saved.fromName || '';
            this.DOM.senderEmail.value = saved.senderEmail || '';
        } catch {
            localStorage.removeItem(this.STORAGE_KEY);
        }
    }

    persistCampaignFields() {
        const current = this.readConfig();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify({
            ...current,
            fromName: this.DOM.fromName.value.trim(),
            senderEmail: this.DOM.senderEmail.value.trim()
        }));
    }

    readConfig() {
        return {
            publicKey: this.DOM.emailjsPublicKey.value.trim(),
            serviceId: this.DOM.emailjsServiceId.value.trim(),
            templateId: this.DOM.emailjsTemplateId.value.trim(),
            fromName: this.DOM.fromName.value.trim(),
            senderEmail: this.DOM.senderEmail.value.trim()
        };
    }

    isConfigured() {
        const { publicKey, serviceId, templateId } = this.readConfig();
        return [publicKey, serviceId, templateId].every(
            (value) => value && !this.PLACEHOLDER_KEYS.has(value)
        );
    }

    updateConfigStatus() {
        const ready = this.isConfigured();
        this.DOM.configStatus.textContent = ready ? 'Configured' : 'Not configured';
        this.DOM.configStatus.classList.toggle('ok', ready);
        if (this.DOM.setupPanel) {
            this.DOM.setupPanel.open = !ready;
        }
    }

    initEmailJS() {
        if (typeof emailjs === 'undefined') {
            this.showToast('EmailJS failed to load. Check your internet connection.', 'error');
            return false;
        }

        const { publicKey } = this.readConfig();
        if (!publicKey || this.PLACEHOLDER_KEYS.has(publicKey)) {
            return false;
        }

        try {
            emailjs.init({ publicKey });
            return true;
        } catch (err) {
            console.error(err);
            this.showToast('Could not initialize EmailJS. Check your Public Key.', 'error');
            return false;
        }
    }

    saveConfig() {
        const config = this.readConfig();
        if (!config.publicKey || !config.serviceId || !config.templateId) {
            this.showToast('Enter Public Key, Service ID, and Template ID.', 'error');
            return;
        }

        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(config));
        const ok = this.initEmailJS();
        this.updateConfigStatus();
        if (ok) {
            this.showToast('EmailJS settings saved in this browser.', 'success');
        }
    }

    bindEvents() {
        this.DOM.form.addEventListener('submit', (e) => this.handleSubmit(e));
        this.DOM.clearBtn.addEventListener('click', () => this.clearForm());
        this.DOM.saveConfigBtn.addEventListener('click', () => this.saveConfig());

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

    getValidEmailArray(text) {
        const matches = String(text || '').match(this.emailRegex);
        if (!matches) return [];
        return [...new Set(matches.map((email) => email.toLowerCase().trim()))];
    }

    updateRecipientCount() {
        const emails = this.getValidEmailArray(this.DOM.recipients.value);
        this.DOM.recipientCount.textContent = `${emails.length} valid email${emails.length !== 1 ? 's' : ''}`;
    }

    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        const span = document.createElement('span');
        span.textContent = message;
        toast.appendChild(span);
        this.DOM.toastContainer.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideIn 0.3s reverse';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
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
        this.loadConfig();
        this.DOM.recipients.value = '';
        this.DOM.subject.value = '';
        this.DOM.message.value = '';
        this.updateRecipientCount();
        this.DOM.progressSection.classList.add('hidden');
        this.resetProgress();
        this.showToast('Form cleared', 'info');
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
            this.showToast('Please upload a .csv or .txt file', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            const currentText = this.DOM.recipients.value;
            const combinedText = currentText ? `${currentText}\n${content}` : content;
            const cleanEmailsArray = this.getValidEmailArray(combinedText);
            this.DOM.recipients.value = cleanEmailsArray.join('\n');
            this.updateRecipientCount();
            this.showToast(`Extracted ${cleanEmailsArray.length} valid emails from ${file.name}`, 'success');
        };
        reader.onerror = () => this.showToast('Could not read that file.', 'error');
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
            this.showToast('EmailJS is not loaded. Refresh the page and try again.', 'error');
            return;
        }

        if (!this.isConfigured() || !this.initEmailJS()) {
            this.showToast('Save your EmailJS Public Key, Service ID, and Template ID first.', 'error');
            this.DOM.setupPanel.open = true;
            this.DOM.emailjsPublicKey.focus();
            return;
        }

        const { serviceId, templateId, fromName, senderEmail } = this.readConfig();
        const emails = this.getValidEmailArray(this.DOM.recipients.value);
        const subject = this.DOM.subject.value.trim();
        const message = this.DOM.message.value.trim();

        if (!fromName) {
            this.showToast('Please enter a sender name.', 'error');
            this.DOM.fromName.focus();
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(senderEmail)) {
            this.showToast('Please enter a valid sender (Reply-To) email.', 'error');
            this.DOM.senderEmail.focus();
            return;
        }

        if (emails.length === 0) {
            this.showToast('No valid recipient emails found. Please check your list.', 'error');
            return;
        }

        if (!subject || !message) {
            this.showToast('Subject and message are required.', 'error');
            return;
        }

        this.persistCampaignFields();
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
                await emailjs.send(serviceId, templateId, {
                    to_email: email,
                    to_name: email,
                    from_name: fromName,
                    from_email: senderEmail,
                    reply_to: senderEmail,
                    subject,
                    message
                });
                success++;
                this.DOM.statSuccess.textContent = String(success);
            } catch (err) {
                console.error(`Failed to send to ${email}:`, err);
                failed++;
                failedEmails.push(`${email} — ${this.emailjsErrorMessage(err)}`);
                this.DOM.statFailed.textContent = String(failed);
            }

            if (i < emails.length - 1) await this.sleep(1500);
        }

        this.DOM.progressStatus.textContent = 'Campaign complete';
        this.setLoading(false);

        if (failedEmails.length) {
            this.DOM.failedList.classList.remove('hidden');
            failedEmails.forEach((item) => {
                const li = document.createElement('li');
                li.textContent = item;
                this.DOM.failedList.appendChild(li);
            });
        }

        if (failed === 0) {
            this.showToast(`Successfully sent to ${success} recipient${success !== 1 ? 's' : ''}.`, 'success');
        } else {
            this.showToast(`Finished. ${success} sent, ${failed} failed.`, 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BulkMailerApp();
});
