export class Controller {
  readonly win_prob: number;
  readonly rev_win_prob: number;
  readonly sliding_window: number;
  readonly sliding_window_hits: number;
  readonly enable_logging: boolean;
  current_correct: "stima" | "stimb";
  reversal_count: number;
  phase_hits: boolean[];

  constructor(options: {
    win_prob: number;
    rev_win_prob: number;
    sliding_window?: number;
    sliding_window_hits?: number;
    enable_logging?: boolean;
  }) {
    this.win_prob = Number(options.win_prob);
    this.rev_win_prob = Number(options.rev_win_prob);
    this.sliding_window = Math.max(1, Math.floor(Number(options.sliding_window ?? 10)));
    this.sliding_window_hits = Math.max(1, Math.floor(Number(options.sliding_window_hits ?? 9)));
    this.enable_logging = Boolean(options.enable_logging ?? true);
    this.current_correct = "stima";
    this.reversal_count = 0;
    this.phase_hits = [];
  }

  static from_dict(config: Record<string, unknown>): Controller {
    const win_prob = Number(config.win_prob ?? 0.8);
    const rev_win_prob = Number(config.rev_win_prob ?? win_prob);
    return new Controller({
      win_prob,
      rev_win_prob,
      sliding_window: Number(config.sliding_window ?? 10),
      sliding_window_hits: Number(config.sliding_window_hits ?? 9),
      enable_logging: Boolean(config.enable_logging ?? true)
    });
  }

  get_win_prob(): number {
    return this.reversal_count === 0 ? this.win_prob : this.rev_win_prob;
  }

  update(hit: boolean): void {
    this.phase_hits.push(Boolean(hit));
    if (this.phase_hits.length > this.sliding_window) {
      this.phase_hits.shift();
    }
    if (
      this.phase_hits.length === this.sliding_window &&
      this.phase_hits.reduce((sum, value) => sum + Number(value), 0) >= this.sliding_window_hits
    ) {
      const old = this.current_correct;
      this.current_correct = old === "stima" ? "stimb" : "stima";
      this.reversal_count += 1;
      this.phase_hits = [];
    }
  }
}
