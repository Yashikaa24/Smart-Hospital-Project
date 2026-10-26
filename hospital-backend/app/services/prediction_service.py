from sqlalchemy.orm import Session
from .. import models

class PredictionService:
    @staticmethod
    def predict_wait_time(doctor_id: str, token_number: int, is_half: bool, db: Session):
        """
        Calculates estimated waiting time, patients ahead, current token, and confidence level
        for a given token in a doctor's queue.
        """
        # Fetch doctor
        doctor = db.query(models.Doctor).filter(models.Doctor.id == doctor_id).first()
        avg_consult = doctor.avg_consult_minutes if doctor else 10
        
        # Fetch active queue (waiting, called, present)
        queue = db.query(models.Token).filter(
            models.Token.doctor_id == doctor_id,
            models.Token.status.in_(['waiting', 'called', 'present'])
        ).order_by(models.Token.token_number).all()
        
        # Find current token being consulted
        active_consultation = db.query(models.Token).filter(
            models.Token.doctor_id == doctor_id,
            models.Token.status.in_(['called', 'present'])
        ).order_by(models.Token.token_number).first()
        
        current_token_num = active_consultation.token_number if active_consultation else 0
        if not current_token_num and len(queue) > 0:
            # Fallback to the token before the first waiting token
            first_waiting = next((t for t in queue if t.status == 'waiting'), None)
            if first_waiting:
                current_token_num = max(0, first_waiting.token_number - 1)
        
        # Calculate patients ahead: waiting/called/present tokens whose token_number is less than token_number
        patients_ahead = 0
        for q_token in queue:
            # If the token is still in the queue, hasn't been completed/cancelled, and has a lower token number
            if q_token.status in ['waiting', 'called', 'present'] and q_token.token_number < token_number:
                # Half tokens only count in patients ahead if they are actually active or if we're also active
                # But for our simple ML prediction, we include them if they're in active statuses
                patients_ahead += 1
                
        # Base ETA
        eta = patients_ahead * avg_consult
        
        # Dynamic adjustments
        # 1. Doctor break simulation: if patients_ahead > 3, add a short break simulation
        break_delay = 0
        if token_number % 5 == 0 and patients_ahead > 2:
            break_delay = 15  # 15 minutes doctor break
            
        # 2. Emergency simulation (if there is a triage log with urgency="emergency" recently, add emergency delay)
        emergency_delay = 0
        recent_emergencies = db.query(models.TriageLog).filter(
            models.TriageLog.urgency == 'emergency'
        ).count()
        if recent_emergencies > 0:
            # Add 12 mins per emergency (up to 36 mins max)
            emergency_delay = min(36, recent_emergencies * 12)
            
        total_eta = eta + break_delay + emergency_delay
        
        # Calculate confidence
        confidence = 98
        if patients_ahead > 0:
            confidence -= min(35, patients_ahead * 6)  # drops 6% per patient ahead, max drop 35%
        if break_delay > 0:
            confidence -= 10
        if emergency_delay > 0:
            confidence -= 15
            
        # Ensure confidence range
        confidence = max(50, min(98, confidence))
        
        return {
            "eta_minutes": total_eta,
            "patients_ahead": patients_ahead,
            "current_token": current_token_num,
            "confidence": confidence
        }
