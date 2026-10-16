const LOADER_LABEL_KEY = 'tha_loader_label';
const LOADER_NAV_KEY = 'tha_loader_nav';
const APP_PAGE_LABELS = {
    'index.html': 'Opening Campaign Studio…',
    'events.html': 'Loading Events…',
    'templates.html': 'Loading Templates…',
    'history.html': 'Loading History…',
    'settings.html': 'Loading Settings…',
    'login.html': 'Returning to sign in…'
};

let loaderRevealTimer = null;
let loaderNavigating = false;

function pageFileName(href) {
    try {
        const url = new URL(href, window.location.href);
        const name = url.pathname.split('/').pop() || 'index.html';
        return name.endsWith('.html') ? name : 'index.html';
    } catch {
        return '';
    }
}

function loaderLabelForHref(href) {
    return APP_PAGE_LABELS[pageFileName(href)] || 'Loading page…';
}

function ensureAppLoader() {
    let loader = document.getElementById('app-loader');
    if (loader) return loader;

    loader = document.createElement('div');
    loader.id = 'app-loader';
    loader.className = 'app-loader';
    loader.setAttribute('role', 'status');
    loader.setAttribute('aria-live', 'polite');
    loader.innerHTML = `
        <div class="app-loader-card">
            <div class="logo">
                <img src="assets/tha-logo.png" alt="Tech Hub Africa">
            </div>
            <div class="app-loader-orbit" aria-hidden="true"><span></span></div>
            <p class="app-loader-title">Campaign Studio</p>
            <p class="app-loader-status">Preparing workspace…</p>
            <div class="app-loader-track"><span class="app-loader-fill"></span></div>
        </div>
    `;
    document.body.prepend(loader);
    return loader;
}

function setAppLoaderStatus(message) {
    const status = ensureAppLoader().querySelector('.app-loader-status');
    if (status && message) status.textContent = message;
}

function setNavLoaderMode(enabled) {
    document.documentElement.classList.toggle('is-nav-loading', enabled);
    const loader = document.getElementById('app-loader');
    if (loader) loader.classList.toggle('is-nav', enabled);
    try {
        if (enabled) sessionStorage.setItem(LOADER_NAV_KEY, '1');
        else sessionStorage.removeItem(LOADER_NAV_KEY);
    } catch {
        /* ignore */
    }
}

function showAppLoader(message, options = {}) {
    const loader = ensureAppLoader();
    const label = message || 'Loading workspace…';
    setAppLoaderStatus(label);
    loader.setAttribute('aria-label', label);
    try {
        sessionStorage.setItem(LOADER_LABEL_KEY, label);
    } catch {
        /* ignore quota / private mode */
    }
    if (options.navigating) {
        loaderNavigating = true;
        setNavLoaderMode(true);
        if (loaderRevealTimer) {
            window.clearTimeout(loaderRevealTimer);
            loaderRevealTimer = null;
        }
    } else {
        setNavLoaderMode(Boolean(options.compact));
    }
    loader.classList.remove('is-hidden', 'is-leaving');
    document.body.classList.add('is-app-loading');
}

function hideAppLoader() {
    if (loaderNavigating) return;
    const loader = document.getElementById('app-loader');
    if (!loader || loader.classList.contains('is-leaving') || loader.classList.contains('is-hidden')) {
        document.body.classList.remove('is-app-loading');
        return;
    }

    loader.classList.add('is-leaving');
    loader.addEventListener('transitionend', () => {
        loader.classList.add('is-hidden');
        document.body.classList.remove('is-app-loading');
        try {
            sessionStorage.removeItem(LOADER_LABEL_KEY);
            sessionStorage.removeItem(LOADER_NAV_KEY);
        } catch {
            /* ignore */
        }
        document.documentElement.classList.remove('is-nav-loading');
    }, { once: true });

    window.setTimeout(() => {
        loader.classList.add('is-hidden');
        document.body.classList.remove('is-app-loading');
    }, 500);
}

function isInternalPageLink(anchor) {
    if (!anchor || anchor.target && anchor.target !== '_self') return false;
    if (anchor.hasAttribute('download')) return false;
    const href = anchor.getAttribute('href');
    if (!href || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('javascript:')) return false;

    try {
        const url = new URL(anchor.href, window.location.href);
        if (url.origin !== window.location.origin) return false;
        if (url.pathname === window.location.pathname && url.search === window.location.search) return false;
        return /\.html$/.test(url.pathname) || url.pathname.endsWith('/');
    } catch {
        return false;
    }
}

function bindPageNavigationLoader() {
    document.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const anchor = event.target.closest('a[href]');
        if (!isInternalPageLink(anchor)) return;

        event.preventDefault();
        showAppLoader(loaderLabelForHref(anchor.href), { navigating: true });
        window.setTimeout(() => {
            window.location.href = anchor.href;
        }, 80);
    });
}

function requireStudioAuth() {
    if (document.body.classList.contains('login-page')) return;
    if (typeof isStudioLoggedIn === 'function' && !isStudioLoggedIn()) {
        showAppLoader('Returning to sign in…', { navigating: true });
        window.location.replace('login.html');
    }
}

function mountAppNav() {
    const nav = document.querySelector('[data-app-nav]');
    if (!nav) return;

    const active = nav.getAttribute('data-app-nav');
    const primary = [
        { id: 'campaign', href: 'index.html', label: 'Campaign' },
        { id: 'events', href: 'events.html', label: 'Events' },
        { id: 'templates', href: 'templates.html', label: 'Templates' },
        { id: 'history', href: 'history.html', label: 'History' }
    ];

    nav.innerHTML = '';

    const mainGroup = document.createElement('div');
    mainGroup.className = 'nav-group nav-group-main';
    mainGroup.setAttribute('role', 'group');
    mainGroup.setAttribute('aria-label', 'Workspace');

    primary.forEach((item) => {
        const link = document.createElement('a');
        link.href = item.href;
        link.className = `nav-link${item.id === active ? ' active' : ''}`;
        link.textContent = item.label;
        mainGroup.appendChild(link);
    });

    const accountGroup = document.createElement('div');
    accountGroup.className = 'nav-group nav-group-account';
    accountGroup.setAttribute('role', 'group');
    accountGroup.setAttribute('aria-label', 'Account');

    const settings = document.createElement('a');
    settings.href = 'settings.html';
    settings.className = `nav-link nav-icon-link${active === 'settings' ? ' active' : ''}`;
    settings.setAttribute('aria-label', 'Settings');
    settings.title = 'Settings';
    settings.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>';
    accountGroup.appendChild(settings);

    const logout = document.createElement('button');
    logout.type = 'button';
    logout.className = 'nav-link nav-icon-link nav-logout';
    logout.setAttribute('aria-label', 'Sign out');
    logout.title = 'Sign out';
    logout.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>';
    logout.addEventListener('click', () => {
        showAppLoader('Signing out…', { navigating: true });
        if (typeof logoutStudio === 'function') logoutStudio();
        window.setTimeout(() => window.location.replace('login.html'), 80);
    });
    accountGroup.appendChild(logout);

    nav.append(mainGroup, accountGroup);
}

function selectedLabel(selectEl) {
    const option = selectEl.options[selectEl.selectedIndex];
    return option ? option.textContent : 'Select';
}

function enhanceSelect(selectEl) {
    if (!selectEl) return;

    let wrap = selectEl.closest('.pretty-select');
    if (!wrap) {
        wrap = document.createElement('div');
        wrap.className = 'pretty-select';
        selectEl.parentNode.insertBefore(wrap, selectEl);
        wrap.appendChild(selectEl);
        selectEl.classList.add('pretty-select-native');

        const toggle = document.createElement('button');
        toggle.type = 'button';
        toggle.className = 'pretty-select-toggle';
        toggle.setAttribute('aria-haspopup', 'listbox');

        const menu = document.createElement('div');
        menu.className = 'pretty-select-menu';
        menu.setAttribute('role', 'listbox');

        wrap.append(toggle, menu);

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.pretty-select.open').forEach((openWrap) => {
                if (openWrap !== wrap) openWrap.classList.remove('open');
            });
            wrap.classList.toggle('open');
        });

        document.addEventListener('click', (e) => {
            if (!wrap.contains(e.target)) wrap.classList.remove('open');
        });
    }

    const toggle = wrap.querySelector('.pretty-select-toggle');
    const menu = wrap.querySelector('.pretty-select-menu');
    menu.innerHTML = '';

    [...selectEl.options].forEach((option) => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'pretty-select-option';
        item.textContent = option.textContent;
        item.dataset.value = option.value;
        if (option.selected) item.classList.add('is-selected');
        item.addEventListener('click', () => {
            selectEl.value = option.value;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
            enhanceSelect(selectEl);
            wrap.classList.remove('open');
        });
        menu.appendChild(item);
    });

    toggle.innerHTML = `<span>${selectedLabel(selectEl)}</span><span class="pretty-caret"></span>`;
}

function enhanceAllSelects(root = document) {
    root.querySelectorAll('select.modern-input').forEach((selectEl) => enhanceSelect(selectEl));
}

function initAppLoader() {
    const pendingLabel = (() => {
        try {
            return sessionStorage.getItem(LOADER_LABEL_KEY);
        } catch {
            return '';
        }
    })();
    const isNavLoad = (() => {
        try {
            return sessionStorage.getItem(LOADER_NAV_KEY) === '1';
        } catch {
            return false;
        }
    })();

    const existing = document.querySelector('#app-loader .app-loader-status')?.textContent?.trim();
    const fallback = document.body.classList.contains('login-page')
        ? 'Preparing sign in…'
        : 'Preparing workspace…';
    showAppLoader(pendingLabel || existing || fallback, { compact: isNavLoad });
    bindPageNavigationLoader();

    const startedAt = Date.now();
    const minMs = pendingLabel ? 420 : 900;
    const reveal = () => {
        const wait = Math.max(0, minMs - (Date.now() - startedAt));
        window.clearTimeout(loaderRevealTimer);
        loaderRevealTimer = window.setTimeout(hideAppLoader, wait);
    };
    const revealAfterLibrary = () => {
        const libraryReady = typeof whenSharedLibraryReady === 'function'
            ? whenSharedLibraryReady()
            : Promise.resolve();
        Promise.resolve(libraryReady).then(reveal, reveal);
    };

    if (document.readyState === 'complete') {
        revealAfterLibrary();
    } else {
        window.addEventListener('load', revealAfterLibrary, { once: true });
    }

    window.addEventListener('pageshow', (event) => {
        if (event.persisted) hideAppLoader();
    });
}

document.addEventListener('DOMContentLoaded', () => {
    initAppLoader();
    requireStudioAuth();
    mountAppNav();
    enhanceAllSelects();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.pretty-select.open').forEach((wrap) => wrap.classList.remove('open'));
    }
});
