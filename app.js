const transcriptText = document.getElementById("transcriptText");
const generatedCommandText = document.getElementById("generatedCommandText");
const assistantReply = document.getElementById("assistantReply");
const assistantState = document.getElementById("assistantState");
const micOrbit = document.getElementById("micOrbit");
const listenButton = document.getElementById("listenButton");
const listenButtonLabel = document.getElementById("listenButtonLabel");
const startVoiceButton = document.getElementById("startVoiceButton");
const demoCommandButton = document.getElementById("demoCommandButton");
const saveListingButton = document.getElementById("saveListingButton");
const voiceFillButton = document.getElementById("voiceFillButton");
const speakSummaryButton = document.getElementById("speakSummaryButton");
const listingCards = document.getElementById("listingCards");
const ordersList = document.getElementById("ordersList");
const languageSelect = document.getElementById("languageSelect");
const languageBadge = document.getElementById("languageBadge");
const languageHint = document.getElementById("languageHint");
const suggestedCommands = document.getElementById("suggestedCommands");
const alertsList = document.getElementById("alertsList");
const alertCountBadge = document.getElementById("alertCountBadge");
const auditMetrics = document.getElementById("auditMetrics");
const auditReply = document.getElementById("auditReply");
const auditForm = document.getElementById("auditForm");
const auditQuery = document.getElementById("auditQuery");
const profileSummary = document.getElementById("profileSummary");
const accountHint = document.getElementById("accountHint");
const topLoginButton = document.getElementById("topLoginButton");
const landingSection = document.getElementById("landingSection");
const dashboardContent = document.getElementById("dashboardContent");
const landingLoginButton = document.getElementById("landingLoginButton");
const buyerDashboardSection = document.getElementById("buyerDashboardSection");
const buyerListingCards = document.getElementById("buyerListingCards");
const imageUploadInput = document.getElementById("imageUploadInput");
const imagePreview = document.getElementById("imagePreview");
const imagePreviewPlaceholder = document.getElementById("imagePreviewPlaceholder");
const imageUploadNote = document.getElementById("imageUploadNote");

const productName = document.getElementById("productName");
const productCategory = document.getElementById("productCategory");
const productPrice = document.getElementById("productPrice");
const productStock = document.getElementById("productStock");
const productDescription = document.getElementById("productDescription");
const contactPhone = document.getElementById("contactPhone");
const minStockAlert = document.getElementById("minStockAlert");

const baseLanguageContent = {
  auto: {
    label: "Auto Detect",
    hint: "Speech-to-text will auto-detect the seller language. The assistant will answer in the detected language.",
    demo: "Speak naturally in your preferred Indian language. You can mix local language and English words like price, stock, add, order, or kilo.",
    ready: "Auto-detect is active. Tap the microphone and speak in your preferred Indian language.",
    summary: "Today you have 3 active listings, 2 new buyer requests, and your marketplace activity is ready to review.",
    commands: [
      { label: "List Product", value: "10 kg vendakkai add panna one kilo 10 rupees" },
      { label: "Check Orders", value: "today order check pannanum" },
      { label: "Low Stock", value: "Show my low stock alerts" },
    ],
  },
  "en-IN": {
    label: "English",
    hint: "Best for English voice input and English audio playback.",
    demo: "Say your product name, quantity, and price. Example: Add 20 kilos of tomatoes for 32 rupees per kilo.",
    ready: "Voice assistant ready. Tap the microphone and speak naturally.",
    summary: "Today you have 3 active listings, 2 new buyer requests, and your tomato product is trending in nearby markets.",
    commands: [
      { label: "List Product", value: "Add 20 kilos of tomatoes for 32 rupees per kilo" },
      { label: "Check Orders", value: "Show pending orders" },
      { label: "Sales Audit", value: "How much did I sell today?" },
    ],
  },
  "hi-IN": {
    label: "हिन्दी",
    hint: "Hindi STT and Hindi TTS response mode.",
    demo: "Apna product naam, quantity aur price boliye. Jaise, 20 kilo tamatar 32 rupaye per kilo mein jodo.",
    ready: "Voice assistant taiyar hai. Microphone par tap karke boliye.",
    summary: "Aaj aapke paas 3 active listings hain, 2 naye buyer requests hain, aur aapka business summary taiyar hai.",
    commands: [
      { label: "प्रोडक्ट जोड़ें", value: "20 kilo tamatar 32 rupaye per kilo mein jodo" },
      { label: "ऑर्डर देखें", value: "Pending order dikhao" },
      { label: "सेल्स ऑडिट", value: "Aaj kitna becha?" },
    ],
  },
  "ta-IN": {
    label: "தமிழ்",
    hint: "Tamil STT and Tamil TTS response mode.",
    demo: "Ungal product peyar, alavu, vilai sollunga. Udharanam: 10 kilo vendakkai oru kilo 10 rupai serkkavum.",
    ready: "Voice assistant tayar. Microphone-ai tap seithu pesunga.",
    summary: "Inru ungalukku 3 active listings, 2 pudhiya buyer requests irukku, matrum business summary tayaraga irukku.",
    commands: [
      { label: "பொருள் சேர்", value: "10 kilo vendakkai oru kilo 10 rupai serkkavum" },
      { label: "ஆர்டர் பார்", value: "Pending orders kaattu" },
      { label: "விற்பனை சுருக்கம்", value: "Innaiku evlo sale aachu?" },
    ],
  },
};

const genericCommands = [
  { label: "List Product", value: "Add 10 kilos of fresh product at 30 rupees per kilo" },
  { label: "Check Orders", value: "Show pending orders" },
  { label: "Sales Audit", value: "What is my total profit?" },
];

const categoryMap = {
  vegetables: "Vegetables",
  vegetable: "Vegetables",
  handicrafts: "Handicrafts",
  craft: "Handicrafts",
  home_foods: "Home Foods",
  foods: "Home Foods",
  food: "Home Foods",
  dairy: "Dairy",
};

const state = {
  config: {
    sarvamConfigured: false,
    defaultSpeaker: "shubh",
    defaultLanguage: "en-IN",
    availableLanguages: [],
  },
  currentLanguage: "en-IN",
  lastDetectedLanguage: "en-IN",
  authMethod: "phone",
  authRole: "seller",
  authSession: null,
  pendingOtp: "",
  otpPhone: "",
  isListening: false,
  isBusy: false,
  audioChunks: [],
  mediaRecorder: null,
  activeAudio: null,
  listings: [],
  orders: [],
  alerts: [],
  profile: null,
  metrics: null,
  alertSpeechHistory: new Set(),
  uploadedImageData: "",
};

let dashboardPollTimer = 0;

function getLanguageMeta(code) {
  return state.config.availableLanguages.find((item) => item.code === code);
}

function getContentForLanguage(code) {
  if (baseLanguageContent[code]) {
    return baseLanguageContent[code];
  }

  const meta = getLanguageMeta(code);
  return {
    label: meta?.nativeLabel || meta?.label || "Language",
    hint: `Voice mode is set to ${meta?.label || code}. STT and TTS will use this language where available.`,
    demo: "Speak your product name, quantity, and price. You can also mix local language and English words like add, stock, price, or order.",
    ready: `Voice assistant is ready in ${meta?.label || code}. Tap the microphone and speak naturally.`,
    summary: "Your daily business summary is ready.",
    commands: genericCommands,
  };
}

function setBusy(isBusy) {
  state.isBusy = isBusy;
  const disable = isBusy;
  listenButton.disabled = disable && !state.isListening;
  startVoiceButton.disabled = disable;
  demoCommandButton.disabled = disable;
  voiceFillButton.disabled = disable;
  saveListingButton.disabled = disable;
  speakSummaryButton.disabled = disable;
  languageSelect.disabled = disable;
  auditQuery.disabled = disable;
  imageUploadInput.disabled = disable;
}

function setAssistantState(label, listening = false) {
  assistantState.textContent = label;
  state.isListening = listening;
  listenButtonLabel.textContent = listening ? "Tap to Stop" : "Tap to Speak";
  micOrbit.classList.toggle("active", listening);
}

function getSpeechLanguage() {
  return state.currentLanguage === "auto"
    ? state.lastDetectedLanguage || state.config.defaultLanguage
    : state.currentLanguage;
}

function renderLanguageOptions() {
  languageSelect.innerHTML = state.config.availableLanguages
    .map((language) => `<option value="${language.code}">${language.label} • ${language.nativeLabel}</option>`)
    .join("");
  languageSelect.value = state.currentLanguage;
}

function renderSuggestedCommands() {
  const content = getContentForLanguage(state.currentLanguage);
  suggestedCommands.innerHTML = content.commands
    .map((command) => `<button class="command-tag" data-command="${command.value}" type="button">${command.label}</button>`)
    .join("");

  suggestedCommands.querySelectorAll(".command-tag").forEach((button) => {
    button.addEventListener("click", () => {
      void runAssistantFlow(button.dataset.command || "", getSpeechLanguage());
    });
  });
}

function renderProfile() {
  const activeProfile = state.authSession?.profile || state.profile;
  if (!state.authSession) {
    profileSummary.textContent = "Signed out";
    if (accountHint) {
      accountHint.textContent = "Click Login above to sign in as buyer or seller.";
    }
    if (contactPhone && state.profile) {
      contactPhone.value = state.profile.phone || contactPhone.value;
    }
    updateTopLoginButton();
    showUserView();
    return;
  }
  profileSummary.textContent = `${state.authSession.role.toUpperCase()}: ${activeProfile.name} • ${activeProfile.village}`;
  if (accountHint) {
    accountHint.textContent = `You are signed in as ${state.authSession.role}. Return to the dashboard or logout from the top button.`;
  }
  if (contactPhone) {
    contactPhone.value = activeProfile.phone || contactPhone.value;
  }
  updateTopLoginButton();
  showUserView();
}

function showUserView() {
  const loggedIn = Boolean(state.authSession);
  if (landingSection) {
    landingSection.classList.toggle("hidden", loggedIn);
  }
  if (dashboardContent) {
    dashboardContent.classList.toggle("hidden", !loggedIn);
  }

  const role = state.authSession?.role || state.profile?.role || "seller";
  document.querySelectorAll(".seller-only").forEach((element) => {
    element.classList.toggle("hidden", !loggedIn || role !== "seller");
  });
  document.querySelectorAll(".buyer-only").forEach((element) => {
    element.classList.toggle("hidden", !loggedIn || role !== "buyer");
  });

  if (loggedIn && role === "buyer") {
    renderBuyerListings();
  }
}

function loadAuthSession() {
  const rawSession = window.localStorage.getItem("voiceRuralAuthSession");
  if (!rawSession) {
    state.authSession = null;
    return;
  }
  try {
    state.authSession = JSON.parse(rawSession);
    state.authRole = state.authSession.role || state.authRole;
  } catch (_error) {
    state.authSession = null;
  }
}

function saveAuthSession(session) {
  window.localStorage.setItem("voiceRuralAuthSession", JSON.stringify(session));
  state.authSession = session;
  state.authRole = session.role || state.authRole;
}

function clearAuthSession() {
  window.localStorage.removeItem("voiceRuralAuthSession");
  state.authSession = null;
}

function updateTopLoginButton() {
  if (!topLoginButton) {
    return;
  }
  if (state.authSession) {
    topLoginButton.textContent = "Logout";
    topLoginButton.dataset.state = "logout";
  } else {
    topLoginButton.textContent = "Login";
    topLoginButton.dataset.state = "login";
  }
}

function handleTopLoginButton() {
  if (!topLoginButton) {
    return;
  }
  if (topLoginButton.dataset.state === "logout") {
    clearAuthSession();
    // Return to landing page — the dashboard requires an active session.
    window.location.href = "index.html";
    return;
  }
  window.location.href = "login.html";
}

function initializeAuthState() {
  loadAuthSession();
  updateTopLoginButton();
}

function showAuthRole(role) {
  state.authRole = role;
  authRoleButtons.forEach((button) => button.classList.toggle("active", button.dataset.role === role));
  authRoleCopy.textContent =
    role === "buyer"
      ? "Access buyer tools with phone OTP or Google sign-in to browse seller listings and place orders."
      : "Use your mobile number with OTP or continue with Google to access your voice-first seller dashboard.";
  const nameLabel = document.getElementById("loginNameLabel");
  if (nameLabel) {
    nameLabel.textContent = role === "buyer" ? "Buyer name" : "Seller name";
  }
}

function showAuthMethod(method) {
  state.authMethod = method;
  phoneAuthPanel.classList.toggle("hidden", method !== "phone");
  googleAuthPanel.classList.toggle("hidden", method !== "google");
  authMethodButtons.forEach((button) => button.classList.toggle("active", button.dataset.method === method));
}

function toggleOtpFields(show) {
  const otpLabel = loginOtp.closest("label");
  if (otpLabel) {
    otpLabel.classList.toggle("hidden", !show);
  }
  verifyOtpButton.closest(".otp-actions").classList.toggle("hidden", !show);
}

function getSavedLoginState() {
  return window.localStorage.getItem("voiceRuralLoggedIn") === "true";
}

function saveLoginState() {
  window.localStorage.setItem("voiceRuralLoggedIn", "true");
}

function clearLoginState() {
  window.localStorage.removeItem("voiceRuralLoggedIn");
}

async function loginWithPayload(payload) {
  const profile = await fetchJson("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  state.profile = profile;
  renderProfile();
  assistantReply.textContent = `${profile.name} is now logged in.`;
  saveLoginState();
  await Promise.all([loadMarketplaceData(), loadDashboard()]);
}

function normalizePhone(phone) {
  return phone.replace(/[^\d+]/g, "");
}

function validatePhoneNumber(phone) {
  return /^\+?\d{10,15}$/.test(normalizePhone(phone));
}

async function sendPhoneOtp() {
  const phone = normalizePhone(loginPhone.value.trim());
  if (!validatePhoneNumber(phone)) {
    assistantReply.textContent = "Enter a valid phone number before sending OTP.";
    return;
  }

  setBusy(true);
  try {
    state.pendingOtp = String(Math.floor(100000 + Math.random() * 900000));
    state.otpPhone = phone;
    await new Promise((resolve) => setTimeout(resolve, 600));
    otpStatus.textContent = `OTP sent to ${phone}. Enter ${state.pendingOtp} to continue.`;
    toggleOtpFields(true);
    loginOtp.focus();
  } catch (error) {
    otpStatus.textContent = `OTP failed to send: ${error.message}`;
  } finally {
    setBusy(false);
  }
}

async function verifyPhoneOtp() {
  const code = loginOtp.value.trim();
  if (!code || code !== state.pendingOtp) {
    assistantReply.textContent = "The OTP does not match. Please try again.";
    return;
  }
  const payload = {
    name: loginName.value.trim() || (state.authRole === "buyer" ? "Buyer" : "Seller"),
    phone: normalizePhone(loginPhone.value.trim()),
    village: loginVillage.value.trim() || "Village Cluster",
    role: state.authRole,
  };
  await loginWithPayload(payload);
  otpStatus.textContent = "Phone verified successfully.";
  toggleOtpFields(false);
  loginOtp.value = "";
  state.pendingOtp = "";
}

async function handleGoogleLogin() {
  setBusy(true);
  assistantReply.textContent = "Connecting to Google sign-in...";
  try {
    await new Promise((resolve) => setTimeout(resolve, 900));
    const payload = {
      name: loginName.value.trim() || (state.authRole === "buyer" ? "Buyer" : "Priya Sharma"),
      phone: validatePhoneNumber(loginPhone.value.trim()) ? normalizePhone(loginPhone.value.trim()) : "+91 98765 43210",
      village: loginVillage.value.trim() || "Nashik Cluster",
      role: state.authRole,
    };
    await loginWithPayload(payload);
  } catch (error) {
    assistantReply.textContent = `Google sign-in failed: ${error.message}`;
  } finally {
    setBusy(false);
  }
}

function initializeLoginView() {
  showAuthRole(state.authRole);
  showAuthMethod(state.authMethod);
  if (getSavedLoginState()) {
    otpStatus.textContent = "You are already signed in. Use phone or Google to refresh your profile.";
  }
}

function preventLoginBypass() {
  if (state.pendingOtp && loginOtp.value.trim() !== state.pendingOtp) {
    assistantReply.textContent = "Please verify the OTP before signing in.";
    return false;
  }
  return true;
}

function login(event) {
  event.preventDefault();
  if (state.pendingOtp) {
    return void verifyPhoneOtp();
  }
  if (!preventLoginBypass()) {
    return;
  }
  const payload = {
    name: loginName.value.trim() || (state.authRole === "buyer" ? "Buyer" : "Seller"),
    phone: normalizePhone(loginPhone.value.trim()),
    village: loginVillage.value.trim() || "Village Cluster",
    role: state.authRole,
  };
  void loginWithPayload(payload);
}

function renderMetrics() {
  if (!state.metrics) {
    auditMetrics.innerHTML = "";
    return;
  }

  auditMetrics.innerHTML = `
    <article class="metric-pill">
      <strong>₹${state.metrics.total_revenue}</strong>
      <span>Revenue</span>
    </article>
    <article class="metric-pill">
      <strong>₹${state.metrics.total_profit}</strong>
      <span>Profit</span>
    </article>
    <article class="metric-pill">
      <strong>${state.metrics.total_orders}</strong>
      <span>Orders</span>
    </article>
  `;
}

function renderAlerts() {
  alertCountBadge.textContent = `${state.alerts.length} Alerts`;
  if (!state.alerts.length) {
    alertsList.innerHTML = `<article class="alert-item"><h5>All good</h5><p>No low-stock alerts right now.</p></article>`;
    return;
  }

  alertsList.innerHTML = state.alerts
    .map(
      (alert) => `
        <article class="alert-item ${alert.severity}">
          <h5>${alert.title}</h5>
          <p>${alert.message}</p>
          <span>Threshold: ${alert.threshold}</span>
        </article>
      `
    )
    .join("");
}

function renderOrders() {
  ordersList.innerHTML = state.orders
    .map(
      (order) => `
        <article class="order-item fade-in">
          <header>
            <div>
              <h5>${order.buyer}</h5>
              <p>${order.detail}</p>
            </div>
          </header>
          <div class="order-meta">
            <span>${order.status}</span>
            <span>Voice-ready</span>
          </div>
        </article>
      `
    )
    .join("");
}

function renderListings() {
  listingCards.innerHTML = state.listings
    .map(
      (item) => `
        <article class="listing-item marketplace-card fade-in">
          <header>
            <div>
              <h5>${item.title}</h5>
              <p>${item.subtitle}</p>
            </div>
            <span class="mini-pill">${item.tag}</span>
          </header>
          ${
            item.image_data
              ? `<img class="listing-photo" src="${item.image_data}" alt="${item.title}" />`
              : `<div class="listing-photo placeholder">Photo-ready listing</div>`
          }
          <div class="listing-meta">
            <span>${item.price}</span>
            <span>${item.stock}</span>
            <span>${item.category || "General"}</span>
          </div>
          <div class="contact-box">
            <strong>${item.seller_name || "Seller"}</strong>
            <span>${item.contact_phone || "+91 98765 43210"}</span>
          </div>
          <div class="card-actions">
            <button class="primary-button buy-button" data-title="${item.title}" type="button">Buy</button>
            <a class="secondary-button contact-link" href="tel:${(item.contact_phone || "").replace(/\s+/g, "")}">
              Contact
            </a>
          </div>
        </article>
      `
    )
    .join("");

  listingCards.querySelectorAll(".buy-button").forEach((button) => {
    button.addEventListener("click", () => {
      void handleBuy(button.dataset.title || "");
    });
  });
}

function renderBuyerListings() {
  if (!buyerListingCards) {
    return;
  }
  buyerListingCards.innerHTML = state.listings
    .map(
      (item) => `
        <article class="listing-item buyer-card fade-in">
          <header>
            <div>
              <h5>${item.title}</h5>
              <p>${item.subtitle}</p>
            </div>
            <span class="mini-pill">${item.category || "General"}</span>
          </header>
          <div class="listing-meta">
            <span>${item.price}</span>
            <span>${item.stock}</span>
          </div>
          <div class="contact-box">
            <strong>${item.seller_name || "Seller"}</strong>
            <span>${item.contact_phone || "+91 98765 43210"}</span>
          </div>
        </article>
      `
    )
    .join("");
}

function setLanguage(language) {
  state.currentLanguage = language;
  const content = getContentForLanguage(language);
  languageBadge.textContent = content.label;
  languageHint.textContent = content.hint;
  transcriptText.textContent = content.commands[0].value;
  generatedCommandText.textContent = "Waiting for a spoken marketplace command.";
  assistantReply.textContent = content.ready;
  renderSuggestedCommands();
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : { detail: await response.text() };
  if (!response.ok) {
    throw new Error(payload.error || payload.detail || "Request failed");
  }
  return payload;
}

async function loadConfig() {
  const payload = await fetchJson("/api/config");
  state.config = payload;
  state.currentLanguage = payload.defaultLanguage || "en-IN";
  state.lastDetectedLanguage = payload.defaultLanguage || "en-IN";
  renderLanguageOptions();
  setLanguage(state.currentLanguage);

  if (!payload.sarvamConfigured) {
    assistantReply.textContent =
      "Backend is ready, but Sarvam is not configured yet. Add SARVAM_API_KEY in .env to enable real STT, chat, and TTS.";
  }
}

async function loadMarketplaceData() {
  const [listingPayload, orderPayload] = await Promise.all([
    fetchJson("/api/listings"),
    fetchJson("/api/orders"),
  ]);
  state.listings = listingPayload.items;
  state.orders = orderPayload.items;
  renderListings();
  renderOrders();
  renderBuyerListings();
}

async function loadProfile() {
  state.profile = await fetchJson(`/api/profile?role=${state.authRole}`);
  renderProfile();
}

async function loadDashboard() {
  const payload = await fetchJson(`/api/dashboard?role=${state.authRole}`);
  state.alerts = payload.alerts || [];
  state.metrics = payload.metrics || null;
  state.profile = payload.seller || state.profile;
  renderAlerts();
  renderMetrics();
  renderProfile();
  maybeSpeakAlerts();
}

function maybeSpeakAlerts() {
  if (state.isListening || state.isBusy || !state.alerts.length) {
    return;
  }

  const freshAlert = state.alerts.find((alert) => !state.alertSpeechHistory.has(alert.id));
  if (!freshAlert) {
    return;
  }

  state.alertSpeechHistory.add(freshAlert.id);
  void speak(freshAlert.message, getSpeechLanguage());
}

function chooseRecorderMimeType() {
  if (!("MediaRecorder" in window)) {
    return "";
  }
  const options = ["audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return options.find((item) => MediaRecorder.isTypeSupported(item)) || "";
}

function stopActiveAudio() {
  if (state.activeAudio) {
    state.activeAudio.pause();
    URL.revokeObjectURL(state.activeAudio.src);
    state.activeAudio = null;
  }
}

function base64ToBlob(base64, mimeType) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

async function speak(text, languageCode = getSpeechLanguage()) {
  if (!text) {
    return;
  }

  stopActiveAudio();

  if (!state.config.sarvamConfigured) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageCode;
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
    return;
  }

  try {
    const payload = await fetchJson("/api/sarvam/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        language_code: languageCode,
        speaker: state.config.defaultSpeaker || "shubh",
        pace: 0.88,
        output_audio_codec: "wav",
        speech_sample_rate: 24000,
      }),
    });

    const audioBase64 = payload.audios?.[0] || payload.audio;
    if (!audioBase64) {
      throw new Error("No audio returned from TTS");
    }

    const audioBlob = base64ToBlob(audioBase64, "audio/wav");
    const audioUrl = URL.createObjectURL(audioBlob);
    const audio = new Audio(audioUrl);
    state.activeAudio = audio;
    audio.addEventListener("ended", () => {
      URL.revokeObjectURL(audioUrl);
      if (state.activeAudio === audio) {
        state.activeAudio = null;
      }
    });
    await audio.play();
  } catch (_error) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageCode;
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    }
  }
}

function applyAssistantFields(fields) {
  if (!fields) {
    return;
  }

  if (fields.product_name) {
    productName.value = fields.product_name;
  }

  if (fields.category) {
    const normalizedCategory = categoryMap[String(fields.category).toLowerCase()] || fields.category;
    const match = Array.from(productCategory.options).find(
      (option) => option.value === normalizedCategory || option.text === normalizedCategory
    );
    if (match) {
      productCategory.value = match.value;
    }
  }

  if (fields.price) {
    const clean = String(fields.price).replace(/[^0-9./ ]/g, "").trim();
    productPrice.value = clean.startsWith("₹") ? clean : `₹${clean || fields.price} / kg`;
  }

  if (fields.stock) {
    const stockValue = String(fields.stock);
    productStock.value = /kg|piece|jar/i.test(stockValue) ? stockValue : `${stockValue} kg`;
  }

  if (fields.description) {
    productDescription.value = fields.description;
  }
}

async function generateAssistantResponse(transcript, languageCode) {
  return fetchJson("/api/assistant/respond", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      transcript,
      language_code: languageCode,
      selected_language: state.currentLanguage,
    }),
  });
}

async function runAssistantFlow(transcript, languageCode) {
  if (!transcript.trim()) {
    return;
  }

  transcriptText.textContent = transcript;
  generatedCommandText.textContent = "Generating marketplace command...";
  assistantReply.textContent = "Analyzing seller request...";
  setAssistantState("Generating");
  setBusy(true);

  try {
    const result = await generateAssistantResponse(transcript, languageCode);
    if (result.language_code) {
      state.lastDetectedLanguage = result.language_code;
    }
    generatedCommandText.textContent = result.canonical_command || "GENERAL_HELP";
    assistantReply.textContent = result.assistant_reply;
    applyAssistantFields(result.fields);
    if (result.intent === "daily_summary") {
      auditReply.textContent = result.assistant_reply;
    }
    await speak(result.assistant_reply, result.language_code || getSpeechLanguage());
  } catch (error) {
    generatedCommandText.textContent = "COMMAND_GENERATION_FAILED";
    assistantReply.textContent = `Assistant generation failed: ${error.message}`;
  } finally {
    setBusy(false);
    setAssistantState("Ready");
  }
}

async function transcribeAudio(blob) {
  if (!state.config.sarvamConfigured) {
    throw new Error("Sarvam is not configured yet. Add SARVAM_API_KEY to .env.");
  }

  const query = new URLSearchParams();
  if (state.currentLanguage !== "auto") {
    query.set("language_code", state.currentLanguage);
  }

  const response = await fetch(`/api/sarvam/stt?${query.toString()}`, {
    method: "POST",
    headers: {
      "Content-Type": (blob.type || "audio/webm").split(";")[0],
    },
    body: blob,
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json") ? await response.json() : { detail: await response.text() };
  if (!response.ok) {
    throw new Error(payload.error || payload.detail || "Transcription failed");
  }

  return {
    transcript: payload.transcript || payload.text || payload.data?.transcript || "",
    languageCode: payload.language_code || payload.language || payload.detected_language || null,
  };
}

async function processRecording(blob) {
  setAssistantState("Processing");
  setBusy(true);
  transcriptText.textContent = "Uploading audio...";

  try {
    const result = await transcribeAudio(blob);
    if (!result.transcript) {
      assistantReply.textContent = "No transcript came back from Sarvam. Try again with a slightly longer recording.";
      generatedCommandText.textContent = "NO_COMMAND_GENERATED";
      transcriptText.textContent = "No speech detected";
      return;
    }

    if (result.languageCode && result.languageCode !== "auto") {
      state.lastDetectedLanguage = result.languageCode;
    }

    await runAssistantFlow(result.transcript, result.languageCode || getSpeechLanguage());
  } catch (error) {
    assistantReply.textContent = `STT failed: ${error.message}`;
    generatedCommandText.textContent = "VOICE_PROCESSING_FAILED";
    transcriptText.textContent = "Voice processing failed";
    setBusy(false);
    setAssistantState("Ready");
  }
}

async function startListening() {
  if (state.isBusy && !state.isListening) {
    return;
  }

  if (state.isListening && state.mediaRecorder) {
    state.mediaRecorder.stop();
    return;
  }

  if (!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia)) {
    assistantReply.textContent = "This browser does not support microphone capture for Sarvam STT.";
    setAssistantState("No Mic API");
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    state.audioChunks = [];
    const mimeType = chooseRecorderMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    state.mediaRecorder = recorder;

    recorder.addEventListener("dataavailable", (event) => {
      if (event.data && event.data.size > 0) {
        state.audioChunks.push(event.data);
      }
    });

    recorder.addEventListener("stop", async () => {
      stream.getTracks().forEach((track) => track.stop());
      const audioBlob = new Blob(state.audioChunks, { type: recorder.mimeType || "audio/webm" });
      state.mediaRecorder = null;
      state.audioChunks = [];
      await processRecording(audioBlob);
    });

    recorder.start();
    transcriptText.textContent = "Listening... Speak now.";
    generatedCommandText.textContent = "Waiting for completed transcript...";
    setAssistantState("Listening", true);
  } catch (_error) {
    assistantReply.textContent = "Microphone access failed. Please allow mic permission in the browser and try again.";
    setAssistantState("Mic Blocked");
  }
}

async function saveListing() {
  const newListing = {
    title: productName.value.trim() || "Untitled Product",
    subtitle: productDescription.value.trim() || "Voice-created marketplace listing",
    price: productPrice.value.trim() || "Price pending",
    stock: productStock.value.trim() || "Stock pending",
    tag: "Just added",
    category: productCategory.value,
    seller_name: state.profile?.name || "Rural Seller",
    contact_phone: contactPhone.value.trim() || state.profile?.phone || "+91 98765 43210",
    min_stock_alert: Number(minStockAlert.value) || 5,
    image_data: state.uploadedImageData || "",
  };

  assistantReply.textContent = "Saving your listing to the marketplace backend.";
  setBusy(true);

  try {
    await fetchJson("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newListing),
    });
    await Promise.all([loadMarketplaceData(), loadDashboard()]);
    assistantReply.textContent = `${newListing.title} has been saved. Your marketplace listing is now live for nearby buyers.`;
    generatedCommandText.textContent = `SAVE_LISTING_TITLE_${newListing.title.replace(/\s+/g, "_").toUpperCase()}`;
    await speak(assistantReply.textContent, getSpeechLanguage());
  } catch (error) {
    assistantReply.textContent = `Could not save listing: ${error.message}`;
  } finally {
    setBusy(false);
  }
}

async function handleBuy(title) {
  const listing = state.listings.find((item) => item.title === title);
  if (!listing) {
    return;
  }

  const quantity = Number(window.prompt(`How many units of ${title} do you want to buy?`, "1"));
  if (!quantity || quantity < 1) {
    return;
  }

  const buyerName = window.prompt("Buyer name", "Marketplace Buyer");
  const buyerPhone = window.prompt("Buyer phone", "+91 ");
  if (!buyerName || !buyerPhone) {
    return;
  }

  setBusy(true);
  try {
    const payload = await fetchJson("/api/buy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        listing_title: title,
        quantity,
        buyer_name: buyerName,
        buyer_phone: buyerPhone,
      }),
    });
    assistantReply.textContent = payload.message;
    generatedCommandText.textContent = `BUY_LISTING_TITLE_${title.replace(/\s+/g, "_").toUpperCase()}_QTY_${quantity}`;
    await Promise.all([loadMarketplaceData(), loadDashboard()]);
    await speak(payload.message, getSpeechLanguage());
  } catch (error) {
    assistantReply.textContent = `Purchase failed: ${error.message}`;
  } finally {
    setBusy(false);
  }
}

async function runAudit(event) {
  event.preventDefault();
  const query = auditQuery.value.trim();
  if (!query) {
    return;
  }

  setBusy(true);
  try {
    const payload = await fetchJson("/api/audit/query", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        language_code: getSpeechLanguage(),
      }),
    });
    auditReply.textContent = payload.reply;
    generatedCommandText.textContent = "AUDIT_QUERY";
    assistantReply.textContent = payload.reply;
    state.metrics = payload.metrics;
    renderMetrics();
    await speak(payload.reply, payload.language_code);
  } catch (error) {
    auditReply.textContent = `Audit failed: ${error.message}`;
  } finally {
    setBusy(false);
  }
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleImageUpload() {
  const [file] = imageUploadInput.files || [];
  if (!file) {
    return;
  }

  setBusy(true);
  try {
    const imageData = await readFileAsDataUrl(file);
    const payload = await fetchJson("/api/listings/image-preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        filename: file.name,
        image_data: imageData,
      }),
    });
    state.uploadedImageData = payload.image_data;
    imagePreview.src = payload.image_data;
    imagePreview.hidden = false;
    imagePreviewPlaceholder.hidden = true;
    productName.value = payload.title;
    productCategory.value = payload.category;
    productDescription.value = payload.description;
    imageUploadNote.textContent = payload.voice_prompt;
    assistantReply.textContent = payload.voice_prompt;
    await speak(payload.voice_prompt, getSpeechLanguage());
  } catch (error) {
    imageUploadNote.textContent = `Image upload failed: ${error.message}`;
  } finally {
    setBusy(false);
  }
}

function scheduleDashboardPolling() {
  window.clearInterval(dashboardPollTimer);
  dashboardPollTimer = window.setInterval(() => {
    void loadDashboard();
  }, 20000);
}

async function boot() {
  try {
    await loadConfig();
    await Promise.all([loadMarketplaceData(), loadProfile(), loadDashboard()]);
    scheduleDashboardPolling();
  } catch (error) {
    assistantReply.textContent = `Startup failed: ${error.message}`;
  }
}

listenButton.addEventListener("click", () => {
  void startListening();
});

startVoiceButton.addEventListener("click", () => {
  void startListening();
});

voiceFillButton.addEventListener("click", () => {
  const content = getContentForLanguage(state.currentLanguage);
  void runAssistantFlow(content.commands[0].value, getSpeechLanguage());
});

saveListingButton.addEventListener("click", () => {
  void saveListing();
});

demoCommandButton.addEventListener("click", async () => {
  const content = getContentForLanguage(state.currentLanguage);
  assistantReply.textContent = content.demo;
  generatedCommandText.textContent = "DEMO_PROMPT_PLAYBACK";
  await speak(content.demo, getSpeechLanguage());
});

speakSummaryButton.addEventListener("click", async () => {
  const payload = await fetchJson("/api/audit/query", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query: "How much did I sell today?",
      language_code: getSpeechLanguage(),
    }),
  });
  auditReply.textContent = payload.reply;
  generatedCommandText.textContent = "DAILY_SUMMARY";
  transcriptText.textContent = payload.query;
  await speak(payload.reply, payload.language_code);
});

languageSelect.addEventListener("change", async () => {
  setLanguage(languageSelect.value);
  const content = getContentForLanguage(state.currentLanguage);
  await speak(content.ready, getSpeechLanguage());
});

auditForm.addEventListener("submit", (event) => {
  void runAudit(event);
});

if (topLoginButton) {
  topLoginButton.addEventListener("click", () => {
    handleTopLoginButton();
  });
}

if (landingLoginButton) {
  landingLoginButton.addEventListener("click", () => {
    window.location.href = "login.html";
  });
}

imageUploadInput.addEventListener("change", () => {
  void handleImageUpload();
});

initializeAuthState();
boot();
