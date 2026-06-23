import {
  set_trial_context,
  type StimBank,
  type TaskSettings,
  type TrialSnapshot,
  type TrialBuilder
} from "psyflow-web";

import type { Controller } from "./controller";
import { sample_reward_draw, type StimPair } from "./utils";

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.min(1, Math.max(0, value));
}

function resolveOutcome(
  responded: boolean,
  hit: boolean,
  winProb: number,
  randVal: unknown
): "win" | "lose" | "no_response" {
  if (!responded) {
    return "no_response";
  }
  const boundedWinProb = clamp01(winProb);
  const threshold = hit ? boundedWinProb : 1 - boundedWinProb;
  const rand = typeof randVal === "number" ? randVal : Math.random();
  return rand < threshold ? "win" : "lose";
}

function resolveDelta(outcome: string, baseDelta: number): number {
  return outcome === "win" ? baseDelta : -baseDelta;
}

function resolveCorrectSide(conditionId: string, currentCorrect: "stima" | "stimb"): "left" | "right" {
  if (currentCorrect === "stima") {
    return conditionId === "AB" ? "left" : "right";
  }
  return conditionId === "BA" ? "left" : "right";
}

function resolveChoiceHit(
  snapshot: TrialSnapshot,
  conditionId: string,
  currentCorrect: "stima" | "stimb",
  leftKey: string,
  rightKey: string
): boolean {
  const response = String(snapshot.units.choice?.key_press ?? "");
  if (!response) {
    return false;
  }
  const correctSide = resolveCorrectSide(conditionId, currentCorrect);
  const correctKey = correctSide === "left" ? leftKey : rightKey;
  return response === correctKey;
}

export function run_trial(
  trial: TrialBuilder,
  condition: string,
  context: {
    settings: TaskSettings;
    stimBank: StimBank;
    controller: Controller;
    pair: StimPair;
    block_id: string;
    block_idx: number;
  }
): TrialBuilder {
  const { settings, stimBank, controller, pair, block_id, block_idx } = context;
  const condition_id = String(condition);
  const key_list = ((settings.key_list as string[]) ?? ["f", "j"]).map(String);
  const left_key = String(settings.left_key ?? "f");
  const right_key = String(settings.right_key ?? "j");
  const delta = Number(settings.delta ?? 10);
  const triggerMap = (settings.triggers ?? {}) as Record<string, unknown>;
  const markerPad = () => controller.reversal_count * 10;

  const fixationUnit = trial.unit("fixation").addStim(stimBank.get("fixation"));
  set_trial_context(fixationUnit, {
    trial_id: trial.trial_id,
    phase: "pre_choice_fixation",
    deadline_s: (settings.fixation_duration as number | number[] | null | undefined) ?? null,
    valid_keys: [...key_list],
    block_id,
    condition_id,
    task_factors: {
      condition: condition_id,
      stage: "pre_choice_fixation",
      block_idx
    },
    stim_id: "fixation"
  });
  fixationUnit.show({ duration: (settings.fixation_duration as number | number[] | null | undefined) ?? null }).to_dict();

  const stimaLeft = stimBank.rebuild("stima", {
    image: pair.stima.url,
    pos: [-4, 0]
  });
  const stimaRight = stimBank.rebuild("stima", {
    image: pair.stima.url,
    pos: [4, 0]
  });
  const stimbLeft = stimBank.rebuild("stimb", {
    image: pair.stimb.url,
    pos: [-4, 0]
  });
  const stimbRight = stimBank.rebuild("stimb", {
    image: pair.stimb.url,
    pos: [4, 0]
  });
  const leftStim = condition_id === "AB" ? stimaLeft : stimbLeft;
  const rightStim = condition_id === "AB" ? stimbRight : stimaRight;

  const choiceUnit = trial.unit("choice").addStim(leftStim).addStim(rightStim);
  set_trial_context(choiceUnit, {
    trial_id: trial.trial_id,
    phase: "choice_response_window",
    deadline_s: Number(settings.choice_duration ?? 1.5),
    valid_keys: [...key_list],
    block_id,
    condition_id,
    task_factors: {
      condition: condition_id,
      stage: "choice_response_window",
      current_correct: () => controller.current_correct,
      reversal_count: () => controller.reversal_count,
      block_idx
    },
    stim_id: "choice_pair"
  });
  choiceUnit
    .captureResponse({
      keys: key_list,
      correct_keys: () => {
        const correctSide = resolveCorrectSide(condition_id, controller.current_correct);
        return correctSide === "left" ? left_key : right_key;
      },
      duration: Number(settings.choice_duration ?? 1.5),
      response_trigger: () => Number(triggerMap.key_press ?? 3) + markerPad(),
      timeout_trigger: () => Number(triggerMap.no_response ?? 4) + markerPad(),
      terminate_on_response: false
    })
    .set_state({
      win_prob: () => controller.get_win_prob(),
      choice_hit: (snapshot: TrialSnapshot) =>
        resolveChoiceHit(snapshot, condition_id, controller.current_correct, left_key, right_key),
      rand_val: (snapshot: TrialSnapshot) =>
        Boolean(snapshot.units.choice?.key_press)
          ? sample_reward_draw(
              settings,
              condition_id,
              block_idx,
              Number(trial.trial_id),
              controller.reversal_count
            ).rand_val
          : null,
      reward_seed: (snapshot: TrialSnapshot) =>
        Boolean(snapshot.units.choice?.key_press)
          ? sample_reward_draw(
              settings,
              condition_id,
              block_idx,
              Number(trial.trial_id),
              controller.reversal_count
            ).reward_seed
          : null,
      outcome: (snapshot: TrialSnapshot) =>
        resolveOutcome(
          Boolean(snapshot.units.choice?.key_press),
          Boolean(snapshot.units.choice?.choice_hit),
          Number(snapshot.units.choice?.win_prob ?? controller.get_win_prob()),
          snapshot.units.choice?.rand_val
        ),
      delta: (snapshot: TrialSnapshot) =>
        resolveDelta(String(snapshot.units.choice?.outcome ?? "no_response"), delta),
      current_correct: () => controller.current_correct,
      reversal_count: () => controller.reversal_count
    })
    .to_dict();

  const blankUnit = trial.unit("blank").addStim(stimBank.get("blank"));
  set_trial_context(blankUnit, {
    trial_id: trial.trial_id,
    phase: "blank_screen",
    deadline_s: (settings.blank_duration as number | number[] | null | undefined) ?? null,
    valid_keys: [],
    block_id,
    condition_id,
    task_factors: {
      condition: condition_id,
      stage: "blank_screen",
      current_correct: () => controller.current_correct,
      reversal_count: () => controller.reversal_count,
      outcome: (snapshot: TrialSnapshot) => snapshot.units.choice?.outcome,
      hit: (snapshot: TrialSnapshot) => Boolean(snapshot.units.choice?.choice_hit),
      win_prob: (snapshot: TrialSnapshot) => snapshot.units.choice?.win_prob,
      rand_val: (snapshot: TrialSnapshot) => snapshot.units.choice?.rand_val,
      reward_seed: (snapshot: TrialSnapshot) => snapshot.units.choice?.reward_seed,
      block_idx
    },
    stim_id: "blank"
  });
  blankUnit.show({ duration: (settings.blank_duration as number | number[] | null | undefined) ?? null }).to_dict();

  const feedbackUnit = trial
    .unit("feedback")
    .addStim((snapshot: TrialSnapshot) =>
      stimBank.get(`${String(snapshot.units.choice?.outcome ?? "no_response")}_feedback`)
    );
  set_trial_context(feedbackUnit, {
    trial_id: trial.trial_id,
    phase: "feedback",
    deadline_s: Number(settings.feedback_duration ?? 0.8),
    valid_keys: [],
    block_id,
    condition_id,
    task_factors: {
      condition: condition_id,
      stage: "feedback",
      current_correct: () => controller.current_correct,
      reversal_count: () => controller.reversal_count,
      outcome: (snapshot: TrialSnapshot) => snapshot.units.choice?.outcome,
      hit: (snapshot: TrialSnapshot) => Boolean(snapshot.units.choice?.choice_hit),
      win_prob: (snapshot: TrialSnapshot) => snapshot.units.choice?.win_prob,
      rand_val: (snapshot: TrialSnapshot) => snapshot.units.choice?.rand_val,
      reward_seed: (snapshot: TrialSnapshot) => snapshot.units.choice?.reward_seed,
      block_idx
    },
    stim_id: "feedback"
  });
  feedbackUnit.show({ duration: Number(settings.feedback_duration ?? 0.8) }).to_dict();

  trial.finalize((snapshot, _runtime, helpers) => {
    const responded = Boolean(snapshot.units.choice?.key_press);
    const hit = responded ? Boolean(snapshot.units.choice?.choice_hit) : false;
    controller.update(hit);
    helpers.setTrialState("choice_delta", Number(snapshot.units.choice?.delta ?? -delta));
    helpers.setTrialState("choice_outcome", String(snapshot.units.choice?.outcome ?? "no_response"));
    helpers.setTrialState("choice_hit", hit);
    helpers.setTrialState("controller_current_correct", controller.current_correct);
    helpers.setTrialState("controller_reversal_count", controller.reversal_count);
  });

  return trial;
}
