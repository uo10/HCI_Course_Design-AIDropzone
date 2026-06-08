"""
Upgraded Mock AI Parser — high-fidelity demo engine.

Uses a multi-dimensional "extension × keyword" rule matrix covering three
real-world scenarios: coursework, job materials, and financial documents.
Generates realistic chain-of-thought summaries, standardized filenames,
and 2–3 relevant tags per file.

Implements the AIParserInterface contract from CLAUDE.md.
"""

from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path

from ..models.common import FileCategory, FileMetadata, OperationStatus
from ..models.parser import ParseItem, ParseResult
from ..utils.file_preview import read_text_preview


# ======================================================================
# Scenario definitions
# ======================================================================

@dataclass
class Scenario:
    name: str
    keywords: list[str]           # name_before_drop must contain at least one
    tag: str                      # primary scenario tag
    extra_tags: list[str] = field(default_factory=list)
    cot_template: str = ""        # chain-of-thought analysis template
    naming_prefix: str = ""       # filename prefix override


SCENARIOS: list[Scenario] = [
    # ── Scenario A: 课程作业 ──
    Scenario(
        name="coursework",
        keywords=["作业", "实验", "报告", "大作业", "课程", "论文",
                   "homework", "assignment", "lab", "report", "essay", "hw"],
        tag="coursework",
        extra_tags=["assignment"],
        cot_template=(
            "[思维链] 文件名包含疑似课程关键词 '{kw}' → "
            "结合扩展名判断为{cat_label} → "
            "建议归类为「课程作业」，适用于教学场景归档。"
        ),
        naming_prefix="coursework",
    ),
    # ── Scenario B: 求职材料 ──
    Scenario(
        name="job_materials",
        keywords=["简历", "求职", "应聘", "cover", "resume", "cv",
                   "portfolio", "作品集", "面试", "推荐信",
                   "个人陈述", "自荐", "履历"],
        tag="job",
        extra_tags=["career"],
        cot_template=(
            "[思维链] 文件名包含职业发展关键词 '{kw}' → "
            "推断为求职/招聘相关文件 → "
            "建议归类为「求职材料」，可配合隐私标记额外保护。"
        ),
        naming_prefix="job",
    ),
    # ── Scenario C: 财务证明 ──
    Scenario(
        name="finance",
        keywords=["工资", "收入", "银行", "流水", "银行流水", "纳税",
                   "税单", "报销", "发票", "账单", "对账单",
                   "payroll", "salary", "invoice", "receipt", "bank",
                   "statement", "tax", "财务", "公积金", "社保"],
        tag="finance",
        extra_tags=["proof"],
        cot_template=(
            "[思维链] 文件名匹配财务凭证关键词 '{kw}' → "
            "判断为{cat_label}类财务文件 → "
            "建议归类为「财务证明」，注意隐私保护与合规存档。"
        ),
        naming_prefix="finance",
    ),
]

# Default fallback descriptions per category
CATEGORY_LABELS: dict[FileCategory, str] = {
    FileCategory.DOCUMENT: "文档",
    FileCategory.IMAGE: "图像",
    FileCategory.VIDEO: "视频",
    FileCategory.AUDIO: "音频",
    FileCategory.ARCHIVE: "压缩包",
    FileCategory.CODE: "代码",
    FileCategory.SPREADSHEET: "电子表格",
    FileCategory.PRESENTATION: "演示文稿",
    FileCategory.PDF: "PDF 文档",
    FileCategory.UNKNOWN: "未知类型文件",
}

CATEGORY_DESCRIPTIONS: dict[FileCategory, str] = {
    FileCategory.DOCUMENT: "标准文本文档，可用于记录、撰写或编辑文字内容",
    FileCategory.IMAGE: "位图或矢量图像文件，通常用于视觉展示或设计素材",
    FileCategory.VIDEO: "视频文件，包含动态影像及可能的音轨",
    FileCategory.AUDIO: "音频文件，包含录制的声音或音乐内容",
    FileCategory.ARCHIVE: "压缩归档文件，内含一个或多个打包文件",
    FileCategory.CODE: "源代码或结构化数据文件，供程序解析或编辑",
    FileCategory.SPREADSHEET: "电子表格文件，包含表格化的数值或文本数据",
    FileCategory.PRESENTATION: "幻灯片演示文稿，用于汇报、展示或教学",
    FileCategory.PDF: "PDF 便携式文档，适合跨平台分享与打印",
    FileCategory.UNKNOWN: "暂无法识别的文件类型，建议人工确认",
}

# Extension → category mapping
EXTENSION_CATEGORY: dict[str, FileCategory] = {
    "doc": FileCategory.DOCUMENT, "docx": FileCategory.DOCUMENT,
    "txt": FileCategory.DOCUMENT, "md": FileCategory.DOCUMENT,
    "rtf": FileCategory.DOCUMENT, "odt": FileCategory.DOCUMENT,
    "png": FileCategory.IMAGE, "jpg": FileCategory.IMAGE,
    "jpeg": FileCategory.IMAGE, "gif": FileCategory.IMAGE,
    "bmp": FileCategory.IMAGE, "webp": FileCategory.IMAGE,
    "svg": FileCategory.IMAGE, "ico": FileCategory.IMAGE,
    "mp4": FileCategory.VIDEO, "avi": FileCategory.VIDEO,
    "mov": FileCategory.VIDEO, "mkv": FileCategory.VIDEO,
    "wmv": FileCategory.VIDEO, "flv": FileCategory.VIDEO,
    "mp3": FileCategory.AUDIO, "wav": FileCategory.AUDIO,
    "flac": FileCategory.AUDIO, "aac": FileCategory.AUDIO,
    "ogg": FileCategory.AUDIO, "wma": FileCategory.AUDIO,
    "zip": FileCategory.ARCHIVE, "rar": FileCategory.ARCHIVE,
    "7z": FileCategory.ARCHIVE, "tar": FileCategory.ARCHIVE,
    "gz": FileCategory.ARCHIVE, "bz2": FileCategory.ARCHIVE,
    "py": FileCategory.CODE, "js": FileCategory.CODE,
    "ts": FileCategory.CODE, "java": FileCategory.CODE,
    "cpp": FileCategory.CODE, "c": FileCategory.CODE,
    "go": FileCategory.CODE, "rs": FileCategory.CODE,
    "html": FileCategory.CODE, "css": FileCategory.CODE,
    "json": FileCategory.CODE, "xml": FileCategory.CODE,
    "yaml": FileCategory.CODE, "yml": FileCategory.CODE,
    "xls": FileCategory.SPREADSHEET, "xlsx": FileCategory.SPREADSHEET,
    "csv": FileCategory.SPREADSHEET,
    "ppt": FileCategory.PRESENTATION, "pptx": FileCategory.PRESENTATION,
    "pdf": FileCategory.PDF,
}

# Sensitive-file keywords
SENSITIVE_PATTERNS: list[str] = [
    "身份证", "简历", "成绩单", "合同", "密码", "病历",
]
SENSITIVE_TAG = "sensitive"
SENSITIVE_SUFFIX = " — ⚠ 检测到敏感信息"


# ======================================================================
# Classification engine
# ======================================================================

def _classify(ext: str, name_before_drop: str) -> dict:
    """Run the multi-dimensional classifier.

    Returns a dict with keys: category, tags, summary, keywords, scenario
    """
    ext_lower = ext.lower().lstrip(".")
    category = EXTENSION_CATEGORY.get(ext_lower, FileCategory.UNKNOWN)
    cat_label = CATEGORY_LABELS.get(category, "未知类型")

    # Match against scenarios
    tags: set[str] = set()
    summary_parts: list[str] = []
    keywords: list[str] = []
    scenario: Scenario | None = None

    for sc in SCENARIOS:
        hit = _match_keywords(name_before_drop, sc.keywords)
        if hit:
            scenario = sc
            keywords.append(hit)
            tags.add(sc.tag)
            tags.update(sc.extra_tags)

            cot = sc.cot_template.format(kw=hit, cat_label=cat_label)
            summary_parts.append(cot)
            break  # first-matching scenario wins

    # Filename-specific supplementary tag
    name_low = name_before_drop.lower()
    _FILENAME_SUPPLEMENTS: dict[str, re.Pattern] = {
        "screenshot": re.compile(r"screenshot|snip|capture|录屏", re.IGNORECASE),
        "photo": re.compile(r"photo|(?:^|[^a-z])pic[^a-z]|IMG_|DSC", re.IGNORECASE),
        "draft": re.compile(r"draft|草稿|初稿|v\d", re.IGNORECASE),
    }
    for kw, pat in _FILENAME_SUPPLEMENTS.items():
        if pat.search(name_low) and kw not in tags:
            tags.add(kw)
            if len(tags) < 3:
                keywords.append(kw)

    # Ensure 2-3 tags minimum; fall back to category-level tags
    if len(tags) < 2:
        _CAT_FALLBACK: dict[FileCategory, list[str]] = {
            FileCategory.DOCUMENT: ["document", "text"],
            FileCategory.IMAGE: ["image", "media"],
            FileCategory.VIDEO: ["video", "media"],
            FileCategory.AUDIO: ["audio", "media"],
            FileCategory.ARCHIVE: ["archive", "compressed"],
            FileCategory.CODE: ["code", "text"],
            FileCategory.SPREADSHEET: ["spreadsheet", "data"],
            FileCategory.PRESENTATION: ["presentation", "slides"],
            FileCategory.PDF: ["pdf", "document"],
            FileCategory.UNKNOWN: ["unknown", "misc"],
        }
        for fb in _CAT_FALLBACK.get(category, ["unknown"]):
            if fb not in tags:
                tags.add(fb)
        if len(tags) < 2:
            tags.add("file")

    # Chain-of-thought summary
    if summary_parts:
        base_summary = " ".join(summary_parts)
    else:
        base_summary = (
            f"[思维链] 文件名未命中特定场景关键词 → "
            f"按扩展名归类为「{cat_label}」→ "
            f"采用通用分类策略。"
        )

    desc = CATEGORY_DESCRIPTIONS.get(category, "未知文件类型")
    summary = f"{base_summary} | {desc}"

    # Confidence is higher when a scenario matched
    confidence = 0.92 if scenario else 0.78

    return {
        "category": category,
        "tags": tags,
        "summary": summary,
        "keywords": keywords,
        "scenario": scenario,
        "confidence": confidence,
    }


def _match_keywords(name: str, keywords: list[str]) -> str:
    """Return the first keyword found in *name*, or ''."""
    name_low = name.lower()
    for kw in keywords:
        if kw.lower() in name_low:
            return kw
    return ""


# ======================================================================
# Filename generator
# ======================================================================

def _suggest_name(file_meta: FileMetadata, result: dict, content_hash: str = "") -> str:
    """Build a clean suggested filename:  scenario_prefix_date_hash.ext"""
    ext = file_meta.extension.lower().lstrip(".") or "unknown"
    stem = Path(file_meta.name_before_drop).stem

    # Keep the original stem clean (max 40 chars for readability)
    if len(stem) > 40:
        stem = stem[:40]

    sha = content_hash[:8] if content_hash else "00000000"
    date_str = datetime.utcnow().strftime("%Y%m%d")

    sc: Scenario | None = result.get("scenario")
    prefix = sc.naming_prefix if sc else "file"
    return f"{prefix}_{date_str}_{sha}_{stem}.{ext}"


# ======================================================================
# Public API
# ======================================================================

def parse_file(
    file_meta: FileMetadata,
    style_prompt: str = "",
    extra_prompt: str = "",
) -> ParseResult:
    """Run the full mock-AI pipeline on a single file.

    *style_prompt* is the persistent naming-style preference from settings
    (e.g. "偏学术、保留英文缩写、最多25字符").
    *extra_prompt* is a one-time hint for this specific file
    (e.g. "强调算法名、突出实验版本").

    Returns ParseResult with chain-of-thought summary, 2-3 tags, and a
    suggested name that reflects any active prompts.
    """
    try:
        # ── Actually open the file to get real metadata ──
        content_hash = ""
        real_size = file_meta.size_bytes
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
                real_size = src.stat().st_size
        except (OSError, PermissionError):
            pass

        # ── Classify ──
        result = _classify(file_meta.extension, file_meta.name_before_drop)
        tags = result["tags"]
        summary = result["summary"]
        keywords = result["keywords"]

        # ── Read file content for better analysis ──
        content_preview = read_text_preview(Path(file_meta.path))
        if content_preview:
            # Extract extra keywords from content
            content_extra = _extract_content_keywords(content_preview, tags, keywords)
            if content_extra:
                summary = summary.replace(
                    "文件名未命中特定场景关键词",
                    f"文件内容包含关键词 '{content_extra[0]}'",
                )
                # Boost confidence when content confirms filename hints
                result["confidence"] = min(result["confidence"] + 0.06, 0.98)

        # Sensitive-file interception
        for kw in SENSITIVE_PATTERNS:
            if kw in file_meta.name_before_drop:
                tags = set(tags)
                tags.add(SENSITIVE_TAG)
                summary += SENSITIVE_SUFFIX
                break

        # ── Apply style & extra prompts (Mock mode) ──
        active_prompts: list[str] = []
        if style_prompt:
            active_prompts.append(f"风格要求: {style_prompt}")
            # Try to extract keywords from the style prompt for tag enrichment
            _apply_prompt_keywords(style_prompt, tags, keywords)
        if extra_prompt:
            active_prompts.append(f"本次要求: {extra_prompt}")
            _apply_prompt_keywords(extra_prompt, tags, keywords)

        if active_prompts:
            summary = summary.rstrip(" |") + " | " + " | ".join(active_prompts)

        # Append real file stats to the summary
        size_kb = real_size / 1024
        if size_kb >= 1024:
            size_str = f"{size_kb/1024:.1f}MB"
        else:
            size_str = f"{size_kb:.0f}KB" if size_kb >= 1 else f"{real_size}B"
        summary += f" | 文件大小 {size_str}，SHA256={content_hash[:12] if content_hash else 'N/A'}"

        suggested_name = _suggest_name(file_meta, result, content_hash)

        item = ParseItem(
            file_path=file_meta.path,
            suggested_name=suggested_name,
            category=result["category"],
            tags=tags,
            summary=summary,
            keywords=keywords,
            confidence=result["confidence"],
            parsed_at=datetime.utcnow(),
        )

        return ParseResult(status=OperationStatus.SUCCESS, data=item)

    except Exception as e:
        return ParseResult(status=OperationStatus.FAILURE, error=str(e))


def _apply_prompt_keywords(prompt: str, tags: set[str], keywords: list[str]) -> None:
    """Extract hint keywords from a prompt string and add to tags/keywords."""
    hints = {
        "学术": "academic", "算法": "algorithm", "实验": "experiment",
        "版本": "version", "英文": "english", "缩写": "abbrev",
        "正式": "formal", "简洁": "concise", "详细": "detailed",
        "代码": "code", "数据": "data", "图表": "chart",
    }
    for cn, en in hints.items():
        if cn in prompt:
            if en not in tags:
                tags.add(en)
            if en not in keywords:
                keywords.append(en)


def _extract_content_keywords(
    content: str, tags: set[str], keywords: list[str]
) -> list[str]:
    """Scan file content for meaningful keywords and enrich tags/keywords."""
    found: list[str] = []
    patterns = {
        "machine learning": "机器学习",
        "deep learning": "深度学习",
        "neural network": "神经网络",
        "algorithm": "算法",
        "experiment": "实验",
        "dataset": "数据集",
        "model": "模型",
        "training": "训练",
        "accuracy": "准确率",
        "classification": "分类",
        "regression": "回归",
        "cluster": "聚类",
        "python": "Python",
        "javascript": "JavaScript",
        "react": "React",
        "database": "数据库",
        "sql": "SQL",
        "api": "API",
        "docker": "Docker",
        "git": "Git",
        "test": "测试",
        "report": "报告",
        "budget": "预算",
        "invoice": "发票",
        "salary": "工资",
        "contract": "合同",
    }
    content_low = content.lower()
    for en_key, cn_label in patterns.items():
        if en_key in content_low:
            tag_name = en_key.replace(" ", "_")
            if tag_name not in tags:
                tags.add(tag_name)
            if cn_label not in keywords:
                keywords.append(cn_label)
            found.append(cn_label)
    return found
