import json
import logging

logger = logging.getLogger(__name__)

TORCH_AVAILABLE = False
_model      = None
_processor  = None

try:
    import torch
    from transformers import Qwen2_5_VLForConditionalGeneration, AutoProcessor
    from qwen_vl_utils import process_vision_info
    TORCH_AVAILABLE = True
except ImportError:
    print('Torch / transformers not available — AI features disabled')


# ── Helpers ────────────────────────────────────────────────────────────────

def _get_model_and_processor():
    """Return (model, processor) from model_loader's globals."""
    try:
        from app.services.model_loader import _model as m, _processor as p
        return m, p
    except Exception:
        return None, None


def _rule_based_report(test_results: list, risk_level: str, overall_score: int) -> dict:
    """
    Deterministic, rule-based report — used when Qwen is unavailable or as
    the fallback when the model returns unparseable output.
    """
    TEST_LABELS = {
        'acuity':      'Visual Acuity',
        'contrast':    'Contrast Sensitivity',
        'color':       'Colour Vision',
        'astigmatism': 'Astigmatism',
        'amsler':      'Central Visual Field (Amsler)',
    }

    RISK_SUMMARIES = {
        'normal': (
            'Your vision screening results are within the normal range across all five tests. '
            'No significant concerns were identified at this time.'
        ),
        'mild': (
            'Your screening identified mild changes in one or more areas of your vision. '
            'These are not immediately alarming, but regular monitoring is advisable.'
        ),
        'moderate': (
            'Your screening shows moderate changes in vision function across one or more tests. '
            'We recommend scheduling a comprehensive eye examination with an optometrist or ophthalmologist.'
        ),
        'high': (
            'Your screening has detected significant changes in vision function. '
            'We strongly recommend an urgent professional eye examination. '
            'Early detection and treatment are important for preserving your sight.'
        ),
    }

    SCORE_FINDING = {
        'normal':   'within normal limits',
        'mild':     'mild deviation detected',
        'moderate': 'moderate deviation detected',
        'high':     'significant deviation — professional evaluation advised',
    }

    RISK_RECS = {
        'normal': [
            'Continue with your regular annual eye examination schedule.',
            'Use appropriate lighting when reading or using screens.',
            'Follow the 20-20-20 rule: every 20 minutes, look at something 20 feet away for 20 seconds.',
            'Maintain a diet rich in leafy greens, omega-3 fatty acids, and antioxidants.',
        ],
        'mild': [
            'Schedule a comprehensive eye exam within the next 4 weeks.',
            'Monitor for any sudden changes in vision and seek care promptly if they occur.',
            'Ensure your glasses or contact lens prescription is up to date.',
            'Reduce screen time and use anti-glare filters where possible.',
        ],
        'moderate': [
            'Book an appointment with an optometrist or ophthalmologist within 1–2 weeks.',
            'Do not drive or operate heavy machinery if vision changes affect your safety.',
            'Bring these screening results to your appointment.',
            'Avoid activities that strain your eyes until evaluated.',
        ],
        'high': [
            'Seek urgent professional eye care — contact an ophthalmologist or eye emergency service.',
            'Do not delay — some vision conditions worsen rapidly without treatment.',
            'Bring a family member or friend if possible; avoid driving yourself.',
            'Share these results with your GP as well as your eye specialist.',
        ],
    }

    findings = []
    referral_flags = []

    for t in test_results:
        tid   = t.get('test_id', '')
        score = t.get('normalized_score', 0)
        flags = t.get('flags', [])

        if score >= 80:
            level = 'normal'
        elif score >= 60:
            level = 'mild'
        elif score >= 40:
            level = 'moderate'
        else:
            level = 'high'

        label   = TEST_LABELS.get(tid, tid.replace('_', ' ').title())
        finding = SCORE_FINDING[level]

        flag_notes = ''
        if flags:
            flag_notes = ' Flags: ' + '; '.join(f.replace('_', ' ') for f in flags) + '.'

        findings.append({
            'test':    label,
            'finding': f'Score {score}/100 — {finding}.{flag_notes}',
            'level':   level,
        })

        if level in ('moderate', 'high') or any('urgent' in f or 'referral' in f for f in flags):
            referral_flags.append(label)

    referral_required = risk_level in ('moderate', 'high') or bool(referral_flags)
    referral_reason   = None
    if referral_required:
        if referral_flags:
            referral_reason = (
                f'Concerning results in: {", ".join(referral_flags)}. '
                'A professional examination is recommended.'
            )
        else:
            referral_reason = (
                'Overall vision score indicates professional evaluation is advisable.'
            )

    follow_up = {'normal': 12, 'mild': 4, 'moderate': 2, 'high': 1}.get(risk_level, 4)

    return {
        'summary':           RISK_SUMMARIES.get(risk_level, RISK_SUMMARIES['normal']),
        'findings':          findings,
        'recommendations':   RISK_RECS.get(risk_level, RISK_RECS['normal']),
        'referral_required': referral_required,
        'referral_reason':   referral_reason,
        'follow_up_weeks':   follow_up,
    }


# ── Public API ─────────────────────────────────────────────────────────────

def generate_report(test_results: list, risk_level: str, overall_score: int) -> dict:
    """
    Generate an AI vision report.

    1. If Qwen model is loaded  → ask the model, parse JSON output.
       Fall back to rule-based on any parse / generation error.
    2. If model not available   → rule-based report immediately.
    """
    model, processor = _get_model_and_processor()

    if not (TORCH_AVAILABLE and model and processor):
        logger.info('[qwen_engine] Model not loaded — using rule-based report')
        return _rule_based_report(test_results, risk_level, overall_score)

    # ── Build prompt ──────────────────────────────────────────────────────
    test_lines = '\n'.join(
        f"  - {t.get('test_id','?')}: score {t.get('normalized_score',0)}/100, flags: {t.get('flags', [])}"
        for t in test_results
    )

    prompt = f"""You are a clinical AI assistant specialising in vision health screening.

Below are the results of a patient's 5-part digital vision screening.

Test Results:
{test_lines}

Overall Score: {overall_score}/100
Risk Level: {risk_level}

Generate a JSON report with EXACTLY these keys:
{{
  "summary": "<2–3 sentence plain-English summary for the patient>",
  "findings": [
    {{"test": "<test name>", "finding": "<plain-English finding>", "level": "normal|mild|moderate|high"}}
  ],
  "recommendations": ["<actionable recommendation 1>", "..."],
  "referral_required": true | false,
  "referral_reason": "<reason string or null>",
  "follow_up_weeks": <integer>
}}

Respond with ONLY valid JSON. No markdown, no code fences, no extra text."""

    try:
        messages = [{'role': 'user', 'content': prompt}]
        text = processor.apply_chat_template(
            messages, tokenize=False, add_generation_prompt=True
        )
        inputs = processor(text=[text], return_tensors='pt')
        inputs = {k: v.to(model.device) for k, v in inputs.items()}

        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=1024,
                do_sample=False,
            )

        generated = processor.batch_decode(
            output_ids[:, inputs['input_ids'].shape[1]:],
            skip_special_tokens=True,
        )[0].strip()

        # Extract JSON even if extra text crept in
        start = generated.find('{')
        end   = generated.rfind('}') + 1
        if start == -1 or end == 0:
            raise ValueError('No JSON object found in model output')

        parsed = json.loads(generated[start:end])
        logger.info('[qwen_engine] AI report generated successfully')
        return parsed

    except Exception as exc:
        logger.warning(f'[qwen_engine] Model generation failed ({exc}) — falling back to rule-based report')
        return _rule_based_report(test_results, risk_level, overall_score)


def analyse_eye_image(image_bytes: bytes, analysis_type: str = 'fundus', extra_prompt: str = '') -> dict:
    """Analyse an eye/fundus image using Qwen2.5-VL."""
    model, processor = _get_model_and_processor()

    if not (TORCH_AVAILABLE and model and processor):
        return {
            'findings':   'AI image analysis is not available on this deployment. Run the backend locally with the Qwen model for full AI capabilities.',
            'disclaimer': 'This is a cloud/demo deployment without AI model support.',
        }

    try:
        import base64
        img_b64 = base64.b64encode(image_bytes).decode()

        type_prompts = {
            'fundus':       'Analyse this fundus (retinal) photograph. Describe optic disc, macula, vessels, and any signs of disease.',
            'prescription': 'Read and interpret this eye prescription. Explain what the values mean for this patient in plain language.',
            'symptom':      'Describe what you observe in this eye image and any visible symptoms or concerns.',
            'general':      'Analyse this eye-related image and provide relevant clinical observations.',
        }
        base_prompt = type_prompts.get(analysis_type, type_prompts['general'])
        full_prompt = base_prompt + extra_prompt

        messages = [{
            'role':    'user',
            'content': [
                {'type': 'image', 'image': f'data:image/jpeg;base64,{img_b64}'},
                {'type': 'text',  'text':  full_prompt},
            ],
        }]

        text   = processor.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        images, _ = process_vision_info(messages)
        inputs = processor(text=[text], images=images, return_tensors='pt')
        inputs = {k: v.to(model.device) for k, v in inputs.items()}

        with torch.no_grad():
            output_ids = model.generate(**inputs, max_new_tokens=512, do_sample=False)

        findings = processor.batch_decode(
            output_ids[:, inputs['input_ids'].shape[1]:],
            skip_special_tokens=True,
        )[0].strip()

        return {
            'findings':   findings,
            'disclaimer': 'This analysis is generated by an AI model and is for informational purposes only. It does not constitute a medical diagnosis.',
        }

    except Exception as exc:
        logger.error(f'[qwen_engine] Image analysis failed: {exc}')
        return {
            'findings':   'Image analysis could not be completed. Please try again.',
            'disclaimer': 'An error occurred during AI analysis.',
        }
