export class EligibilityService {
  static calculateFederalAge(birthDate) {
    const birth = new Date(birthDate);
    const today = new Date();
    const seasonYear = today.getMonth() >= 8 ? today.getFullYear() : today.getFullYear() - 1;
    const dec31 = new Date(seasonYear, 11, 31);
    return dec31.getFullYear() - birth.getFullYear();
  }

  static getFederalCategory(age) {
    if (age <= 7) return 'Baby';
    if (age <= 9) return 'Poussin';
    if (age <= 11) return 'Benjamin';
    if (age <= 13) return 'Minime';
    if (age <= 15) return 'Cadet';
    if (age <= 17) return 'Junior';
    if (age <= 34) return 'Senior';
    return 'Vétéran';
  }

  static checkAgeEligibility(memberBirthDate, minAge, maxAge) {
    const today = new Date();
    const birthDate = new Date(memberBirthDate);

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }

    const federalAge = this.calculateFederalAge(memberBirthDate);
    const category = this.getFederalCategory(federalAge);

    if (age < minAge || age > maxAge) {
      return {
        eligible: false,
        age,
        federalAge,
        category,
        reason: `L'âge de l'adhérent (${age} ans, catégorie ${category}) doit être compris entre ${minAge} et ${maxAge} ans.`
      };
    }

    return { eligible: true, age, federalAge, category };
  }

  static checkMedicalCertificate(medicalCertDate, isHighRiskSport) {
    if (!medicalCertDate) {
      return { eligible: false, reason: 'Certificat médical manquant.' };
    }

    const certDate = new Date(medicalCertDate);
    const today = new Date();

    if (isHighRiskSport) {
      const oneYearAgo = new Date();
      oneYearAgo.setFullYear(today.getFullYear() - 1);
      if (certDate < oneYearAgo) {
        return {
          eligible: false,
          status: 'medical_non_compliant',
          reason: 'Certificat médical expiré pour un sport à risque (doit dater de moins d\'un an).'
        };
      }
    } else {
      const threeYearsAgo = new Date();
      threeYearsAgo.setFullYear(today.getFullYear() - 3);
      if (certDate < threeYearsAgo) {
        return {
          eligible: false,
          status: 'medical_non_compliant',
          reason: 'Certificat médical expiré (doit dater de moins de 3 ans pour les sports standards).'
        };
      }
    }

    return { eligible: true };
  }

  static validateMemberForActivity(member, activity) {
    const ageCheck = this.checkAgeEligibility(member.birth_date, activity.min_age, activity.max_age);
    if (!ageCheck.eligible) return ageCheck;

    const medicalCheck = this.checkMedicalCertificate(member.cert_medical_date, activity.is_high_risk_sport);
    if (!medicalCheck.eligible) return medicalCheck;

    return {
      eligible: true,
      federalAge: ageCheck.federalAge,
      category: ageCheck.category
    };
  }
}