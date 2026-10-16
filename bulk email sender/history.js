document.addEventListener('DOMContentLoaded', () => {
    const historyList = document.getElementById('historyList');
    const clearBtn = document.getElementById('clearHistoryBtn');
    const deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
    const refreshOpensBtn = document.getElementById('refreshOpensBtn');
    const selectVisibleBox = document.getElementById('selectVisibleBox');
    const searchInput = document.getElementById('historySearch');
    const resultCount = document.getElementById('historyResultCount');
    const openTrackHint = document.getElementById('openTrackHint');
    const statusButtons = [...document.querySelectorAll('.history-status-filters [data-status]')];
    const dialog = document.getElementById('messageDialog');
    const dialogTitle = document.getElementById('messageDialogTitle');
    const dialogTo = document.getElementById('messageDialogTo');
    const dialogStatus = document.getElementById('messageDialogStatus');
    const dialogOpened = document.getElementById('messageDialogOpened');
    const dialogSubject = document.getElementById('messageDialogSubject');
    const dialogFrom = document.getElementById('messageDialogFrom');
    const dialogWhen = document.getElementById('messageDialogWhen');
    const dialogAttachmentsWrap = document.getElementById('messageDialogAttachmentsWrap');
    const dialogAttachments = document.getElementById('messageDialogAttachments');
    const dialogNotice = document.getElementById('messageDialogNotice');
    const dialogBody = document.getElementById('messageDialogBody');
    const closeDialogBtn = document.getElementById('closeMessageDialog');

    let statusFilter = 'all';
    let selected = new Set();

    const messageKey = (entryId, email) => `${entryId}::${String(email || '').toLowerCase()}`;

    const formatWhen = (value) => {
        try {
            return new Date(value).toLocaleString();
        } catch {
            return 'Unknown time';
        }
    };

    const queryValue = () => String(searchInput.value || '').trim().toLowerCase();

    const matchesQuery = (email, query) => {
        if (!query) return true;
        return String(email || '').toLowerCase().includes(query);
    };

    const failReasonFor = (entry, email) => {
        const needle = String(email || '').toLowerCase();
        const line = (entry.failedDetails || []).find((item) => {
            return String(item || '').toLowerCase().startsWith(needle);
        });
        if (!line) return '';
        const parts = String(line).split(' — ');
        return parts.length > 1 ? parts.slice(1).join(' — ') : '';
    };

    const visibleRecipients = (entry) => {
        const query = queryValue();
        const succeeded = succeededEmailsFromEntry(entry).filter((email) => matchesQuery(email, query));
        const failed = failedEmailsFromEntry(entry).filter((email) => matchesQuery(email, query));
        const openedSet = new Set(openedEmailsFromEntry(entry));

        const withOpen = (email, status, extra = {}) => {
            const open = openInfoForEmail(entry, email);
            const opened = openedSet.has(String(email).toLowerCase());
            return {
                email,
                status: opened && status === 'sent' ? 'opened' : status,
                opened,
                openedAt: open && open.openedAt,
                lastOpenedAt: open && open.lastOpenedAt,
                openCount: open ? open.openCount : 0,
                ...extra
            };
        };

        if (statusFilter === 'sent') {
            return succeeded.map((email) => withOpen(email, 'sent'));
        }
        if (statusFilter === 'opened') {
            return succeeded.filter((email) => openedSet.has(email)).map((email) => withOpen(email, 'sent'));
        }
        if (statusFilter === 'failed') {
            return failed.map((email) => withOpen(email, 'failed', { reason: failReasonFor(entry, email) }));
        }

        const rows = [
            ...succeeded.map((email) => withOpen(email, 'sent')),
            ...failed.map((email) => withOpen(email, 'failed', { reason: failReasonFor(entry, email) }))
        ];

        if (rows.length) return rows;

        return (entry.recipients || [])
            .filter((email) => matchesQuery(email, query))
            .map((email) => withOpen(email, 'unknown'));
    };

    const filteredEntries = () => {
        return loadHistory().filter((entry) => visibleRecipients(entry).length > 0);
    };

    const visibleMessageKeys = () => {
        const keys = [];
        filteredEntries().forEach((entry) => {
            visibleRecipients(entry).forEach((item) => {
                keys.push(messageKey(entry.id, item.email));
            });
        });
        return keys;
    };

    const pruneSelection = () => {
        const valid = new Set();
        loadHistory().forEach((entry) => {
            const emails = new Set([
                ...(entry.recipients || []),
                ...succeededEmailsFromEntry(entry),
                ...failedEmailsFromEntry(entry)
            ]);
            emails.forEach((email) => valid.add(messageKey(entry.id, email)));
        });
        selected = new Set([...selected].filter((key) => valid.has(key)));
    };

    const updateSelectionUi = () => {
        const visible = visibleMessageKeys();
        const selectedVisible = visible.filter((key) => selected.has(key)).length;
        deleteSelectedBtn.disabled = selected.size === 0;
        deleteSelectedBtn.textContent = selected.size
            ? `Delete selected (${selected.size})`
            : 'Delete selected';
        selectVisibleBox.checked = visible.length > 0 && selectedVisible === visible.length;
        selectVisibleBox.indeterminate = selectedVisible > 0 && selectedVisible < visible.length;
        selectVisibleBox.disabled = visible.length === 0;
    };

    const statusLabel = (status) => {
        if (status === 'failed') return 'Failed';
        if (status === 'opened') return 'Opened';
        if (status === 'sent') return 'Sent';
        return 'Targeted';
    };

    const openedLine = (recipient) => {
        if (recipient.status === 'failed') return 'Not sent';
        if (!recipient.openedAt) {
            return recipient.status === 'sent' ? 'Not opened yet' : 'Unknown';
        }
        const when = formatWhen(recipient.openedAt);
        if (recipient.openCount > 1) {
            return `${when} · ${recipient.openCount} opens`;
        }
        return when;
    };

    const updateOpenTrackHint = () => {
        if (!openTrackHint) return;
        if (typeof isOpenTrackingConfigured === 'function' && isOpenTrackingConfigured()) {
            openTrackHint.classList.add('hidden');
            openTrackHint.textContent = '';
            if (refreshOpensBtn) refreshOpensBtn.disabled = false;
            return;
        }
        if (refreshOpensBtn) refreshOpensBtn.disabled = true;
        openTrackHint.classList.remove('hidden');
        openTrackHint.textContent = 'Open tracking is off. Upload track.php to your website and save its public HTTPS URL on Settings, then send a new campaign.';
    };

    const fromLine = (entry) => {
        const name = String(entry.fromName || '').trim();
        const email = String(entry.fromEmail || '').trim();
        if (name && email) return `${name} <${email}>`;
        return name || email || 'Not recorded';
    };

    const closeMessage = () => {
        dialog.classList.add('hidden');
        document.body.classList.remove('has-message-dialog');
    };

    const openMessage = (entry, recipient) => {
        const status = statusLabel(recipient.status);
        dialogTitle.textContent = entry.subject || 'Untitled campaign';
        dialogTo.textContent = recipient.email;
        dialogStatus.textContent = recipient.reason ? `${status} — ${recipient.reason}` : status;
        dialogStatus.className = recipient.status === 'failed' ? 'danger-text' : '';
        if (dialogOpened) dialogOpened.textContent = openedLine(recipient);
        dialogSubject.textContent = entry.subject || 'Untitled campaign';
        dialogFrom.textContent = fromLine(entry);
        dialogWhen.textContent = formatWhen(entry.createdAt);
        const names = (entry.attachmentNames || []).filter(Boolean);
        if (dialogAttachmentsWrap) {
            dialogAttachmentsWrap.classList.toggle('hidden', !names.length);
            dialogAttachments.textContent = names.join(', ');
        }

        const hasBody = Boolean(String(entry.message || '').trim());
        const deliveryNote = recipient.status === 'sent' || recipient.status === 'opened'
            ? 'The mail service accepted this address. If it is not in the inbox, check Spam and Promotions, or search from:techhubafrica.org.'
            : '';
        const missingBody = hasBody
            ? ''
            : 'This older history item does not include the message body. New campaigns will save it so you can open the full email.';
        const notice = [deliveryNote, missingBody].filter(Boolean).join(' ');
        dialogNotice.classList.toggle('hidden', !notice);
        dialogNotice.textContent = notice;

        if (hasBody && typeof buildMessageHtml === 'function') {
            dialogBody.innerHTML = buildMessageHtml(entry.message, entry.logoUrl || '');
        } else if (hasBody) {
            dialogBody.textContent = entry.message;
        } else {
            dialogBody.innerHTML = '';
        }

        dialog.classList.remove('hidden');
        document.body.classList.add('has-message-dialog');
        closeDialogBtn.focus();
    };

    const renderList = () => {
        pruneSelection();
        updateOpenTrackHint();
        const allEntries = loadHistory();
        const entries = filteredEntries();
        const query = queryValue();
        historyList.innerHTML = '';

        if (!allEntries.length) {
            resultCount.textContent = '';
            const empty = document.createElement('p');
            empty.className = 'field-hint';
            empty.textContent = 'No campaigns yet. Sends from the Campaign tab will show up here.';
            historyList.appendChild(empty);
            updateSelectionUi();
            return;
        }

        const messageCount = entries.reduce((sum, entry) => sum + visibleRecipients(entry).length, 0);
        const filterLabel = statusFilter === 'all' ? 'messages' : `${statusFilter} messages`;
        if (!entries.length) {
            resultCount.textContent = query
                ? `No ${filterLabel} match “${searchInput.value.trim()}”.`
                : `No ${filterLabel} in history.`;
            const empty = document.createElement('p');
            empty.className = 'field-hint';
            empty.textContent = 'Try another email or switch the status filter.';
            historyList.appendChild(empty);
            updateSelectionUi();
            return;
        }

        resultCount.textContent = `Showing ${messageCount} ${filterLabel} across ${entries.length} campaign${entries.length === 1 ? '' : 's'}.`;

        entries.forEach((entry) => {
            const recipients = visibleRecipients(entry);
            const card = document.createElement('article');
            card.className = 'item-card';

            const heading = document.createElement('div');
            heading.className = 'history-card-heading';

            const campaignBox = document.createElement('input');
            campaignBox.type = 'checkbox';
            campaignBox.className = 'history-check';
            campaignBox.setAttribute('aria-label', `Select messages in ${entry.subject || 'this campaign'}`);
            const campaignKeys = recipients.map((item) => messageKey(entry.id, item.email));
            const selectedInCard = campaignKeys.filter((key) => selected.has(key)).length;
            campaignBox.checked = campaignKeys.length > 0 && selectedInCard === campaignKeys.length;
            campaignBox.indeterminate = selectedInCard > 0 && selectedInCard < campaignKeys.length;
            campaignBox.addEventListener('change', () => {
                campaignKeys.forEach((key) => {
                    if (campaignBox.checked) selected.add(key);
                    else selected.delete(key);
                });
                card.querySelectorAll('.recipient-select input').forEach((input) => {
                    input.checked = campaignBox.checked;
                });
                card.querySelectorAll('.recipient-row').forEach((btn) => {
                    btn.classList.toggle('is-selected', campaignBox.checked);
                });
                campaignBox.indeterminate = false;
                updateSelectionUi();
            });

            const titleWrap = document.createElement('div');
            const title = document.createElement('h3');
            title.textContent = entry.subject || 'Untitled campaign';
            const meta = document.createElement('p');
            meta.className = 'item-meta';
            meta.textContent = `${formatWhen(entry.createdAt)} · ${entry.eventName || 'One-off list'} · ${entry.success || 0} sent · ${openedEmailsFromEntry(entry).length} opened · ${entry.failed || 0} failed`;
            titleWrap.append(title, meta);

            heading.append(campaignBox, titleWrap);

            const people = document.createElement('ul');
            people.className = 'recipient-list';
            recipients.forEach((item) => {
                const row = document.createElement('li');
                row.className = 'recipient-item';
                const key = messageKey(entry.id, item.email);

                const selectLabel = document.createElement('label');
                selectLabel.className = 'recipient-select';
                const box = document.createElement('input');
                box.type = 'checkbox';
                box.className = 'history-check';
                box.checked = selected.has(key);
                box.setAttribute('aria-label', `Select message to ${item.email}`);
                box.addEventListener('change', () => {
                    if (box.checked) selected.add(key);
                    else selected.delete(key);
                    openBtn.classList.toggle('is-selected', box.checked);
                    const selectedInCard = campaignKeys.filter((itemKey) => selected.has(itemKey)).length;
                    campaignBox.checked = campaignKeys.length > 0 && selectedInCard === campaignKeys.length;
                    campaignBox.indeterminate = selectedInCard > 0 && selectedInCard < campaignKeys.length;
                    updateSelectionUi();
                });
                selectLabel.appendChild(box);

                const openBtn = document.createElement('button');
                openBtn.type = 'button';
                openBtn.className = `recipient-row is-${item.status}${selected.has(key) ? ' is-selected' : ''}`;
                openBtn.setAttribute('aria-label', `Open message to ${item.email}`);

                const email = document.createElement('span');
                email.className = 'recipient-email';
                email.textContent = item.email;

                const badge = document.createElement('span');
                badge.className = `status-badge ${item.status}`;
                badge.textContent = statusLabel(item.status);

                const hint = document.createElement('span');
                hint.className = 'recipient-open-hint';
                hint.textContent = 'Open message';

                openBtn.append(email, badge);
                if (item.reason) {
                    const reason = document.createElement('span');
                    reason.className = 'recipient-reason';
                    reason.textContent = item.reason;
                    openBtn.appendChild(reason);
                }
                openBtn.appendChild(hint);
                openBtn.addEventListener('click', () => openMessage(entry, item));

                row.append(selectLabel, openBtn);
                people.appendChild(row);
            });

            card.append(heading, people);
            historyList.appendChild(card);
        });

        updateSelectionUi();
    };

    searchInput.addEventListener('input', renderList);

    const refreshOpens = async ({ silent } = {}) => {
        if (typeof refreshHistoryOpens !== 'function') return;
        if (typeof isOpenTrackingConfigured === 'function' && !isOpenTrackingConfigured()) {
            if (!silent) showToast('Set the open tracking URL in Settings first.', 'error');
            return;
        }
        try {
            if (refreshOpensBtn && !silent) {
                refreshOpensBtn.disabled = true;
                refreshOpensBtn.textContent = 'Checking…';
            }
            const changed = await refreshHistoryOpens();
            renderList();
            if (!silent) {
                showToast(changed ? 'Open activity updated.' : 'No new opens yet.', 'info');
            }
        } catch (err) {
            if (!silent) {
                showToast(err && err.message ? err.message : 'Could not load opens. Check track.php on your host.', 'error');
            }
        } finally {
            if (refreshOpensBtn) {
                refreshOpensBtn.disabled = typeof isOpenTrackingConfigured === 'function' && !isOpenTrackingConfigured();
                refreshOpensBtn.textContent = 'Refresh opens';
            }
        }
    };

    if (refreshOpensBtn) {
        refreshOpensBtn.addEventListener('click', () => refreshOpens());
    }

    statusButtons.forEach((button) => {
        button.addEventListener('click', () => {
            statusFilter = button.dataset.status || 'all';
            statusButtons.forEach((item) => item.classList.toggle('is-active', item === button));
            renderList();
        });
    });

    selectVisibleBox.addEventListener('change', () => {
        const keys = visibleMessageKeys();
        if (selectVisibleBox.checked) keys.forEach((key) => selected.add(key));
        else keys.forEach((key) => selected.delete(key));
        renderList();
    });

    deleteSelectedBtn.addEventListener('click', () => {
        if (!selected.size) return;
        const count = selected.size;
        if (!confirm(`Delete ${count} selected message${count === 1 ? '' : 's'} from history?`)) return;
        const targets = [...selected].map((key) => {
            const split = key.indexOf('::');
            return { id: key.slice(0, split), email: key.slice(split + 2) };
        });
        deleteHistoryMessages(targets);
        selected.clear();
        closeMessage();
        renderList();
        showToast(count === 1 ? 'Message deleted.' : `${count} messages deleted.`, 'info');
    });

    closeDialogBtn.addEventListener('click', closeMessage);
    dialog.querySelectorAll('[data-close-message]').forEach((el) => {
        el.addEventListener('click', closeMessage);
    });
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && !dialog.classList.contains('hidden')) {
            closeMessage();
        }
    });

    clearBtn.addEventListener('click', () => {
        if (!loadHistory().length) return;
        if (!confirm('Clear all campaign history?')) return;
        closeMessage();
        clearHistory();
        selected.clear();
        searchInput.value = '';
        statusFilter = 'all';
        statusButtons.forEach((item) => item.classList.toggle('is-active', item.dataset.status === 'all'));
        renderList();
        showToast('History cleared.', 'info');
    });

    document.addEventListener('tha-library-changed', () => {
        if (typeof loadHistory === 'function') renderList();
    });

    renderList();
    refreshOpens({ silent: true });
    setInterval(() => refreshOpens({ silent: true }), 30000);
});
