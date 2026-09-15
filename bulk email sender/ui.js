function mountAppNav() {
    const nav = document.querySelector('[data-app-nav]');
    if (!nav) return;

    const active = nav.getAttribute('data-app-nav');
    const items = [
        { id: 'campaign', href: 'index.html', label: 'Campaign' },
        { id: 'events', href: 'events.html', label: 'Events' },
        { id: 'templates', href: 'templates.html', label: 'Templates' },
        { id: 'history', href: 'history.html', label: 'History' },
        { id: 'settings', href: 'settings.html', label: 'Settings' }
    ];

    nav.innerHTML = '';
    items.forEach((item) => {
        const link = document.createElement('a');
        link.href = item.href;
        link.className = `nav-link${item.id === active ? ' active' : ''}`;
        link.textContent = item.label;
        nav.appendChild(link);
    });
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

document.addEventListener('DOMContentLoaded', () => {
    mountAppNav();
    enhanceAllSelects();
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        document.querySelectorAll('.pretty-select.open').forEach((wrap) => wrap.classList.remove('open'));
    }
});
