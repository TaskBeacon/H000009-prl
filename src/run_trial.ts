import {
  set_trial_context,
  type StimBank,
  type TaskSettings,
  type TrialSnapshot,
  type TrialBuilder
} from "psyflow-web";

import type { Controller } from "./controller";
import type { StimPair } from "./utils";

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

  let correct_side: "left" | "right";
  if (controller.current_correct === "stima") {
    correct_side = condition_id === "AB" ? "left" : "right";
  } else {
    correct_side = condition_id === "BA" ? "left" : "right";
  }
  const correct_key = correct_side === "left" ? left_key : right_key;

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
      current_correct: controller.current_correct,
      reversal_count: controller.reversal_count,
      block_idx
    },
    stim_id: "choice_pair"
  });
  choiceUnit
    .captureResponse({
      keys: key_list,
      correct_keys: correct_key,
      duration: Number(settings.choice_duration ?? 1.5),
      terminate_on_response: false
    })
    .set_state({
      win_prob: () => controller.get_win_prob(),
      rand_val: (snapshot: TrialSnapshot) => (Boolean(snapshot.units.choice?.key_press) ? Math.random() : null),
      outcome: (snapshot: TrialSnapshot) =>
        resolveOutcome(
          Boolean(snapshot.units.choice?.key_press),
          Boolean(snapshot.units.choice?.hit),
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
    phase: "pre_feedback_blank",
    deadline_s: (settings.blank_duration as number | number[] | null | undefined) ?? null,
    valid_keys: [...key_list],
    block_id,
    condition_id,
    task_factors: {
      condition: condition_id,
      stage: "pre_feedback_blank",
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
    phase: "outcome_feedback",
    deadline_s: Number(settings.feedback_duration ?? 0.8),
    valid_keys: [...key_list],
    block_id,
    condition_id,
    task_factors: {
      condition: condition_id,
      stage: "outcome_feedback",
      block_idx
    }
  });
  feedbackUnit.show({ duration: Number(settings.feedback_duration ?? 0.8) }).to_dict();

  trial.finalize((snapshot, _runtime, helpers) => {
    const responded = Boolean(snapshot.units.choice?.key_press);
    const hit = responded ? Boolean(snapshot.units.choice?.hit) : false;
    controller.update(hit);
    helpers.setTrialState("choice_delta", Number(snapshot.units.choice?.delta ?? -delta));
    helpers.setTrialState("choice_outcome", String(snapshot.units.choice?.outcome ?? "no_response"));
    helpers.setTrialState("choice_hit", hit);
    helpers.setTrialState("controller_current_correct", controller.current_correct);
    helpers.setTrialState("controller_reversal_count", controller.reversal_count);
  });

  return trial;
}
