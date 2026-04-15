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

const productName = document.getElementById("productName");
const productCategory = document.getElementById("productCategory");
const productPrice = document.getElementById("productPrice");
const productStock = document.getElementById("productStock");
const productDescription = document.getElementById("productDescription");

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
      { label: "Update Stock", value: "baskets stock update pannunga minus 5" },
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
      { label: "Update Stock", value: "Reduce basket stock by 5" },
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
      { label: "स्टॉक अपडेट", value: "Tokri stock 5 kam karo" },
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
      { label: "ஸ்டாக் குறை", value: "Stock 5 kurai" },
    ],
  },
};

const genericCommands = [
  { label: "List Product", value: "Add 10 kilos of fresh product at 30 rupees per kilo" },
  { label: "Check Orders", value: "Show pending orders" },
  { label: "Update Stock", value: "Update stock minus 5" },
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
  isListening: false,
  isBusy: false,
  audioChunks: [],
  mediaRecorder: null,
  activeAudio: null,
  listings: [],
  orders: [],
};

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
}

function renderListings() {
  listingCards.innerHTML = state.listings
    .map(
      (item) => `
        <article class="listing-item fade-in">
          <header>
            <div>
              <h5>${item.title}</h5>
              <p>${item.subtitle}</p>
            </div>
            <span class="mini-pill">${item.tag}</span>
          </header>
          <div class="listing-meta">
            <span>${item.price}</span>
            <span>${item.stock}</span>
          </div>
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
            <span>Tap to answer by voice</span>
          </div>
        </article>
      `
    )
    .join("");
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
  } catch (error) {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = languageCode;
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } else {
      throw error;
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
    const value = String(fields.price).startsWith("₹") ? fields.price : `₹${fields.price}${String(fields.price).includes("/") ? "" : " / kg"}`;
    productPrice.value = value;
  }

  if (fields.stock) {
    productStock.value = String(fields.stock).includes("kg") ? fields.stock : `${fields.stock} kg`;
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
  } catch (error) {
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
  };

  assistantReply.textContent = "Saving your listing to the marketplace backend.";
  setBusy(true);

  try {
    await fetchJson("/api/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newListing),
    });
    await loadMarketplaceData();
    assistantReply.textContent = `${newListing.title} has been saved. Your marketplace listing is now live for nearby buyers.`;
    generatedCommandText.textContent = `SAVE_LISTING_TITLE_${newListing.title.replace(/\s+/g, "_").toUpperCase()}`;
    await speak(assistantReply.textContent, getSpeechLanguage());
  } catch (error) {
    assistantReply.textContent = `Could not save listing: ${error.message}`;
  } finally {
    setBusy(false);
  }
}

async function boot() {
  try {
    await loadConfig();
    await loadMarketplaceData();
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
  const content = getContentForLanguage(state.currentLanguage);
  assistantReply.textContent = content.summary;
  generatedCommandText.textContent = "DAILY_SUMMARY";
  transcriptText.textContent = content.summary;
  await speak(content.summary, getSpeechLanguage());
});

languageSelect.addEventListener("change", async () => {
  setLanguage(languageSelect.value);
  const content = getContentForLanguage(state.currentLanguage);
  await speak(content.ready, getSpeechLanguage());
});

boot();
