import json
import logging
import re
import torch
from PIL import Image
from io import BytesIO
from qwen_vl_utils import process_vision_info
from app.services.model_loader import get_model

logger = logging.getLogger(__name__)

TEST_NAMES = {
    "acuity":      "Visual Acuity (Landolt C)",
    "contrast":    "Contrast Sensitivity",
    "color":       "Colour Vision (Ishihara)",
    "astigmatism": "Astigmatism (Clock Dial)",
    "amsler":      "Central Visual Field (Amsler Grid)",
}

def generate_report(test_results: list[dict], risk_level: str, overall_score: int) -> dict:
    model, processor = get_model()

    formatted_tests = "\n".join(
        f"  • {TEST_NAMES.get(r['test_id'], r['test_id'])}: "
        f"score {r['normalized_score']}/100"
        f"{(', flags: ' + ', '.join(r['flags'])) if r.get('flags') else ''}"
        for r in test_results
    )

    messages = [
        {
            "role": "system",
            "content": (
                "You are a clinical eye health AI assistant for MNR Vision. "
                "Generate structured plain-language health reports from screening results. "
                "Always recommend professional consultation. Never diagnose."
            ),
        },
        {
            "role": "user",
            "content": f"""Patient completed an online vision screening.

OVERALL SCORE: {overall_score}/100
RISK LEVEL: {risk_level.upper()}

INDIVIDUAL TEST RESULTS:
{formatted_tests}

Return ONLY valid JSON, no markdown, with exactly these keys:
{{
  "summary": "2-3 sentence overview written directly to the patient",
  "findings": [
    {{"test": "test name", "finding": "one sentence", "severity": "normal|mild|moderate|high"}}
  ],
  "recommendations": ["recommendation 1", "recommendation 2", "recommendation 3"],
  "referral_required": true or false,
  "referral_reason": "reason string or null",
  "follow_up_weeks": integer
}}"""
        },
    ]

    text = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    image_inputs, video_inputs = process_vision_info(messages)

    inputs = processor(
        text=[text],
        images=image_inputs if image_inputs else None,
        videos=video_inputs if video_inputs else None,
        padding=True,
        return_tensors="pt",
    )
    inputs = inputs.to(model.device)

    with torch.no_grad():
        generated_ids = model.generate(
            **inputs,
            max_new_tokens=600,
            temperature=0,
            do_sample=False,
            repetition_penalty=1.1,
        )

    generated_ids_trimmed = [
        out_ids[len(in_ids):]
        for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    output_text = processor.batch_decode(
        generated_ids_trimmed,
        skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )[0].strip()

    return _parse_json(output_text)


def analyse_eye_image(image_bytes: bytes, analysis_type: str = "general") -> dict:
    model, processor = get_model()
    image = Image.open(BytesIO(image_bytes)).convert("RGB")

    prompts = {
        "general":      "Analyse this image and describe what you observe relevant to eye health.",
        "fundus":       "Analyse this retinal photograph. Describe the optic disc, macula, vessels, and any visible abnormalities.",
        "prescription": "Read this prescription and return JSON: right_eye: {sph, cyl, axis, add}, left_eye: {sph, cyl, axis, add}, and a plain-language interpretation.",
        "symptom":      "The patient reports eye discomfort. Describe what you see and provide general guidance.",
    }

    systems = {
        "general":      "You are a clinical eye health AI. Describe findings relevant to eye health.",
        "fundus":       "You are a clinical eye health AI. Analyse fundus photographs for signs of diabetic retinopathy, glaucoma, or macular degeneration.",
        "prescription": "You are a clinical eye health AI. Extract and interpret vision prescriptions from documents.",
        "symptom":      "You are a clinical eye health AI. Describe visible eye symptoms and provide general guidance. Always recommend professional examination.",
    }

    messages = [
        {"role": "system", "content": systems.get(analysis_type, systems["general"])},
        {
            "role": "user",
            "content": [
                {"type": "image", "image": image},
                {"type": "text", "text": prompts.get(analysis_type, prompts["general"])},
            ],
        },
    ]

    text = processor.apply_chat_template(
        messages, tokenize=False, add_generation_prompt=True
    )
    image_inputs, video_inputs = process_vision_info(messages)

    inputs = processor(
        text=[text], images=image_inputs, padding=True, return_tensors="pt"
    )
    inputs = inputs.to(model.device)

    with torch.no_grad():
        generated_ids = model.generate(
            **inputs, max_new_tokens=400, temperature=0.3,
            do_sample=True, top_p=0.9,
        )

    generated_ids_trimmed = [
        out_ids[len(in_ids):]
        for in_ids, out_ids in zip(inputs.input_ids, generated_ids)
    ]
    output_text = processor.batch_decode(
        generated_ids_trimmed, skip_special_tokens=True,
        clean_up_tokenization_spaces=False,
    )[0].strip()

    return {
        "analysis_type": analysis_type,
        "findings": output_text,
        "disclaimer": "This AI analysis is for informational purposes only. Consult a qualified ophthalmologist.",
    }


def _parse_json(text: str) -> dict:
    text = text.strip()
    if text.startswith("```"):
        lines = text.split("\n")
        text = "\n".join(lines[1:-1] if lines[-1].strip() == "```" else lines[1:])
    match = re.search(r"\{.*\}", text, re.DOTALL)
    if match:
        text = match.group(0)
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {
            "summary": "Screening complete. Please consult an eye care professional.",
            "findings": [],
            "recommendations": ["Schedule an appointment with an optometrist."],
            "referral_required": True,
            "referral_reason": "AI analysis incomplete. Clinical review recommended.",
            "follow_up_weeks": 4,
        }