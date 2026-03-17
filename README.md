# H000009 PRL

HTML/browser preview of the Probabilistic Reversal Learning task built with `psyflow-web`.
The trial procedure, per-block controller reversal logic, response mapping, and feedback/outcome rules are aligned to local `T000009-prl`; only block count is shortened for preview.

## Layout

- `main.ts`: task orchestration
- `config/config.yaml`: declarative config
- `src/run_trial.ts`: trial logic
- `src/controller.ts`: reversal-learning controller
- `src/utils.ts`: asset pairing and block summary helpers

## Run

From `e:\xhmhc\TaskBeacon\psyflow-web`:

```powershell
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:4173/?task=H000009-prl
```
