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
        const emails = extractEmails(eventEmails.value);
        eventRecipientCount.textContent = `${emails.length} valid email${emails.length !== 1 ? 's' : ''}`;
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
        eventEmails.value = (event.emails || []).join('\n');
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

    const mergeFile = (file) => {
        if (!file.name.match(/\.(csv|txt)$/i)) {
            showToast('Please upload a .csv or .txt file', 'error');
            return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
            const combined = eventEmails.value ? `${eventEmails.value}\n${e.target.result}` : e.target.result;
            const emails = extractEmails(combined);
            eventEmails.value = emails.join('\n');
            updateCount();
            showToast(`Loaded ${emails.length} emails from ${file.name}`, 'success');
        };
        reader.readAsText(file);
    };

    const readEvent = () => ({
        name: eventName.value.trim(),
        description: eventDescription.value.trim(),
        emails: eventEmails.value
    });

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

    const editId = new URLSearchParams(window.location.search).get('id');
    if (editId) {
        const existing = getEvent(editId);
        if (existing) loadEventIntoForm(existing);
    }

    updateCount();
    renderList();
});
