document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm');
    const publicKeyInput = document.getElementById('emailjsPublicKey');
    const serviceIdInput = document.getElementById('emailjsServiceId');
    const templateIdInput = document.getElementById('emailjsTemplateId');
    const configStatus = document.getElementById('configStatus');

    const fillForm = () => {
        const saved = loadCampaignConfig();
        publicKeyInput.value = saved.publicKey || '';
        serviceIdInput.value = saved.serviceId || '';
        templateIdInput.value = saved.templateId || '';
        updateStatus();
    };

    const updateStatus = () => {
        const ready = isEmailJsConfigured();
        configStatus.textContent = ready ? 'Configured' : 'Not configured';
        configStatus.classList.toggle('ok', ready);
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
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

    fillForm();
});
