import { randomUUID } from "node:crypto";

import { query, withTransaction } from "./db.js";

const MAX_ATTEMPTS = 2000;

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toStringValue = (value, fallback = "") =>
  typeof value === "string" ? value : fallback;

const toIsoDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

async function upsertUser(client, profile) {
  const sub = toStringValue(profile?.sub || profile?.user_id || "").trim();
  if (!sub) {
    throw new Error("Missing user sub/user_id from Auth0 payload.");
  }

  const email = toStringValue(profile?.email || "").trim() || null;
  const fullName = toStringValue(profile?.name || "").trim() || null;
  const rawProfile = profile ? JSON.stringify(profile) : null;

  const result = await client.query(
    `
      INSERT INTO app_users (
        auth0_user_id,
        email,
        full_name,
        raw_profile,
        last_login_at
      )
      VALUES ($1, $2, $3, $4::jsonb, NOW())
      ON CONFLICT (auth0_user_id)
      DO UPDATE SET
        email = COALESCE(EXCLUDED.email, app_users.email),
        full_name = COALESCE(EXCLUDED.full_name, app_users.full_name),
        raw_profile = COALESCE(EXCLUDED.raw_profile, app_users.raw_profile),
        last_login_at = NOW(),
        updated_at = NOW()
      RETURNING id, auth0_user_id, email, full_name, created_at, updated_at
    `,
    [sub, email, fullName, rawProfile],
  );

  return result.rows[0];
}

const countIndexMatches = (expected = [], actual = []) => {
  const length = Math.min(expected.length, actual.length);
  let count = 0;
  for (let i = 0; i < length; i += 1) {
    if (expected[i] === actual[i]) count += 1;
  }
  return count;
};

function normalizeAttemptPayload(attemptInput) {
  const memoryScore = toNumber(attemptInput?.memoryRecall?.score, 0);
  const memoryMaxScore = Math.max(0, toNumber(attemptInput?.memoryRecall?.maxScore, 0));
  const memoryAccuracy =
    memoryMaxScore > 0 ? clamp(memoryScore / memoryMaxScore, 0, 1) : 0;

  const drawingCompletedTasks = Math.max(
    0,
    toNumber(attemptInput?.drawing?.completedTasks, 0),
  );
  const drawingTotalTasks = Math.max(0, toNumber(attemptInput?.drawing?.totalTasks, 0));
  const drawingCompletionRatio =
    drawingTotalTasks > 0 ? clamp(drawingCompletedTasks / drawingTotalTasks, 0, 1) : 0;

  const test2Part1TargetObjects = Array.isArray(
    attemptInput?.testData?.test2?.part1?.objects,
  )
    ? attemptInput.testData.test2.part1.objects
    : [];
  const test2Part1TargetLabels = test2Part1TargetObjects
    .map((item) => toStringValue(item?.label || ""))
    .filter(Boolean);
  const test2Part1Selections = Array.isArray(attemptInput?.testData?.test2?.part1?.selections)
    ? attemptInput.testData.test2.part1.selections.map((label) => String(label))
    : [];
  const uniqueSelections = new Set(test2Part1Selections);
  const test2Part1CorrectCount = test2Part1TargetLabels.filter((label) =>
    uniqueSelections.has(label),
  ).length;

  const test2Part2ExpectedAnswer = toStringValue(
    attemptInput?.testData?.test2?.part2?.expectedAnswer ?? "",
  );
  const test2Part2UserAnswer = toStringValue(
    attemptInput?.testData?.test2?.part2?.answer ?? "",
  );
  const part2NormalizedExpected = test2Part2ExpectedAnswer.trim();
  const part2NormalizedUser = test2Part2UserAnswer.trim();
  const test2Part2IsCorrect =
    part2NormalizedExpected && part2NormalizedUser
      ? part2NormalizedExpected === part2NormalizedUser
      : null;

  const test2Part3TargetSequence = Array.isArray(
    attemptInput?.testData?.test2?.part3?.targetSequence,
  )
    ? attemptInput.testData.test2.part3.targetSequence.map((value) => String(value))
    : [];
  const test2Part3UserSequence = Array.isArray(
    attemptInput?.testData?.test2?.part3?.userSequence,
  )
    ? attemptInput.testData.test2.part3.userSequence.map((value) => String(value))
    : [];
  const test2Part3CorrectCount = countIndexMatches(
    test2Part3TargetSequence,
    test2Part3UserSequence,
  );

  const startedAt = toIsoDateOrNull(attemptInput?.timing?.assessmentStartedAt);
  const endedAt = toIsoDateOrNull(attemptInput?.timing?.assessmentEndedAt);

  return {
    attemptId: toStringValue(attemptInput?.id).trim() || randomUUID(),
    patientSub: toStringValue(attemptInput?.patientSub || "").trim(),
    patientEmail: toStringValue(attemptInput?.patientEmail || "").trim(),
    capturedAt: toIsoDateOrNull(attemptInput?.capturedAt) || new Date().toISOString(),
    memoryRecall: {
      score: memoryScore,
      maxScore: memoryMaxScore,
      accuracy: Number(memoryAccuracy.toFixed(3)),
    },
    drawing: {
      completedTasks: drawingCompletedTasks,
      totalTasks: drawingTotalTasks,
      completionRatio: Number(drawingCompletionRatio.toFixed(3)),
      clockTimePrompt: toStringValue(attemptInput?.drawing?.clockTimePrompt),
    },
    speech: {
      transcript: toStringValue(attemptInput?.speech?.transcript),
      wordCount: Math.max(0, toNumber(attemptInput?.speech?.wordCount, 0)),
      speechRateWpm: Math.max(0, toNumber(attemptInput?.speech?.speechRateWpm, 0)),
      vocabularyDiversity: clamp(
        toNumber(attemptInput?.speech?.vocabularyDiversity, 0),
        0,
        1,
      ),
    },
    stage3: {
      targetWords: Array.isArray(attemptInput?.stage3?.targetWords)
        ? attemptInput.stage3.targetWords.map((word) => String(word))
        : [],
      recall: {
        matchedCount: Math.max(0, toNumber(attemptInput?.stage3?.recall?.matchedCount, 0)),
        totalTargetWords: Math.max(
          0,
          toNumber(attemptInput?.stage3?.recall?.totalTargetWords, 0),
        ),
        accuracy: clamp(toNumber(attemptInput?.stage3?.recall?.accuracy, 0), 0, 1),
        matchedWords: Array.isArray(attemptInput?.stage3?.recall?.matchedWords)
          ? attemptInput.stage3.recall.matchedWords.map((word) => String(word))
          : [],
      },
      repeatDurationSeconds: Math.max(
        0,
        toNumber(attemptInput?.stage3?.repeatDurationSeconds, 0),
      ),
      phase: toStringValue(attemptInput?.stage3?.phase, "listen"),
      timestamps: {
        listenPlayedAt: toIsoDateOrNull(attemptInput?.stage3?.timestamps?.listenPlayedAt),
        repeatStartedAt: toIsoDateOrNull(attemptInput?.stage3?.timestamps?.repeatStartedAt),
        repeatEndedAt: toIsoDateOrNull(attemptInput?.stage3?.timestamps?.repeatEndedAt),
      },
    },
    presage: {
      facialSignalsStatus: toStringValue(
        attemptInput?.presage?.facialSignalsStatus,
        "unknown",
      ),
      sessionQuality: toStringValue(attemptInput?.presage?.sessionQuality, "unavailable"),
      source: toStringValue(attemptInput?.presage?.source, "unavailable"),
      faceMissingEvents: Math.max(0, toNumber(attemptInput?.presage?.faceMissingEvents, 0)),
      faceMissingSeconds: Math.max(0, toNumber(attemptInput?.presage?.faceMissingSeconds, 0)),
      metrics: attemptInput?.presage?.metrics || null,
    },
    timing: {
      assessmentStartedAt: startedAt,
      assessmentEndedAt: endedAt,
      totalDurationSeconds: Math.max(
        0,
        toNumber(attemptInput?.timing?.totalDurationSeconds, 0),
      ),
      tests: {
        test0Seconds: Math.max(0, toNumber(attemptInput?.timing?.tests?.test0Seconds, 0)),
        test1Seconds: Math.max(0, toNumber(attemptInput?.timing?.tests?.test1Seconds, 0)),
        test2Seconds: Math.max(0, toNumber(attemptInput?.timing?.tests?.test2Seconds, 0)),
        test3Seconds: Math.max(0, toNumber(attemptInput?.timing?.tests?.test3Seconds, 0)),
      },
    },
    testData: {
      test0Words: Array.isArray(attemptInput?.testData?.test0Words)
        ? attemptInput.testData.test0Words.map((word) => String(word))
        : [],
      test1Drawings: attemptInput?.testData?.test1Drawings || {},
      test2: {
        part1: {
          objects: test2Part1TargetObjects,
          options: Array.isArray(attemptInput?.testData?.test2?.part1?.options)
            ? attemptInput.testData.test2.part1.options
            : [],
          selections: test2Part1Selections,
          correctSelections: test2Part1CorrectCount,
        },
        part2: {
          expectedAnswer: test2Part2ExpectedAnswer,
          answer: test2Part2UserAnswer,
          isCorrect: test2Part2IsCorrect,
        },
        part3: {
          targetSequence: test2Part3TargetSequence,
          userSequence: test2Part3UserSequence,
          correctCount: test2Part3CorrectCount,
          totalCount: test2Part3TargetSequence.length,
        },
      },
      test3: {
        promptWords: Array.isArray(attemptInput?.testData?.test3?.promptWords)
          ? attemptInput.testData.test3.promptWords.map((word) => String(word))
          : [],
        promptText: toStringValue(attemptInput?.testData?.test3?.promptText),
        skipped: Boolean(attemptInput?.testData?.test3?.skipped),
        micPermission: toStringValue(attemptInput?.testData?.test3?.micPermission, "unknown"),
      },
    },
  };
}

export async function syncAuth0UserProfile(profile) {
  return withTransaction(async (client) => upsertUser(client, profile));
}

export async function saveAssessmentAttempt(attemptInput) {
  const attempt = normalizeAttemptPayload(attemptInput);

  if (!attempt.patientSub) {
    throw new Error("patientSub is required.");
  }

  return withTransaction(async (client) => {
    const user = await upsertUser(client, {
      sub: attempt.patientSub,
      email: attempt.patientEmail || null,
      name: attemptInput?.patientName || null,
      source: "assessment-submit",
    });

    const insertAssessment = await client.query(
      `
        INSERT INTO assessments (
          attempt_id,
          patient_user_id,
          patient_sub,
          patient_email,
          captured_at,
          assessment_started_at,
          assessment_ended_at,
          total_duration_seconds,
          attempt_payload
        )
        VALUES ($1, $2, $3, $4, $5::timestamptz, $6::timestamptz, $7::timestamptz, $8, $9::jsonb)
        RETURNING id
      `,
      [
        attempt.attemptId,
        user.id,
        attempt.patientSub,
        attempt.patientEmail || null,
        attempt.capturedAt,
        attempt.timing.assessmentStartedAt,
        attempt.timing.assessmentEndedAt,
        attempt.timing.totalDurationSeconds,
        JSON.stringify(attempt),
      ],
    );

    const assessmentId = insertAssessment.rows[0].id;

    await client.query(
      `
        INSERT INTO memory_recall_results (
          assessment_id,
          score,
          max_score,
          accuracy,
          duration_seconds
        )
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        assessmentId,
        attempt.memoryRecall.score,
        attempt.memoryRecall.maxScore,
        attempt.memoryRecall.accuracy,
        attempt.timing.tests.test0Seconds,
      ],
    );

    await client.query(
      `
        INSERT INTO drawing_results (
          assessment_id,
          completed_tasks,
          total_tasks,
          completion_ratio,
          clock_time_prompt,
          duration_seconds,
          drawings_json
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      `,
      [
        assessmentId,
        attempt.drawing.completedTasks,
        attempt.drawing.totalTasks,
        attempt.drawing.completionRatio,
        attempt.drawing.clockTimePrompt || null,
        attempt.timing.tests.test1Seconds,
        JSON.stringify(attempt.testData.test1Drawings || {}),
      ],
    );

    await client.query(
      `
        INSERT INTO memory_challenge_results (
          assessment_id,
          part1_correct_count,
          part1_total_target,
          part1_selected_json,
          part1_target_json,
          part2_expected_answer,
          part2_user_answer,
          part2_is_correct,
          part3_target_sequence,
          part3_user_sequence,
          part3_correct_count,
          part3_total_count,
          duration_seconds
        )
        VALUES (
          $1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9::jsonb, $10::jsonb, $11, $12, $13
        )
      `,
      [
        assessmentId,
        attempt.testData.test2.part1.correctSelections,
        attempt.testData.test2.part1.objects.length,
        JSON.stringify(attempt.testData.test2.part1.selections || []),
        JSON.stringify(attempt.testData.test2.part1.objects || []),
        attempt.testData.test2.part2.expectedAnswer || null,
        attempt.testData.test2.part2.answer || null,
        attempt.testData.test2.part2.isCorrect,
        JSON.stringify(attempt.testData.test2.part3.targetSequence || []),
        JSON.stringify(attempt.testData.test2.part3.userSequence || []),
        attempt.testData.test2.part3.correctCount,
        attempt.testData.test2.part3.totalCount,
        attempt.timing.tests.test2Seconds,
      ],
    );

    await client.query(
      `
        INSERT INTO speech_results (
          assessment_id,
          transcript,
          word_count,
          speech_rate_wpm,
          vocabulary_diversity,
          duration_seconds,
          phase,
          target_words_json,
          matched_words_json,
          matched_count,
          total_target_words,
          recall_accuracy,
          prompt_text,
          mic_permission,
          skipped,
          listen_played_at,
          repeat_started_at,
          repeat_ended_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, $15,
          $16::timestamptz, $17::timestamptz, $18::timestamptz
        )
      `,
      [
        assessmentId,
        attempt.speech.transcript || null,
        attempt.speech.wordCount,
        attempt.speech.speechRateWpm,
        attempt.speech.vocabularyDiversity,
        attempt.timing.tests.test3Seconds,
        attempt.stage3.phase,
        JSON.stringify(attempt.stage3.targetWords || []),
        JSON.stringify(attempt.stage3.recall.matchedWords || []),
        attempt.stage3.recall.matchedCount,
        attempt.stage3.recall.totalTargetWords,
        attempt.stage3.recall.accuracy,
        attempt.testData.test3.promptText || null,
        attempt.testData.test3.micPermission || null,
        attempt.testData.test3.skipped,
        attempt.stage3.timestamps.listenPlayedAt,
        attempt.stage3.timestamps.repeatStartedAt,
        attempt.stage3.timestamps.repeatEndedAt,
      ],
    );

    const presageMetrics = attempt.presage.metrics || {};

    await client.query(
      `
        INSERT INTO facial_metrics (
          assessment_id,
          facial_signals_status,
          session_quality,
          source,
          face_missing_events,
          face_missing_seconds,
          sample_count,
          started_at,
          ended_at,
          engagement_json,
          blink_rate_json,
          expression_variability_json,
          face_presence_json
        )
        VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8::timestamptz, $9::timestamptz,
          $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb
        )
      `,
      [
        assessmentId,
        attempt.presage.facialSignalsStatus,
        attempt.presage.sessionQuality,
        attempt.presage.source,
        attempt.presage.faceMissingEvents,
        attempt.presage.faceMissingSeconds,
        Math.max(0, toNumber(presageMetrics.sampleCount, 0)),
        toIsoDateOrNull(presageMetrics.startedAt),
        toIsoDateOrNull(presageMetrics.endedAt),
        JSON.stringify(presageMetrics.engagement || null),
        JSON.stringify(presageMetrics.blinkRate || null),
        JSON.stringify(presageMetrics.expressionVariability || null),
        JSON.stringify(presageMetrics.facePresence || null),
      ],
    );

    return attempt;
  });
}

export async function getAllAssessmentAttempts() {
  const result = await query(
    `
      SELECT attempt_payload
      FROM assessments
      ORDER BY captured_at ASC
      LIMIT $1
    `,
    [MAX_ATTEMPTS],
  );

  return result.rows.map((row) => row.attempt_payload);
}

export async function getPatientAssessmentHistory(patientSub) {
  const result = await query(
    `
      SELECT attempt_payload
      FROM assessments
      WHERE patient_sub = $1
      ORDER BY captured_at ASC
      LIMIT $2
    `,
    [patientSub, MAX_ATTEMPTS],
  );

  return result.rows.map((row) => row.attempt_payload);
}
