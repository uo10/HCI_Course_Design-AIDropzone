"""
Real LLM-backed AI Parser.

Supports OpenAI-compatible APIs (DeepSeek, OpenAI, etc.) and Anthropic.
Reads configuration from config.json → ai_parser_options.llm.

Implements the same interface as mock_ai_parser.parse_file() so the two
are drop-in swappable via the factory in main.py.
"""

from __future__ import annotations

import hashlib
import json
import re
from datetime import datetime
from pathlib import Path

import httpx

from ..models.common import FileCategory, FileMetadata, OperationStatus
from ..models.parser import ParseItem, ParseResult
from ..utils.config import load_config

# ---------------------------------------------------------------------------
# Prompt template
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """You are an AI file classifier for a desktop file-organisation tool called "AI Dropzone".

Analyse the file based on its FILENAME, EXTENSION and SIZE (you cannot read the actual file content in this version).

Return ONLY a JSON object (no markdown, no backticks) with these exact keys:
- "category": one of [document, image, video, audio, archive, code, spreadsheet, presentation, pdf, unknown]
- "tags": array of 2-3 lowercase English tags (e.g. ["coursework","assignment"])
- "summary": a chain-of-thought analysis in Chinese, 1-2 sentences, explaining your reasoning
- "keywords": array of 1-3 key terms extracted from the filename
- "confidence": number between 0.0 and 1.0
- "suggested_name": a clean English filename suggestion (keep original extension), format: category_date_originalstem.ext

Rules:
- If the filename contains Chinese academic keywords (作业/实验/报告/论文/课程) → category depends on extension, add "coursework" tag
- If it contains career keywords (简历/求职/CV/resume/portfolio) → add "job" and "career" tags
- If it contains finance keywords (银行/工资/发票/报销/税/tax/invoice) → add "finance" and "proof" tags
- Images (jpg/png/gif/webp) → category "image", tags ["image","media"]
- PDF → category "pdf"
- Be creative but reasonable with the summary — write as if you really analysed the file content.
"""

USER_PROMPT_TEMPLATE = """File: {name_before_drop}
Extension: {extension}
Size: {size_kb:.0f} KB
Path: {path}

Analyse this file and return the JSON."""

# ---------------------------------------------------------------------------
# API callers
# ---------------------------------------------------------------------------

def _call_openai_compatible(cfg: dict, system: str, user: str, timeout: int) -> str:
    """Call OpenAI / DeepSeek chat/completions endpoint."""
    base_url = cfg.get("base_url", "https://api.openai.com/v1").rstrip("/")
    if not base_url.endswith("/chat/completions"):
        if "/v1" in base_url:
            base_url = base_url.split("/v1")[0] + "/v1"
        base_url = base_url + "/chat/completions"

    api_key = cfg.get("api_key", "") or cfg.get("api_key_env", "")
    model = cfg.get("model", "gpt-3.5-turbo")

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user", "content": user},
        ],
        "temperature": 0.3,
        "max_tokens": 600,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(base_url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]


def _call_anthropic(cfg: dict, system: str, user: str, timeout: int) -> str:
    """Call Anthropic messages endpoint."""
    base_url = cfg.get("base_url", "https://api.anthropic.com").rstrip("/")
    if not base_url.endswith("/v1/messages"):
        base_url = base_url.rstrip("/") + "/v1/messages"

    api_key = cfg.get("api_key", "") or cfg.get("api_key_env", "")
    model = cfg.get("model", "claude-sonnet-4-6")

    headers = {
        "x-api-key": api_key,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
    }
    payload = {
        "model": model,
        "system": system,
        "messages": [{"role": "user", "content": user}],
        "max_tokens": 600,
    }

    with httpx.Client(timeout=timeout) as client:
        resp = client.post(base_url, headers=headers, json=payload)
        resp.raise_for_status()
        data = resp.json()
        return data["content"][0]["text"]


# ---------------------------------------------------------------------------
# LLM → ParseItem mapping
# ---------------------------------------------------------------------------

_VALID_CATEGORIES = {c.value for c in FileCategory}

def _parse_llm_response(raw: str, file_meta: FileMetadata, content_hash: str) -> ParseItem:
    """Extract structured fields from the LLM's JSON text.  Falls back
    gracefully if the JSON is malformed or missing keys."""
    # Strip markdown code fences
    cleaned = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    cleaned = re.sub(r"\s*```$", "", cleaned)

    try:
        data = json.loads(cleaned)
    except json.JSONDecodeError:
        # Try to extract JSON object from the text
        match = re.search(r"\{[\s\S]*\}", cleaned)
        if match:
            try:
                data = json.loads(match.group(0))
            except json.JSONDecodeError:
                data = {}
        else:
            data = {}

    category_str = str(data.get("category", "unknown")).lower()
    category = FileCategory(category_str) if category_str in _VALID_CATEGORIES else FileCategory.UNKNOWN

    raw_tags = data.get("tags", [])
    if isinstance(raw_tags, list):
        tags = {str(t).lower().strip() for t in raw_tags[:5] if str(t).strip()}
    else:
        tags = set()

    summary = str(data.get("summary", "LLM analysis completed."))
    keywords = [str(k) for k in data.get("keywords", [])[:5]] if isinstance(data.get("keywords"), list) else []

    confidence = float(data.get("confidence", 0.80))
    confidence = max(0.0, min(1.0, confidence))

    suggested = str(data.get("suggested_name", ""))
    if not suggested:
        ext = file_meta.extension.lower().lstrip(".") or "unknown"
        stem = Path(file_meta.name_before_drop).stem
        sha = content_hash[:8] if content_hash else "00000000"
        date_str = datetime.utcnow().strftime("%Y%m%d")
        suggested = f"file_{date_str}_{sha}_{stem}.{ext}"

    return ParseItem(
        file_path=file_meta.path,
        suggested_name=suggested,
        category=category,
        tags=tags,
        summary=summary,
        keywords=keywords,
        confidence=confidence,
        parsed_at=datetime.utcnow(),
    )


# ---------------------------------------------------------------------------
# Public API — same signature as mock_ai_parser.parse_file
# ---------------------------------------------------------------------------

def parse_file(file_meta: FileMetadata) -> ParseResult:
    """Real LLM-backed file analysis.

    Reads the LLM config from config.json, calls the configured provider,
    and maps the response into the standard ParseResult envelope.
    On any failure (network, auth, JSON parse), returns a failure result
    — the caller may then choose to fall back to Mock.
    """
    try:
        # Compute real content hash
        content_hash = ""
        try:
            src = Path(file_meta.path)
            if src.is_file():
                sha = hashlib.sha256()
                with open(src, "rb") as fh:
                    while True:
                        chunk = fh.read(65536)
                        if not chunk:
                            break
                        sha.update(chunk)
                content_hash = sha.hexdigest()
        except (OSError, PermissionError):
            pass

        # Load LLM config
        cfg = load_config()
        llm_cfg = cfg.get("ai_parser_options", {}).get("llm", {})
        provider = llm_cfg.get("provider", "openai").lower()
        timeout = int(llm_cfg.get("timeout_seconds", 30))

        # Build prompts
        system = SYSTEM_PROMPT
        size_kb = file_meta.size_bytes / 1024
        user = USER_PROMPT_TEMPLATE.format(
            name_before_drop=file_meta.name_before_drop,
            extension=file_meta.extension,
            size_kb=size_kb,
            path=file_meta.path,
        )

        # Call the appropriate provider
        if provider == "anthropic":
            raw = _call_anthropic(llm_cfg, system, user, timeout)
        else:
            raw = _call_openai_compatible(llm_cfg, system, user, timeout)

        item = _parse_llm_response(raw, file_meta, content_hash)
        return ParseResult(status=OperationStatus.SUCCESS, data=item)

    except Exception as e:
        return ParseResult(status=OperationStatus.FAILURE, error=str(e))
