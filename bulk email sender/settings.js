document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm');
    const logoForm = document.getElementById('logoForm');
    const publicKeyInput = document.getElementById('emailjsPublicKey');
    const serviceIdInput = document.getElementById('emailjsServiceId');
    const templateIdInput = document.getElementById('emailjsTemplateId');
    const configStatus = document.getElementById('configStatus');
    const builtInNotice = document.getElementById('builtInNotice');
    const orgLogoUrl = document.getElementById('orgLogoUrl');
    const orgLogoFile = document.getElementById('orgLogoFile');
    const orgLogoPreview = document.getElementById('orgLogoPreview');
    const orgLogoPreviewWrap = document.getElementById('orgLogoPreviewWrap');
    let orgLogoDataUrl = '';

    const showOrgLogo = (src) => {
        if (!src) {
            orgLogoPreview.removeAttribute('src');
            orgLogoPreviewWrap.classList.add('hidden');
            return;
        }
        orgLogoPreview.src = src;
        orgLogoPreviewWrap.classList.remove('hidden');
    };

    const fillForm = () => {
        const saved = loadCampaignConfig();
        publicKeyInput.value = saved.publicKey || '';
        serviceIdInput.value = saved.serviceId || '';
        templateIdInput.value = saved.templateId || '';
        orgLogoUrl.value = saved.logoUrl || '';
        orgLogoDataUrl = saved.logoDataUrl || '';
        showOrgLogo(saved.logoUrl || saved.logoDataUrl || '');

        if (hasBuiltInEmailJs()) {
            builtInNotice.classList.remove('hidden');
            [publicKeyInput, serviceIdInput, templateIdInput].forEach((input) => {
                input.readOnly = true;
            });
            document.getElementById('saveConfigBtn').disabled = true;
        }

        updateStatus();
    };

    const updateStatus = () => {
        const ready = isEmailJsConfigured();
        configStatus.textContent = ready ? 'Configured' : 'Not configured';
        configStatus.classList.toggle('ok', ready);
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (hasBuiltInEmailJs()) {
            showToast('Keys are set in config.js. Edit that file instead.', 'info');
            return;
        }

        const publicKey = publicKeyInput.value.trim();
        const serviceId = serviceIdInput.value.trim();
        const templateId = templateIdInput.value.trim();

        if (!publicKey || !serviceId || !templateId) {
            showToast('Enter Public Key, Service ID, and Template ID.', 'error');
            return;
        }

        saveCampaignConfig({ publicKey, serviceId, templateId });
        updateStatus();
        showToast('Settings saved in this browser.', 'success');
    });

    document.getElementById('orgLogoBrowseBtn').addEventListener('click', () => orgLogoFile.click());
    document.getElementById('orgLogoClearBtn').addEventListener('click', () => {
        orgLogoDataUrl = '';
        orgLogoUrl.value = '';
        showOrgLogo('');
    });
    orgLogoFile.addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            orgLogoDataUrl = await fileToLogoDataUrl(file);
            showOrgLogo(orgLogoDataUrl);
            showToast('Logo ready. Click Save logo.', 'success');
        } catch (err) {
            showToast(err.message || 'Could not use that image.', 'error');
        }
        e.target.value = '';
    });
    orgLogoUrl.addEventListener('input', () => {
        showOrgLogo(orgLogoUrl.value.trim() || orgLogoDataUrl);
    });

    logoForm.addEventListener('submit', (e) => {
        e.preventDefault();
        saveCampaignConfig({
            logoUrl: orgLogoUrl.value.trim(),
            logoDataUrl: orgLogoDataUrl
        });
        showToast('Organization logo saved.', 'success');
    });

    fillForm();
});
