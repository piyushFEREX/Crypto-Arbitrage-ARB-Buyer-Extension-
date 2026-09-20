// // popup.js

// document.addEventListener('DOMContentLoaded', () => {
//   // --- DOM Element References ---
//   const minPriceInput  = document.getElementById('minPrice');
//   const maxPriceInput  = document.getElementById('maxPrice');
//   const delayMsInput   = document.getElementById('delayMs');
//   const autoBuyToggle  = document.getElementById('autoBuyToggle');
//   const toggleBtn      = document.getElementById('toggleBtn');

//   // --- Initial Setup / State ---
//   // You can load saved settings from chrome.storage here if needed

  
//   // --- Event Listeners ---
  
//   // 1. Start / Stop Button Click
//   toggleBtn.addEventListener('click', async () => {
//     // Read current input values
//     const minVal = parseFloat(minPriceInput.value);
//     const maxVal = parseFloat(maxPriceInput.value);
//     const delay  = parseInt(delayMsInput.value, 10);
//     const isAutoBuyOrderEnabled = autoBuyToggle.checked;

//     // TODO: Write your start/stop toggle logic & chrome.tabs.sendMessage call here
//   });

//   // 2. Toggle Switch Change
//   autoBuyToggle.addEventListener('change', (e) => {
//     const isChecked = e.target.checked;
    
//     // TODO: Write your toggle behavior here
//   });

// });



document.addEventListener('DOMContentLoaded', async () => {
  const minValInput = document.getElementById('minVal');
  const maxValInput = document.getElementById('maxVal');
  const delayMsInput = document.getElementById('delayMs');
  const targetTabInput = document.getElementById('targetTab');
  const autoSelectPaymentInput = document.getElementById('autoSelectPayment');
  const startBtn = document.getElementById('startBtn');
  const stopBtn = document.getElementById('stopBtn');
  const statusIndicator = document.getElementById('statusIndicator');

  // Load saved configuration from storage when popup opens
  chrome.storage.local.get(['autoBuyConfig'], (result) => {
    if (result.autoBuyConfig) {
      const cfg = result.autoBuyConfig;
      minValInput.value = cfg.minVal ?? '';
      maxValInput.value = cfg.maxVal ?? '';
      delayMsInput.value = cfg.delayMs ?? '';
      targetTabInput.value = cfg.targetTab ?? '';
      autoSelectPaymentInput.checked = cfg.autoSelectPayment ?? true;
    }
  });

  // Start Button Click Handler
  startBtn.addEventListener('click', async () => {
    const payload = {
      minVal: Number(minValInput.value),
      maxVal: Number(maxValInput.value),
      delayMs: Number(delayMsInput.value),
      targetTab: targetTabInput.value.trim(),
      autoSelectPayment: autoSelectPaymentInput.checked
    };

    // Save to storage
    await chrome.storage.local.set({ autoBuyConfig: payload });

    // Send payload message to active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: "EXECUTE_REFRESH", payload }, (response) => {
        if (chrome.runtime.lastError) {
          statusIndicator.textContent = "Status: Page not ready or not loaded.";
        } else {
          statusIndicator.textContent = "Status: Running...";
          statusIndicator.style.color = "#198754";
        }
      });
    }
  });

  // Stop Button Click Handler
  stopBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      chrome.tabs.sendMessage(tab.id, { action: "STOP_REFRESH" }, (response) => {
        statusIndicator.textContent = "Status: Stopped";
        statusIndicator.style.color = "#dc3545";
      });
    }
  });
});