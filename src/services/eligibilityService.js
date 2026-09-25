export class EligibilityService {
  static checkAgeEligibility(memberBirthDate, minAge, maxAge) {
    const today = new Date();
    const birthDate = new Date(memberBirthDate);
    
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    if (age < minAge || age > maxAge) {
      return { 
        eligible: false, 
        reason: `L'âge de l'adhérent (${age} ans) doit être compris entre ${minAge} et ${maxAge} ans.` 
      };
    }

    return { eligible: true };
  }

  static checkMedicalCertificate(medicalCertDate, isHighRiskSport) {
    if (!medicalCertDate) {
      return { eligible: false, reason: 'Certificat médical manquant.' };
    }

    const certDate = new Date(medicalCertDate);
    const today = new Date();
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(today.getFullYear() - 1);

    if (isHighRiskSport && certDate < oneYearAgo) {
      return { 
        eligible: false, 
        reason: 'Certificat médical expiré pour un sport à risque (doit dater de moins d\'un an).' 
      };
    }

    return { eligible: true };
  }

  static validateMemberForActivity(member, activity) {
    const ageCheck = this.checkAgeEligibility(member.birth_date, activity.min_age, activity.max_age);
    if (!ageCheck.eligible) return ageCheck;

    const medicalCheck = this.checkMedicalCertificate(member.medical_cert_date, activity.is_high_risk_sport);
    if (!medicalCheck.eligible) return medicalCheck;

    return { eligible: true };
  }
}