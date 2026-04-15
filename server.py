import json
import mimetypes
import os
import re
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
import uvicorn

from backend.sarvam_client import SarvamClient, SarvamClientError, load_env

BASE_DIR = Path(__file__).resolve().parent
DATA_FILE = BASE_DIR / "data" / "store.json"

load_env(BASE_DIR / ".env")

SUPPORTED_LANGUAGES = [
    {"code": "auto", "label": "Auto Detect", "nativeLabel": "Auto Detect"},
    {"code": "en-IN", "label": "English", "nativeLabel": "English"},
    {"code": "hi-IN", "label": "Hindi", "nativeLabel": "हिन्दी"},
    {"code": "bn-IN", "label": "Bengali", "nativeLabel": "বাংলা"},
    {"code": "gu-IN", "label": "Gujarati", "nativeLabel": "ગુજરાતી"},
    {"code": "kn-IN", "label": "Kannada", "nativeLabel": "ಕನ್ನಡ"},
    {"code": "ml-IN", "label": "Malayalam", "nativeLabel": "മലയാളം"},
    {"code": "mr-IN", "label": "Marathi", "nativeLabel": "मराठी"},
    {"code": "pa-IN", "label": "Punjabi", "nativeLabel": "ਪੰਜਾਬੀ"},
    {"code": "ta-IN", "label": "Tamil", "nativeLabel": "தமிழ்"},
    {"code": "te-IN", "label": "Telugu", "nativeLabel": "తెలుగు"},
]

DEFAULT_STORE = {
    "listings": [
        {
            "title": "Fresh Tomatoes",
            "subtitle": "Farm produce from Nashik cluster",
            "price": "₹32 / kg",
            "stock": "20 kg ready",
            "tag": "Fast moving",
        },
        {
            "title": "Handmade Bamboo Baskets",
            "subtitle": "Craft collective, 100% handmade",
            "price": "₹180 / piece",
            "stock": "12 in stock",
            "tag": "Festival demand",
        },
        {
            "title": "Homemade Mango Pickle",
            "subtitle": "Small-batch home kitchen product",
            "price": "₹140 / jar",
            "stock": "30 jars ready",
            "tag": "Repeat buyers",
        },
    ],
    "orders": [
        {
            "buyer": "Village Fresh Mart",
            "detail": "Need 10 kg tomatoes for tomorrow morning delivery.",
            "status": "Awaiting voice reply",
        },
        {
            "buyer": "Anita General Store",
            "detail": "Asked if bamboo baskets are available in bulk quantity.",
            "status": "New buyer question",
        },
        {
            "buyer": "Ramesh Caterers",
            "detail": "Requested a price confirmation for 15 pickle jars.",
            "status": "Ready to confirm",
        },
    ],
}

DEFAULT_ASSISTANT_RESULT = {
    "intent": "general_help",
    "canonical_command": "GENERAL_HELP",
    "assistant_reply": "I heard your request. You can add a product, check orders, update stock, or ask for today's summary.",
    "language_code": "en-IN",
    "fields": {
        "product_name": "",
        "category": "",
        "price": "",
        "stock": "",
        "description": "",
        "stock_delta": "",
        "buyer_name": "",
    },
}

CATEGORY_HINTS = {
    "vegetables": ["tomato", "tamatar", "vendakkai", "okra", "onion", "potato", "thakkali", "bhindi"],
    "handicrafts": ["basket", "baskets", "tokri", "craft", "handmade", "bamboo"],
    "home_foods": ["pickle", "achar", "murukku", "snack", "papad"],
    "dairy": ["milk", "paneer", "curd", "ghee"],
}

ADD_HINTS = [
    "add", "jodo", "serkkavum", "serisi", "cherkkuka", "umero", "kara", "cheyyandi", "panna", "set",
    "list", "register", "put", "create"
]
STOCK_HINTS = [
    "stock", "reduce", "minus", "kam", "kurai", "tagginchu", "update", "change", "increase", "remove"
]
ORDER_HINTS = [
    "order", "orders", "buyer", "pending", "check", "dikhao", "kaattu", "show"
]
SUMMARY_HINTS = ["summary", "today", "daily", "status", "report"]


class ListingPayload(BaseModel):
    title: str
    subtitle: str
    price: str
    stock: str
    tag: str


class TtsPayload(BaseModel):
    text: str
    language_code: str = "en-IN"
    speaker: str | None = None
    pace: float = 0.88
    output_audio_codec: str = "wav"
    speech_sample_rate: int = 24000


class AssistantPayload(BaseModel):
    transcript: str
    language_code: str | None = None
    selected_language: str | None = None


class Store:
    def __init__(self, path: Path):
        self.path = path
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.write(DEFAULT_STORE)

    def read(self) -> dict[str, Any]:
        with open(self.path, "r", encoding="utf-8") as handle:
            return json.load(handle)

    def write(self, payload: dict[str, Any]) -> None:
        with open(self.path, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, ensure_ascii=False, indent=2)


store = Store(DATA_FILE)


def get_sarvam_client() -> SarvamClient | None:
    api_key = os.getenv("SARVAM_API_KEY", "").strip()
    if not api_key or api_key == "replace_with_your_real_sarvam_api_key":
        return None
    return SarvamClient(api_key)


def normalize_language_code(language_code: str | None, selected_language: str | None) -> str:
    if language_code and language_code != "auto":
        return language_code
    if selected_language and selected_language != "auto":
        return selected_language
    return os.getenv("SARVAM_DEFAULT_LANGUAGE", "en-IN")


def parse_chat_json(content: str) -> dict[str, Any]:
    text = (content or "").strip()

    if "</think>" in text:
        text = text.split("</think>", 1)[1].strip()

    if "```json" in text:
        text = text.split("```json", 1)[1].strip()
    elif text.startswith("```"):
        parts = text.split("\n")
        if parts and parts[0].startswith("```"):
            parts = parts[1:]
        if parts and parts[-1].strip() == "```":
            parts = parts[:-1]
        text = "\n".join(parts).strip()

    if text.endswith("```"):
        text = text[:-3].strip()

    start = text.find("{")
    end = text.rfind("}")
    if start != -1 and end != -1:
        text = text[start : end + 1]

    payload = json.loads(text)
    fields = payload.get("fields") or {}
    merged_fields = {**DEFAULT_ASSISTANT_RESULT["fields"], **fields}

    return {
        "intent": payload.get("intent") or DEFAULT_ASSISTANT_RESULT["intent"],
        "canonical_command": payload.get("canonical_command") or DEFAULT_ASSISTANT_RESULT["canonical_command"],
        "assistant_reply": payload.get("assistant_reply") or DEFAULT_ASSISTANT_RESULT["assistant_reply"],
        "language_code": payload.get("language_code") or DEFAULT_ASSISTANT_RESULT["language_code"],
        "fields": merged_fields,
    }


def infer_category(text: str) -> str:
    lower = text.lower()
    for category, hints in CATEGORY_HINTS.items():
        if any(hint in lower for hint in hints):
            return category
    return ""


def extract_product_name(text: str) -> str:
    lower = text.lower()
    known_products = [
        "vendakkai", "tomato", "tamatar", "thakkali", "okra", "basket", "baskets", "tokri", "pickle", "achar",
        "onion", "potato", "milk", "paneer", "curd"
    ]
    for product in known_products:
        if product in lower:
            return product
    words = re.findall(r"[a-zA-Z]+", text)
    filtered = [word for word in words if word.lower() not in {"add", "set", "price", "stock", "order", "check", "today", "one", "kilo", "kg", "rupees", "rupee"}]
    return filtered[0] if filtered else ""


def extract_number(pattern: str, text: str) -> str:
    match = re.search(pattern, text, flags=re.IGNORECASE)
    return match.group(1) if match else ""


def canonicalize(intent: str, fields: dict[str, str]) -> str:
    parts = [intent.upper()]
    for key in ["product_name", "category", "price", "stock", "stock_delta", "buyer_name"]:
        value = str(fields.get(key, "")).strip()
        if value:
            safe = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_")
            parts.append(f"{key.upper()}_{safe}")
    return "_".join(parts) if len(parts) > 1 else intent.upper()


def localized_reply(intent: str, language_code: str, fields: dict[str, str]) -> str:
    product = fields.get("product_name") or "product"
    stock = fields.get("stock") or fields.get("stock_delta") or ""
    price = fields.get("price") or ""

    if language_code == "ta-IN":
        if intent == "add_listing":
            return f"{stock or 'புதிய'} {product} ₹{price or '0'} விலையில் சேர்க்கப்பட்டது." if price else f"{product} பட்டியலில் சேர்க்கப்பட்டது."
        if intent == "update_stock":
            return f"{product} stock புதுப்பிக்கப்பட்டது."
        if intent == "check_orders":
            return "உங்களுடைய pending orders இப்போது பார்க்கலாம்."
        if intent == "daily_summary":
            return "இன்றைய விற்பனை சுருக்கம் தயார்."
        return "உங்கள் கோரிக்கை புரிந்தது. மேலும் விவரம் கொடுத்தால் நான் உதவுகிறேன்."

    if language_code == "hi-IN":
        if intent == "add_listing":
            return f"{product} listing ₹{price or '0'} ke saath add ho gayi hai." if price else f"{product} listing add ho gayi hai."
        if intent == "update_stock":
            return f"{product} ka stock update ho gaya hai."
        if intent == "check_orders":
            return "Aapke pending orders ab dikhaye ja rahe hain."
        if intent == "daily_summary":
            return "Aaj ka business summary taiyar hai."
        return "Maine aapki request samajh li. Thoda aur detail boliye to main sahi action le sakta hoon."

    if intent == "add_listing":
        return f"{product} listing added successfully at ₹{price or '0'}." if price else f"{product} listing added successfully."
    if intent == "update_stock":
        return f"{product} stock has been updated."
    if intent == "check_orders":
        return "Your pending orders are ready to review."
    if intent == "daily_summary":
        return "Your daily business summary is ready."
    return DEFAULT_ASSISTANT_RESULT["assistant_reply"]


def heuristic_assistant_response(transcript: str, language_code: str, selected_language: str | None) -> dict[str, Any]:
    normalized_language = normalize_language_code(language_code, selected_language)
    lower = transcript.lower()
    fields = {**DEFAULT_ASSISTANT_RESULT["fields"]}
    fields["product_name"] = extract_product_name(transcript)
    fields["category"] = infer_category(transcript)
    quantity = extract_number(r"(\d+)\s*(?:kg|kilo|kilogram|pieces|piece)?", lower)
    price = extract_number(r"(?:price|rupees|rupaye|rupai|rs|₹)\s*(\d+)|(\d+)\s*(?:rupees|rupaye|rupai|rs)", lower)
    if not price:
        match = re.search(r"(\d+)\s*(?:rupees|rupaye|rupai|rs|₹)", lower)
        price = match.group(1) if match else ""
    fields["stock"] = quantity
    fields["price"] = price

    if any(word in lower for word in ORDER_HINTS):
        intent = "check_orders"
    elif any(word in lower for word in SUMMARY_HINTS):
        intent = "daily_summary"
    elif any(word in lower for word in STOCK_HINTS) and not any(word in lower for word in ADD_HINTS):
        intent = "update_stock"
        fields["stock_delta"] = quantity
        fields["stock"] = ""
    elif any(word in lower for word in ADD_HINTS) or fields["product_name"] or fields["price"]:
        intent = "add_listing"
    else:
        intent = "general_help"

    if intent == "add_listing" and not fields["description"] and fields["product_name"]:
        fields["description"] = f"Voice-created listing for {fields['product_name']}"

    return {
        "intent": intent,
        "canonical_command": canonicalize(intent, fields),
        "assistant_reply": localized_reply(intent, normalized_language, fields),
        "language_code": normalized_language,
        "fields": fields,
    }


def postprocess_assistant_result(result: dict[str, Any], transcript: str, language_code: str | None, selected_language: str | None) -> dict[str, Any]:
    fallback = heuristic_assistant_response(transcript, language_code or result.get("language_code"), selected_language)
    current = {**fallback, **result}
    current_fields = {**fallback["fields"], **(result.get("fields") or {})}
    current["fields"] = current_fields

    lower = transcript.lower()
    if any(word in lower for word in ADD_HINTS) and current["intent"] == "update_stock":
        current["intent"] = "add_listing"
    if any(word in lower for word in ORDER_HINTS):
        current["intent"] = "check_orders"
    if any(word in lower for word in SUMMARY_HINTS):
        current["intent"] = "daily_summary"

    if not current["canonical_command"] or current["canonical_command"] == "GENERAL_HELP":
        current["canonical_command"] = canonicalize(current["intent"], current_fields)

    if not current_fields.get("product_name"):
        current_fields["product_name"] = fallback["fields"].get("product_name", "")
    if not current_fields.get("category"):
        current_fields["category"] = fallback["fields"].get("category", "")
    if not current_fields.get("price"):
        current_fields["price"] = fallback["fields"].get("price", "")
    if not current_fields.get("stock"):
        current_fields["stock"] = fallback["fields"].get("stock", "")
    if current["intent"] == "update_stock" and not current_fields.get("stock_delta"):
        current_fields["stock_delta"] = fallback["fields"].get("stock_delta", current_fields.get("stock", ""))

    if not current.get("assistant_reply") or current["assistant_reply"] == DEFAULT_ASSISTANT_RESULT["assistant_reply"]:
        current["assistant_reply"] = localized_reply(current["intent"], current.get("language_code") or fallback["language_code"], current_fields)

    if not current.get("language_code"):
        current["language_code"] = fallback["language_code"]

    current["canonical_command"] = canonicalize(current["intent"], current_fields)
    current["fields"] = current_fields
    return current


def generate_assistant_response(client: SarvamClient, transcript: str, language_code: str | None, selected_language: str | None) -> dict[str, Any]:
    requested_language = normalize_language_code(language_code, selected_language)
    system_prompt = """You are a multilingual voice marketplace assistant for rural Indian sellers.
Convert the seller transcript into a structured marketplace command and reply in the same spoken language.
Return JSON only with this exact schema:
{
  \"intent\": \"add_listing|check_orders|update_stock|daily_summary|respond_to_buyer|general_help\",
  \"canonical_command\": \"A unique machine-friendly English command with extracted details\",
  \"assistant_reply\": \"Natural short reply in the user's language\",
  \"language_code\": \"BCP-47 language code like ta-IN or hi-IN\",
  \"fields\": {
    \"product_name\": \"\",
    \"category\": \"\",
    \"price\": \"\",
    \"stock\": \"\",
    \"description\": \"\",
    \"stock_delta\": \"\",
    \"buyer_name\": \"\"
  }
}
Rules:
- canonical_command must be in English uppercase snake-like style with extracted values.
- assistant_reply must be in the same language as the seller transcript, not English unless the transcript is English.
- If language is mixed, prefer the dominant spoken Indian language or the requested language code.
- Treat code-mixed English as normal Indian speech. Words like add, update, price, stock, check, order, kilo, piece may appear with Indian language phrasing.
- Use add_listing when the seller is creating a new product entry with product name, quantity, or price.
- Use update_stock only when the seller clearly asks to increase, reduce, or change stock of an existing item.
- If details are missing, still generate a helpful canonical_command and ask a short follow-up in the same language.
Examples:
- \"20 kilo tamatar 32 rupaye per kilo mein jodo\" => add_listing
- \"10 kg vendakkai oru kilo 10 rupai serkkavum\" => add_listing
- \"10 kg vendakkai add panna one kilo 10 rupees\" => add_listing
- \"tomato price set 30 rupees kilo\" => add_listing
- \"Tokri stock 5 kam karo\" => update_stock
- \"baskets stock update pannunga minus 5\" => update_stock
- \"Pending order dikhao\" => check_orders
- \"today order check pannanum\" => check_orders
"""
    user_prompt = (
        f"Selected language mode: {selected_language or 'auto'}\n"
        f"Detected/requested transcript language: {requested_language}\n"
        f"Seller transcript: {transcript}"
    )

    try:
        response = client.chat_completion(
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            model=os.getenv("SARVAM_CHAT_MODEL", "sarvam-m"),
            temperature=0.1,
            max_tokens=900,
        )
        content = response.get("choices", [{}])[0].get("message", {}).get("content", "")
        parsed = parse_chat_json(content)
        return postprocess_assistant_result(parsed, transcript, requested_language, selected_language)
    except (SarvamClientError, json.JSONDecodeError, KeyError, IndexError, TypeError, ValueError):
        return heuristic_assistant_response(transcript, requested_language, selected_language)


app = FastAPI(title="Voice Rural", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/health")
def health() -> dict[str, Any]:
    return {
        "ok": True,
        "voice_provider": "sarvam",
        "sarvam_configured": bool(get_sarvam_client()),
        "backend": "fastapi",
    }


@app.get("/api/config")
def config() -> dict[str, Any]:
    return {
        "voiceProvider": "sarvam",
        "sarvamConfigured": bool(get_sarvam_client()),
        "defaultLanguage": os.getenv("SARVAM_DEFAULT_LANGUAGE", "en-IN"),
        "defaultSpeaker": os.getenv("SARVAM_DEFAULT_SPEAKER", "shubh"),
        "availableLanguages": SUPPORTED_LANGUAGES,
        "sttAutoDetect": True,
        "backend": "fastapi",
    }


@app.get("/api/listings")
def get_listings() -> dict[str, Any]:
    return {"items": store.read()["listings"]}


@app.get("/api/orders")
def get_orders() -> dict[str, Any]:
    return {"items": store.read()["orders"]}


@app.post("/api/listings", status_code=201)
def create_listing(payload: ListingPayload) -> dict[str, Any]:
    item = payload.model_dump()
    data = store.read()
    data["listings"] = [item, *data["listings"][:5]]
    store.write(data)
    return {"item": item}


@app.post("/api/sarvam/tts")
def sarvam_tts(payload: TtsPayload) -> dict[str, Any]:
    client = get_sarvam_client()
    if not client:
        raise HTTPException(status_code=503, detail="Sarvam API key is missing. Add SARVAM_API_KEY to .env before using TTS.")

    try:
        return client.text_to_speech(
            text=payload.text,
            target_language_code=payload.language_code,
            speaker=payload.speaker or os.getenv("SARVAM_DEFAULT_SPEAKER", "shubh"),
            pace=payload.pace,
            model=os.getenv("SARVAM_TTS_MODEL", "bulbul:v3"),
            speech_sample_rate=payload.speech_sample_rate,
            output_audio_codec=payload.output_audio_codec,
        )
    except SarvamClientError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@app.post("/api/sarvam/stt")
async def sarvam_stt(request: Request, language_code: str | None = Query(default=None)) -> dict[str, Any]:
    client = get_sarvam_client()
    if not client:
        raise HTTPException(status_code=503, detail="Sarvam API key is missing. Add SARVAM_API_KEY to .env before using STT.")

    audio_bytes = await request.body()
    mime_type = request.headers.get("content-type", "audio/webm").split(";", 1)[0].strip()
    extension = mimetypes.guess_extension(mime_type) or ".webm"
    filename = f"voice-input{extension}"
    if language_code == "auto":
        language_code = None

    try:
        return client.speech_to_text(
            audio_bytes=audio_bytes,
            filename=filename,
            mime_type=mime_type,
            model=os.getenv("SARVAM_STT_MODEL", "saaras:v3"),
            language_code=language_code,
        )
    except SarvamClientError as exc:
        raise HTTPException(status_code=exc.status_code, detail=str(exc)) from exc


@app.post("/api/assistant/respond")
def assistant_respond(payload: AssistantPayload) -> dict[str, Any]:
    client = get_sarvam_client()
    if not client:
        raise HTTPException(status_code=503, detail="Sarvam API key is missing. Add SARVAM_API_KEY to .env before using assistant generation.")

    transcript = payload.transcript.strip()
    if not transcript:
        raise HTTPException(status_code=400, detail="Transcript is required")

    return generate_assistant_response(
        client,
        transcript=transcript,
        language_code=payload.language_code,
        selected_language=payload.selected_language,
    )


@app.get("/")
def root() -> FileResponse:
    return FileResponse(BASE_DIR / "index.html")


app.mount("/", StaticFiles(directory=str(BASE_DIR), html=True), name="static")


def run() -> None:
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)


if __name__ == "__main__":
    run()
