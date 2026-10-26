import os
import anthropic
import json
from dotenv import load_dotenv

load_dotenv()

api_key = os.getenv("ANTHROPIC_API_KEY", "")
# Instantiate client only if a real-looking key exists to prevent early initialization crashes
if api_key and not api_key.startswith("sk-ant-xxx"):
    client = anthropic.Anthropic(api_key=api_key)
else:
    client = None

async def triage_symptoms(symptoms: str):
    system_prompt = """
    You are a professional hospital triage assistant. 
    Analyze the patient's symptoms and return a JSON object with:
    {
        "department": "Name of the medical department",
        "urgency": "low" | "medium" | "high" | "emergency",
        "reason": "Brief medical reasoning",
        "see_doctor_in_minutes": Estimated wait time in minutes
    }
    Be accurate and prioritize safety. If it's a life-threatening emergency, set urgency to 'emergency' and recommend immediate ER visit.
    """
    
    # Check if we should use fallback simulator
    if not client:
        print("Using local triage fallback analyzer...")
        symptom_lower = symptoms.lower()
        if "chest" in symptom_lower or "heart" in symptom_lower or "breath" in symptom_lower or "stroke" in symptom_lower:
            return {
                "department": "Cardiology / Emergency",
                "urgency": "emergency",
                "reason": "Chest pain, pressure, or shortness of breath are high-risk symptoms that could indicate an acute cardiac event or respiratory distress. Please proceed to the nearest Emergency Room immediately.",
                "see_doctor_in_minutes": 0
            }
        elif "fever" in symptom_lower or "cough" in symptom_lower or "cold" in symptom_lower or "throat" in symptom_lower:
            return {
                "department": "General Medicine",
                "urgency": "low",
                "reason": "Symptoms indicate a potential upper respiratory viral infection or common cold. Advised to stay hydrated, rest, and consult a general physician.",
                "see_doctor_in_minutes": 45
            }
        elif "bone" in symptom_lower or "fracture" in symptom_lower or "joint" in symptom_lower or "sprain" in symptom_lower:
            return {
                "department": "Orthopedics",
                "urgency": "medium",
                "reason": "Indicates possible musculoskeletal trauma, fracture, or joint sprain. Recommended orthopedic consultation and X-ray evaluation.",
                "see_doctor_in_minutes": 20
            }
        elif "stomach" in symptom_lower or "belly" in symptom_lower or "vomit" in symptom_lower or "nausea" in symptom_lower:
            return {
                "department": "Gastroenterology",
                "urgency": "medium",
                "reason": "Abdominal pain accompanied by nausea/vomiting could stem from acute gastroenteritis, food poisoning, or acid reflux. Consult a gastroenterologist.",
                "see_doctor_in_minutes": 30
            }
        else:
            return {
                "department": "General Medicine",
                "urgency": "medium",
                "reason": "General symptoms analyzed. Patient is routed to General Medicine for standard primary care assessment and diagnostic workup.",
                "see_doctor_in_minutes": 30
            }

    try:
        response = client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=1024,
            system=system_prompt,
            messages=[{"role": "user", "content": symptoms}]
        )
        
        # Extract JSON from response
        content = response.content[0].text
        return json.loads(content)
    except Exception as e:
        print(f"Anthropic API call failed: {e}. Falling back...")
        return {
            "department": "General Medicine",
            "urgency": "medium",
            "reason": "Symptom triage fallback used due to network/API constraints.",
            "see_doctor_in_minutes": 30
        }

async def chat_with_patient(messages: list, hospital_name: str):
    system_prompt = f"""
    You are a helpful assistant for {hospital_name}. 
    Your goal is to answer patient questions about hospital services, timing, and general health info.
    Guidelines:
    - Never provide a medical diagnosis.
    - If a patient describes severe symptoms (chest pain, stroke signs, etc.), tell them to call emergency services or go to the ER immediately.
    - Be polite and professional.
    """
    
    # Check if we should use fallback simulator
    if not client:
        print("Using local chatbot fallback responder...")
        last_message = messages[-1]["content"] if messages else ""
        last_message_lower = last_message.lower()
        if "hello" in last_message_lower or "hi" in last_message_lower or "hey" in last_message_lower:
            return f"Hello! Welcome to {hospital_name}. How can I assist you with your health query, doctor availability, or OPD timings today?"
        elif "bed" in last_message_lower or "icu" in last_message_lower or "resource" in last_message_lower:
            return f"You can check our live bed and ICU availability directly on the **Beds & ICU** tab in the navigation bar. We sync these resource statistics with our MySQL database in real time so you can view live vacancy before arrival."
        elif "appointment" in last_message_lower or "book" in last_message_lower or "token" in last_message_lower:
            return "To get a consultation token, please scan the QR code located outside the doctor's clinic, or enter the Doctor's ID directly in the **Scan** portal. This will queue you into our live queue tracking system."
        elif "triage" in last_message_lower or "symptom" in last_message_lower:
            return "If you are unsure which department to consult, please head over to our **AI Triage** tab. Describe your symptoms and our assistant will immediately analyze the urgency and route you to the correct ward."
        else:
            return f"Thank you for reaching out to {hospital_name}'s digital assistant. If you are experiencing a medical emergency, please proceed to the ER or call emergency services immediately. For standard queries, feel free to ask about beds, appointments, or triage!"

    try:
        # Convert message format to Anthropic format
        formatted_messages = []
        for msg in messages:
            formatted_messages.append({"role": msg["role"], "content": msg["content"]})
            
        response = client.messages.create(
            model="claude-3-5-sonnet-20240620",
            max_tokens=1024,
            system=system_prompt,
            messages=formatted_messages
        )
        
        return response.content[0].text
    except Exception as e:
        print(f"Anthropic chat call failed: {e}. Falling back...")
        return "I'm currently operating in offline mode. If this is an emergency, please go to the ER. For other questions, please contact our hospital front desk."
