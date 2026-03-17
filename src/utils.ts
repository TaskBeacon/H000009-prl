import type { ReducedTrialRow } from "psyflow-web";

export interface AssetEntry {
  name: string;
  url: string;
}

export interface StimPair {
  stima: AssetEntry;
  stimb: AssetEntry;
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
