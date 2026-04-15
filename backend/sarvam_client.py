import json
import os
import uuid
from urllib import error, request


class SarvamClientError(Exception):
    def __init__(self, status_code, message, payload=None):
        super().__init__(message)
        self.status_code = status_code
        self.payload = payload or {}


class SarvamClient:
    base_url = "https://api.sarvam.ai"

    def __init__(self, api_key):
        self.api_key = api_key

    def _json_request(self, path, payload):
        req = request.Request(
            f"{self.base_url}{path}",
            data=json.dumps(payload).encode("utf-8"),
            headers={
                "api-subscription-key": self.api_key,
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=90) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise SarvamClientError(exc.code, body)
        except error.URLError as exc:
            raise SarvamClientError(502, f"Sarvam request failed: {exc.reason}")

    def text_to_speech(
        self,
        text,
        target_language_code="en-IN",
        speaker="shubh",
        pace=0.9,
        model="bulbul:v3",
        speech_sample_rate=24000,
        output_audio_codec="wav",
    ):
        payload = {
            "text": text,
            "target_language_code": target_language_code,
            "speaker": speaker,
            "pace": pace,
            "model": model,
            "speech_sample_rate": speech_sample_rate,
            "output_audio_codec": output_audio_codec,
            "temperature": 0.4,
        }
        return self._json_request("/text-to-speech", payload)

    def speech_to_text(
        self,
        audio_bytes,
        filename="recording.webm",
        mime_type="audio/webm",
        model="saaras:v3",
        mode="transcribe",
        language_code=None,
    ):
        boundary = f"----VoiceRuralBoundary{uuid.uuid4().hex}"
        body = bytearray()

        def add_field(name, value):
            body.extend(f"--{boundary}\r\n".encode("utf-8"))
            body.extend(
                f'Content-Disposition: form-data; name="{name}"\r\n\r\n{value}\r\n'.encode("utf-8")
            )

        add_field("model", model)
        add_field("mode", mode)
        add_field("with_timestamps", "false")
        if language_code:
            add_field("language_code", language_code)

        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(
            (
                f'Content-Disposition: form-data; name="file"; filename="{filename}"\r\n'
                f"Content-Type: {mime_type}\r\n\r\n"
            ).encode("utf-8")
        )
        body.extend(audio_bytes)
        body.extend(b"\r\n")
        body.extend(f"--{boundary}--\r\n".encode("utf-8"))

        req = request.Request(
            f"{self.base_url}/speech-to-text",
            data=bytes(body),
            headers={
                "api-subscription-key": self.api_key,
                "Content-Type": f"multipart/form-data; boundary={boundary}",
            },
            method="POST",
        )

        try:
            with request.urlopen(req, timeout=90) as response:
                return json.loads(response.read().decode("utf-8"))
        except error.HTTPError as exc:
            body = exc.read().decode("utf-8", errors="replace")
            raise SarvamClientError(exc.code, body)
        except error.URLError as exc:
            raise SarvamClientError(502, f"Sarvam request failed: {exc.reason}")

    def chat_completion(
        self,
        messages,
        model="sarvam-m",
        temperature=0.2,
        max_tokens=350,
        reasoning_effort=None,
    ):
        payload = {
            "messages": messages,
            "model": model,
            "temperature": temperature,
            "max_tokens": max_tokens,
        }
        if reasoning_effort:
            payload["reasoning_effort"] = reasoning_effort
        return self._json_request("/v1/chat/completions", payload)


def load_env(path):
    if not os.path.exists(path):
        return

    with open(path, "r", encoding="utf-8") as handle:
        for raw_line in handle:
            line = raw_line.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())
