"use strict";

const ACCOUNT_KEY = "daily-audit-account-v1";
const SESSION_KEY = "daily-audit-session-v1";

function getAccount() {
  try {
    return JSON.parse(localStorage.getItem(ACCOUNT_KEY)) || { email: "", password: "123456" };
  } catch {
    return { email: "", password: "123456" };
  }
}

function saveAccount(account) {
  localStorage.setItem(ACCOUNT_KEY, JSON.stringify(account));
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
        message.textContent = "Gmail address ကိုမှန်ကန်စွာထည့်ပါ။";
        return;
      }
      try {
        const response = await fetch("/api/account/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const result = await response.json();
        if (!response.ok) {
          const account = getAccount();
          if (account.email && email.toLowerCase() === account.email.toLowerCase()
            && password === (account.password || "")) {
            localStorage.setItem(SESSION_KEY, "active");
            window.location.replace("Dashboard.html");
            return;
          }
          message.textContent = response.status === 401
            ? "Gmail address သို့မဟုတ် Password မှားယွင်းနေသည်။"
            : result.error;
          return;
        }
        saveAccount({ email: result.email, password });
        localStorage.setItem(SESSION_KEY, "active");
        window.location.replace("Dashboard.html");
      } catch {
        const account = getAccount();
        if (!account.email) {
          saveAccount({ email: email.toLowerCase(), password: "123456" });
        }
        const localAccount = getAccount();
        if (email.toLowerCase() === localAccount.email.toLowerCase()
          && password === localAccount.password) {
          localStorage.setItem(SESSION_KEY, "active");
          window.location.replace("Dashboard.html");
        } else {
          message.textContent = "Gmail သို့မဟုတ် Password မှန်ကန်မှု စစ်မရပါ။";
        }
      }
    });
  }

  const resetPasswordButton = document.getElementById("reset-password-button");
  if (resetPasswordButton) {
    resetPasswordButton.addEventListener("click", async () => {
      const emailInput = document.getElementById("email");
      const message = document.getElementById("login-message");
      const email = emailInput.value.trim();
      if (!isGmail(email)) {
        message.textContent = "Reset လုပ်ရန် Gmail address ကိုအရင်ထည့်ပါ။";
        emailInput.focus();
        return;
      }
      if (!window.confirm("Password ကို default password 123456 အဖြစ် reset လုပ်မှာ သေချာပါသလား။")) return;
      try {
        const response = await fetch("/api/account/reset", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email })
        });
        const result = await response.json();
        if (!response.ok) {
          message.textContent = result.error || "Password reset မရပါ။";
          return;
        }
        saveAccount({ email: email.toLowerCase(), password: "123456" });
        document.getElementById("password").value = "";
        message.className = "auth-message success";
        message.textContent = "Password reset ပြီးပါပြီ။ Default password 123456 ဖြင့်ဝင်နိုင်ပါပြီ။";
      } catch {
        message.textContent = "Database server သို့မချိတ်ဆက်နိုင်ပါ။";
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
      if (newPassword.length < 6) {
        message.textContent = "Password အသစ်သည် အနည်းဆုံး ၆ လုံး ဖြစ်ရပါမည်။";
        return;
      }
      if (newPassword !== confirmPassword) {
        message.textContent = "Password အသစ်နှစ်ခုပြန်ဖြည့်ချက် မတူပါ။";
        return;
      }
      try {
        const response = await fetch("/api/account/change", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: account.email,
            currentPassword,
            newPassword
          })
        });
        const result = await response.json();
        if (!response.ok) {
          message.textContent = result.error || "Password ပြောင်းမရပါ။";
          return;
        }
        saveAccount({ email: account.email, password: newPassword });
        message.className = "auth-message success";
        message.textContent = "Password ပြောင်းပြီးပါပြီ။";
        changeForm.reset();
      } catch {
        message.textContent = "Database server သို့မချိတ်ဆက်နိုင်ပါ။";
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
    button.setAttribute("aria-label", showing ? "Password ကြည့်ရန်" : "Password ဝှက်ရန်");
  });
});

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
      alert("Browser menu မှ Add to Home Screen သို့မဟုတ် Install App ကိုရွေးပါ။");
      return;
    }
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    installButton.hidden = true;
  });
}
