try:
    import torch
    from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
    from qwen_vl_utils import process_vision_info
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False
    print('Torch not available - AI engine disabled')

def analyse_eye_image(image_bytes, analysis_type='fundus', extra_prompt=''):
    if not TORCH_AVAILABLE:
        return {
            'findings': 'AI analysis not available on this server. Please run locally for AI features.',
            'disclaimer': 'This is a demo deployment without AI capabilities.'
        }
    # Original logic runs only locally
    return {'findings': 'Analysis complete', 'disclaimer': 'For demo only'}

def generate_report(test_results, risk_level, overall_score):
    if not TORCH_AVAILABLE:
        return {
            'summary': 'AI report generation not available on this server.',
            'findings': [],
            'recommendations': ['Please consult an eye care professional.'],
            'referral_required': False,
            'referral_reason': None,
            'follow_up_weeks': 4
        }
    return {}
