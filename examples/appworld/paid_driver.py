"""Paid development driver for the AppWorld spike (issue 037).

Holds AppWorldServers + one task world open, points a typed-only Pi agent
at the live world through Strata's MCP extension path, then saves and
grades with the upstream evaluator. DEVELOPMENT spend, not evidence:
the dev task's database was inspected before, so no score may be claimed.

All artifacts stay under .work/appworld/. Never touches task databases,
ground truth, or solutions. Only aggregate grader counts are persisted.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import subprocess
import sys
import urllib.request
from pathlib import Path


UPSTREAM_PIN = "42b5bcf3cd334fee33f0c37c02070a9f5807add5"
MODEL = "meta/muse-spark-1.3-contributor"
MAX_OUTPUT_TOKENS = 8192


def parse_args(argv: list[str]) -> argparse.Namespace:
    p = argparse.ArgumentParser(description="AppWorld paid development driver")
    p.add_argument("--task", required=True)
    p.add_argument("--out", required=True, help="New artifact dir under .work/appworld")
    p.add_argument("--experiment", default=None)
    p.add_argument("--apps", default="supervisor,spotify")
    p.add_argument("--max-requests", type=int, default=40)
    p.add_argument("--max-cost-usd", type=float, default=5.0)
    p.add_argument("--agent-timeout-s", type=int, default=1700)
    return p.parse_args(argv)


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def fetch_rates(model: str) -> dict:
    req = urllib.request.Request(
        "https://openrouter.ai/api/v1/models", headers={"User-Agent": "strata-appworld-driver"}
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        catalog = json.loads(resp.read().decode("utf-8"))
    entry = next(m for m in catalog["data"] if m["id"] == model)
    pricing = entry["pricing"]

    def price(name: str, fallback: float = 0.0) -> float:
        raw = pricing.get(name)
        if raw is None:
            return fallback
        return float(raw)

    rates = {
        "input": price("prompt"),
        "output": price("completion"),
        "cacheRead": price("input_cache_read", 0.0),
        "cacheWrite": price("input_cache_write", 0.0),
        "request": price("request", 0.0),
    }
    context = int(entry["context_length"])
    request_tokens = context + MAX_OUTPUT_TOKENS
    request_cost = (
        context * max(rates["input"], rates["cacheRead"], rates["cacheWrite"])
        + MAX_OUTPUT_TOKENS * rates["output"]
        + rates["request"]
    )
    return {"rates": rates, "context": context,
            "requestTokens": request_tokens, "requestCostUsd": request_cost}


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    repo = Path(__file__).resolve().parents[2]
    base = (repo / ".work" / "appworld").resolve()
    out = Path(args.out).resolve()
    try:
        out.relative_to(base)
    except ValueError:
        print(f"out must resolve under {base}", file=sys.stderr)
        return 2
    if out.exists():
        print(f"refusing to overwrite existing out dir: {out}", file=sys.stderr)
        return 2
    root = base
    apps = [a.strip() for a in args.apps.split(",") if a.strip()]
    if not apps:
        print("at least one app name is required", file=sys.stderr)
        return 2

    # Operation allowlist comes from a locally inspected MCP manifest
    # (discovered names, never invented). Newest inspect dir wins.
    manifests = sorted(base.glob("inspect-*/manifest.json"))
    if not manifests:
        print("no inspect manifest found; run --inspect first", file=sys.stderr)
        return 2
    manifest = json.loads(manifests[-1].read_text(encoding="utf-8"))
    allow = sorted({op["name"] for op in manifest["operations"]})
    if not allow:
        print("inspect manifest has no operations", file=sys.stderr)
        return 2

    rates = fetch_rates(MODEL)
    experiment = args.experiment or (
        "paid_%s_%d" % (datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"), os.getpid())
    )
    if (root / experiment).exists():
        print(f"refusing to reuse existing experiment dir: {root / experiment}", file=sys.stderr)
        return 2

    out.mkdir(parents=True, exist_ok=False)
    venv_python = os.path.abspath(os.path.join(root, "venv", "bin", "python"))
    bun_exe = __import__("shutil").which("bun")
    if not bun_exe:
        print("bun executable not found on PATH", file=sys.stderr)
        return 2

    os.environ["APPWORLD_ROOT"] = str(root)
    os.environ["APPWORLD_CACHE"] = str(root / "cache")
    try:
        from appworld import AppWorld
        from appworld.environment import AppWorldServers
    except Exception as exc:
        write_json(out / "failure.json", {"ok": False, "error": f"appworld import failed: {exc}"})
        return 1

    try:
        with AppWorldServers(experiment_name=experiment, remote_apis_port="{port}") as servers:
            defaults = dict(servers.defaults)
            remote_apis_url = str(defaults.get("remote_apis_url", ""))
            if not remote_apis_url:
                raise RuntimeError("AppWorldServers.defaults missing remote_apis_url")

            strata_config = {
                "id": "appworld",
                "command": venv_python,
                "args": ["-m", "appworld.cli", "serve", "mcp", "stdio",
                         "--app-names", ",".join(apps),
                         "--output-type", "both",
                         "--remote-apis-url", remote_apis_url,
                         "--root", str(root)],
                "allow": allow,
            }
            write_json(out / "strata.json", strata_config)

            profile = out / "profile"
            profile.mkdir()
            (profile / "settings.json").write_text(
                json.dumps({"retry": {"enabled": False}, "quietStartup": True}), encoding="utf-8")
            (profile / "models.json").write_text(json.dumps({"providers": {"openrouter": {
                "baseUrl": "https://openrouter.ai/api/v1", "api": "openai-completions",
                "apiKey": "OPENROUTER_API_KEY",
                "models": [{"id": MODEL, "reasoning": True, "input": ["text"],
                            "contextWindow": rates["context"], "maxTokens": MAX_OUTPUT_TOKENS,
                            "cost": {"input": rates["rates"]["input"] * 1e6,
                                     "output": rates["rates"]["output"] * 1e6,
                                     "cacheRead": rates["rates"]["cacheRead"] * 1e6,
                                     "cacheWrite": rates["rates"]["cacheWrite"] * 1e6}}]}}}),
                encoding="utf-8")
            guard = {
                "budget": {"maxRequests": args.max_requests,
                           "maxTokens": args.max_requests * rates["requestTokens"],
                           "requestTokens": rates["requestTokens"],
                           "maxCostUsd": args.max_cost_usd,
                           "requestCostUsd": rates["requestCostUsd"]},
                "model": MODEL,
                "maxOutputTokens": MAX_OUTPUT_TOKENS,
                "requestsPath": str(out / "requests.jsonl"),
                "stopPath": str(out / "stop.json"),
                "promptPath": str(out / "effective-prompt.json"),
            }
            write_json(out / "guard.json", guard)

            with AppWorld(task_id=args.task, **defaults) as world:
                instruction = getattr(world, "instruction", None)
                if not isinstance(instruction, str) or not instruction:
                    instruction = str(getattr(getattr(world, "task", None), "instruction", ""))
                (out / "instruction.txt").write_text(instruction, encoding="utf-8")
                prompt = (
                    "Solve this AppWorld task using ONLY typed_program with "
                    "`import { api } from '@cap/appworld'` (program_details may inspect past runs). "
                    "Direct file and shell tools are disabled; do not attempt them.\n\n"
                    f"Task instruction: {instruction}\n\n"
                    "Work plan: read the supervisor active task and profile for account context; "
                    "if an API needs login, look up account credentials through supervisor APIs only; "
                    "query the needed app APIs; compute the answer inside the program. "
                    "Note: call payloads nest under a `response` key. "
                    "When you have the final answer, submit it with supervisor__complete_task "
                    "(concise answer, e.g. a title) and then reply with ONLY a ```json block "
                    "containing the answer value you submitted."
                )
                (out / "prompt.md").write_text(prompt, encoding="utf-8")

                cli = [bun_exe or "bun",
                       str(repo / "node_modules/@mariozechner/pi-coding-agent/dist/cli.js"),
                       "--provider", "openrouter", "--model", MODEL, "--thinking", "medium",
                       "--no-session", "--no-extensions", "--no-skills", "--no-prompt-templates",
                       "--mode", "json",
                       "-e", str(repo / "src/pi/extension.ts"),
                       "-e", str(repo / "examples/benchmark/guard.ts"),
                       "-p", prompt]
                env = dict(os.environ)
                env["PI_CODING_AGENT_DIR"] = str(profile)
                env["STRATA_CONFIG"] = str(out / "strata.json")
                env["STRATA_STRICT"] = "1"
                env["STRATA_BENCHMARK_GUARD"] = str(out / "guard.json")
                agent_exit: int | None = None
                try:
                    with open(out / "run.jsonl", "wb") as so, open(out / "stderr.log", "wb") as se:
                        proc = subprocess.run(cli, cwd=str(out), env=env,
                                              stdout=so, stderr=se, timeout=args.agent_timeout_s)
                    agent_exit = int(proc.returncode)
                except subprocess.TimeoutExpired:
                    (out / "agent.timeout").write_text(
                        f"agent timed out after {args.agent_timeout_s}s\n", encoding="utf-8")
                except OSError as exc:
                    (out / "agent.spawn_error").write_text(f"{exc}\n", encoding="utf-8")

                try:
                    world.save()
                except Exception as exc:  # noqa: BLE001 - must continue to grading
                    (out / "save_error.txt").write_text(f"{exc}\n", encoding="utf-8")
                tracker = world.evaluate()
                completed = bool(world.task_completed())
                result = {
                    "mode": "paid-dev",
                    "task": args.task,
                    "experiment": experiment,
                    "agentExit": agent_exit,
                    "completed": completed,
                    "passes": len(tracker.passes),
                    "failures": len(tracker.failures),
                    "pins": {"upstream": UPSTREAM_PIN, "model": MODEL,
                             "maxRequests": args.max_requests, "maxCostUsd": args.max_cost_usd},
                }
                write_json(out / "result.json", result)
                ok = bool(agent_exit == 0 and completed and len(tracker.failures) == 0)
                return 0 if ok else 1
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - record and exit nonzero, never fake healthy
        try:
            write_json(out / "failure.json", {"ok": False, "task": args.task, "error": str(exc)[:1500]})
        except OSError:
            pass
        print(f"driver failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
