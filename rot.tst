// Global flag to track and stop the loop once completed or manually cancelled
let isAutoBuyActive = false;
let currentLoopTimeout = null;

/**
 * Triggers full refresh & buy sequence. Loops automatically until a target is clicked.
 * @param {number} minVal - Minimum target price
 * @param {number} maxVal - Maximum target price
 * @param {number} delayMs - Delay between refresh attempts in milliseconds (default: 400ms)
 */
async function startAutoBuyLoop(minVal, maxVal, delayMs = 100) {
  if (isAutoBuyActive) {
    console.warn("[AutoBuy] Loop is already running.");
    return;
  }

  isAutoBuyActive = true;
  console.log(`[AutoBuy] Engine Started! Hunting for range ₹${minVal} - ₹${maxVal}...`);

  async function executionStep() {
    if (!isAutoBuyActive) return;

    // 1. First check if a matching item is ALREADY visible before triggering a refresh
    const bought = attemptPurchase(minVal, maxVal);
    if (bought) {
      stopAutoBuyLoop("Success! Item matched and clicked. Halting execution.");
      return;
    }

    // 2. Open dropdown menu
    const dropdownButton = findDropdownButton();
    if (dropdownButton) {
      dispatchMouseEventChain(dropdownButton);
    }

    // 3. Wait for popover menu to render and click "Default"
    const defaultOption = await waitForElement('.van-popover__action-text', 'Default', 300);

    if (defaultOption) {
      const targetButton = defaultOption.closest('.van-popover__action') || defaultOption;
      dispatchMouseEventChain(targetButton);

      // Brief pause for network/DOM re-render after clicking Default
      await new Promise((r) => setTimeout(r, 100));

      // 4. Check for target item after refresh
      const itemClicked = attemptPurchase(minVal, maxVal);
      if (itemClicked) {
        stopAutoBuyLoop("Success! Item matched and clicked after refresh. Halting execution.");
        return;
      }
    } else {
      console.warn("[AutoBuy] Popover 'Default' item not visible. Retrying cycle...");
    }

    // 5. If not found, schedule next loop iteration
    if (isAutoBuyActive) {
      currentLoopTimeout = setTimeout(executionStep, delayMs);
    }
  }

  executionStep();
}

/**
 * Stop loop and release control back to user
 */
function stopAutoBuyLoop(reason = "Stopped by user.") {
  isAutoBuyActive = false;
  if (currentLoopTimeout) clearTimeout(currentLoopTimeout);
  console.log(`[AutoBuy] Engine Stopped: ${reason}`);
}

/**
 * Scans DOM for matching target price and executes click
 * @returns {boolean} True if purchase target was clicked
 */
function attemptPurchase(val1, val2) {
  const min = Math.min(Number(val1), Number(val2));
  const max = Math.max(Number(val1), Number(val2));

  const items = document.querySelectorAll('.item');
  for (const item of items) {
    let amount = NaN;
    const maxAttr = item.getAttribute('maximumamount');

    if (maxAttr && !Number.isNaN(Number(maxAttr))) {
      amount = parseFloat(maxAttr);
    } else {
      const amountEl = item.querySelector('.amount');
      if (!amountEl) continue;

      const match = amountEl.textContent.match(/(?:₹|\$|\b)\s*(\d+(?:\.\d+)?)/);
      if (match && match[1]) amount = parseFloat(match[1]);
    }

    if (Number.isNaN(amount) || amount < min || amount > max) continue;

    const buyBtn = item.querySelector('button');

    if (
      buyBtn &&
      !buyBtn.disabled &&
      !buyBtn.classList.contains('van-button--disabled') &&
      buyBtn.offsetParent !== null
    ) {
      console.log(`[AutoBuy] MATCH FOUND! ₹${amount}. Clicking target now...`);
      dispatchMouseEventChain(buyBtn);
      return true; // Clicked successfully
    }
  }

  return false;
}

// --- UTILITY HELPERS ---

function findDropdownButton() {
  let btn = document.querySelector('.dropdown-toggle, [role="button"]');
  if (!btn) {
    const allElements = Array.from(document.querySelectorAll('button, div, span'));
    btn = allElements.find((el) => el.textContent.trim() === 'Default');
  }
  return btn;
}

function waitForElement(selector, textContent, timeoutMs = 300) {
  return new Promise((resolve) => {
    const startTime = Date.now();
    const check = () => {
      const elements = Array.from(document.querySelectorAll(selector));
      const match = elements.find((el) => el.textContent.trim().includes(textContent));

      if (match) {
        resolve(match);
      } else if (Date.now() - startTime >= timeoutMs) {
        resolve(null);
      } else {
        setTimeout(check, 20);
      }
    };
    check();
  });
}

function dispatchMouseEventChain(element) {
  const opts = { bubbles: true, cancelable: true, view: window };
  element.dispatchEvent(new MouseEvent('mouseover', opts));
  element.dispatchEvent(new MouseEvent('mouseenter', opts));
  element.dispatchEvent(new MouseEvent('mousedown', opts));
  element.dispatchEvent(new MouseEvent('mouseup', opts));
  element.click();
}

// --- EXTENSION MESSAGE LISTENER ---

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "EXECUTE_REFRESH") {
    // Start looping for range 1800 - 2000 with 300ms intervals
    startAutoBuyLoop(1800, 2000, 300);
    sendResponse({ status: "STARTED" });
  } else if (message.action === "STOP_REFRESH") {
    stopAutoBuyLoop("Cancelled via shortcut/popup.");
    sendResponse({ status: "STOPPED" });
  }
  return true;
});