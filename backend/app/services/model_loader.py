TORCH_AVAILABLE = False
_model = None
_processor = None

try:
    import torch
    from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
    TORCH_AVAILABLE = True
except ImportError:
    print('Torch not available - AI features disabled')

def load_model():
    global _model, _processor
    if not TORCH_AVAILABLE:
        return None, None
    try:
        from app.core.config import settings
        _processor = AutoProcessor.from_pretrained(settings.MODEL_PATH)
        _model = Qwen2_5_VLForConditionalGeneration.from_pretrained(settings.MODEL_PATH)
        print('Model loaded successfully')
    except Exception as e:
        print(f'Model loading failed: {e}')
    return _model, _processor

def is_loaded():
    return _model is not None
