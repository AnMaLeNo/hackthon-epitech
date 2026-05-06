document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('task-form');
  const taskNameInput = document.getElementById('task-name');
  const startTimeInput = document.getElementById('start-time');
  const endTimeInput = document.getElementById('end-time');
  const taskList = document.getElementById('task-list');
  const emptyState = document.getElementById('empty-state');

  // Load tasks from storage
  loadTasks();

  // Set default times for convenience (current time and +1 hour)
  const now = new Date();
  startTimeInput.value = now.toTimeString().slice(0, 5);
  now.setHours(now.getHours() + 1);
  endTimeInput.value = now.toTimeString().slice(0, 5);

  // Add task event
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
      
      // Reset only task name, keep times or update them
      taskNameInput.value = '';
      
      // Optionally update times for the next task automatically
      startTimeInput.value = endTime;
      const [hours, minutes] = endTime.split(':').map(Number);
      const nextEnd = new Date();
      nextEnd.setHours(hours + 1, minutes);
      endTimeInput.value = nextEnd.toTimeString().slice(0, 5);
    }
  });

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

  function loadTasks() {
    chrome.storage.local.get(['tasks'], (result) => {
      const tasks = result.tasks || [];
      updateEmptyState(tasks.length);
      
      tasks.forEach(task => {
        renderTask(task);
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
    
    const deleteBtn = li.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', () => {
      deleteTask(task.id, li);
    });
    
    taskList.appendChild(li);
  }

  function deleteTask(id, element) {
    chrome.storage.local.get(['tasks'], (result) => {
      let tasks = result.tasks || [];
      tasks = tasks.filter(t => t.id !== id);
      
      chrome.storage.local.set({ tasks }, () => {
        // Animation
        element.style.opacity = '0';
        element.style.transform = 'translateY(-10px)';
        setTimeout(() => {
          element.remove();
          updateEmptyState(tasks.length);
        }, 300);
      });
    });
  }

  function updateEmptyState(count) {
    if (count === 0) {
      emptyState.style.display = 'block';
      taskList.style.display = 'none';
    } else {
      emptyState.style.display = 'none';
      taskList.style.display = 'flex';
    }
  }

  function escapeHTML(str) {
    const p = document.createElement('p');
    p.appendChild(document.createTextNode(str));
    return p.innerHTML;
  }
});
