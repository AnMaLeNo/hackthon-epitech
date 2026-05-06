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
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const hasActiveTask = tasks.some(task => {
        const [startH, startM] = task.start.split(':').map(Number);
        const [endH, endM] = task.end.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;
        
        // Gérer le cas où la tâche se termine le lendemain (minuit passé)
        if (endMinutes < startMinutes) {
          return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
        }
        return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
      });

      // 3. L'URI correspond à la blocklist (déjà vérifié)
      if (hasActiveTask) {
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

function triggerWebhook() {
  fetch("http://localhost:8080/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ content: "Bonjour depuis le relais !" })
  })
  .then(response => console.log("Webhook envoyé avec succès", response.status))
  .catch(error => console.error("Erreur d'envoi du Webhook", error));
}
