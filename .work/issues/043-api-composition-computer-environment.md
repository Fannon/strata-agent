# 043 — Compose remote services and local tools through typed functions

Status: hypothesis captured from user direction; no additional implementation selected
Dependencies: 037/042 application-composition evidence; 035 catalog scale; 039 only when a task requires REST beyond MCP

## Proposition

Typed composition may fit agents spanning many unfamiliar APIs/MCP tools and a programmable execution environment better than familiar local coding workflows. The environment includes a runtime such as Bun, CLI tools and filesystem operations used underneath TypeScript functions. This is code execution, not GUI/desktop automation.

Discover a small set of functions, call services, invoke local tools or read files through those functions, and combine their results in code. Local and remote functions can share an interface without sharing execution location or authority. Prefer existing contracts and generated clients; local adapters are legitimate when justified by a task, not categorically excluded by an MCP/REST-only direction.

## Validation path

The user's intended architectural goal is that every agent operation is expressible as a typed function, including CLI/filesystem work underneath. This does not authorize wrapping everything now: select operations from concrete tasks and measure the cost of supplying their contracts.

Counter-hypothesis: models may have a familiarity advantage with existing Bash/Linux tools over novel typed interfaces. Current trials cannot attribute losses to training familiarity rather than declaration volume, naming, semantics, validation or repair overhead. Preserve a capable ordinary scripting/CLI baseline. Record unfamiliar-name/argument mistakes and repair attempts as observations; any later causal test should separately vary interface familiarity while holding semantics, access and context budget as constant as practical. Do not add this ablation to the initial 042 pilot or claim knowledge of a model's training corpus.

037/042 first test service composition with local computation and simple-call controls. Compare against an agent with the same APIs, discovery and ordinary scripting abilities. Measure task completion, total cost/latency, integration effort and unauthorized effects. A large catalog alone is not evidence: equally lazy direct tools are the baseline. This issue records the broader hypothesis and does not create a competing pilot.

If a useful signal emerges, select a concrete workflow combining remote calls with local CLI/filesystem functions. Specify exact tools/resources and an independent outcome check before adding adapters. Measure this as an extension of the earlier experiment, not retroactive evidence that every transport helps.

Separate retrieval, business semantics, schema compatibility, local processing and effect-policy failures. A typed signature neither authorizes access nor makes writes reversible. Preserve default QuickJS for the initial comparison; direct Bun's ambient host access remains a separate executor question. Host adapters running local tools are not automatically inside the generated program's sandbox.

## Completion and decisions

Use 042's parity table and pilot to identify whether service composition earns its cost. Any later local-tool extension needs a justified task, baseline with equivalent abilities, documented execution/permission boundary and bounded experiment. No GUI automation, universal adapter framework or new sandbox is implied. Negative results can narrow or stop this direction.
