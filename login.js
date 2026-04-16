const roleButtons = document.querySelectorAll(".auth-role-button");
const methodButtons = document.querySelectorAll(".auth-method-button");
const phonePanel = document.getElementById("phonePanel");
const googlePanel = document.getElementById("googlePanel");
const loginPhoneInput = document.getElementById("loginPhoneInput");
const loginPasswordInput = document.getElementById("loginPasswordInput");
const loginNameInput = document.getElementById("loginNameInput");
const loginVillageInput = document.getElementById("loginVillageInput");
const loginButton = document.getElementById("loginButton");
const otpStatus = document.getElementById("otpStatus");
const googleLoginButton = document.getElementById("googleLoginButton");
const backHomeButton = document.getElementById("backHomeButton");
const loginSessionSummary = document.getElementById("loginSessionSummary");
const loginNameHint = document.getElementById("loginNameHint");
const loginModeBadge = document.getElementById("loginModeBadge");
const loginHint = document.getElementById("loginHint");

const loginState = {
  authRole: "seller",
  authMethod: "phone",
};

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function validatePhoneNumber(phone) {
  return /^\+?\d{10,15}$/.test(normalizePhone(phone));
}

function fetchJson(url, options) {
  return fetch(url, options).then(async (response) => {
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(errorText || response.statusText);
    }
    return response.json();
  });
}

function updateRoleDisplay() {
  roleButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.role === loginState.authRole);
  });
  loginNameHint.textContent = loginState.authRole === "buyer" ? "Buyer name" : "Seller name";
  loginModeBadge.textContent = loginState.authRole === "buyer" ? "Buyer login" : "Seller login";
  loginHint.textContent = loginState.authRole === "buyer"
    ? "Buyers can view listings and place orders after signing in."
    : "Sellers can manage inventory and respond to buyers after signing in.";
  updateSessionSummary();
}

function updateMethodDisplay() {
  methodButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.method === loginState.authMethod);
  });
  phonePanel.classList.toggle("hidden", loginState.authMethod !== "phone");
  googlePanel.classList.toggle("hidden", loginState.authMethod !== "google");
  if (loginState.authMethod === "phone") {
    otpStatus.textContent = "Enter your phone and password to log in.";
  }
}

function updateSessionSummary() {
  const session = getSavedAuthSession();
  if (!session) {
    loginSessionSummary.textContent = "Not signed in";
    return;
  }
  loginSessionSummary.textContent = `${session.role.toUpperCase()} active: ${session.profile.name}`;
}

function getSavedAuthSession() {
  const raw = window.localStorage.getItem("voiceRuralAuthSession");
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw);
  } catch (_error) {
    return null;
  }
}

function saveAuthSession(session) {
  window.localStorage.setItem("voiceRuralAuthSession", JSON.stringify(session));
}

function setStatus(message, isError = false) {
  otpStatus.textContent = message;
  otpStatus.style.color = isError ? "#a63e2e" : "var(--muted)";
}

async function performPhoneLogin() {
  const phone = normalizePhone(loginPhoneInput.value.trim());
  const password = loginPasswordInput.value.trim();
  const name = loginNameInput.value.trim();
  if (!validatePhoneNumber(phone)) {
    setStatus("Enter a valid phone number first.", true);
    return;
  }
  if (!password) {
    setStatus("Enter your password to continue.", true);
    return;
  }
  if (!name) {
    setStatus("Please enter your name.", true);
    return;
  }
  const payload = {
    name,
    phone,
    village: loginVillageInput.value.trim() || "Village Cluster",
    role: loginState.authRole,
    password,
  };
  await completeLogin(payload);
}

async function handleGoogleLogin() {
  const payload = {
    name: loginNameInput.value.trim() || (loginState.authRole === "buyer" ? "Buyer" : "Priya Sharma"),
    phone: validatePhoneNumber(loginPhoneInput.value.trim()) ? normalizePhone(loginPhoneInput.value.trim()) : "+91 98765 43210",
    village: loginVillageInput.value.trim() || "Nashik Cluster",
    role: loginState.authRole,
  };
  await completeLogin(payload);
}

async function completeLogin(payload) {
  try {
    setStatus(`Signing in as ${payload.role}...`);
    const profile = await fetchJson("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    saveAuthSession({ role: payload.role, profile });
    window.location.href = "dashboard.html";
  } catch (error) {
    setStatus(`Login failed: ${error.message}`, true);
  }
}

function attachEvents() {
  roleButtons.forEach((button) => {
    button.addEventListener("click", () => {
      loginState.authRole = button.dataset.role;
      updateRoleDisplay();
    });
  });

  methodButtons.forEach((button) => {
    button.addEventListener("click", () => {
      loginState.authMethod = button.dataset.method;
      updateMethodDisplay();
    });
  });

  if (loginButton) {
    loginButton.addEventListener("click", () => {
      void performPhoneLogin();
    });
  }

  googleLoginButton.addEventListener("click", () => {
    void handleGoogleLogin();
  });

  backHomeButton.addEventListener("click", () => {
    window.location.href = "index.html";
  });
}

function boot() {
  updateRoleDisplay();
  updateMethodDisplay();
  updateSessionSummary();
  attachEvents();
  const activeSession = getSavedAuthSession();
  if (activeSession) {
    window.location.href = "dashboard.html";
  }
}

boot();
