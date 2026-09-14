class BulkMailerApp {
    constructor() {
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
            configStatus: document.getElementById('configStatus')
        };

        this.emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
        this.sending = false;

        this.init();
    }

    init() {
        this.loadCampaignFields();
        this.initEmailJS();
        this.bindEvents();
        this.updateRecipientCount();
        this.updateConfigStatus();
    }

    loadCampaignFields() {
        const saved = loadCampaignConfig();
        this.DOM.fromName.value = saved.fromName || '';
        this.DOM.senderEmail.value = saved.senderEmail || '';
    }

    persistCampaignFields() {
        saveCampaignConfig({
            fromName: this.DOM.fromName.value.trim(),
            senderEmail: this.DOM.senderEmail.value.trim()
        });
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
        this.DOM.configStatus.textContent = ready ? 'Configured' : 'Not configured';
        this.DOM.configStatus.classList.toggle('ok', ready);
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
            const cleanEmailsArray = this.getValidEmailArray(combinedText);
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
            showToast('Open Settings and save your EmailJS keys first.', 'error');
            window.location.href = 'settings.html';
            return;
        }

        const { serviceId, templateId, fromName, senderEmail } = this.readSendFields();
        const emails = this.getValidEmailArray(this.DOM.recipients.value);
        const subject = this.DOM.subject.value.trim();
        const message = this.DOM.message.value.trim();

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
            showToast(`Successfully sent to ${success} recipient${success !== 1 ? 's' : ''}.`, 'success');
        } else {
            showToast(`Finished. ${success} sent, ${failed} failed.`, 'error');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new BulkMailerApp();
});
