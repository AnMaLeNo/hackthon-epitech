// État en mémoire pour éviter les déclenchements multiples sur le même domaine
const blockedTabs = {}; // { tabId: "hostname" }

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Ne réagir que lorsque l'URL change (ou au chargement complet si nécessaire)
  if (!changeInfo.url) return;

  try {
    const url = new URL(changeInfo.url);
    // Ignorer les pages internes du navigateur
    if (url.protocol.startsWith('chrome')) return;

    const hostname = url.hostname;

    // Récupérer l'état actuel (Focus Mode, Tâches, Blocklist)
    const data = await new Promise((resolve) => {
      chrome.storage.local.get(['focusMode', 'tasks', 'blocklist'], resolve);
    });

    const isFocusMode = data.focusMode === true;
    const tasks = data.tasks || [];
    const blocklist = data.blocklist || [];

    // Vérifier si le domaine actuel correspond à la blocklist
    const isBlockedDomain = blocklist.some(domain => hostname.includes(domain));

    // --- Comportement 2 : envoi au test-server sur toute navigation en mode focus ---
    // (déclenché indépendamment de la blocklist)
    if (isFocusMode) {
      const activeTask = getActiveTask(tasks);
      if (activeTask) {
        console.log(`[Test-Server] Navigation détectée en mode Focus : ${changeInfo.url}`);
        sendToTestServer(changeInfo.url, activeTask.name);
      }
    }

    // --- Comportement 1 : webhook Discord si site bloqué ---
    if (isBlockedDomain) {
      // Si on était déjà sur ce domaine bloqué dans cet onglet, on ne renvoie pas le webhook
      if (blockedTabs[tabId] === hostname) {
        return;
      }

      // Nouveau domaine bloqué visité
      blockedTabs[tabId] = hostname;

      // 1. L'état "Mode Focus" est évalué à True
      if (!isFocusMode) return;

      // 2. L'horodatage système est inclus dans l'intervalle défini par les variables d'une tâche existante
      const activeTask = getActiveTask(tasks);

      // 3. L'URI correspond à la blocklist (déjà vérifié)
      if (activeTask) {
        console.log(`Violation détectée : navigation vers ${hostname}`);
        triggerWebhook();
      }

    } else {
      // Si on navigue vers un domaine non bloqué, on réinitialise l'état de l'onglet
      delete blockedTabs[tabId];
    }
  } catch (error) {
    console.error("Erreur lors de l'analyse de l'URL :", error);
  }
});

// Nettoyer l'état quand un onglet est fermé
chrome.tabs.onRemoved.addListener((tabId) => {
  delete blockedTabs[tabId];
});

/**
 * Retourne la première tâche active selon l'heure courante, ou null si aucune.
 */
function getActiveTask(tasks) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  return tasks.find(task => {
    const [startH, startM] = task.start.split(':').map(Number);
    const [endH, endM] = task.end.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (endMinutes < startMinutes) {
      return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
    }
    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  }) || null;
}

/**
 * Envoie un webhook POST au serveur Discord relay.
 */
function triggerWebhook() {
  fetch("http://100.84.166.112:8800/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content: "Bonjour depuis le relais !" })
  })
    .then(response => console.log("[Discord] Webhook envoyé", response.status))
    .catch(error => console.error("[Discord] Erreur d'envoi", error));
}

/**
 * Envoie un GET au test-server avec le nom, l'URL visitée et la tâche en cours.
 */
function sendToTestServer(visitedUrl, taskName) {
  // Récupérer le nom de l'utilisateur depuis le storage
  chrome.storage.local.get(['userName'], (result) => {
    const userName = result.userName || 'Anonyme';

    const params = new URLSearchParams({
      "name": userName,
      "tâche": taskName,
      "url": visitedUrl
    });

    fetch(`http://100.84.166.112:8800/process?${params.toString()}`, {
      method: "GET"
    })
      .then(response => console.log("[Test-Server] Requête envoyée", response.status))
      .catch(error => console.error("[Test-Server] Erreur d'envoi", error));
  });
}
