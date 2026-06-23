import { PythonRandom, type ReducedTrialRow } from "psyflow-web";

export interface AssetEntry {
  name: string;
  url: string;
}

export interface StimPair {
  stima: AssetEntry;
  stimb: AssetEntry;
}

function conditionHash(condition: string): number {
  return Array.from(condition).reduce((sum, char, index) => sum + (index + 1) * char.charCodeAt(0), 0);
}

export function sample_reward_draw(
  settings: { block_seed?: unknown },
  condition: string,
  blockIdx: number | null | undefined,
  trialId: number,
  reversalCount: number
): { rand_val: number; reward_seed: number } {
  const blockIndex = Math.trunc(Number(blockIdx ?? 0));
  let blockSeed = 0;
  const blockSeeds = Array.isArray(settings.block_seed) ? settings.block_seed : [];
  const seedValue = blockSeeds[blockIndex];
  if (seedValue != null) {
    blockSeed = Math.trunc(Number(seedValue));
  }

  const rewardSeed =
    blockSeed +
    conditionHash(String(condition)) +
    Math.trunc(Number(trialId)) * 1009 +
    Math.trunc(Number(reversalCount)) * 100003;
  return {
    rand_val: new PythonRandom(rewardSeed).random(),
    reward_seed: rewardSeed
  };
}

function basename(pathLike: string): string {
  const parts = pathLike.replace(/\\/g, "/").split("/");
  return parts[parts.length - 1] ?? pathLike;
}

export function normalizeImportedAssets(modules: Record<string, string>): AssetEntry[] {
  return Object.entries(modules)
    .map(([key, url]) => ({
      name: basename(key),
      url: String(url)
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function buildStimPairs(images: AssetEntry[]): StimPair[] {
  const pairs: StimPair[] = [];
  for (let index = 0; index + 1 < images.length; index += 2) {
    pairs.push({
      stima: images[index] as AssetEntry,
      stimb: images[index + 1] as AssetEntry
    });
  }
  return pairs;
}

export function getBlockStimPair(pairs: StimPair[], blockIndex: number): StimPair {
  if (pairs.length === 0) {
    throw new Error("No PRL stimulus pairs available.");
  }
  const pair = pairs[blockIndex];
  if (!pair) {
    throw new Error(
      `Missing PRL stimulus pair for block index ${String(blockIndex)}. Available pairs: ${String(pairs.length)}.`
    );
  }
  return pair;
}

export function summarizeBlock(rows: ReducedTrialRow[], blockId: string): { score: number } {
  const score = rows
    .filter((row) => row.block_id === blockId)
    .reduce((sum, row) => sum + Number(row.choice_delta ?? 0), 0);
  return { score };
}
