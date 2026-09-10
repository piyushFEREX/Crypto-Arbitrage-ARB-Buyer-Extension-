// Listen for the keyboard shortcut command from the browser
chrome.commands.onCommand.addListener((command) => {
  if (command === "trigger-refresh-shortcut") {
    // Find the webpage tab you are currently looking at
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].id) {
        // Send a hidden message to the webpage telling it to run the click code
        chrome.tabs.sendMessage(tabs[0].id, { action: "EXECUTE_REFRESH" });
      }
    });
  }
});
