"""042 pilot matrix runner (gate 4, paid). Runs frozen task x arm x rep cells
sequentially through paid_driver.py with per-cell caps and a cumulative
spend stop. All artifacts local under .work/appworld/.

Usage:
  OPENROUTER_API_KEY=... python examples/appworld/pilot.py \
    --matrix .work/appworld/pilot-matrix.json --out .work/appworld/pilot-v1 \
    --python <venv-python> --budget-usd 5.0
"""
from __future__ import annotations

import argparse
import datetime
import json
import os
import subprocess
import sys
from pathlib import Path

RATES = {"input": 1e-7, "output": 2e-7, "cacheRead": 2e-9, "cacheWrite": 0.0}


def cell_cost(cell_dir: Path) -> float:
    total = 0.0
    run = cell_dir / "run.jsonl"
    if not run.is_file():
        return 0.0
    for line in run.read_text(encoding="utf-8").splitlines():
        try:
            e = json.loads(line)
        except Exception:
            continue
        if e.get("type") != "turn_end":
            continue
        msg = e.get("message")
        u = msg.get("usage") if isinstance(msg, dict) else None
        if not isinstance(u, dict):
            continue
        for key, rate in RATES.items():
            total += (u.get(key) or 0) * rate
    return total


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(description="042 pilot matrix runner")
    p.add_argument("--matrix", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--python", required=True)
    p.add_argument("--budget-usd", type=float, default=5.0)
    p.add_argument("--max-requests", type=int, default=40)
    p.add_argument("--agent-timeout-s", type=int, default=1700)
    args = p.parse_args(argv)
    repo = Path(__file__).resolve().parents[2]
    base = (repo / ".work" / "appworld").resolve()
    out = Path(args.out).resolve()
    try:
        out.relative_to(base)
    except ValueError:
        print(f"out must resolve under {base}", file=sys.stderr)
        return 2
    matrix = json.loads(Path(args.matrix).read_text(encoding="utf-8"))
    cells = matrix["cells"]
    out.mkdir(parents=True, exist_ok=False)
    ledger_path = out / "ledger.jsonl"
    spent = 0.0
    done = 0
    for cell in cells:
        remaining = args.budget_usd - spent
        if remaining <= 0.01:
            print(f"BUDGET STOP: spent ${spent:.4f}", flush=True)
            break
        cell_out = out / f"cell-{cell['id']}"
        cmd = [
            sys.executable, str(repo / "examples" / "appworld" / "paid_driver.py"),
            "--task", cell["task"], "--arm", cell["arm"],
            "--out", str(cell_out), "--apps", ",".join(cell["apps"]),
            "--python", os.path.abspath(args.python),
            "--max-requests", str(args.max_requests),
            "--max-cost-usd", f"{min(2.0, remaining):.2f}",
            "--thinking", cell.get("thinking", "medium"),
        ]
        print(f"--- cell {cell['id']} task={cell['task']} arm={cell['arm']} "
              f"rep={cell['rep']} (spent ${spent:.4f}) ---", flush=True)
        try:
            proc = subprocess.run(cmd, cwd=str(repo), timeout=args.agent_timeout_s + 600)
            exit_code = proc.returncode
        except subprocess.TimeoutExpired:
            exit_code = 124
        cost = cell_cost(cell_out)
        spent += cost
        record = {"cell": cell["id"], "task": cell["task"], "arm": cell["arm"],
                  "rep": cell["rep"], "exit": exit_code,
                  "costUsd": round(cost, 6), "cumulativeUsd": round(spent, 6)}
        result_file = cell_out / "result.json"
        if result_file.is_file():
            try:
                r = json.loads(result_file.read_text(encoding="utf-8"))
                record.update({k: r.get(k) for k in
                               ("completed", "passes", "failures", "agentExit")})
            except Exception as exc:
                record["resultError"] = str(exc)[:200]
        with open(ledger_path, "a", encoding="utf-8") as fh:
            fh.write(json.dumps(record) + "\n")
        done += 1
        print(f"cell {cell['id']}: exit={exit_code} cost=${cost:.4f} "
              f"cumulative=${spent:.4f} {record.get('completed')}/"
              f"{record.get('passes')}/{record.get('failures')}", flush=True)
    summary = {"cells": len(cells), "done": done, "spentUsd": round(spent, 6),
               "budgetUsd": args.budget_usd,
               "finished": datetime.datetime.now(datetime.timezone.utc).isoformat()}
    (out / "pilot-summary.json").write_text(json.dumps(summary, indent=2), encoding="utf-8")
    print(json.dumps(summary), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
