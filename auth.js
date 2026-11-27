"use strict";

const ACCOUNT_KEY = "daily-audit-account-v1";
const SESSION_KEY = "daily-audit-session-v1";

function getAccount() {
  try {
    const account = JSON.parse(localStorage.getItem(ACCOUNT_KEY));
    return account && account.email ? { email: account.email } : { email: "" };
  } catch {
    return { email: "" };
  }
}

function saveAccount(account) {
  localStorage.setItem(
    ACCOUNT_KEY,
    JSON.stringify({ email: String(account.email || "").toLowerCase() }),
  );
}

function randomSalt() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

async function migrateLegacyAccount() {
  try {
    const legacy = JSON.parse(localStorage.getItem(ACCOUNT_KEY));
    if (legacy && legacy.email && typeof legacy.password === "string") {
      await saveOfflineCredential(String(legacy.email), legacy.password);
      localStorage.setItem(
        ACCOUNT_KEY,
        JSON.stringify({ email: String(legacy.email).toLowerCase() }),
      );
    }
  } catch (error) {
    console.warn("Could not migrate the legacy account credential.", error);
  }
}

function createConnectionIndicator() {
  const style = document.createElement("style");
  style.textContent = `
    #connection-status { position: fixed; z-index: 9999; right: 16px; bottom: 16px; min-height: 36px;
      display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: 999px;
      background: #fff; border: 1px solid #d7e1ef; box-shadow: 0 8px 24px rgba(27,43,74,.15);
      color: #475670; font: 600 12px/1.2 "DM Sans","Noto Sans Myanmar",sans-serif; }
    #connection-status::before { width: 9px; height: 9px; border-radius: 50%; content: ""; background: #14876b; }
    #connection-status.offline { color: #9a3d46; border-color: #efc7cc; }
    #connection-status.offline::before { background: #c24d5b; }
    #connection-status.restored::before { background: #14876b; }
  `;
  document.head.append(style);
  const indicator = document.createElement("div");
  indicator.id = "connection-status";
  indicator.setAttribute("role", "status");
  indicator.setAttribute("aria-live", "polite");
  document.body.append(indicator);
  return indicator;
}

function updateConnectionIndicator(restored = false) {
  const indicator =
    document.getElementById("connection-status") || createConnectionIndicator();
  indicator.className = navigator.onLine
    ? restored
      ? "restored"
      : ""
    : "offline";
  indicator.textContent = navigator.onLine
    ? restored
      ? "Connection Internet ပြန်လည်ချိတ်ဆက်ပြီးပါပြီ"
      : "Online"
    : "Offline";
  if (restored) {
    window.clearTimeout(updateConnectionIndicator.restoredTimer);
    updateConnectionIndicator.restoredTimer = window.setTimeout(
      () => updateConnectionIndicator(false),
      4000,
    );
  }
}

let lastConnectionState = navigator.onLine ? "online" : "offline";

async function probeConnection() {
  if (!navigator.onLine) {
    lastConnectionState = "offline";
    updateConnectionIndicator(false);
    return;
  }
  const controller =
    typeof AbortController === "function" ? new AbortController() : null;
  const timeout = controller
    ? window.setTimeout(() => controller.abort(), 2500)
    : null;
  try {
    const response = await fetch("/api/deliveries", {
      cache: "no-store",
      headers: { Accept: "application/json" },
      signal: controller ? controller.signal : undefined,
    });
    if (!response.ok)
      throw new Error("The server did not respond successfully.");
    if (lastConnectionState === "offline") {
      lastConnectionState = "online";
      updateConnectionIndicator(true);
      window.dispatchEvent(new Event("online"));
    } else {
      lastConnectionState = "online";
      updateConnectionIndicator(false);
    }
  } catch {
    const wasOnline = lastConnectionState === "online";
    lastConnectionState = "offline";
    updateConnectionIndicator(false);
    if (wasOnline) window.dispatchEvent(new Event("offline"));
  } finally {
    if (timeout) window.clearTimeout(timeout);
  }
}

window.setInterval(probeConnection, 3000);

async function passwordVerifier(password, salt) {
  const encoded = new TextEncoder().encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function saveOfflineCredential(email, password) {
  const salt = randomSalt();
  const passwordHash = await passwordVerifier(password, salt);
  await window.DailyAuditStore.saveCredential(email, salt, passwordHash);
  saveAccount({ email });
}

async function verifyOfflineCredential(email, password) {
  const credential = await window.DailyAuditStore.getCredential(email);
  if (!credential) return false;
  const passwordHash = await passwordVerifier(password, credential.salt);
  return passwordHash === credential.passwordHash;
}

function isGmail(email) {
  return /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@gmail\.com$/i.test(email.trim());
}

function hasSession() {
  return localStorage.getItem(SESSION_KEY) === "active";
}

function protectPage() {
  if (document.body.dataset.page && !hasSession()) {
    window.location.replace("login.html");
  }
}

function logout() {
  localStorage.removeItem(SESSION_KEY);
  window.location.replace("login.html");
}

if (document.body.dataset.authPage) {
  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const email = document.getElementById("email").value.trim();
      const password = document.getElementById("password").value;
      const message = document.getElementById("login-message");
      if (!isGmail(email)) {
        message.textContent = "Gmail လိပ်စာ အတည်ဖြစ်စေရန် ရိုက်ထည့်ပါ။";
        return;
      }
      try {
        const response = await fetch("/api/account/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const result = await response.json();
        if (!response.ok) {
          const account = getAccount();
          if (
            account.email &&
            email.toLowerCase() === account.email.toLowerCase() &&
            (await verifyOfflineCredential(email, password))
          ) {
            localStorage.setItem(SESSION_KEY, "active");
            window.location.replace("Dashboard.html");
            return;
          }
          message.textContent =
            response.status === 401
              ? "Gmail လိပ်စာ သို့မဟုတ် စကားဝှက် မမှန်ပါ။"
              : result.error;
          return;
        }
        await saveOfflineCredential(result.email, password);
        localStorage.setItem(SESSION_KEY, "active");
        window.location.replace("Dashboard.html");
      } catch {
        const account = getAccount();
        const localAccount = getAccount();
        if (
          (await verifyOfflineCredential(email, password)) ||
          (!localAccount.email && password === "123456")
        ) {
          if (!localAccount.email) await saveOfflineCredential(email, password);
          localStorage.setItem(SESSION_KEY, "active");
          window.location.replace("Dashboard.html");
        } else {
          message.textContent =
            "Gmail သို့မဟုတ် password စိစစ်၍မရပါ။";
        }
      }
    });
  }

  const resetPasswordButton = document.getElementById("reset-password-button");
  const forgotPasswordButton = document.getElementById(
    "forgot-password-button",
  );
  if (forgotPasswordButton) {
    forgotPasswordButton.addEventListener("click", () => {
      const emailInput = document.getElementById("email");
      const message = document.getElementById("login-message");
      emailInput.focus();
      if (!emailInput.value.trim()) {
        message.textContent =
          "Gmail ထည့်ပြီး password ပြန်သတ်မှတ်ရန်ကို နှိပ်ပါ။";
      }
    });
  }
  if (resetPasswordButton) {
    resetPasswordButton.addEventListener("click", async () => {
      const emailInput = document.getElementById("email");
      const message = document.getElementById("login-message");
      const email = emailInput.value.trim();
      if (!isGmail(email)) {
        message.textContent = "password ပြန်သတ်မှတ်မီ Gmailကို ထည့်ပါ။";
        emailInput.focus();
        return;
      }
      if (
        !window.confirm("password ကို original password 123456 သို့ ပြန်သတ်မှတ်မလား?")
      )
        return;
      try {
        const response = await fetch("/api/account/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        const result = await response.json();
        if (!response.ok) {
          message.textContent = result.error || "password ပြန်သတ်မှတ်၍မရပါ။";
          return;
        }
        await saveOfflineCredential(email, "123456");
        document.getElementById("password").value = "";
        message.className = "auth-message success";
        message.textContent =
          "password ပြန်သတ်မှတ်ပြီးပါပြီ။ original password 123456 ဖြင့် ဝင်ရောက်ပါ။";
      } catch {
        message.textContent = "Database သို့ ချိတ်ဆက်၍မရပါ။ password ပြန်သတ်မှတ်၍မရပါ။";
      }
    });
  }

  const changeForm = document.getElementById("change-form");
  if (changeForm) {
    if (!hasSession()) window.location.replace("login.html");
    changeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const account = getAccount();
      const currentPassword = document.getElementById("current-password").value;
      const newPassword = document.getElementById("new-password").value;
      const confirmPassword = document.getElementById("confirm-password").value;
      const message = document.getElementById("change-message");
      const submitButton = changeForm.querySelector('button[type="submit"]');
      const showMessage = (text, success = false) => {
        message.className = success ? "auth-message success" : "auth-message";
        message.textContent = text;
      };
      if (newPassword.length !== 6) {
        showMessage("New Password တွင်characters ၆ လုံးတိတိ ရှိရမည်။");
        return;
      }
      if (newPassword !== confirmPassword) {
        showMessage("New Password နှစ်ခု တူညီမှုမရှိပါ။");
        return;
      }
      if (newPassword === currentPassword) {
        showMessage("Current Password နှင့် မတူသော New Password ကို ရွေးပါ။");
        return;
      }
      submitButton.disabled = true;
      submitButton.textContent = "ပြောင်းနေပါသည်...";
      try {
        const response = await fetch("/api/account/change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: account.email,
            currentPassword,
            newPassword,
          }),
        });
        const result = await response.json();
        if (!response.ok) {
          showMessage(result.error || "New Password ပြောင်း၍မရပါ။");
          return;
        }
        await saveOfflineCredential(account.email, newPassword);
        showMessage("New Password အောင်မြင်စွာ ပြောင်းပြီးပါပြီ။", true);
        changeForm.reset();
        logout();
      } catch (error) {
        if (error instanceof TypeError || error instanceof SyntaxError) {
          const localAccount = getAccount();
          const localEmailMatches =
            !localAccount.email ||
            !account.email ||
            localAccount.email.toLowerCase() ===
              String(account.email).toLowerCase();
          if (
            localEmailMatches &&
            (await verifyOfflineCredential(account.email, currentPassword))
          ) {
            await saveOfflineCredential(
              localAccount.email || account.email,
              newPassword,
            );
            showMessage(
              "browserအတွက်သာ passwordပြောင်းထားသည်။ server သို့မဟုတ် အခြားစက်များတွင် ပြောင်းမထားပါ။",
              true,
            );
            changeForm.reset();
            logout();
          } else {
            showMessage(
              "serverသို့ ချိတ်ဆက်၍မရပါ။ browserတွင် သိမ်းထားသော current passwordကို စိစစ်ပါ။",
            );
          }
          return;
        }
        console.error("Could not change password with the server.", error);
        showMessage("serverတုံ့ပြန်မှုကို ဖတ်၍မရပါ။ ထပ်မံကြိုးစားပါ။");
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = "change password";
      }
    });
  }
}

document.querySelectorAll("[data-password-toggle]").forEach((button) => {
  button.addEventListener("click", () => {
    const input = document.getElementById(button.dataset.passwordToggle);
    if (!input) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    button.setAttribute("aria-pressed", String(!showing));
    button.setAttribute(
      "aria-label",
      showing ? "password ပြရန်" : "password ဝှက်ရန်",
    );
  });
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    updateConnectionIndicator(false);
  });
} else {
  updateConnectionIndicator(false);
}
window.addEventListener("offline", () => {
  lastConnectionState = "offline";
  updateConnectionIndicator(false);
});
window.addEventListener("online", () => probeConnection());
probeConnection();
migrateLegacyAccount();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {});
  });
}

let deferredInstallPrompt = null;
window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  const installButton = document.getElementById("install-button");
  if (installButton) installButton.hidden = false;
});

const installButton = document.getElementById("install-button");
if (installButton) {
  installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) {
      alert(
        "browser menu ‘dashboardသို့ထည့်ရန်’ သို့မဟုတ် ‘App တပ်ဆင်ရန်’ ကို ရွေးပါ။",
      );
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
}
