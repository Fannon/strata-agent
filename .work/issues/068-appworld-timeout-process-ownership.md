# 068 — Own detached AppWorld server processes on hard timeout

Status: DEFERRED implementation. Discovered in final cleanup for authorized 065; that campaign's orphaned processes were stopped.
Dependencies: `examples/benchmark/process.ts`, `examples/application/controller.py`, upstream AppWorld BackgroundServer process behavior.

065's outer process-group kill terminated the timed-out controller/agent but left two AppWorld API-server parent/child pairs running in separate groups. Original local ports 60295 and 60360 identified the owned processes. The frozen controller's claim that the outer driver owns the whole server tree is too broad for these detached servers.

Before cleanup, saved their original database states and recovered upstream/full-row grades without restarting agents or making model calls. Both tasks were incomplete/wrong, with unchanged domain state. Primary failures remain; elapsed times and one request's usage remain unavailable. Snapshots and original result/accounting records stay ignored. `examples/benchmark/recover-application.py` and the complete audit replay the recovered grades.

If selected, explicitly track/terminate the detached server groups or provide graceful controller cleanup before hard kill, including startup and timeout races. Verify no owned API/MCP processes survive a forced timeout and preserve grading/evidence where feasible. Do not rely on killing only the controller's group. No process-supervision implementation or paid follow-up is selected by this capture.
