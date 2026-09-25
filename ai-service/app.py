import re
import json
from datetime import datetime, timezone
import pdfplumber
import docx
from flask import Flask, request, jsonify
from flask_cors import CORS
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

app = Flask(__name__)
CORS(app)

EMAIL_REGEX = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
PHONE_REGEX = r'(\+?\d[\d\s\-\(\)]{8,}\d)'
MODEL_VERSION = "v1.0.0"

def extract_text_from_pdf(file):
    text = ""
    with pdfplumber.open(file) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text += page_text + "\n"
    return text

def extract_text_from_docx(file):
    document = docx.Document(file)
    return "\n".join(para.text for para in document.paragraphs)

def skill_in_text(skill, text_lower):
    base = skill.lower().strip()
    variants = {base, base.rstrip('s'), base.replace('.', ''), base.replace('.', ' '), base.replace(' ', '')}
    variants.discard('')
    return any(
        re.search(r'(?<![a-z0-9])' + re.escape(v) + r'(?![a-z0-9])', text_lower)
        for v in variants
    )

def parse_cv_structured(text):
    """Parse CV into structured JSON format"""
    email_match = re.search(EMAIL_REGEX, text)
    phone_match = re.search(PHONE_REGEX, text)

    common_skills = [
        'python', 'javascript', 'java', 'react', 'node.js', 'typescript', 'sql',
        'mongodb', 'express', 'angular', 'vue', 'django', 'flask', 'spring',
        'html', 'css', 'git', 'docker', 'kubernetes', 'aws', 'azure', 'gcp',
        'machine learning', 'data science', 'rest api', 'graphql'
    ]
    
    text_lower = text.lower()
    found_skills = [skill for skill in common_skills if skill_in_text(skill, text_lower)]
    
    years_match = re.search(r'(\d+)\+?\s*(?:years?|yrs?)\s+(?:of\s+)?experience', text_lower)
    years_experience = int(years_match.group(1)) if years_match else 0
    
    lines = [l.strip() for l in text.split('\n') if l.strip()]
    full_name = lines[0] if lines else ""

    return {
        "full_name": full_name,
        "email": email_match.group(0) if email_match else None,
        "phone": phone_match.group(0) if phone_match else None,
        "skills": found_skills,
        "years_experience": years_experience,
        "text": text  
    }

@app.route('/')
def health_check():
    return jsonify({"status": "AI service is running", "version": MODEL_VERSION})

@app.route('/screen-application', methods=['POST'])
def screen_application():
    """
    New unified endpoint that parses CV, scores, and returns everything needed
    for the new AIScores schema
    """
    if 'resume' not in request.files:
        return jsonify({"error": "No resume file uploaded"}), 400
    
    data = request.form
    if 'required_skills' not in data or 'job_description' not in data:
        return jsonify({"error": "Send required_skills (JSON array) and job_description"}), 400

    file = request.files['resume']
    filename = file.filename.lower()

    if filename.endswith('.pdf'):
        text = extract_text_from_pdf(file)
    elif filename.endswith('.docx'):
        text = extract_text_from_docx(file)
    else:
        return jsonify({"error": "Only PDF and DOCX files are supported"}), 400

    if not text.strip():
        return jsonify({"error": "Could not extract any text from this file"}), 400

    parsed_json = parse_cv_structured(text)
    

    try:
        required_skills = json.loads(data['required_skills'])
    except:
        required_skills = []
    
    job_description = data['job_description']
    
    resume_text_lower = text.lower()
    matched_skills = []
    missing_skills = []
    
    for skill in required_skills:
        if skill_in_text(skill, resume_text_lower):
            matched_skills.append(skill)
        else:
            missing_skills.append(skill)
    

    skill_coverage = len(matched_skills) / len(required_skills) if required_skills else 0
    
    try:
        vectorizer = TfidfVectorizer(stop_words='english')
        tfidf_matrix = vectorizer.fit_transform([text, job_description])
        text_similarity = float(cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])[0][0])
    except:
        text_similarity = 0.0
    
    if skill_coverage == 1.0:
        match_percent = 100
    else:

        match_percent = round(100 * (0.7 * skill_coverage + 0.3 * text_similarity))
    

    if match_percent >= 75:
        match_label = "STRONG"
    elif match_percent >= 50:
        match_label = "POSSIBLE"
    else:
        match_label = "NOT_A_FIT"
    

    years_factor = min(parsed_json['years_experience'] / 5, 1.0) if parsed_json['years_experience'] else 0
    predicted_score = round(10 * (0.5 * skill_coverage + 0.2 * years_factor + 0.3 * text_similarity), 1)
    
    return jsonify({
        "parsed_json": parsed_json,
        "match_percent": match_percent,
        "match_label": match_label,
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "predicted_score": predicted_score,
        "model_version": MODEL_VERSION,
        "scored_at": datetime.now(timezone.utc).replace(tzinfo=None).isoformat()
    })

SIMILARITY_THRESHOLD = 0.90

@app.route('/check-duplicates', methods=['POST'])
def check_duplicates():
    """
    Check for duplicate candidates
    Returns new format with reason: SAME_EMAIL, SAME_PHONE, SIMILAR_CV
    """
    data = request.get_json()

    if not data or 'candidate' not in data or 'existing' not in data:
        return jsonify({"error": "Send candidate and existing"}), 400

    candidate = data['candidate']  
    existing = data['existing']   
    
    if not existing:
        return jsonify({"duplicates": []})
    
    duplicates = []
    
 
    if candidate.get('email'):
        for ex in existing:
            if ex.get('email') and candidate['email'].lower() == ex['email'].lower():
                duplicates.append({
                    "matched_application_id": ex['application_id'],
                    "reason": "SAME_EMAIL",
                    "similarity": 1.0
                })
    
    if candidate.get('phone'):
        candidate_digits = re.sub(r'\D', '', candidate['phone'])[-10:]
        for ex in existing:
            if ex.get('phone'):
                ex_digits = re.sub(r'\D', '', ex['phone'])[-10:]
                if candidate_digits == ex_digits:
                    if not any(d['matched_application_id'] == ex['application_id'] for d in duplicates):
                        duplicates.append({
                            "matched_application_id": ex['application_id'],
                            "reason": "SAME_PHONE",
                            "similarity": 1.0
                        })
    
    if candidate.get('text'):
        texts = [candidate['text']] + [ex['text'] for ex in existing if ex.get('text')]
        if len(texts) > 1:
            try:
                vectorizer = TfidfVectorizer(stop_words='english')
                tfidf_matrix = vectorizer.fit_transform(texts)
                similarities = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:])[0]
                
                for i, score in enumerate(similarities):
                    if score >= SIMILARITY_THRESHOLD:
                        ex_app_id = existing[i]['application_id']
                        if not any(d['matched_application_id'] == ex_app_id for d in duplicates):
                            duplicates.append({
                                "matched_application_id": ex_app_id,
                                "reason": "SIMILAR_CV",
                                "similarity": round(float(score), 3)
                            })
            except Exception as e:
                print(f"CV similarity check error: {e}")
    
    return jsonify({"duplicates": duplicates})


COMPANY_NAME = "GWS Digital Services"
CURRENCY = "PKR"
SALARY_PERIOD = "per month"

EMPLOYMENT_LABELS = {
    'FULL_TIME': 'Full-time',
    'PART_TIME': 'Part-time',
    'CONTRACT': 'Contract',
    'INTERNSHIP': 'Internship'
}

WORK_MODE_LABELS = {
    'ONSITE': 'On-site',
    'REMOTE': 'Remote',
    'HYBRID': 'Hybrid'
}

@app.route('/generate-offer', methods=['POST'])
def generate_offer():
    """
    Builds an offer letter from a fixed template.
    HR's guidelines (one per line) become the "Additional terms" list.
    """
    data = request.get_json(silent=True) or {}

    candidate_name = str(data.get('candidate_name') or '').strip()
    job_title = str(data.get('job_title') or '').strip()

    if not candidate_name or not job_title:
        return jsonify({"error": "candidate_name and job_title are required"}), 400

    try:
        salary = float(data.get('salary'))
    except (TypeError, ValueError):
        return jsonify({"error": "salary must be a number"}), 400

    try:
        start = datetime.strptime(str(data.get('start_date'))[:10], '%Y-%m-%d')
    except ValueError:
        return jsonify({"error": "start_date must look like 2026-10-15"}), 400

    department = str(data.get('department') or '').strip()
    location = str(data.get('location') or '').strip()
    employment = EMPLOYMENT_LABELS.get(data.get('employment_type'), 'Full-time')
    work_mode = WORK_MODE_LABELS.get(data.get('work_mode'), '')
    start_text = f"{start.day} {start:%B %Y}"

    terms = [
        line.strip().lstrip('-•* ').strip()
        for line in str(data.get('guidelines') or '').splitlines()
    ]
    terms = [t for t in terms if t]

    intro = f"We are pleased to offer you the position of {job_title}"
    if department:
        intro += f" in the {department} department"
    intro += f" at {COMPANY_NAME}."

    details = [f"- Position: {job_title}"]
    if department:
        details.append(f"- Department: {department}")
    details.append(f"- Employment type: {employment}")
    place = ", ".join(p for p in [work_mode, location] if p)
    if place:
        details.append(f"- Work arrangement: {place}")
    details.append(f"- Start date: {start_text}")
    details.append(f"- Salary: {CURRENCY} {salary:,.0f} {SALARY_PERIOD}")

    lines = [
        f"Dear {candidate_name},",
        "",
        intro,
        "",
        "Position details",
        *details,
        ""
    ]

    if terms:
        lines += ["Additional terms", *[f"- {t}" for t in terms], ""]

    lines += [
        "Please review this offer and let us know your decision through your Hyre.AI account.",
        "",
        "We look forward to welcoming you to the team.",
        "",
        "Kind regards,",
        "HR Team",
        COMPANY_NAME
    ]

    return jsonify({"letter_body": "\n".join(lines)})

if __name__ == '__main__':
    app.run(debug=True, port=5001)