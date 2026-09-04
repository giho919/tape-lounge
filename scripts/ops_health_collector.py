#!/usr/bin/env python3
"""Publish a low-priority server and trading-bot health snapshot to Supabase."""

from __future__ import annotations

import argparse
import base64
import json
import math
import os
import shutil
import socket
import subprocess
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


PUBLISH_URL = os.getenv(
    "TAPE_OPS_HEALTH_PUBLISH_URL",
    "https://mmvhyzajmfkilldxxazs.supabase.co/functions/v1/ops-health-publish",
)
SIGNING_KEY = Path(
    os.getenv(
        "TAPE_OPS_HEALTH_SIGNING_KEY",
        "/home/shyoo/.config/tape-lounge/lounge-crew-signing-key.pem",
    )
)
BITHUMB_STATUS = Path(
    os.getenv(
        "BITHUMB_SIGNAL_STATUS_PATH",
        "/home/shyoo/mirage/user_data/state/bithumb_signal_executor.json",
    )
)
VERSION = "1.0"


def iso_time(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")


def command(args: list[str], timeout: float = 8) -> str | None:
    try:
        result = subprocess.run(args, capture_output=True, text=True, timeout=timeout, check=False)
    except (OSError, subprocess.SubprocessError):
        return None
    return result.stdout.strip() if result.returncode == 0 else None


def systemd_properties(unit: str, *, user: bool = True) -> dict[str, str]:
    args = ["systemctl"]
    if user:
        args.append("--user")
    args.extend([
        "show", unit, "-p", "ActiveState", "-p", "SubState", "-p", "Result",
        "-p", "ExecMainStatus", "-p", "NextElapseUSecRealtime",
    ])
    output = command(args) or ""
    return dict(line.split("=", 1) for line in output.splitlines() if "=" in line)


def failed_units(*, user: bool) -> list[str]:
    args = ["systemctl"]
    if user:
        args.append("--user")
    args.extend(["--failed", "--no-legend", "--plain"])
    output = command(args) or ""
    return [line.split()[0] for line in output.splitlines() if line.split()]


def cpu_counters(path: Path = Path("/proc/stat")) -> tuple[int, int]:
    values = [int(value) for value in path.read_text().splitlines()[0].split()[1:]]
    return sum(values), values[3] + values[4]


def cpu_percentage(before: tuple[int, int], after: tuple[int, int]) -> float:
    total = after[0] - before[0]
    idle = after[1] - before[1]
    if total <= 0:
        return 0.0
    return max(0.0, min(100.0, (1 - idle / total) * 100))


def root_block_stat() -> tuple[str, tuple[int, int, int]] | None:
    device = os.stat("/").st_dev
    stat_path = Path(f"/sys/dev/block/{os.major(device)}:{os.minor(device)}/stat")
    try:
        values = [int(value) for value in stat_path.read_text().split()]
        return stat_path.resolve().parent.name, (values[2], values[6], values[9])
    except (OSError, ValueError, IndexError):
        return None


def disk_rates(
    before: tuple[int, int, int], after: tuple[int, int, int], elapsed: float,
) -> tuple[float, float, float]:
    if elapsed <= 0:
        return 0.0, 0.0, 0.0
    read_kbps = max(0, after[0] - before[0]) * 0.5 / elapsed
    write_kbps = max(0, after[1] - before[1]) * 0.5 / elapsed
    busy_pct = max(0.0, min(100.0, (after[2] - before[2]) / (elapsed * 10)))
    return read_kbps, write_kbps, busy_pct


def sample_activity(interval: float = 0.25) -> dict[str, Any]:
    cpu_before = cpu_counters()
    disk_before = root_block_stat()
    started = time.monotonic()
    time.sleep(interval)
    elapsed = time.monotonic() - started
    cpu_after = cpu_counters()
    disk_after = root_block_stat()
    result: dict[str, Any] = {"cpu_usage_pct": round(cpu_percentage(cpu_before, cpu_after), 2)}
    if disk_before and disk_after and disk_before[0] == disk_after[0]:
        read_kbps, write_kbps, busy_pct = disk_rates(disk_before[1], disk_after[1], elapsed)
        result.update({
            "disk_device": disk_after[0],
            "disk_read_kbps": round(read_kbps, 2),
            "disk_write_kbps": round(write_kbps, 2),
            "disk_busy_pct": round(busy_pct, 2),
        })
    else:
        result.update({
            "disk_device": None,
            "disk_read_kbps": None,
            "disk_write_kbps": None,
            "disk_busy_pct": None,
        })
    return result


def memory_metrics(path: Path = Path("/proc/meminfo")) -> dict[str, int]:
    values: dict[str, int] = {}
    for line in path.read_text().splitlines():
        name, raw = line.split(":", 1)
        values[name] = int(raw.strip().split()[0])
    return {
        "memory_total_mb": values["MemTotal"] // 1024,
        "memory_available_mb": values["MemAvailable"] // 1024,
        "swap_total_mb": values["SwapTotal"] // 1024,
        "swap_used_mb": max(0, values["SwapTotal"] - values["SwapFree"]) // 1024,
    }


def cpu_temperature() -> float | None:
    candidates: list[tuple[int, float]] = []
    for input_path in Path("/sys/class/hwmon").glob("hwmon*/temp*_input"):
        try:
            value = float(input_path.read_text().strip()) / 1000
            label_path = input_path.with_name(input_path.name.replace("_input", "_label"))
            label = label_path.read_text().strip().lower() if label_path.exists() else ""
            priority = 2 if "package" in label else 1 if "core" in label else 0
            if -50 <= value <= 150:
                candidates.append((priority, value))
        except (OSError, ValueError):
            continue
    if not candidates:
        return None
    highest_priority = max(item[0] for item in candidates)
    return round(max(value for priority, value in candidates if priority == highest_priority), 2)


def optional_number(value: str) -> float | None:
    try:
        number = float(value.strip())
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def gpu_metrics() -> dict[str, Any]:
    output = command([
        "nvidia-smi",
        "--query-gpu=name,temperature.gpu,utilization.gpu,memory.used,memory.total,power.draw",
        "--format=csv,noheader,nounits",
    ], timeout=5)
    if not output:
        return {"present": False}
    values = [item.strip() for item in output.splitlines()[0].split(",")]
    if len(values) != 6:
        return {"present": False}
    return {
        "present": True,
        "name": values[0][:80],
        "temperature_c": optional_number(values[1]),
        "utilization_pct": optional_number(values[2]),
        "memory_used_mb": optional_number(values[3]),
        "memory_total_mb": optional_number(values[4]),
        "power_w": optional_number(values[5]),
    }


def last_heartbeat() -> datetime | None:
    output = command([
        "journalctl", "--user", "-u", "freqtrade-btc-paxg.service",
        "-g", "Bot heartbeat", "-n", "1", "-o", "json", "--no-pager",
    ])
    if not output:
        return None
    try:
        item = json.loads(output.splitlines()[-1])
        return datetime.fromtimestamp(int(item["__REALTIME_TIMESTAMP"]) / 1_000_000, timezone.utc)
    except (KeyError, TypeError, ValueError, json.JSONDecodeError):
        return None


def read_bithumb_status() -> dict[str, Any] | None:
    try:
        value = json.loads(BITHUMB_STATUS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return None
    return value if isinstance(value, dict) else None


def kubernetes_summary() -> dict[str, Any]:
    output = command(["kubectl", "get", "pods", "-A", "-o", "json"], timeout=10)
    if not output:
        return {"available": False, "total": 0, "ready": 0, "unhealthy": 0, "restarts": 0}
    try:
        items = json.loads(output).get("items", [])
    except (AttributeError, json.JSONDecodeError):
        return {"available": False, "total": 0, "ready": 0, "unhealthy": 0, "restarts": 0}
    ready = 0
    restarts = 0
    unhealthy_names: list[str] = []
    for item in items:
        statuses = item.get("status", {}).get("containerStatuses") or []
        pod_ready = item.get("status", {}).get("phase") == "Running" and bool(statuses) and all(
            status.get("ready") is True for status in statuses
        )
        restarts += sum(int(status.get("restartCount") or 0) for status in statuses)
        if pod_ready:
            ready += 1
        else:
            namespace = item.get("metadata", {}).get("namespace", "?")
            name = item.get("metadata", {}).get("name", "?")
            unhealthy_names.append(f"{namespace}/{name}"[:120])
    return {
        "available": True,
        "total": len(items),
        "ready": ready,
        "unhealthy": len(items) - ready,
        "restarts": restarts,
        "unhealthy_names": unhealthy_names[:10],
    }


def integer_property(properties: dict[str, str], name: str) -> int | None:
    try:
        return int(properties.get(name, ""))
    except ValueError:
        return None


def account_alignment(status: dict[str, Any] | None, index: int) -> bool | None:
    if not status:
        return None
    accounts = status.get("accounts")
    if not isinstance(accounts, list) or index >= len(accounts) or not isinstance(accounts[index], dict):
        return None
    value = accounts[index].get("aligned")
    return value if isinstance(value, bool) else None


def assess_health(health: dict[str, Any]) -> tuple[str, list[str]]:
    critical: list[str] = []
    degraded: list[str] = []
    details = health["details"]
    if not health["main_bot_ok"]:
        critical.append("main_bot_unhealthy")
    if not health["bithumb_timer_ok"]:
        critical.append("bithumb_timer_unhealthy")
    if health["bithumb_last_exit_code"] not in (0, None):
        critical.append("bithumb_executor_failed")
    for index, value in enumerate((health["bithumb_account_1_aligned"], health["bithumb_account_2_aligned"]), 1):
        if value is not True:
            critical.append(f"bithumb_account_{index}_not_aligned")
    if details["bithumb"].get("status_error"):
        critical.append("bithumb_status_error")
    status_age = details["bithumb"].get("status_age_seconds")
    if status_age is None or status_age > 900:
        critical.append("bithumb_status_stale")
    if health["root_disk_used_pct"] >= 90:
        critical.append("root_disk_critical")
    elif health["root_disk_used_pct"] >= 80:
        degraded.append("root_disk_high")
    if health["memory_available_mb"] < 512:
        critical.append("memory_critical")
    elif health["memory_available_mb"] < 2048:
        degraded.append("memory_low")
    for name in ("cpu_temp_c", "gpu_temp_c"):
        value = health.get(name)
        if value is not None and value >= 85:
            critical.append(f"{name}_critical")
        elif value is not None and value >= 75:
            degraded.append(f"{name}_high")
    if health["cpu_usage_pct"] >= 95:
        degraded.append("cpu_saturated")
    if health.get("disk_busy_pct") is not None and health["disk_busy_pct"] >= 90:
        degraded.append("disk_busy")
    if details["kubernetes"].get("available") and details["kubernetes"].get("unhealthy", 0) > 0:
        degraded.append("kubernetes_pods_unhealthy")
    if details["services"].get("tape-market-recorder.service") != "active":
        degraded.append("market_recorder_unhealthy")
    issues = critical + degraded
    return ("critical" if critical else "degraded" if degraded else "healthy"), issues


def collect_health(now: datetime | None = None) -> dict[str, Any]:
    now = now or datetime.now(timezone.utc)
    host = socket.gethostname()[:63]
    activity = sample_activity()
    memory = memory_metrics()
    root = shutil.disk_usage("/")
    root_used_pct = round((root.total - root.free) / root.total * 100, 2)
    gpu = gpu_metrics()

    main = systemd_properties("freqtrade-btc-paxg.service")
    heartbeat = last_heartbeat()
    heartbeat_age = (now - heartbeat).total_seconds() if heartbeat else None
    main_ok = main.get("ActiveState") == "active" and heartbeat_age is not None and heartbeat_age <= 180

    bithumb_timer = systemd_properties("bithumb-signal-executor.timer")
    bithumb_service = systemd_properties("bithumb-signal-executor.service")
    bithumb_status = read_bithumb_status()
    checked_at: datetime | None = None
    if bithumb_status and isinstance(bithumb_status.get("checked_at"), str):
        try:
            checked_at = datetime.fromisoformat(bithumb_status["checked_at"].replace("Z", "+00:00"))
        except ValueError:
            pass
    status_age = (now - checked_at).total_seconds() if checked_at else None
    signal = bithumb_status.get("signal") if bithumb_status and isinstance(bithumb_status.get("signal"), dict) else {}

    services = {
        unit: systemd_properties(unit).get("ActiveState", "unknown")
        for unit in ("tape-market-recorder.service", "dropbox.service", "airflow-pf.service", "code-server.service")
    }
    kubernetes = kubernetes_summary()
    accounts: list[dict[str, Any]] = []
    if bithumb_status and isinstance(bithumb_status.get("accounts"), list):
        for account in bithumb_status["accounts"][:2]:
            if isinstance(account, dict):
                accounts.append({
                    "name": str(account.get("name", ""))[:20],
                    "target": account.get("target"),
                    "aligned": account.get("aligned"),
                    "action": str(account.get("action", ""))[:80],
                    "error": bool(account.get("error")),
                })

    observed = iso_time(now)
    health: dict[str, Any] = {
        "sample_key": f"{host.lower()}:{int(now.timestamp()) // 300}",
        "observed_at": observed,
        "host_name": host,
        "overall_status": "healthy",
        "uptime_seconds": int(float(Path("/proc/uptime").read_text().split()[0])),
        "load_1m": round(os.getloadavg()[0], 3),
        "cpu_usage_pct": activity["cpu_usage_pct"],
        "memory_available_mb": memory["memory_available_mb"],
        "swap_used_mb": memory["swap_used_mb"],
        "root_disk_used_pct": root_used_pct,
        "disk_read_kbps": activity["disk_read_kbps"],
        "disk_write_kbps": activity["disk_write_kbps"],
        "disk_busy_pct": activity["disk_busy_pct"],
        "cpu_temp_c": cpu_temperature(),
        "gpu_temp_c": gpu.get("temperature_c"),
        "gpu_util_pct": gpu.get("utilization_pct"),
        "main_bot_ok": main_ok,
        "main_bot_heartbeat_at": iso_time(heartbeat) if heartbeat else None,
        "signal_candle": signal.get("candle") if isinstance(signal.get("candle"), str) else None,
        "signal_regime": signal.get("regime") if signal.get("regime") in ("RISK_ON", "RISK_OFF") else None,
        "signal_target": signal.get("target") if signal.get("target") in ("ETH", "USDT") else None,
        "bithumb_timer_ok": bithumb_timer.get("ActiveState") == "active",
        "bithumb_last_exit_code": integer_property(bithumb_service, "ExecMainStatus"),
        "bithumb_account_1_aligned": account_alignment(bithumb_status, 0),
        "bithumb_account_2_aligned": account_alignment(bithumb_status, 1),
        "issues": [],
        "details": {
            "collector_version": VERSION,
            "server": {
                "memory_total_mb": memory["memory_total_mb"],
                "swap_total_mb": memory["swap_total_mb"],
                "root_disk_available_gb": round(root.free / 1024 ** 3, 2),
                "disk_device": activity["disk_device"],
                "failed_system_units": failed_units(user=False)[:20],
                "failed_user_units": failed_units(user=True)[:20],
            },
            "gpu": gpu,
            "main_bot": {
                "active_state": main.get("ActiveState"),
                "sub_state": main.get("SubState"),
                "result": main.get("Result"),
                "exec_main_status": integer_property(main, "ExecMainStatus"),
                "heartbeat_age_seconds": round(heartbeat_age, 1) if heartbeat_age is not None else None,
            },
            "bithumb": {
                "timer_state": bithumb_timer.get("ActiveState"),
                "next_run": bithumb_timer.get("NextElapseUSecRealtime") or None,
                "service_result": bithumb_service.get("Result"),
                "status_age_seconds": round(status_age, 1) if status_age is not None else None,
                "status_error": bithumb_status.get("error") if bithumb_status else "status_unavailable",
                "accounts": accounts,
            },
            "services": services,
            "kubernetes": kubernetes,
        },
    }
    health["overall_status"], health["issues"] = assess_health(health)
    return health


def publish(health: dict[str, Any], signing_key: Path = SIGNING_KEY) -> None:
    if not signing_key.is_file():
        raise RuntimeError(f"signing key not found: {signing_key}")
    timestamp = int(time.time())
    body = json.dumps(
        {"timestamp": timestamp, "health": health},
        ensure_ascii=False,
        separators=(",", ":"),
    ).encode()
    signature = subprocess.run(
        ["openssl", "dgst", "-sha256", "-sign", str(signing_key)],
        input=body,
        capture_output=True,
        check=True,
        timeout=10,
    ).stdout
    request = urllib.request.Request(
        PUBLISH_URL,
        data=body,
        headers={
            "content-type": "application/json",
            "accept": "application/json",
            "user-agent": "Tape-Ops-Health/1.0",
            "x-ops-timestamp": str(timestamp),
            "x-ops-signature": base64.b64encode(signature).decode(),
        },
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=20) as response:
        result = json.load(response)
    if result.get("ok") is not True:
        raise RuntimeError("ops health publisher rejected the snapshot")


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", help="collect and print without publishing")
    args = parser.parse_args(argv)
    health = collect_health()
    if args.dry_run:
        print(json.dumps(health, ensure_ascii=False, indent=2, sort_keys=True))
        return 0
    publish(health)
    print(json.dumps({
        "sample_key": health["sample_key"],
        "overall_status": health["overall_status"],
        "issues": health["issues"],
    }, ensure_ascii=False, separators=(",", ":")))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
