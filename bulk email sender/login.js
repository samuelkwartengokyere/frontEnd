function setLoginBusy(busy) {
    const button = document.getElementById('loginBtn');
    const text = button.querySelector('.btn-text');
    const loader = button.querySelector('.btn-loader');
    button.disabled = busy;
    text.classList.toggle('hidden', busy);
    loader.classList.toggle('hidden', !busy);
}

function showLoginError(message) {
    const error = document.getElementById('loginError');
    error.textContent = message;
    error.classList.remove('hidden');
    error.classList.remove('shake');
    void error.offsetWidth;
    error.classList.add('shake');
}

document.addEventListener('DOMContentLoaded', () => {
    const sharedLoginReady = typeof refreshSharedSettings === 'function'
        ? refreshSharedSettings()
        : Promise.resolve();

    if (isStudioLoggedIn()) {
        if (typeof showAppLoader === 'function') showAppLoader('Opening Campaign Studio…', { navigating: true });
        window.location.replace('index.html');
        return;
    }

    const form = document.getElementById('loginForm');
    const emailInput = document.getElementById('loginEmail');
    const passwordInput = document.getElementById('loginPassword');
    const rememberInput = document.getElementById('rememberMe');
    const toggle = document.getElementById('togglePassword');
    const stage = document.getElementById('loginStage');

    toggle.addEventListener('click', () => {
        const hidden = passwordInput.type === 'password';
        passwordInput.type = hidden ? 'text' : 'password';
        toggle.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
        toggle.classList.toggle('is-on', hidden);
    });

    form.addEventListener('submit', (event) => {
        event.preventDefault();
        document.getElementById('loginError').classList.add('hidden');
        setLoginBusy(true);

        window.setTimeout(() => {
            sharedLoginReady.then(async () => {
                const ok = await loginStudio(emailInput.value, passwordInput.value, rememberInput.checked);
                if (!ok) {
                    setLoginBusy(false);
                    showLoginError('Those credentials do not match this workspace.');
                    passwordInput.focus();
                    passwordInput.select();
                    return;
                }

                document.querySelector('.login-card').classList.add('login-success');
                window.setTimeout(() => {
                    if (typeof showAppLoader === 'function') showAppLoader('Opening Campaign Studio…', { navigating: true });
                    window.location.href = 'index.html';
                }, 420);
            });
        }, 650);
    });

    window.addEventListener('pointermove', (event) => {
        const x = (event.clientX / window.innerWidth - 0.5) * 24;
        const y = (event.clientY / window.innerHeight - 0.5) * 24;
        stage.style.setProperty('--parx', `${x}px`);
        stage.style.setProperty('--pary', `${y}px`);
    });
});
