import json
import mimetypes
import os
import re
import secrets
import threading
from datetime import datetime
from pathlib import Path
from typing import Any

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
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
    "seller_profile": {
        "name": "Rural Seller",
        "phone": "+91 98765 43210",
        "role": "seller",
        "village": "Nashik Cluster",
        "token": "",
        "password": "seller123",
    },
    "buyer_profile": {
        "name": "Local Buyer",
        "phone": "+91 90000 12345",
        "role": "buyer",
        "village": "Nearby Market",
        "token": "",
        "password": "buyer123",
    },
    "settings": {
        "default_profit_margin": 0.22,
        "low_stock_poll_seconds": 30,
    },
    "listings": [
        {
            "title": "Fresh Tomatoes",
            "subtitle": "Farm produce from Nashik cluster",
            "price": "₹32 / kg",
            "stock": "20 kg ready",
            "tag": "Fast moving",
            "category": "Vegetables",
            "seller_name": "Rural Seller",
            "contact_phone": "+91 98765 43210",
            "min_stock_alert": 8,
            "image_data": "",
        },
        {
            "title": "Handmade Bamboo Baskets",
            "subtitle": "Craft collective, 100% handmade",
            "price": "₹180 / piece",
            "stock": "12 in stock",
            "tag": "Festival demand",
            "category": "Handicrafts",
            "seller_name": "Rural Seller",
            "contact_phone": "+91 98765 43210",
            "min_stock_alert": 5,
            "image_data": "",
        },
        {
            "title": "Homemade Mango Pickle",
            "subtitle": "Small-batch home kitchen product",
            "price": "₹140 / jar",
            "stock": "30 jars ready",
            "tag": "Repeat buyers",
            "category": "Home Foods",
            "seller_name": "Rural Seller",
            "contact_phone": "+91 98765 43210",
            "min_stock_alert": 10,
            "image_data": "",
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
    "sales": [
        {
            "listing_title": "Fresh Tomatoes",
            "quantity": 6,
            "unit": "kg",
            "total": 192,
            "profit": 42.24,
            "buyer_name": "Village Fresh Mart",
            "buyer_phone": "+91 91234 56789",
            "created_at": "2026-04-16T08:30:00",
        },
        {
            "listing_title": "Handmade Bamboo Baskets",
            "quantity": 2,
            "unit": "piece",
            "total": 360,
            "profit": 79.2,
            "buyer_name": "Anita General Store",
            "buyer_phone": "+91 99887 66554",
            "created_at": "2026-04-16T11:00:00",
        },
    ],
    "uploaded_images": [],
}

DEFAULT_ASSISTANT_RESULT = {
    "intent": "general_help",
    "canonical_command": "GENERAL_HELP",
    "assistant_reply": "I heard your request. You can add a product, check orders, update stock, ask for low-stock alerts, or ask for today's sales summary.",
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
    "add",
    "jodo",
    "serkkavum",
    "serisi",
    "cherkkuka",
    "umero",
    "kara",
    "cheyyandi",
    "panna",
    "set",
    "list",
    "register",
    "put",
    "create",
]
STOCK_HINTS = [
    "stock",
    "reduce",
    "minus",
    "kam",
    "kurai",
    "tagginchu",
    "update",
    "change",
    "increase",
    "remove",
]
ORDER_HINTS = [
    "order",
    "orders",
    "buyer",
    "pending",
    "check",
    "dikhao",
    "kaattu",
    "show",
]
SUMMARY_HINTS = ["summary", "today", "daily", "status", "report", "profit", "sell", "sales", "revenue"]
ALERT_HINTS = ["low stock", "alert", "alerts", "inventory alert", "stock alert"]


class ListingPayload(BaseModel):
    title: str
    subtitle: str
    price: str
    stock: str
    tag: str
    category: str = "Vegetables"
    seller_name: str = "Rural Seller"
    contact_phone: str = "+91 98765 43210"
    min_stock_alert: int = 5
    image_data: str = ""


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


class LoginPayload(BaseModel):
    name: str
    phone: str
    role: str = "seller"
    village: str = "Village Cluster"
    password: str | None = None


class BuyPayload(BaseModel):
    listing_title: str
    quantity: int = Field(ge=1)
    buyer_name: str
    buyer_phone: str


class ImagePreviewPayload(BaseModel):
    filename: str
    image_data: str


class AuditPayload(BaseModel):
    query: str
    language_code: str = "en-IN"


class Store:
    def __init__(self, path: Path):
        self.path = path
        self.lock = threading.RLock()
        self.path.parent.mkdir(parents=True, exist_ok=True)
        if not self.path.exists():
            self.write(DEFAULT_STORE)

    def _merge_defaults(self, payload: dict[str, Any], defaults: dict[str, Any]) -> dict[str, Any]:
        merged = dict(defaults)
        for key, value in payload.items():
            if isinstance(value, dict) and isinstance(merged.get(key), dict):
                merged[key] = self._merge_defaults(value, merged[key])
            else:
                merged[key] = value
        return merged

    def read(self) -> dict[str, Any]:
        with self.lock:
            try:
                with open(self.path, "r", encoding="utf-8") as handle:
                    payload = json.load(handle)
            except (FileNotFoundError, json.JSONDecodeError):
                payload = DEFAULT_STORE
                self.write(payload)
        merged = self._merge_defaults(payload, DEFAULT_STORE)
        if merged != payload:
            self.write(merged)
        return merged

    def write(self, payload: dict[str, Any]) -> None:
        temp_path = self.path.with_suffix(".tmp")
        with self.lock:
            with open(temp_path, "w", encoding="utf-8") as handle:
                json.dump(payload, handle, ensure_ascii=False, indent=2)
            os.replace(temp_path, self.path)


store = Store(DATA_FILE)


def normalize_listing(listing: dict[str, Any], profile: dict[str, Any]) -> dict[str, Any]:
    normalized = {
        "title": listing.get("title", "Untitled Product"),
        "subtitle": listing.get("subtitle", "Voice-created marketplace listing"),
        "price": listing.get("price", "Price pending"),
        "stock": listing.get("stock", "0 units"),
        "tag": listing.get("tag", "Live"),
        "category": listing.get("category") or infer_category(listing.get("title", "")) or "Vegetables",
        "seller_name": listing.get("seller_name") or profile.get("name", "Rural Seller"),
        "contact_phone": listing.get("contact_phone") or profile.get("phone", "+91 98765 43210"),
        "min_stock_alert": int(listing.get("min_stock_alert", 5) or 5),
        "image_data": listing.get("image_data", ""),
    }
    return normalized


def normalize_store_data(data: dict[str, Any]) -> dict[str, Any]:
    profile = data.get("seller_profile", DEFAULT_STORE["seller_profile"])
    data["listings"] = [normalize_listing(item, profile) for item in data.get("listings", [])]
    return data


def sanitize_profile(profile: dict[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in profile.items() if key != "password"}


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
        "vendakkai",
        "tomato",
        "tamatar",
        "thakkali",
        "okra",
        "basket",
        "baskets",
        "tokri",
        "pickle",
        "achar",
        "onion",
        "potato",
        "milk",
        "paneer",
        "curd",
    ]
    for product in known_products:
        if product in lower:
            return product
    words = re.findall(r"[a-zA-Z]+", text)
    filtered = [
        word
        for word in words
        if word.lower()
        not in {
            "add",
            "set",
            "price",
            "stock",
            "order",
            "check",
            "today",
            "one",
            "kilo",
            "kg",
            "rupees",
            "rupee",
            "summary",
            "profit",
            "sales",
            "show",
        }
    ]
    return filtered[0] if filtered else ""


def extract_price(text: str) -> str:
    patterns = [
        r"(\d+)\s*(?:rupees|rupaye|rupai|rs|₹)",
        r"(?:price|rate)\s*(?:is|set|to)?\s*(\d+)",
    ]
    for pattern in patterns:
        match = re.search(pattern, text, flags=re.IGNORECASE)
        if match:
            return match.group(1)
    return ""


def extract_quantity(text: str) -> str:
    match = re.search(r"(\d+)\s*(?:kg|kilo|kilogram|pieces|piece|jar|jars)?", text, flags=re.IGNORECASE)
    return match.group(1) if match else ""


def parse_stock_value(stock_text: str) -> tuple[int, str]:
    match = re.search(r"(-?\d+)\s*([a-zA-Z]+)?", stock_text or "")
    if not match:
        return 0, "units"
    return int(match.group(1)), match.group(2) or "units"


def format_stock_value(quantity: int, unit: str) -> str:
    label = unit if unit else "units"
    suffix = " ready" if label == "kg" else " in stock"
    return f"{quantity} {label}{suffix}"


def canonicalize(intent: str, fields: dict[str, str]) -> str:
    parts = [intent.upper()]
    for key in ["product_name", "category", "price", "stock", "stock_delta", "buyer_name"]:
        value = str(fields.get(key, "")).strip()
        if value:
            safe = re.sub(r"[^A-Za-z0-9]+", "_", value).strip("_")
            parts.append(f"{key.upper()}_{safe}")
    return "_".join(parts) if len(parts) > 1 else intent.upper()


def localized_reply(intent: str, language_code: str, fields: dict[str, str], extra: str = "") -> str:
    product = fields.get("product_name") or "product"
    stock = fields.get("stock") or fields.get("stock_delta") or ""
    price = fields.get("price") or ""

    if language_code == "ta-IN":
        if intent == "add_listing":
            return (
                f"{stock or 'புதிய'} {product} பட்டியல் சேர்க்கப்பட்டது. ஒரு கிலோ விலை {price} ரூபாய்."
                if price
                else f"{product} பட்டியலில் சேர்க்கப்பட்டது."
            )
        if intent == "update_stock":
            return extra or f"{product} stock புதுப்பிக்கப்பட்டது."
        if intent == "check_orders":
            return "உங்களுடைய pending orders இப்போது பார்க்கலாம்."
        if intent == "daily_summary":
            return extra or "இன்றைய விற்பனை சுருக்கம் தயார்."
        if intent == "inventory_alerts":
            return extra or "குறைந்த stock alerts தயார்."
        return "உங்கள் கோரிக்கை புரிந்தது. மேலும் விவரம் கொடுத்தால் நான் உதவுகிறேன்."

    if language_code == "hi-IN":
        if intent == "add_listing":
            return (
                f"{product} listing {price} rupaye ke saath add ho gayi hai."
                if price
                else f"{product} listing add ho gayi hai."
            )
        if intent == "update_stock":
            return extra or f"{product} ka stock update ho gaya hai."
        if intent == "check_orders":
            return "Aapke pending orders ab dikhaye ja rahe hain."
        if intent == "daily_summary":
            return extra or "Aaj ka business summary taiyar hai."
        if intent == "inventory_alerts":
            return extra or "Low stock alerts taiyar hain."
        return "Maine aapki request samajh li. Thoda aur detail boliye to main sahi action le sakta hoon."

    if intent == "add_listing":
        return f"{product} listing added successfully at ₹{price} per unit." if price else f"{product} listing added successfully."
    if intent == "update_stock":
        return extra or f"{product} stock has been updated."
    if intent == "check_orders":
        return "Your pending orders are ready to review."
    if intent == "daily_summary":
        return extra or "Your daily business summary is ready."
    if intent == "inventory_alerts":
        return extra or "Your low stock alerts are ready."
    return DEFAULT_ASSISTANT_RESULT["assistant_reply"]


def compute_inventory_alerts(data: dict[str, Any]) -> list[dict[str, Any]]:
    alerts = []
    for listing in data["listings"]:
        quantity, unit = parse_stock_value(listing.get("stock", ""))
        threshold = int(listing.get("min_stock_alert", 5))
        if quantity <= threshold:
            alerts.append(
                {
                    "id": f"{listing['title']}-{quantity}",
                    "title": listing["title"],
                    "current_stock": listing["stock"],
                    "threshold": threshold,
                    "severity": "high" if quantity <= max(1, threshold // 2) else "medium",
                    "message": f"{listing['title']} is low on stock. Only {quantity} {unit} left.",
                }
            )
    return alerts


def compute_audit_metrics(data: dict[str, Any]) -> dict[str, Any]:
    total_revenue = sum(item.get("total", 0) for item in data["sales"])
    total_profit = sum(item.get("profit", 0) for item in data["sales"])
    total_orders = len(data["sales"])
    total_quantity = sum(item.get("quantity", 0) for item in data["sales"])
    return {
        "total_revenue": round(total_revenue, 2),
        "total_profit": round(total_profit, 2),
        "total_orders": total_orders,
        "total_quantity": total_quantity,
    }


def audit_reply(language_code: str, metrics: dict[str, Any]) -> str:
    if language_code == "ta-IN":
        return (
            f"இன்று மொத்த விற்பனை ₹{metrics['total_revenue']}, "
            f"மொத்த லாபம் ₹{metrics['total_profit']}, "
            f"மொத்த ஆர்டர்கள் {metrics['total_orders']}."
        )
    if language_code == "hi-IN":
        return (
            f"Aaj ki total bikri ₹{metrics['total_revenue']}, "
            f"total profit ₹{metrics['total_profit']}, "
            f"aur total orders {metrics['total_orders']} hain."
        )
    return (
        f"Today's total sales are ₹{metrics['total_revenue']}, "
        f"estimated profit is ₹{metrics['total_profit']}, "
        f"and completed orders are {metrics['total_orders']}."
    )


def heuristic_assistant_response(transcript: str, language_code: str, selected_language: str | None) -> dict[str, Any]:
    normalized_language = normalize_language_code(language_code, selected_language)
    lower = transcript.lower()
    fields = {**DEFAULT_ASSISTANT_RESULT["fields"]}
    fields["product_name"] = extract_product_name(transcript)
    fields["category"] = infer_category(transcript)
    fields["stock"] = extract_quantity(lower)
    fields["price"] = extract_price(lower)

    if any(word in lower for word in ALERT_HINTS):
        intent = "inventory_alerts"
    elif any(word in lower for word in ORDER_HINTS):
        intent = "check_orders"
    elif any(word in lower for word in SUMMARY_HINTS):
        intent = "daily_summary"
    elif any(word in lower for word in STOCK_HINTS) and not any(word in lower for word in ADD_HINTS):
        intent = "update_stock"
        fields["stock_delta"] = f"-{fields['stock']}" if fields["stock"] else ""
        fields["stock"] = ""
    elif any(word in lower for word in ADD_HINTS) or fields["product_name"] or fields["price"]:
        intent = "add_listing"
    else:
        intent = "general_help"

    data = store.read()
    extra = ""
    if intent == "daily_summary":
        extra = audit_reply(normalized_language, compute_audit_metrics(data))
    elif intent == "inventory_alerts":
        alerts = compute_inventory_alerts(data)
        if alerts:
            titles = ", ".join(item["title"] for item in alerts[:3])
            extra = (
                f"Low stock items: {titles}."
                if normalized_language == "en-IN"
                else f"Low stock items ready: {titles}."
            )
        else:
            extra = (
                "No low stock alerts right now."
                if normalized_language == "en-IN"
                else "No low stock alerts right now."
            )
    elif intent == "update_stock" and fields["product_name"]:
        extra = localized_reply(intent, normalized_language, fields)

    return {
        "intent": intent,
        "canonical_command": canonicalize(intent, fields),
        "assistant_reply": localized_reply(intent, normalized_language, fields, extra=extra),
        "language_code": normalized_language,
        "fields": fields,
    }


def postprocess_assistant_result(
    result: dict[str, Any], transcript: str, language_code: str | None, selected_language: str | None
) -> dict[str, Any]:
    fallback = heuristic_assistant_response(transcript, language_code or result.get("language_code"), selected_language)
    current = {**fallback, **result}
    current_fields = {**fallback["fields"], **(result.get("fields") or {})}
    current["fields"] = current_fields

    lower = transcript.lower()
    if any(word in lower for word in ALERT_HINTS):
        current["intent"] = "inventory_alerts"
    elif any(word in lower for word in ORDER_HINTS):
        current["intent"] = "check_orders"
    elif any(word in lower for word in SUMMARY_HINTS):
        current["intent"] = "daily_summary"
    elif any(word in lower for word in ADD_HINTS) and current["intent"] == "update_stock":
        current["intent"] = "add_listing"

    if not current_fields.get("product_name"):
        current_fields["product_name"] = fallback["fields"].get("product_name", "")
    if not current_fields.get("category"):
        current_fields["category"] = fallback["fields"].get("category", "")
    if not current_fields.get("price"):
        current_fields["price"] = fallback["fields"].get("price", "")
    if not current_fields.get("stock"):
        current_fields["stock"] = fallback["fields"].get("stock", "")
    if current["intent"] == "update_stock" and not current_fields.get("stock_delta"):
        current_fields["stock_delta"] = fallback["fields"].get("stock_delta", "")

    if current["intent"] == "daily_summary":
        current["assistant_reply"] = audit_reply(current.get("language_code") or fallback["language_code"], compute_audit_metrics(store.read()))
    if current["intent"] == "inventory_alerts":
        alerts = compute_inventory_alerts(store.read())
        titles = ", ".join(item["title"] for item in alerts[:3]) if alerts else ""
        if alerts:
            current["assistant_reply"] = (
                f"Low stock items are {titles}."
                if current.get("language_code") == "en-IN"
                else f"Low stock items are {titles}."
            )
        else:
            current["assistant_reply"] = localized_reply("inventory_alerts", current.get("language_code") or fallback["language_code"], current_fields)

    if not current.get("assistant_reply") or current["assistant_reply"] == DEFAULT_ASSISTANT_RESULT["assistant_reply"]:
        current["assistant_reply"] = localized_reply(
            current["intent"], current.get("language_code") or fallback["language_code"], current_fields
        )

    current["canonical_command"] = canonicalize(current["intent"], current_fields)
    current["fields"] = current_fields
    return current


def generate_assistant_response(client: SarvamClient, transcript: str, language_code: str | None, selected_language: str | None) -> dict[str, Any]:
    requested_language = normalize_language_code(language_code, selected_language)
    system_prompt = """You are a multilingual voice marketplace assistant for rural Indian sellers.
Convert the seller transcript into a structured marketplace command and reply in the same spoken language.
Return JSON only with this exact schema:
{
  \"intent\": \"add_listing|check_orders|update_stock|daily_summary|inventory_alerts|respond_to_buyer|general_help\",
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
- Use daily_summary for questions like how much did I sell today or what is my profit.
- Use inventory_alerts for low stock or alert questions.
- If details are missing, still generate a helpful canonical_command and ask a short follow-up in the same language.
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


def guess_image_title(filename: str) -> str:
    stem = Path(filename).stem.replace("-", " ").replace("_", " ").strip()
    return stem.title() if stem else "New Product"


def image_preview_result(filename: str, image_data: str) -> dict[str, Any]:
    title = guess_image_title(filename)
    category = infer_category(title) or "vegetables"
    pretty_category = {
        "vegetables": "Vegetables",
        "handicrafts": "Handicrafts",
        "home_foods": "Home Foods",
        "dairy": "Dairy",
    }.get(category, "Vegetables")
    return {
        "title": title,
        "category": pretty_category,
        "description": f"Image captured for {title}. Use voice to confirm price and stock.",
        "image_data": image_data,
        "voice_prompt": f"Photo added for {title}. Now speak the price, stock, and category to complete the listing.",
    }


app = FastAPI(title="Voice Rural", version="1.2.0")
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


@app.get("/api/profile")
def get_profile(role: str = Query(default="seller")) -> dict[str, Any]:
    data = store.read()
    profile = data.get("buyer_profile", data["seller_profile"]) if role == "buyer" else data["seller_profile"]
    return sanitize_profile(profile)


@app.post("/api/login")
def login(payload: LoginPayload) -> dict[str, Any]:
    data = store.read()
    key = f"{payload.role}_profile"
    existing_profile = data.get(key, {})

    if existing_profile.get("phone") == payload.phone:
        stored_password = existing_profile.get("password")
        if stored_password:
            if not payload.password:
                raise HTTPException(status_code=400, detail="Password is required for this account")
            if payload.password != stored_password:
                raise HTTPException(status_code=401, detail="Invalid password")
        else:
            if not payload.password:
                raise HTTPException(status_code=400, detail="Set a password for this account")

        existing_profile["name"] = payload.name
        existing_profile["village"] = payload.village
        if payload.password:
            existing_profile["password"] = payload.password
        existing_profile["token"] = secrets.token_hex(16)
        profile = existing_profile
    else:
        if not payload.password:
            raise HTTPException(status_code=400, detail="Password is required to create a new account")
        profile = {
            "name": payload.name,
            "phone": payload.phone,
            "role": payload.role,
            "village": payload.village,
            "token": secrets.token_hex(16),
            "password": payload.password,
        }
        data[key] = profile

    if payload.role == "seller":
        for listing in data["listings"]:
            listing["seller_name"] = payload.name
            listing["contact_phone"] = payload.phone

    store.write(data)
    return {
        "name": profile["name"],
        "phone": profile["phone"],
        "role": profile["role"],
        "village": profile["village"],
        "token": profile["token"],
    }


@app.get("/api/listings")
def get_listings() -> dict[str, Any]:
    data = normalize_store_data(store.read())
    store.write(data)
    return {"items": data["listings"]}


@app.get("/api/orders")
def get_orders() -> dict[str, Any]:
    return {"items": store.read()["orders"]}


@app.get("/api/dashboard")
def get_dashboard(role: str = Query(default="seller")) -> dict[str, Any]:
    data = normalize_store_data(store.read())
    store.write(data)
    profile = data.get("seller_profile") if role == "seller" else data.get("buyer_profile", data.get("seller_profile"))
    return {
        "alerts": compute_inventory_alerts(data),
        "metrics": compute_audit_metrics(data),
        "seller": sanitize_profile(profile),
    }


@app.post("/api/listings", status_code=201)
def create_listing(payload: ListingPayload) -> dict[str, Any]:
    data = normalize_store_data(store.read())
    item = payload.model_dump()
    data["listings"] = [item, *data["listings"][:7]]
    store.write(data)
    return {"item": item}


@app.post("/api/buy")
def buy_listing(payload: BuyPayload) -> dict[str, Any]:
    data = normalize_store_data(store.read())
    listing = next((item for item in data["listings"] if item["title"] == payload.listing_title), None)
    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    stock_value, unit = parse_stock_value(listing["stock"])
    if payload.quantity > stock_value:
        raise HTTPException(status_code=400, detail="Requested quantity is greater than available stock")

    price_text = listing["price"]
    price_match = re.search(r"(\d+)", price_text)
    unit_price = int(price_match.group(1)) if price_match else 0
    total = unit_price * payload.quantity
    margin = float(data["settings"]["default_profit_margin"])
    profit = round(total * margin, 2)

    new_stock = stock_value - payload.quantity
    listing["stock"] = format_stock_value(new_stock, unit)
    data["orders"].insert(
        0,
        {
            "buyer": payload.buyer_name,
            "detail": f"Bought {payload.quantity} {unit} of {listing['title']}.",
            "status": "Purchased",
        },
    )
    data["sales"].insert(
        0,
        {
            "listing_title": listing["title"],
            "quantity": payload.quantity,
            "unit": unit,
            "total": total,
            "profit": profit,
            "buyer_name": payload.buyer_name,
            "buyer_phone": payload.buyer_phone,
            "created_at": datetime.now().isoformat(timespec="seconds"),
        },
    )
    store.write(data)
    return {
        "success": True,
        "message": f"Purchase completed for {listing['title']}",
        "listing": listing,
        "sale": data["sales"][0],
    }


@app.post("/api/listings/image-preview")
def image_preview(payload: ImagePreviewPayload) -> dict[str, Any]:
    data = store.read()
    preview = image_preview_result(payload.filename, payload.image_data)
    data["uploaded_images"].insert(
        0,
        {
            "filename": payload.filename,
            "created_at": datetime.now().isoformat(timespec="seconds"),
        },
    )
    store.write(data)
    return preview


@app.post("/api/audit/query")
def audit_query(payload: AuditPayload) -> dict[str, Any]:
    metrics = compute_audit_metrics(store.read())
    return {
        "query": payload.query,
        "metrics": metrics,
        "reply": audit_reply(payload.language_code, metrics),
        "language_code": payload.language_code,
    }


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
