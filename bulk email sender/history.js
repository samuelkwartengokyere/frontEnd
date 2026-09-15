document.addEventListener('DOMContentLoaded', () => {
    const historyList = document.getElementById('historyList');
    const clearBtn = document.getElementById('clearHistoryBtn');

    const formatWhen = (value) => {
        try {
            return new Date(value).toLocaleString();
        } catch {
            return 'Unknown time';
        }
    };

    const renderList = () => {
        const entries = loadHistory();
        historyList.innerHTML = '';

        if (!entries.length) {
            const empty = document.createElement('p');
            empty.className = 'field-hint';
            empty.textContent = 'No campaigns yet. Sends from the Campaign tab will show up here.';
            historyList.appendChild(empty);
            return;
        }

        entries.forEach((entry) => {
            const card = document.createElement('article');
            card.className = 'item-card';

            const title = document.createElement('h3');
            title.textContent = entry.subject || 'Untitled campaign';

            const meta = document.createElement('p');
            meta.className = 'item-meta';
            meta.textContent = `${formatWhen(entry.createdAt)} · ${entry.eventName || 'One-off list'} · ${entry.success || 0} sent · ${entry.failed || 0} failed`;

            const people = document.createElement('p');
            people.className = 'item-meta';
            people.textContent = `To: ${(entry.recipients || []).join(', ') || 'No recipients recorded'}`;

            card.append(title, meta, people);

            if ((entry.failedDetails || []).length) {
                const fail = document.createElement('p');
                fail.className = 'item-meta danger-text';
                fail.textContent = entry.failedDetails.join(' | ');
                card.appendChild(fail);
            }

            historyList.appendChild(card);
        });
    };

    clearBtn.addEventListener('click', () => {
        if (!loadHistory().length) return;
        if (!confirm('Clear all campaign history?')) return;
        clearHistory();
        renderList();
        showToast('History cleared.', 'info');
    });

    renderList();
});
