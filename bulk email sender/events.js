document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('eventForm');
    const eventId = document.getElementById('eventId');
    const eventName = document.getElementById('eventName');
    const eventDescription = document.getElementById('eventDescription');
    const eventEmails = document.getElementById('eventEmails');
    const eventRecipientCount = document.getElementById('eventRecipientCount');
    const eventList = document.getElementById('eventList');
    const dropzone = document.getElementById('eventDropzone');
    const fileInput = document.getElementById('eventFileInput');
    const browseBtn = document.getElementById('eventBrowseBtn');
    const resetBtn = document.getElementById('resetEventBtn');
    const saveBtn = document.getElementById('saveEventBtn');
    const updateBtn = document.getElementById('updateEventBtn');

    const updateCount = () => {
        const people = parseRecipients(eventEmails.value);
        const named = people.filter((person) => person.name).length;
        eventRecipientCount.textContent = named
            ? `${people.length} recipient${people.length !== 1 ? 's' : ''} (${named} named)`
            : `${people.length} valid email${people.length !== 1 ? 's' : ''}`;
    };

    const resetForm = () => {
        eventId.value = '';
        form.reset();
        eventEmails.value = '';
        updateBtn.classList.add('hidden');
        updateCount();
        eventName.focus();
    };

    const loadEventIntoForm = (event) => {
        eventId.value = event.id;
        eventName.value = event.name;
        eventDescription.value = event.description || '';
        eventEmails.value = formatPeopleList(event.people || event.emails || []);
        updateBtn.classList.remove('hidden');
        updateCount();
        eventName.focus();
    };

    const renderList = () => {
        const events = loadEvents();
        eventList.innerHTML = '';

        if (!events.length) {
            const empty = document.createElement('p');
            empty.className = 'field-hint';
            empty.textContent = 'No events yet. Create Hackathon, Startup Pitch, or any other programme first.';
            eventList.appendChild(empty);
            return;
        }

        events.forEach((event) => {
            const card = document.createElement('article');
            card.className = 'item-card';

            const title = document.createElement('h3');
            title.textContent = event.name;

            const meta = document.createElement('p');
            meta.className = 'item-meta';
            meta.textContent = `${(event.emails || []).length} people${event.description ? ` · ${event.description}` : ''}`;

            const actions = document.createElement('div');
            actions.className = 'row-actions';

            const editBtn = document.createElement('button');
            editBtn.type = 'button';
            editBtn.className = 'btn-secondary btn-small';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', () => loadEventIntoForm(event));

            const sendBtn = document.createElement('a');
            sendBtn.className = 'btn-secondary btn-small btn-link';
            sendBtn.href = `index.html?event=${encodeURIComponent(event.id)}`;
            sendBtn.textContent = 'Send campaign';

            const downloadBtn = document.createElement('button');
            downloadBtn.type = 'button';
            downloadBtn.className = 'btn-secondary btn-small';
            downloadBtn.textContent = 'Download people';
            downloadBtn.addEventListener('click', () => {
                downloadEventPeople(event);
                showToast('People list downloaded.', 'success');
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.type = 'button';
            deleteBtn.className = 'btn-secondary btn-small danger-text';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', () => {
                if (!confirm(`Delete event “${event.name}”?`)) return;
                deleteEvent(event.id);
                if (eventId.value === event.id) resetForm();
                renderList();
                showToast('Event deleted.', 'info');
            });

            actions.append(editBtn, sendBtn, downloadBtn, deleteBtn);
            card.append(title, meta, actions);
            eventList.appendChild(card);
        });
    };

    const mergeFile = async (file) => {
        try {
            const result = await extractEmailsFromUpload(file);
            const people = uniquePeople([
                ...parseRecipients(eventEmails.value),
                ...(result.people || result.emails.map((email) => ({ name: '', email })))
            ]);
            eventEmails.value = formatPeopleList(people);
            updateCount();
            if (!people.length) {
                showToast(`No email addresses were found in ${file.name}. Use Name and Email columns.`, 'error');
                return;
            }
            const named = people.filter((person) => person.name).length;
            const via = result.columnLabel ? ` from “${result.columnLabel}”` : '';
            showToast(
                `Loaded ${result.emails.length} recipient${result.emails.length !== 1 ? 's' : ''}${via} in ${file.name}${named ? ` (${named} with names)` : ''}.`,
                'success'
            );
        } catch (err) {
            showToast(err && err.message ? err.message : 'Could not read that file.', 'error');
        }
    };

    const readEvent = () => {
        const people = parseRecipients(eventEmails.value);
        return {
            name: eventName.value.trim(),
            description: eventDescription.value.trim(),
            people,
            emails: people.map((person) => person.email)
        };
    };

    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const payload = readEvent();
        if (!payload.name) {
            showToast('Event name is required.', 'error');
            return;
        }
        const saved = upsertEvent(payload);
        resetForm();
        renderList();
        showToast(`Added “${saved.name}” with ${saved.emails.length} people.`, 'success');
    });

    updateBtn.addEventListener('click', () => {
        const payload = readEvent();
        if (!eventId.value) {
            showToast('Choose an event to update, or use Save event to add a new one.', 'error');
            return;
        }
        if (!payload.name) {
            showToast('Event name is required.', 'error');
            return;
        }
        const saved = upsertEvent({ id: eventId.value, ...payload });
        resetForm();
        renderList();
        showToast(`Updated “${saved.name}”.`, 'success');
    });

    resetBtn.addEventListener('click', resetForm);
    eventEmails.addEventListener('input', updateCount);

    browseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        fileInput.click();
    });
    dropzone.addEventListener('click', (e) => {
        if (e.target.closest('#eventBrowseBtn')) return;
        fileInput.click();
    });
    fileInput.addEventListener('change', (e) => {
        if (e.target.files[0]) {
            mergeFile(e.target.files[0]);
            e.target.value = '';
        }
    });
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });
    dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        if (e.dataTransfer.files[0]) mergeFile(e.dataTransfer.files[0]);
    });

    updateCount();

    document.addEventListener('tha-library-changed', () => {
        renderList();
    });

    const showSharedEvents = () => {
        const editId = new URLSearchParams(window.location.search).get('id');
        if (editId && !eventId.value) {
            const existing = getEvent(editId);
            if (existing) loadEventIntoForm(existing);
        }
        renderList();
    };

    if (typeof whenSharedLibraryReady === 'function') {
        whenSharedLibraryReady().then(showSharedEvents);
    } else {
        showSharedEvents();
    }
});
