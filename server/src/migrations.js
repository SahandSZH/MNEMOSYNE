import { query } from "./db.js";

const statements = [
  `CREATE EXTENSION IF NOT EXISTS "pgcrypto";`,
  `CREATE TABLE IF NOT EXISTS app_users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      auth0_user_id TEXT NOT NULL UNIQUE,
      email TEXT,
      full_name TEXT,
      raw_profile JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_at TIMESTAMPTZ
    );`,
  `CREATE TABLE IF NOT EXISTS assessments (
      id BIGSERIAL PRIMARY KEY,
      attempt_id TEXT NOT NULL UNIQUE,
      patient_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      patient_sub TEXT NOT NULL,
      patient_email TEXT,
      captured_at TIMESTAMPTZ NOT NULL,
      assessment_started_at TIMESTAMPTZ,
      assessment_ended_at TIMESTAMPTZ,
      total_duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      attempt_payload JSONB NOT NULL
    );`,
  `CREATE TABLE IF NOT EXISTS test0_test4_results (
      assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
      random_words_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      user_inputs_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      matched_words_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      matched_count INTEGER NOT NULL DEFAULT 0,
      total_target_words INTEGER NOT NULL DEFAULT 0,
      recall_accuracy NUMERIC(6, 3) NOT NULL DEFAULT 0,
      duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0
    );`,
  `CREATE TABLE IF NOT EXISTS test1_drawing_results (
      assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
      clock_time_prompt TEXT,
      step1_image_data_url TEXT,
      step2_image_data_url TEXT,
      step3_image_data_url TEXT,
      completed_tasks INTEGER NOT NULL DEFAULT 0,
      total_tasks INTEGER NOT NULL DEFAULT 0,
      completion_ratio NUMERIC(6, 3) NOT NULL DEFAULT 0,
      duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0
    );`,
  `CREATE TABLE IF NOT EXISTS test2_memory_challenge_results (
      assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
      part1_random_prompt_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      part1_user_answer_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      part1_correct_count INTEGER NOT NULL DEFAULT 0,
      part1_total_target INTEGER NOT NULL DEFAULT 0,
      part2_random_prompt TEXT,
      part2_expected_answer TEXT,
      part2_user_answer TEXT,
      part2_is_correct BOOLEAN,
      part3_random_prompt_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      part3_user_answer_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      part3_correct_count INTEGER NOT NULL DEFAULT 0,
      part3_total_count INTEGER NOT NULL DEFAULT 0,
      duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0
    );`,
  `CREATE TABLE IF NOT EXISTS test3_spoken_results (
      assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
      chosen_words_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      user_responses_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      transcript TEXT,
      word_count INTEGER NOT NULL DEFAULT 0,
      speech_rate_wpm NUMERIC(10, 3) NOT NULL DEFAULT 0,
      vocabulary_diversity NUMERIC(10, 3) NOT NULL DEFAULT 0,
      phase TEXT NOT NULL DEFAULT 'listen',
      matched_words_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      matched_count INTEGER NOT NULL DEFAULT 0,
      total_target_words INTEGER NOT NULL DEFAULT 0,
      recall_accuracy NUMERIC(6, 3) NOT NULL DEFAULT 0,
      repeat_duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0,
      listen_played_at TIMESTAMPTZ,
      repeat_started_at TIMESTAMPTZ,
      repeat_ended_at TIMESTAMPTZ,
      duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0
    );`,
  `CREATE TABLE IF NOT EXISTS memory_recall_results (
      assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      accuracy NUMERIC(6, 3) NOT NULL DEFAULT 0,
      duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0
    );`,
  `CREATE TABLE IF NOT EXISTS drawing_results (
      assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
      completed_tasks INTEGER NOT NULL,
      total_tasks INTEGER NOT NULL,
      completion_ratio NUMERIC(6, 3) NOT NULL DEFAULT 0,
      clock_time_prompt TEXT,
      duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0,
      drawings_json JSONB
    );`,
  `CREATE TABLE IF NOT EXISTS memory_challenge_results (
      assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
      part1_correct_count INTEGER NOT NULL DEFAULT 0,
      part1_total_target INTEGER NOT NULL DEFAULT 0,
      part1_selected_json JSONB,
      part1_target_json JSONB,
      part2_expected_answer TEXT,
      part2_user_answer TEXT,
      part2_is_correct BOOLEAN,
      part3_target_sequence JSONB,
      part3_user_sequence JSONB,
      part3_correct_count INTEGER NOT NULL DEFAULT 0,
      part3_total_count INTEGER NOT NULL DEFAULT 0,
      duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0
    );`,
  `CREATE TABLE IF NOT EXISTS speech_results (
      assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
      transcript TEXT,
      word_count INTEGER NOT NULL DEFAULT 0,
      speech_rate_wpm NUMERIC(10, 3) NOT NULL DEFAULT 0,
      vocabulary_diversity NUMERIC(10, 3) NOT NULL DEFAULT 0,
      duration_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0,
      phase TEXT NOT NULL DEFAULT 'listen',
      target_words_json JSONB,
      matched_words_json JSONB,
      matched_count INTEGER NOT NULL DEFAULT 0,
      total_target_words INTEGER NOT NULL DEFAULT 0,
      recall_accuracy NUMERIC(6, 3) NOT NULL DEFAULT 0,
      prompt_text TEXT,
      mic_permission TEXT,
      skipped BOOLEAN NOT NULL DEFAULT FALSE,
      listen_played_at TIMESTAMPTZ,
      repeat_started_at TIMESTAMPTZ,
      repeat_ended_at TIMESTAMPTZ
    );`,
  `CREATE TABLE IF NOT EXISTS facial_metrics (
      assessment_id BIGINT PRIMARY KEY REFERENCES assessments(id) ON DELETE CASCADE,
      facial_signals_status TEXT NOT NULL DEFAULT 'unknown',
      session_quality TEXT NOT NULL DEFAULT 'unavailable',
      source TEXT NOT NULL DEFAULT 'unavailable',
      face_missing_events INTEGER NOT NULL DEFAULT 0,
      face_missing_seconds NUMERIC(10, 3) NOT NULL DEFAULT 0,
      sample_count INTEGER NOT NULL DEFAULT 0,
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      engagement_json JSONB,
      blink_rate_json JSONB,
      expression_variability_json JSONB,
      face_presence_json JSONB
    );`,
  `CREATE INDEX IF NOT EXISTS idx_assessments_patient_sub_captured
    ON assessments(patient_sub, captured_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_assessments_captured
    ON assessments(captured_at DESC);`,
  `CREATE INDEX IF NOT EXISTS idx_test0_test4_results_assessment
    ON test0_test4_results(assessment_id);`,
  `CREATE INDEX IF NOT EXISTS idx_test1_drawing_results_assessment
    ON test1_drawing_results(assessment_id);`,
  `CREATE INDEX IF NOT EXISTS idx_test2_memory_results_assessment
    ON test2_memory_challenge_results(assessment_id);`,
  `CREATE INDEX IF NOT EXISTS idx_test3_spoken_results_assessment
    ON test3_spoken_results(assessment_id);`,
];

export async function runMigrations() {
  for (const statement of statements) {
    await query(statement);
  }
}
