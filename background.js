// Listen for command defined in manifest.json
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "trigger-refresh-shortcut") {
    // 1. Get current active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    if (tab && tab.id) {
      // 2. Fetch stored preferences from storage
      chrome.storage.local.get(["autoBuyConfig"], (result) => {
        const payload = result.autoBuyConfig || {
          minVal: 800,
          maxVal: 1000,
          delayMs: 50,
          targetTab: "OTP-UPI",
          autoSelectPayment: true
        };

        // 3. Dispatch execution message to content script
        chrome.tabs.sendMessage(tab.id, {
          action: "EXECUTE_REFRESH",
          payload: payload
        }).catch((err) => console.log("Tab not ready for message:", err));
      });
    }
  }
});