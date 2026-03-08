const MAX_ATTEMPTS = 2000;
const attempts = [];

export function saveAssessmentAttempt(attempt) {
  attempts.push(attempt);
  if (attempts.length > MAX_ATTEMPTS) {
    attempts.shift();
  }
  return attempt;
}

export function getAllAssessmentAttempts() {
  return [...attempts];
}

export function getPatientAssessmentHistory(patientSub) {
  return attempts.filter((attempt) => attempt.patientSub === patientSub);
}
