# Voice Mart

Voice Rural is a voice-first marketplace prototype for rural sellers in India. The backend now runs on FastAPI and uses Sarvam for STT, command generation, and TTS.

## Stack

- Frontend: HTML, CSS, JavaScript
- Backend: FastAPI
- Voice STT: Sarvam `saaras:v3`
- Command generation: Sarvam chat `sarvam-m`
- Voice TTS: Sarvam `bulbul:v3`

## Features

- Indian multilingual STT
- Code-mixed Indian English command handling
- Unique generated canonical command for each transcript
- Spoken reply in the seller's language
- Local JSON persistence for listings and orders

## Setup

```env
SARVAM_API_KEY=your_real_key
SARVAM_DEFAULT_LANGUAGE=en-IN
SARVAM_DEFAULT_SPEAKER=shubh
SARVAM_TTS_MODEL=bulbul:v3
SARVAM_STT_MODEL=saaras:v3
SARVAM_CHAT_MODEL=sarvam-m
PORT=8000
```

## Install

```bash
python3 -m pip install -r requirements.txt
```

## Run

```bash
python3 -m uvicorn server:app --host 0.0.0.0 --port 8000
```

Open:

```text
http://127.0.0.1:8000
```

## Backend Routes

- `GET /api/health`
- `GET /api/config`
- `GET /api/listings`
- `POST /api/listings`
- `GET /api/orders`
- `POST /api/sarvam/stt`
- `POST /api/assistant/respond`
- `POST /api/sarvam/tts`

## Mixed-English Handling

The assistant prompt is now tuned for code-mixed commands such as:

- `10 kg vendakkai add panna one kilo 10 rupees`
- `tomato price set 30 rupees kilo`
- `baskets stock update pannunga minus 5`
- `today order check pannanum`

The backend generates a machine-friendly canonical command and a natural spoken response in the detected language.
# Voice-Mart
