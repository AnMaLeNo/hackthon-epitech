document.addEventListener('DOMContentLoaded', () => {
  // Elements for Tasks
  const form = document.getElementById('task-form');
  const taskNameInput = document.getElementById('task-name');
  const startTimeInput = document.getElementById('start-time');
  const endTimeInput = document.getElementById('end-time');
  const taskList = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');

  // Elements for Focus Mode & Blocklist
  const focusToggle = document.getElementById('focus-toggle');
  const blocklistForm = document.getElementById('blocklist-form');
  const domainNameInput = document.getElementById('domain-name');
  const blocklistList = document.getElementById('blocklist-list');
  const blocklistEmpty = document.getElementById('blocklist-empty');

  // Initial Data Load
  loadData();

  // Set default times for tasks (current time and +1 hour)
  const now = new Date();
  startTimeInput.value = now.toTimeString().slice(0, 5);
  now.setHours(now.getHours() + 1);
  endTimeInput.value = now.toTimeString().slice(0, 5);

  // --- FOCUS MODE LOGIC ---
  focusToggle.addEventListener('change', (e) => {
    chrome.storage.local.set({ focusMode: e.target.checked });
  });

  // --- TASK LOGIC ---
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    
    const taskName = taskNameInput.value.trim();
    const startTime = startTimeInput.value;
    const endTime = endTimeInput.value;
    
    if (taskName && startTime && endTime) {
      if (startTime >= endTime) {
        alert("L'heure de fin doit être postérieure à l'heure de début.");
        return;
      }
      
      const newTask = {
        id: Date.now().toString(),
        name: taskName,
        start: startTime,
        end: endTime
      };
      
      saveTask(newTask);
      taskNameInput.value = '';
      
      startTimeInput.value = endTime;
      const [hours, minutes] = endTime.split(':').map(Number);
      const nextEnd = new Date();
      nextEnd.setHours(hours + 1, minutes);
      endTimeInput.value = nextEnd.toTimeString().slice(0, 5);
    }
  });

  // --- BLOCKLIST LOGIC ---
  blocklistForm.addEventListener('submit', (e) => {
    e.preventDefault();
    let domain = domainNameInput.value.trim().toLowerCase();
    
    // Simplifier le domaine (enlever http/https et www)
    domain = domain.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];

    if (domain) {
      chrome.storage.local.get(['blocklist'], (result) => {
        const blocklist = result.blocklist || [];
        if (!blocklist.includes(domain)) {
          blocklist.push(domain);
          chrome.storage.local.set({ blocklist }, () => {
            renderDomain(domain);
            updateBlocklistEmptyState(blocklist.length);
          });
        }
      });
      domainNameInput.value = '';
    }
  });

  // --- SHARED FUNCTIONS ---
  function loadData() {
    chrome.storage.local.get(['tasks', 'focusMode', 'blocklist'], (result) => {
      // Load Focus Mode
      focusToggle.checked = result.focusMode || false;

      // Load Tasks
      const tasks = result.tasks || [];
      updateEmptyState(tasks.length);
      tasks.forEach(task => renderTask(task));

      // Load Blocklist
      const blocklist = result.blocklist || [];
      updateBlocklistEmptyState(blocklist.length);
      blocklist.forEach(domain => renderDomain(domain));
    });
  }

  function saveTask(task) {
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      tasks.push(task);
      chrome.storage.local.set({ tasks }, () => {
        renderTask(task);
        updateEmptyState(tasks.length);
      });
    });
  }

  function renderTask(task) {
    const li = document.createElement('li');
    li.className = 'task-item';
    li.dataset.id = task.id;
    
    li.innerHTML = `
      <div class="task-info">
        <span class="task-name">${escapeHTML(task.name)}</span>
        <span class="task-time">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          ${task.start} - ${task.end}
        </span>
      </div>
      <button class="delete-btn" aria-label="Supprimer">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
      </button>
    `;
    
    li.querySelector('.delete-btn').addEventListener('click', () => {
      deleteTask(task.id, li);
    });
    
    taskList.appendChild(li);
  }

  function deleteTask(id, element) {
    chrome.storage.local.get(['tasks'], (result) => {
      let tasks = result.tasks || [];
      tasks = tasks.filter(t => t.id !== id);
      chrome.storage.local.set({ tasks }, () => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          element.remove();
          updateEmptyState(tasks.length);
        }, 300);
      });
    });
  }

  function renderDomain(domain) {
    const li = document.createElement('li');
    li.className = 'domain-item';
    li.innerHTML = `
      <span class="domain-name">${escapeHTML(domain)}</span>
      <button class="delete-btn" aria-label="Supprimer">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
      </button>
    `;

    li.querySelector('.delete-btn').addEventListener('click', () => {
      deleteDomain(domain, li);
    });

    blocklistList.appendChild(li);
  }

  function deleteDomain(domain, element) {
    chrome.storage.local.get(['blocklist'], (result) => {
      let blocklist = result.blocklist || [];
      blocklist = blocklist.filter(d => d !== domain);
      chrome.storage.local.set({ blocklist }, () => {
        element.style.opacity = '0';
        element.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          element.remove();
          updateBlocklistEmptyState(blocklist.length);
        }, 300);
      });
    });
  }

  function updateEmptyState(count) {
    emptyState.style.display = count === 0 ? 'block' : 'none';
    taskList.style.display = count === 0 ? 'none' : 'flex';
  }

  function updateBlocklistEmptyState(count) {
    blocklistEmpty.style.display = count === 0 ? 'block' : 'none';
    blocklistList.style.display = count === 0 ? 'none' : 'flex';
  }

  function escapeHTML(str) {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
  }
});
