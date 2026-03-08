import { randomUUID } from "node:crypto";

import { query, withTransaction } from "./db.js";

const MAX_ATTEMPTS = 2000;

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const toText = (value, fallback = "") => {
  if (value === null || value === undefined) return fallback;
  return String(value);
};

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const toIsoDateOrNull = (value) => {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const toStringArray = (value, fallback = []) => {
  if (!Array.isArray(value)) return fallback;
  return value.map((item) => toText(item).trim()).filter(Boolean);
};

const normalizeWord = (value) => toText(value).toLowerCase().replace(/[^a-z0-9]/g, "");

const countIndexMatches = (expected = [], actual = []) => {
  const length = Math.min(expected.length, actual.length);
  let count = 0;
  for (let i = 0; i < length; i += 1) {
    if (expected[i] === actual[i]) count += 1;
  }
  return count;
};

const computeWordRecall = (targets, responses) => {
  const normalizedTargets = targets.map(normalizeWord).filter(Boolean);
  const normalizedResponses = responses.map(normalizeWord).filter(Boolean);
  const responseSet = new Set(normalizedResponses);

  const matchedWords = [];
  const seen = new Set();
  for (const targetWord of targets) {
    const normalizedTarget = normalizeWord(targetWord);
    if (!normalizedTarget || seen.has(normalizedTarget)) continue;
    if (responseSet.has(normalizedTarget)) {
      seen.add(normalizedTarget);
      matchedWords.push(targetWord);
    }
  }

  const matchedCount = seen.size;
  const totalTargetWords = normalizedTargets.length;
  const recallAccuracy = totalTargetWords > 0 ? matchedCount / totalTargetWords : 0;

  return {
    matchedWords,
    matchedCount,
    totalTargetWords,
    recallAccuracy: Number(clamp(recallAccuracy, 0, 1).toFixed(3)),
  };
};

async function upsertUser(client, profile) {
  const sub = toText(profile?.sub || profile?.user_id || "").trim();
  if (!sub) {
    throw new Error("Missing user sub/user_id from Auth0 payload.");
  }

  const email = toText(profile?.email || "").trim() || null;
  const fullName = toText(profile?.name || "").trim() || null;
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

function normalizeAttemptPayload(attemptInput) {
  const testsInput = attemptInput?.tests || {};
  const legacyTestData = attemptInput?.testData || {};

  const randomWords = toStringArray(
    testsInput?.test0And4?.randomWords,
    toStringArray(legacyTestData?.test0Words, []),
  );
  const userInputs = toStringArray(
    testsInput?.test0And4?.userInputs,
    toStringArray(legacyTestData?.test4?.recalledWords, []),
  );
  const test0Recall = computeWordRecall(randomWords, userInputs);

  const legacyDrawings = legacyTestData?.test1Drawings || {};
  const drawingStep1 =
    toText(testsInput?.test1?.drawings?.step1 || legacyDrawings?.[1] || "").trim() || null;
  const drawingStep2 =
    toText(testsInput?.test1?.drawings?.step2 || legacyDrawings?.[2] || "").trim() || null;
  const drawingStep3 =
    toText(testsInput?.test1?.drawings?.step3 || legacyDrawings?.[3] || "").trim() || null;
  const drawingCompletedTasks = [drawingStep1, drawingStep2, drawingStep3].filter(Boolean).length;
  const drawingTotalTasks = 3;
  const drawingCompletionRatio =
    drawingTotalTasks > 0 ? clamp(drawingCompletedTasks / drawingTotalTasks, 0, 1) : 0;

  const legacyPart1Objects = Array.isArray(legacyTestData?.test2?.part1?.objects)
    ? legacyTestData.test2.part1.objects
    : [];
  const legacyPart1Prompt = legacyPart1Objects
    .map((item) => toText(item?.label || "").trim())
    .filter(Boolean);
  const test2Part1Prompt = toStringArray(testsInput?.test2?.part1?.randomPrompt, legacyPart1Prompt);
  const test2Part1Answer = toStringArray(
    testsInput?.test2?.part1?.userAnswer,
    toStringArray(legacyTestData?.test2?.part1?.selections, []),
  );
  const uniquePart1Answers = new Set(test2Part1Answer.map(normalizeWord));
  const test2Part1CorrectCount = test2Part1Prompt.filter((word) =>
    uniquePart1Answers.has(normalizeWord(word)),
  ).length;

  const test2Part2RandomPrompt = toText(testsInput?.test2?.part2?.randomPrompt || "").trim();
  const test2Part2ExpectedAnswer = toText(
    testsInput?.test2?.part2?.expectedAnswer ?? legacyTestData?.test2?.part2?.expectedAnswer ?? "",
  ).trim();
  const test2Part2UserAnswer = toText(
    testsInput?.test2?.part2?.userAnswer ?? legacyTestData?.test2?.part2?.answer ?? "",
  ).trim();
  const test2Part2IsCorrect =
    test2Part2ExpectedAnswer && test2Part2UserAnswer
      ? test2Part2ExpectedAnswer === test2Part2UserAnswer
      : null;

  const test2Part3Prompt = toStringArray(
    testsInput?.test2?.part3?.randomPrompt,
    toStringArray(legacyTestData?.test2?.part3?.targetSequence, []),
  );
  const test2Part3Answer = toStringArray(
    testsInput?.test2?.part3?.userAnswer,
    toStringArray(legacyTestData?.test2?.part3?.userSequence, []),
  );
  const test2Part3CorrectCount = countIndexMatches(test2Part3Prompt, test2Part3Answer);

  const transcript = toText(
    testsInput?.test3?.transcript || attemptInput?.speech?.transcript || "",
  ).trim();
  const chosenWords = toStringArray(
    testsInput?.test3?.chosenWords,
    toStringArray(attemptInput?.stage3?.targetWords, []),
  );
  const userResponses = toStringArray(
    testsInput?.test3?.userResponses,
    transcript
      ? transcript
          .split(/\s+/)
          .map((word) => word.trim())
          .filter(Boolean)
      : [],
  );
  const spokenRecall = computeWordRecall(chosenWords, userResponses);

  const stage3Recall = {
    matchedCount: Math.max(
      0,
      toNumber(attemptInput?.stage3?.recall?.matchedCount, spokenRecall.matchedCount),
    ),
    totalTargetWords: Math.max(
      0,
      toNumber(attemptInput?.stage3?.recall?.totalTargetWords, spokenRecall.totalTargetWords),
    ),
    accuracy: clamp(
      toNumber(attemptInput?.stage3?.recall?.accuracy, spokenRecall.recallAccuracy),
      0,
      1,
    ),
    matchedWords: toStringArray(attemptInput?.stage3?.recall?.matchedWords, spokenRecall.matchedWords),
  };

  const speechWordCount = Math.max(
    0,
    toNumber(attemptInput?.speech?.wordCount, transcript ? transcript.split(/\s+/).filter(Boolean).length : 0),
  );
  const speechRateWpm = Math.max(0, toNumber(attemptInput?.speech?.speechRateWpm, 0));
  const vocabularyDiversity = clamp(toNumber(attemptInput?.speech?.vocabularyDiversity, 0), 0, 1);

  const timingInput = attemptInput?.timing || {};
  const timingTests = timingInput?.tests || {};
  const test0Seconds = Math.max(
    0,
    toNumber(
      timingTests?.test0Seconds,
      toNumber(timingTests?.test0And4Seconds, 0),
    ),
  );
  const test1Seconds = Math.max(0, toNumber(timingTests?.test1Seconds, 0));
  const test2Seconds = Math.max(0, toNumber(timingTests?.test2Seconds, 0));
  const test3Seconds = Math.max(
    0,
    toNumber(timingTests?.test3Seconds, toNumber(attemptInput?.stage3?.repeatDurationSeconds, 0)),
  );
  const totalDurationSeconds = Math.max(
    0,
    toNumber(timingInput?.totalDurationSeconds, test0Seconds + test1Seconds + test2Seconds + test3Seconds),
  );

  const assessmentStartedAt = toIsoDateOrNull(timingInput?.assessmentStartedAt);
  const assessmentEndedAt = toIsoDateOrNull(timingInput?.assessmentEndedAt);
  const listenPlayedAt = toIsoDateOrNull(attemptInput?.stage3?.timestamps?.listenPlayedAt);
  const repeatStartedAt = toIsoDateOrNull(attemptInput?.stage3?.timestamps?.repeatStartedAt);
  const repeatEndedAt = toIsoDateOrNull(attemptInput?.stage3?.timestamps?.repeatEndedAt);

  const memoryScore = Math.max(
    0,
    toNumber(attemptInput?.memoryRecall?.score, test0Recall.matchedCount),
  );
  const memoryMaxScore = Math.max(
    0,
    toNumber(attemptInput?.memoryRecall?.maxScore, test0Recall.totalTargetWords),
  );
  const memoryAccuracy = memoryMaxScore > 0 ? clamp(memoryScore / memoryMaxScore, 0, 1) : 0;

  const presage = {
    facialSignalsStatus: toText(attemptInput?.presage?.facialSignalsStatus || "unavailable").trim(),
    sessionQuality: toText(attemptInput?.presage?.sessionQuality || "unavailable").trim(),
    source: toText(attemptInput?.presage?.source || "unavailable").trim(),
    faceMissingEvents: Math.max(0, toNumber(attemptInput?.presage?.faceMissingEvents, 0)),
    faceMissingSeconds: Math.max(0, toNumber(attemptInput?.presage?.faceMissingSeconds, 0)),
    metrics: attemptInput?.presage?.metrics || null,
  };

  const normalized = {
    attemptId: toText(attemptInput?.id || "").trim() || randomUUID(),
    patientSub: toText(attemptInput?.patientSub || "").trim(),
    patientEmail: toText(attemptInput?.patientEmail || "").trim(),
    capturedAt: toIsoDateOrNull(attemptInput?.capturedAt) || new Date().toISOString(),
    tests: {
      test0And4: {
        randomWords,
        userInputs,
        matchedWords: test0Recall.matchedWords,
        matchedCount: test0Recall.matchedCount,
        totalTargetWords: test0Recall.totalTargetWords,
        recallAccuracy: test0Recall.recallAccuracy,
      },
      test1: {
        clockTimePrompt: toText(
          testsInput?.test1?.clockTimePrompt || attemptInput?.drawing?.clockTimePrompt || "",
        ).trim(),
        drawings: {
          step1: drawingStep1,
          step2: drawingStep2,
          step3: drawingStep3,
        },
        completedTasks: drawingCompletedTasks,
        totalTasks: drawingTotalTasks,
        completionRatio: Number(drawingCompletionRatio.toFixed(3)),
      },
      test2: {
        part1: {
          randomPrompt: test2Part1Prompt,
          userAnswer: test2Part1Answer,
          correctCount: test2Part1CorrectCount,
          totalTarget: test2Part1Prompt.length,
        },
        part2: {
          randomPrompt: test2Part2RandomPrompt,
          expectedAnswer: test2Part2ExpectedAnswer,
          userAnswer: test2Part2UserAnswer,
          isCorrect: test2Part2IsCorrect,
        },
        part3: {
          randomPrompt: test2Part3Prompt,
          userAnswer: test2Part3Answer,
          correctCount: test2Part3CorrectCount,
          totalCount: test2Part3Prompt.length,
        },
      },
      test3: {
        chosenWords,
        userResponses,
        transcript,
      },
    },
    memoryRecall: {
      score: memoryScore,
      maxScore: memoryMaxScore,
      accuracy: Number(memoryAccuracy.toFixed(3)),
    },
    drawing: {
      completedTasks: drawingCompletedTasks,
      totalTasks: drawingTotalTasks,
      completionRatio: Number(drawingCompletionRatio.toFixed(3)),
      clockTimePrompt: toText(
        testsInput?.test1?.clockTimePrompt || attemptInput?.drawing?.clockTimePrompt || "",
      ).trim(),
    },
    speech: {
      transcript,
      wordCount: speechWordCount,
      speechRateWpm,
      vocabularyDiversity,
    },
    stage3: {
      targetWords: chosenWords,
      recall: {
        matchedCount: stage3Recall.matchedCount,
        totalTargetWords: stage3Recall.totalTargetWords,
        accuracy: Number(stage3Recall.accuracy.toFixed(3)),
        matchedWords: stage3Recall.matchedWords,
      },
      repeatDurationSeconds: Math.max(
        0,
        toNumber(attemptInput?.stage3?.repeatDurationSeconds, test3Seconds),
      ),
      phase: toText(attemptInput?.stage3?.phase || "listen").trim(),
      timestamps: {
        listenPlayedAt,
        repeatStartedAt,
        repeatEndedAt,
      },
    },
    presage,
    timing: {
      assessmentStartedAt,
      assessmentEndedAt,
      totalDurationSeconds: Number(totalDurationSeconds.toFixed(3)),
      tests: {
        test0Seconds: Number(test0Seconds.toFixed(3)),
        test1Seconds: Number(test1Seconds.toFixed(3)),
        test2Seconds: Number(test2Seconds.toFixed(3)),
        test3Seconds: Number(test3Seconds.toFixed(3)),
      },
    },
    testData: {
      test0Words: randomWords,
      test1Drawings: {
        1: drawingStep1,
        2: drawingStep2,
        3: drawingStep3,
      },
      test2: {
        part1: {
          objects: test2Part1Prompt.map((label) => ({ label })),
          options: test2Part1Prompt.map((label) => ({ label })),
          selections: test2Part1Answer,
          correctSelections: test2Part1CorrectCount,
        },
        part2: {
          expectedAnswer: test2Part2ExpectedAnswer,
          answer: test2Part2UserAnswer,
          isCorrect: test2Part2IsCorrect,
        },
        part3: {
          targetSequence: test2Part3Prompt,
          userSequence: test2Part3Answer,
          correctCount: test2Part3CorrectCount,
          totalCount: test2Part3Prompt.length,
        },
      },
      test3: {
        promptWords: chosenWords,
        promptText: chosenWords.join(" "),
        skipped: false,
        micPermission: toText(legacyTestData?.test3?.micPermission || "unknown"),
      },
    },
  };

  return normalized;
}

async function insertPerTestRows(client, assessmentId, attempt, { ignoreConflicts = false } = {}) {
  const onConflict = ignoreConflicts ? "ON CONFLICT (assessment_id) DO NOTHING" : "";

  await client.query(
    `
      INSERT INTO test0_test4_results (
        assessment_id,
        random_words_json,
        user_inputs_json,
        matched_words_json,
        matched_count,
        total_target_words,
        recall_accuracy,
        duration_seconds
      )
      VALUES ($1, $2::jsonb, $3::jsonb, $4::jsonb, $5, $6, $7, $8)
      ${onConflict}
    `,
    [
      assessmentId,
      JSON.stringify(attempt.tests.test0And4.randomWords || []),
      JSON.stringify(attempt.tests.test0And4.userInputs || []),
      JSON.stringify(attempt.tests.test0And4.matchedWords || []),
      attempt.tests.test0And4.matchedCount,
      attempt.tests.test0And4.totalTargetWords,
      attempt.tests.test0And4.recallAccuracy,
      attempt.timing.tests.test0Seconds,
    ],
  );

  await client.query(
    `
      INSERT INTO test1_drawing_results (
        assessment_id,
        clock_time_prompt,
        step1_image_data_url,
        step2_image_data_url,
        step3_image_data_url,
        completed_tasks,
        total_tasks,
        completion_ratio,
        duration_seconds
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ${onConflict}
    `,
    [
      assessmentId,
      attempt.tests.test1.clockTimePrompt || null,
      attempt.tests.test1.drawings.step1,
      attempt.tests.test1.drawings.step2,
      attempt.tests.test1.drawings.step3,
      attempt.tests.test1.completedTasks,
      attempt.tests.test1.totalTasks,
      attempt.tests.test1.completionRatio,
      attempt.timing.tests.test1Seconds,
    ],
  );

  await client.query(
    `
      INSERT INTO test2_memory_challenge_results (
        assessment_id,
        part1_random_prompt_json,
        part1_user_answer_json,
        part1_correct_count,
        part1_total_target,
        part2_random_prompt,
        part2_expected_answer,
        part2_user_answer,
        part2_is_correct,
        part3_random_prompt_json,
        part3_user_answer_json,
        part3_correct_count,
        part3_total_count,
        duration_seconds
      )
      VALUES (
        $1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $9, $10::jsonb, $11::jsonb, $12, $13, $14
      )
      ${onConflict}
    `,
    [
      assessmentId,
      JSON.stringify(attempt.tests.test2.part1.randomPrompt || []),
      JSON.stringify(attempt.tests.test2.part1.userAnswer || []),
      attempt.tests.test2.part1.correctCount,
      attempt.tests.test2.part1.totalTarget,
      attempt.tests.test2.part2.randomPrompt || null,
      attempt.tests.test2.part2.expectedAnswer || null,
      attempt.tests.test2.part2.userAnswer || null,
      attempt.tests.test2.part2.isCorrect,
      JSON.stringify(attempt.tests.test2.part3.randomPrompt || []),
      JSON.stringify(attempt.tests.test2.part3.userAnswer || []),
      attempt.tests.test2.part3.correctCount,
      attempt.tests.test2.part3.totalCount,
      attempt.timing.tests.test2Seconds,
    ],
  );

  await client.query(
    `
      INSERT INTO test3_spoken_results (
        assessment_id,
        chosen_words_json,
        user_responses_json,
        transcript,
        word_count,
        speech_rate_wpm,
        vocabulary_diversity,
        phase,
        matched_words_json,
        matched_count,
        total_target_words,
        recall_accuracy,
        repeat_duration_seconds,
        listen_played_at,
        repeat_started_at,
        repeat_ended_at,
        duration_seconds
      )
      VALUES (
        $1, $2::jsonb, $3::jsonb, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, $13,
        $14::timestamptz, $15::timestamptz, $16::timestamptz, $17
      )
      ${onConflict}
    `,
    [
      assessmentId,
      JSON.stringify(attempt.tests.test3.chosenWords || []),
      JSON.stringify(attempt.tests.test3.userResponses || []),
      attempt.tests.test3.transcript || null,
      attempt.speech.wordCount,
      attempt.speech.speechRateWpm,
      attempt.speech.vocabularyDiversity,
      attempt.stage3.phase,
      JSON.stringify(attempt.stage3.recall.matchedWords || []),
      attempt.stage3.recall.matchedCount,
      attempt.stage3.recall.totalTargetWords,
      attempt.stage3.recall.accuracy,
      attempt.stage3.repeatDurationSeconds,
      attempt.stage3.timestamps.listenPlayedAt,
      attempt.stage3.timestamps.repeatStartedAt,
      attempt.stage3.timestamps.repeatEndedAt,
      attempt.timing.tests.test3Seconds,
    ],
  );
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

    const insertedAssessment = await client.query(
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

    const assessmentId = insertedAssessment.rows[0].id;

    await insertPerTestRows(client, assessmentId, attempt);

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
        JSON.stringify(attempt.tests.test1.drawings || {}),
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
        attempt.tests.test2.part1.correctCount,
        attempt.tests.test2.part1.totalTarget,
        JSON.stringify(attempt.tests.test2.part1.userAnswer || []),
        JSON.stringify(attempt.tests.test2.part1.randomPrompt || []),
        attempt.tests.test2.part2.expectedAnswer || null,
        attempt.tests.test2.part2.userAnswer || null,
        attempt.tests.test2.part2.isCorrect,
        JSON.stringify(attempt.tests.test2.part3.randomPrompt || []),
        JSON.stringify(attempt.tests.test2.part3.userAnswer || []),
        attempt.tests.test2.part3.correctCount,
        attempt.tests.test2.part3.totalCount,
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
        attempt.tests.test3.chosenWords.join(" ") || null,
        null,
        false,
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

    return {
      ...attempt,
      assessmentId: Number(assessmentId),
    };
  });
}

export async function backfillAssessmentDerivedTables() {
  return withTransaction(async (client) => {
    const missingRows = await client.query(
      `
        SELECT a.id, a.attempt_payload
        FROM assessments a
        LEFT JOIN test0_test4_results t0 ON t0.assessment_id = a.id
        LEFT JOIN test1_drawing_results t1 ON t1.assessment_id = a.id
        LEFT JOIN test2_memory_challenge_results t2 ON t2.assessment_id = a.id
        LEFT JOIN test3_spoken_results t3 ON t3.assessment_id = a.id
        WHERE t0.assessment_id IS NULL
          OR t1.assessment_id IS NULL
          OR t2.assessment_id IS NULL
          OR t3.assessment_id IS NULL
        ORDER BY a.id ASC
      `,
    );

    let backfilledCount = 0;

    for (const row of missingRows.rows) {
      const normalized = normalizeAttemptPayload(row.attempt_payload || {});

      await client.query(
        `
          UPDATE assessments
          SET
            assessment_started_at = COALESCE($1::timestamptz, assessment_started_at),
            assessment_ended_at = COALESCE($2::timestamptz, assessment_ended_at),
            total_duration_seconds = CASE
              WHEN total_duration_seconds = 0 AND $3::numeric > 0 THEN $3::numeric
              ELSE total_duration_seconds
            END,
            attempt_payload = $4::jsonb
          WHERE id = $5
        `,
        [
          normalized.timing.assessmentStartedAt,
          normalized.timing.assessmentEndedAt,
          normalized.timing.totalDurationSeconds,
          JSON.stringify(normalized),
          row.id,
        ],
      );

      await insertPerTestRows(client, row.id, normalized, { ignoreConflicts: true });
      backfilledCount += 1;
    }

    return {
      backfilledCount,
    };
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

export async function saveAssessmentAiReport(attemptId, aiReport) {
  if (!attemptId) return false;

  const result = await query(
    `
      UPDATE assessments
      SET attempt_payload = jsonb_set(
        COALESCE(attempt_payload, '{}'::jsonb),
        '{aiReport}',
        $2::jsonb,
        true
      )
      WHERE attempt_id = $1
    `,
    [attemptId, JSON.stringify(aiReport || null)],
  );

  return result.rowCount > 0;
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
