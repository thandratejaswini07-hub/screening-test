import torch
import logging
from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
from app.core.config import settings

logger  = logging.getLogger(__name__)
_model  = None
_processor = None

def load_model():
    global _model, _processor
    model_path = settings.MODEL_PATH
    logger.info(f"Loading Qwen2.5-VL-3B-Instruct from: {model_path}")

    if torch.cuda.is_available():
        device_map  = "auto"
        torch_dtype = torch.bfloat16
        logger.info(f"GPU: {torch.cuda.get_device_name(0)}")
    else:
        device_map  = "cpu"
        torch_dtype = torch.float32
        logger.warning("No GPU detected. Inference will be slow (~30s per response).")

    _model = Qwen2_5_VLForConditionalGeneration.from_pretrained(
        model_path,
        torch_dtype=torch_dtype,
        device_map=device_map,
    )
    _model.eval()

    _processor = AutoProcessor.from_pretrained(
        model_path,
        min_pixels=256 * 28 * 28,
        max_pixels=1280 * 28 * 28,
    )

    logger.info("✓ Model loaded successfully")
    return _model, _processor

def get_model():
    if _model is None or _processor is None:
        raise RuntimeError("Model not loaded. Call load_model() at startup.")
    return _model, _processor

def is_loaded() -> bool:
    return _model is not None and _processor is not None