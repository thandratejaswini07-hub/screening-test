"""
app/services/model_loader.py
────────────────────────────
Lazy-loads Qwen2.5-VL-3B-Instruct on first use.
Never crashes at startup — falls back to rule-based report if model unavailable.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path

logger = logging.getLogger(__name__)

_model     = None
_processor = None
_lock      = threading.Lock()
_load_error: str | None = None
_loaded    = False

# Path where your model is already downloaded
MODEL_DIR = Path(__file__).parent.parent.parent / "models" / "Qwen2.5-VL-3B-Instruct"


def load_model() -> bool:
    """
    Loads the model lazily. Safe to call multiple times — loads only once.
    Returns True if model loaded successfully, False otherwise.
    """
    global _model, _processor, _load_error, _loaded

    with _lock:
        if _loaded:
            return _model is not None
        if _load_error:
            return False

        try:
            import torch

            # Use local path if model is already downloaded, else HuggingFace
            model_path = str(MODEL_DIR) if MODEL_DIR.exists() else "Qwen/Qwen2.5-VL-3B-Instruct"
            logger.info(f"[Model] Loading from: {model_path}")

            if not MODEL_DIR.exists():
                logger.warning("[Model] Local model not found — downloading from HuggingFace (~6GB)...")

            device = "cuda" if torch.cuda.is_available() else "cpu"
            if device == "cpu":
                logger.warning("[Model] No GPU detected. Inference will be slow (~30s per response).")

            from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor

            _processor = AutoProcessor.from_pretrained(
                model_path,
                trust_remote_code=True,
            )

            _model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
                model_path,
                torch_dtype=torch.float32,  # float32 for CPU stability
                device_map=device,
                trust_remote_code=True,
            )
            _model.eval()
            _loaded = True
            logger.info(f"[Model] Loaded successfully on {device}")
            return True

        except Exception as e:
            _load_error = str(e)
            _loaded = True  # Mark as attempted so we don't retry on every request
            logger.error(f"[Model] Failed to load: {e}")
            return False


def get_model():
    return _model


def get_processor():
    return _processor


def is_loaded() -> bool:
    return _model is not None