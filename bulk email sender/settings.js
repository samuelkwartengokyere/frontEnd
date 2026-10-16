document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('settingsForm');
    const loginForm = document.getElementById('loginSettingsForm');
    const logoForm = document.getElementById('logoForm');
    const publicKeyInput = document.getElementById('emailjsPublicKey');
    const serviceIdInput = document.getElementById('emailjsServiceId');
    const templateIdInput = document.getElementById('emailjsTemplateId');
    const configStatus = document.getElementById('configStatus');
    const loginStatus = document.getElementById('loginStatus');
    const builtInNotice = document.getElementById('builtInNotice');
    const workspaceEmail = document.getElementById('workspaceEmail');
    const currentPassword = document.getElementById('currentPassword');
    const newPassword = document.getElementById('newPassword');
    const confirmPassword = document.getElementById('confirmPassword');
    const orgLogoUrl = document.getElementById('orgLogoUrl');
    const orgLogoFile = document.getElementById('orgLogoFile');
    const orgLogoPreview = document.getElementById('orgLogoPreview');
    const orgLogoPreviewWrap = document.getElementById('orgLogoPreviewWrap');
    const openTrackForm = document.getElementById('openTrackForm');
    const openTrackUrl = document.getElementById('openTrackUrl');
    const openTrackStatus = document.getElementById('openTrackStatus');
    const useThisSiteTrackBtn = document.getElementById('useThisSiteTrackBtn');
    let orgLogoDataUrl = '';

    const hasCustomLogin = () => Boolean(localStorage.getItem(AUTH_CREDENTIALS_KEY));

    const updateLoginStatus = () => {
        loginStatus.textContent = hasCustomLogin() ? 'Custom' : 'Default';
        loginStatus.classList.toggle('ok', hasCustomLogin());
    };

    document.querySelectorAll('[data-toggle-password]').forEach((button) => {
        button.addEventListener('click', () => {
            const input = document.getElementById(button.getAttribute('data-toggle-password'));
            if (!input) return;
            const hidden = input.type === 'password';
            input.type = hidden ? 'text' : 'password';
            button.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
            button.classList.toggle('is-on', hidden);
        });
    });

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
        if (openTrackUrl) {
            openTrackUrl.value = saved.openTrackUrl || '';
        }
        updateOpenTrackStatus();

        if (hasBuiltInEmailJs()) {
            builtInNotice.classList.remove('hidden');
            [publicKeyInput, serviceIdInput, templateIdInput].forEach((input) => {
                input.readOnly = true;
            });
            document.getElementById('saveConfigBtn').disabled = true;
        }

        workspaceEmail.value = loadStudioAuth().email || '';
        updateStatus();
        updateLoginStatus();
    };

    const updateOpenTrackStatus = () => {
        if (!openTrackStatus) return;
        const on = typeof isOpenTrackingConfigured === 'function' && isOpenTrackingConfigured();
        openTrackStatus.textContent = on ? 'On' : 'Off';
        openTrackStatus.classList.toggle('ok', on);
    };

    const updateStatus = () => {
        const ready = isEmailJsConfigured();
        configStatus.textContent = ready ? 'Configured' : 'Not configured';
        configStatus.classList.toggle('ok', ready);
    };

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const auth = loadStudioAuth();
        const email = workspaceEmail.value.trim().toLowerCase();
        const current = currentPassword.value;
        const nextPassword = newPassword.value;
        const confirm = confirmPassword.value;

        if (!email) {
            showToast('Enter a login email.', 'error');
            return;
        }
        if (nextPassword && nextPassword.length < 8) {
            showToast('New password must be at least 8 characters.', 'error');
            newPassword.focus();
            return;
        }
        if (nextPassword && nextPassword !== confirm) {
            showToast('New password and confirmation do not match.', 'error');
            confirmPassword.focus();
            return;
        }
        if (!nextPassword && confirm) {
            showToast('Enter the new password to confirm it.', 'error');
            newPassword.focus();
            return;
        }

        const remote = typeof updateWorkspaceLogin === 'function'
            ? await updateWorkspaceLogin({ email, currentPassword: current, newPassword: nextPassword })
            : null;
        if (remote && remote.ok) {
            const saved = saveStudioAuth({
                email: remote.email || email,
                password: nextPassword || current
            }, { skipPublish: true });
            refreshStudioSession(saved.email);
            currentPassword.value = '';
            newPassword.value = '';
            confirmPassword.value = '';
            updateLoginStatus();
            showToast('Workspace login updated. Everyone uses these details on the next sign-in.', 'success');
            return;
        }
        if (remote && remote.error) {
            showToast(remote.error, 'error');
            if (/current password/i.test(remote.error)) currentPassword.focus();
            return;
        }

        if (current !== auth.password) {
            showToast('Current password is incorrect.', 'error');
            currentPassword.focus();
            return;
        }

        const saved = saveStudioAuth({
            email,
            password: nextPassword || auth.password
        });
        refreshStudioSession(saved.email);
        currentPassword.value = '';
        newPassword.value = '';
        confirmPassword.value = '';
        updateLoginStatus();
        showToast('Workspace login updated on this browser. Start MySQL in XAMPP to share it.', 'success');
    });

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
        showToast('Settings saved for everyone using this studio.', 'success');
    });

    if (useThisSiteTrackBtn) {
        useThisSiteTrackBtn.addEventListener('click', () => {
            const suggested = typeof suggestedOpenTrackUrl === 'function' ? suggestedOpenTrackUrl() : '';
            if (!suggested) {
                showToast('Open Campaign Studio over https (not as a local file), then try again.', 'error');
                return;
            }
            openTrackUrl.value = suggested;
        });
    }

    if (openTrackForm) {
        openTrackForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const url = String(openTrackUrl.value || '').trim();
            if (url && !/^https?:\/\//i.test(url)) {
                showToast('Use a full http(s) URL to track.php.', 'error');
                return;
            }
            saveCampaignConfig({ openTrackUrl: url });
            updateOpenTrackStatus();
            showToast(url ? 'Open tracking saved for everyone. New campaigns will record opens.' : 'Open tracking turned off for everyone.', 'success');
        });
    }

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
        showToast('Organization logo saved for everyone.', 'success');
    });

    const settingsFormBusy = () => {
        const active = document.activeElement;
        return Boolean(active && active.closest && active.closest('#loginSettingsForm, #settingsForm, #openTrackForm, #logoForm'));
    };

    document.addEventListener('tha-library-changed', () => {
        if (!settingsFormBusy()) fillForm();
    });

    if (typeof whenSharedLibraryReady === 'function') {
        whenSharedLibraryReady().then(() => fillForm());
    } else {
        fillForm();
    }
});
