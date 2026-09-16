"""AppWorld offline-compatibility controller (issue037 spike).

Owns no framework code. Launches the bun replay harness against a fresh
upstream AppWorld world, then grades with the upstream state grader.
All artifacts stay local under the repo .work/appworld tree.
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


UPSTREAM_PIN = "42b5bcf3cd334fee33f0c37c02070a9f5807add5"
APPWORLD_VERSION = "0.2.0.dev0"
APPWORLD_DATA_VERSION = "0.2.0"
MCP_VERSION = "2.2.0"
PYTHON_VERSION = "3.11"


def _repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def _is_within(child: Path, parent: Path) -> bool:
    try:
        child.relative_to(parent)
        return True
    except ValueError:
        return False


def parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="AppWorld spike controller")
    parser.add_argument("--task", required=True, help="AppWorld task id")
    parser.add_argument("--program", default=None, help="Local TS program for run mode")
    parser.add_argument("--inspect", action="store_true", help="Inspect mode (no program run)")
    parser.add_argument("--root", default=None, help="AppWorld root (default <repo>/.work/appworld)")
    parser.add_argument("--out", required=True, help="New local artifact dir under .work/appworld")
    parser.add_argument("--experiment", default=None, help="Experiment name (generated if omitted)")
    parser.add_argument("--apps", default="supervisor,spotify", help="Comma-separated app names")
    parser.add_argument("--python", default=None,
                        help="Interpreter for the MCP server child "
                             "(default <root>/venv/bin/python; e.g. a platform venv elsewhere)")
    parser.add_argument("--direct-script", default=None,
                        help="Canned direct-call JSON script for reference-arm mode "
                             "(mutually exclusive with --program)")
    return parser.parse_args(argv)


def write_json(path: Path, payload: dict) -> None:
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def main(argv: list[str] | None = None) -> int:
    args = parse_args(sys.argv[1:] if argv is None else argv)
    repo = _repo_root()
    base = repo / ".work" / "appworld"

    root = Path(args.root).resolve() if args.root else base.resolve()
    out = Path(args.out).resolve()
    base_resolved = base.resolve()

    # Validate locality before creating anything.
    if not _is_within(root, base_resolved) or not _is_within(out, base_resolved):
        print(f"root and out must resolve under {base_resolved}", file=sys.stderr)
        return 2
    if out.exists():
        print(f"refusing to overwrite existing out dir: {out}", file=sys.stderr)
        return 2

    apps = [a.strip() for a in str(args.apps).split(",") if a.strip()]
    if not apps:
        print("at least one app name is required", file=sys.stderr)
        return 2

    experiment = args.experiment or (
        "exp_%s_%d" % (datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ"), os.getpid())
    )
    # Never reuse an existing experiment dir.
    exp_path = root / experiment
    if exp_path.exists():
        print(f"refusing to reuse existing experiment dir: {exp_path}", file=sys.stderr)
        return 2

    program: Path | None = None
    if args.program:
        program = Path(args.program).resolve()
        if not program.is_file():
            print(f"program not found: {program}", file=sys.stderr)
            return 2

    direct_script: Path | None = None
    if args.direct_script:
        if args.program:
            print("--program and --direct-script are mutually exclusive", file=sys.stderr)
            return 2
        if args.inspect:
            print("--inspect and --direct-script are mutually exclusive", file=sys.stderr)
            return 2
        direct_script = Path(args.direct_script).resolve()
        if not direct_script.is_file():
            print(f"direct script not found: {direct_script}", file=sys.stderr)
            return 2
        if not _is_within(direct_script, repo):
            print(f"direct script must resolve under {repo}", file=sys.stderr)
            return 2

    # Interpreter for the MCP server child. Default is the Linux venv path;
    # --python overrides it (e.g. a Windows platform venv). The path MUST
    # stay unresolved: venv/bin/python is a symlink, and resolving it loses
    # the venv (CPython finds pyvenv.cfg by walking up from the executable
    # path). A resolved path boots a bare interpreter without appworld/mcp
    # installed, which kills the MCP child instantly with ModuleNotFoundError
    # (seen as MCP -32000 Connection closed). Absolute but unresolved keeps
    # venv site-packages active.
    venv_python = os.path.abspath(args.python) if args.python else os.path.abspath(
        os.path.join(root, "venv", "bin", "python"))
    if Path(os.path.abspath(sys.executable)) != Path(venv_python):
        print(
            f"warning: current interpreter {sys.executable} != venv python {venv_python}",
            file=sys.stderr,
        )

    # The repository's Bun executable, resolved absolutely so the replay
    # does not depend on the caller's PATH layout.
    bun_exe = shutil.which("bun")
    if not bun_exe:
        print("bun executable not found on PATH; start from an environment with bun installed", file=sys.stderr)
        return 2

    out.mkdir(parents=True, exist_ok=False)
    mode = "inspect" if args.inspect else ("direct" if direct_script is not None else "run")

    # Environment must be set before any appworld import.
    os.environ["APPWORLD_ROOT"] = str(root)
    os.environ["APPWORLD_CACHE"] = str(root / "cache")

    try:
        from appworld import AppWorld
        from appworld.environment import AppWorldServers
    except Exception as exc:
        write_json(out / "failure.json", {"ok": False, "mode": mode, "task": args.task, "error": f"appworld import failed: {exc}"})
        return 1

    try:
        with AppWorldServers(experiment_name=experiment, remote_apis_port="{port}") as servers:
            defaults = dict(servers.defaults)
            remote_apis_url = str(defaults.get("remote_apis_url", ""))
            if not remote_apis_url:
                raise RuntimeError("AppWorldServers.defaults missing remote_apis_url")
            config = {
                "root": str(root),
                "python": venv_python,
                "remoteApisUrl": remote_apis_url,
                "apps": apps,
                "artifactDir": str(out),
                # 040 boundary policy, shared verbatim by both 042 arms.
                "outputCompatibility": {"acceptNaiveDateTime": True},
            }
            if program is not None:
                config["program"] = str(program)
            if direct_script is not None:
                config["directScript"] = str(direct_script)
                # Parity runs persist structured results (incl. world tokens)
                # to local ignored artifacts for arm comparison.
                config["persistResults"] = True
            write_json(out / "config.json", config)

            with AppWorld(task_id=args.task, **defaults) as world:
                # Save the task instruction separately for local debugging.
                # Never serialize ground_truth or direct DB state.
                try:
                    instruction = getattr(world, "instruction", None)
                    if instruction is None:
                        instruction = getattr(getattr(world, "task", None), "instruction", None)
                    if isinstance(instruction, str) and instruction:
                        (out / "instruction.txt").write_text(instruction, encoding="utf-8")
                except OSError:
                    pass

                harness = "direct.ts" if mode == "direct" else "replay.ts"
                replay_argv = [bun_exe, str(repo / "examples" / "appworld" / harness),
                               "--config", str(out / "config.json")]
                if args.inspect:
                    replay_argv.append("--inspect")
                env = dict(os.environ)
                env["APPWORLD_ROOT"] = str(root)
                env["APPWORLD_CACHE"] = str(root / "cache")
                replay_exit: int | None = None
                try:
                    with open(out / "replay.stdout.log", "wb") as so, open(out / "replay.stderr.log", "wb") as se:
                        proc = subprocess.run(replay_argv, cwd=str(repo), env=env,
                                              stdout=so, stderr=se, timeout=120)
                    replay_exit = int(proc.returncode)
                except subprocess.TimeoutExpired:
                    replay_exit = None
                    (out / "replay.timeout").write_text("replay timed out after 120s\n", encoding="utf-8")
                except OSError as exc:
                    replay_exit = None
                    (out / "replay.spawn_error").write_text(f"{exc}\n", encoding="utf-8")
                replay_ok = replay_exit == 0

                # Always sync API-server state so evaluate() sees replay effects.
                try:
                    world.save()
                except Exception as exc:  # noqa: BLE001 - must continue to grading
                    (out / "save_error.txt").write_text(f"{exc}\n", encoding="utf-8")

                tracker = world.evaluate()
                completed = bool(world.task_completed())
                result = {
                    "mode": mode,
                    "task": args.task,
                    "experiment": experiment,
                    "replayExit": replay_exit,
                    "replayOk": replay_ok,
                    "completed": completed,
                    "passes": len(tracker.passes),
                    "failures": len(tracker.failures),
                    "pins": {
                        "upstream": UPSTREAM_PIN,
                        "appworld": APPWORLD_VERSION,
                        "data": APPWORLD_DATA_VERSION,
                        "mcp": MCP_VERSION,
                        "python": f"{sys.version_info.major}.{sys.version_info.minor}",
                        "python_full": sys.version.split()[0],
                    },
                }
                write_json(out / "result.json", result)

                if args.inspect:
                    ok = replay_ok
                elif mode == "direct":
                    # Reference-arm parity scripts are read-only and never
                    # submit complete_task; harness success means every
                    # scripted call validated. Grader aggregates are still
                    # recorded for the parity table.
                    ok = replay_ok
                else:
                    ok = bool(replay_ok and completed and len(tracker.failures) == 0)
                return 0 if ok else 1
    except SystemExit:
        raise
    except Exception as exc:  # noqa: BLE001 - record and exit nonzero, never fake healthy
        try:
            write_json(out / "failure.json", {"ok": False, "mode": mode, "task": args.task,
                                              "experiment": experiment, "error": str(exc)[:1500]})
        except OSError:
            pass
        print(f"controller failed: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
