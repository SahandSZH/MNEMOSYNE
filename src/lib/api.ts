const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000";

type HttpMethod = "GET" | "POST";

type RequestOptions = {
  method?: HttpMethod;
  token?: string;
  jsonBody?: unknown;
  formData?: FormData;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", token, jsonBody, formData } = options;

  const headers: Record<string, string> = {};
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (jsonBody !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: jsonBody !== undefined ? JSON.stringify(jsonBody) : formData,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `Request failed with status ${response.status}`);
  }

  return (await response.json()) as T;
}

export type AssessmentCreatePayload = {
  patient_id: number;
  date?: string;
  recall_score: number;
  drawing_score: number;
  fluency_score: number;
};

export type FacialMetricsPayload = {
  face_presence_score: number;
  blink_rate: number;
  eye_focus_score: number;
  expression_variability: number;
};

export type FacialBiometricCreatePayload = {
  patient_id: number;
  session_id: string;
  facial_metrics: FacialMetricsPayload;
};

export function createAssessment(payload: AssessmentCreatePayload, token?: string) {
  return request<{
    id: number;
    patient_id: number;
    session_id: string | null;
    recall_score: number;
    drawing_score: number;
    fluency_score: number;
  }>("/assessment", {
    method: "POST",
    token,
    jsonBody: payload,
  });
}

export function uploadSpeechFile(
  params: { session_id?: string; assessment_id?: number; audio_file: File },
  token?: string,
) {
  const formData = new FormData();
  if (params.session_id) {
    formData.append("session_id", params.session_id);
  }
  if (params.assessment_id !== undefined) {
    formData.append("assessment_id", String(params.assessment_id));
  }
  formData.append("audio_file", params.audio_file);

  return request<{
    assessment_id: number;
    session_id: string | null;
    transcript: string;
    word_count: number;
    speech_rate: number;
    vocabulary_diversity: number;
  }>("/speech", {
    method: "POST",
    token,
    formData,
  });
}

export function uploadFacialMetrics(payload: FacialBiometricCreatePayload, token?: string) {
  return request<{
    assessment_id: number;
    patient_id: number;
    session_id: string;
    facial_metrics: FacialMetricsPayload;
    presage_behavioral_risk: string | null;
    presage_risk_score: number | null;
  }>("/biometrics/facial", {
    method: "POST",
    token,
    jsonBody: payload,
  });
}

export function uploadClockDrawing(
  params: {
    image_file: File;
    session_id?: string;
    assessment_id?: number;
    run_analysis?: boolean;
  },
  token?: string,
) {
  const formData = new FormData();
  if (params.session_id) {
    formData.append("session_id", params.session_id);
  }
  if (params.assessment_id !== undefined) {
    formData.append("assessment_id", String(params.assessment_id));
  }
  formData.append("image_file", params.image_file);
  formData.append("run_analysis", String(params.run_analysis ?? true));

  return request<{
    assessment_id: number;
    session_id: string | null;
    filename: string;
    content_type: string;
    analyzed_score: number | null;
    analysis_notes: string | null;
  }>("/clock-drawing", {
    method: "POST",
    token,
    formData,
  });
}

export function fetchPatient(patientId: number, token?: string) {
  return request(`/patient/${patientId}`, { token });
}

export function fetchDoctorDashboard(patientId: number, token?: string) {
  return request(`/doctor/dashboard/${patientId}`, { token });
}
