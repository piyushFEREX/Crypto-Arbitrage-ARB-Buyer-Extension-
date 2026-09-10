// Global state
let isAutoBuyActive = false;
let globalPaymentObserver = null;

/**
 * High-Speed Payment Auto-Selector
 * Triggers the exact microsecond the payment options modal renders into the DOM.
 */
function listenForPaymentModal() {
  if (globalPaymentObserver) globalPaymentObserver.disconnect();

  globalPaymentObserver = new MutationObserver(() => {
    // Check if payment page header or list container exists
    const bankList = document.querySelector('.bank-list');
    if (bankList) {
      // Find the first option under "Please select payment account"
      const firstPaymentOption = bankList.querySelector('.item.select .x-row');
      if (firstPaymentOption) {
        // Disconnect immediately to avoid duplicate clicks
        globalPaymentObserver.disconnect();
        globalPaymentObserver = null;

        console.log("[AutoBuy] Payment screen detected! Clicking first available option instantly...");
        fastClick(firstPaymentOption);
        stopAutoBuyLoop("Payment option clicked successfully!");
      }
    }
  });

  // Watch entire document subtree for fast injection
  globalPaymentObserver.observe(document.body, { childList: true, subtree: true });
}

/**
 * Ensures the 'OTP-UPI' tab is active before proceeding.
 */
async function ensureOtpUpiTabActive() {
  const activeTab = document.querySelector('.van-tab--active');
  
  if (activeTab && activeTab.textContent.includes('OTP-UPI')) {
    return true;
  }

  const tabs = document.querySelectorAll('.van-tab');
  let targetTab = null;
  for (let i = 0; i < tabs.length; i++) {
    if (tabs[i].textContent.includes('OTP-UPI')) {
      targetTab = tabs[i];
      break;
    }
  }

  if (targetTab) {
    console.log("[AutoBuy] Switching to OTP-UPI tab...");
    fastClick(targetTab);

    return new Promise((resolve) => {
      if (targetTab.classList.contains('van-tab--active') || targetTab.getAttribute('aria-selected') === 'true') {
        resolve(true);
        return;
      }

      const observer = new MutationObserver(() => {
        if (targetTab.classList.contains('van-tab--active') || targetTab.getAttribute('aria-selected') === 'true') {
          observer.disconnect();
          resolve(true);
        }
      });

      observer.observe(targetTab, { attributes: true, attributeFilter: ['class', 'aria-selected'] });

      setTimeout(() => {
        observer.disconnect();
        resolve(false);
      }, 200);
    });
  }

  return false;
}

/**
 * Optimized target purchase check.
 */
function attemptPurchase(minVal, maxVal) {
  const min = Math.min(Number(minVal), Number(maxVal));
  const max = Math.max(Number(minVal), Number(maxVal));

  const buyButtons = document.querySelectorAll('.item button:not([disabled]):not(.van-button--disabled)');
  
  for (let i = 0; i < buyButtons.length; i++) {
    const buyBtn = buyButtons[i];
    if (buyBtn.offsetParent === null) continue;

    const item = buyBtn.closest('.item');
    if (!item) continue;

    let amount = NaN;
    const maxAttr = item.getAttribute('maximumamount');

    if (maxAttr && maxAttr !== '') {
      amount = +maxAttr;
    } else {
      const amountEl = item.querySelector('.amount');
      if (amountEl) {
        const match = amountEl.textContent.match(/\d+(?:\.\d+)?/);
        if (match) amount = +match[0];
      }
    }

    if (!isNaN(amount) && amount >= min && amount <= max) {
      console.log(`[AutoBuy] MATCH FOUND! ₹${amount}. Dispatching purchase...`);
      fastClick(buyBtn);
      return true;
    }
  }

  return false;
}

/**
 * Fires events synchronously without event object overhead.
 */
function fastClick(element) {
  element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window }));
  element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window }));
  element.click();
}

/**
 * Waits for popover target instantly using MutationObserver.
 */
function waitForPopoverAction(timeoutMs = 300) {
  return new Promise((resolve) => {
    const existing = document.querySelector('.van-popover__action');
    if (existing && existing.textContent.includes('Default')) {
      resolve(existing);
      return;
    }

    let timer = null;
    const observer = new MutationObserver(() => {
      const actions = document.querySelectorAll('.van-popover__action-text');
      for (let i = 0; i < actions.length; i++) {
        if (actions[i].textContent.trim().includes('Default')) {
          observer.disconnect();
          if (timer) clearTimeout(timer);
          resolve(actions[i].closest('.van-popover__action') || actions[i]);
          return;
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    timer = setTimeout(() => {
      observer.disconnect();
      resolve(null);
    }, timeoutMs);
  });
}

/**
 * Main automated refresh and buy cycle.
 */
async function runCycle(minVal, maxVal, delayMs) {
  if (!isAutoBuyActive) return;

  // Pre-check step: If payment page already loaded before cycle starts, handle it
  const bankList = document.querySelector('.bank-list');
  if (bankList) {
    const firstOption = bankList.querySelector('.item.select .x-row');
    if (firstOption) {
      fastClick(firstOption);
      stopAutoBuyLoop("Payment option clicked.");
      return;
    }
  }

  // Step 1: Instant check before refreshing
  if (attemptPurchase(minVal, maxVal)) {
    // Target clicked! MutationObserver takes over to watch for the payment modal
    return;
  }

  // Step 2: Open dropdown
  let dropdownButton = document.querySelector('.dropdown-toggle, [role="button"]');
  if (!dropdownButton) {
    const nodes = document.querySelectorAll('button, div, span');
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].textContent.trim() === 'Default') {
        dropdownButton = nodes[i];
        break;
      }
    }
  }

  if (dropdownButton) {
    fastClick(dropdownButton);

    // Step 3: Wait for popover via MutationObserver
    const defaultOption = await waitForPopoverAction(300);

    if (defaultOption) {
      fastClick(defaultOption);

      // Step 4: Check target instantly post-refresh
      if (attemptPurchase(minVal, maxVal)) {
        // Target clicked! Observer handles payment selection
        return;
      }
    }
  }

  // Step 5: Schedule next refresh tick if payment page hasn't mounted
  if (isAutoBuyActive) {
    setTimeout(() => runCycle(minVal, maxVal, delayMs), delayMs);
  }
}

async function startAutoBuyLoop(minVal, maxVal, delayMs = 50) {
  if (isAutoBuyActive) return;
  isAutoBuyActive = true;
  console.log(`[AutoBuy] Engine Started (Ultra-Fast Mode)`);

  // Activate background observer for the payment page immediately
  listenForPaymentModal();

  // Ensure 'OTP-UPI' is active before starting loop execution
  await ensureOtpUpiTabActive();

  runCycle(minVal, maxVal, delayMs);
}

function stopAutoBuyLoop(reason = "Stopped by user.") {
  isAutoBuyActive = false;
  if (globalPaymentObserver) {
    globalPaymentObserver.disconnect();
    globalPaymentObserver = null;
  }
  console.log(`[AutoBuy] Engine Stopped: ${reason}`);
}

// Extension message receiver
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "EXECUTE_REFRESH") {
    startAutoBuyLoop(1800, 2000, 50);
    sendResponse({ status: "STARTED" });
  } else if (message.action === "STOP_REFRESH") {
    stopAutoBuyLoop("Cancelled via shortcut/popup.");
    sendResponse({ status: "STOPPED" });
  }
  return true;
});