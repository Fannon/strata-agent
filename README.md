# strata-agent

> **Work in progress — research proof of concept.** Strata is unfinished and is not intended for productive or production use.

Strata explores a simple idea: **what if an AI agent could use its tools as typed functions in a small program?**

An agent often needs to find information, make several related calls, and combine the results. Strata lets it express that work in TypeScript. The program can fetch data, filter it, and pass results between tools before returning a summary to the model. Types describe what each function accepts and returns, so some mistakes can be caught before anything runs.

The prototype is an extension for Pi, a coding agent. The broader research question applies to agents working with local tools and remote services.

## The idea: tools as functions

A command-line tool, an MCP tool (a tool exposed through the Model Context Protocol), and a REST API all offer operations an agent can call. Could they share a useful programming interface, even though they run in different places?

| Kind of operation | What a typed function could represent | Where the work happens |
| --- | --- | --- |
| Local tool or CLI | Search files, inspect Git history, run a project check | On the local machine, through an approved adapter |
| MCP tool | Query a service or invoke an operation described by its tool schema | In the connected tool server, locally or remotely |
| REST API | Fetch records or update an external application | In a remote service, through an API client |
| Local computation | Filter, join, sort or summarize the returned data | Inside the program's execution sandbox |

The hypothesis is that the agent could compose these functions without having to handle a different calling convention for each tool. Some functions would make remote calls; others would perform local work inside the sandbox. Access to files, processes and external services would still need explicit permissions.

The broader goal is that every operation available to the agent can be expressed as a typed function, including CLI and filesystem operations underneath. One risk is familiarity: models may already be better at established Bash/Linux workflows than at a new set of function names and schemas. Strata could lose that advantage while adding more definitions to read. This is a counter-hypothesis to test, not an established explanation of the results; comparisons must retain the baseline's ordinary CLI and scripting abilities.

The working hypothesis is that this tradeoff depends on familiarity: a typed wrapper may add friction for a tool the model already knows, yet provide useful structure for an unfamiliar API it must learn anyway. A uniform interface could also make entire workflows easier to compose, even when some individual calls become more expensive. A hybrid—typed functions alongside familiar shell tools—might work better still. Whether uniform composition outweighs the benefit of choosing between interfaces is an open research question.

That is the direction being explored, not a description of a finished universal tool system. Today, Strata has an MCP connection, a small CLI demonstration, and read-only repository tools. General REST integration and broad tool coverage remain ideas to investigate. In the current prototype, local tool adapters run in the trusted host; the generated program's computation runs in a restricted environment. This is not yet a hardened security sandbox.

## A small example

Suppose the agent needs to find large invoices for customers in Germany. It can write one program that gets the customers, fetches their invoices, and returns only the relevant fields:

```ts
import { api } from "@cap/fixture";

export async function main() {
  const { customers } = await api.customers({ country: "DE" });
  const { invoices } = await api.invoices({
    customerIds: customers.map((customer) => customer.id),
  });

  return invoices
    .filter((invoice) => invoice.amount > 10_000)
    .map((invoice) => ({ id: invoice.id, amount: invoice.amount }));
}
```

This example uses the included demonstration data. Intermediate customer and invoice records stay outside the model's conversation; the model sees the final result. If the program uses an invalid argument or a field that does not exist in the declared types, Strata can report that mistake before calling the tools. Inputs, outputs and permissions are also checked when calls run.

Types cannot tell the agent whether it chose the right business rule. They are only as useful as the underlying descriptions and schemas.

## What are we trying to find out?

The main question is whether this approach helps agents complete real tasks more reliably, cheaply or quickly. Fewer tool calls alone would not be enough: writing programs, reading type definitions and fixing errors also consume time and model context.

The research focuses on four questions:

- **Composition:** When does combining calls and processing data in a program beat individual tool calls or ordinary shell scripts?
- **Useful feedback:** Do type errors help agents correct mistakes before taking actions, enough to justify the extra machinery?
- **Discovery:** Could an agent find and load just the functions it needs from a large tool catalog, without reading every tool definition first?
- **Shared interfaces:** How much integration effort can existing MCP schemas and REST API descriptions save, and where do local tools still need custom adapters?

Comparisons need to give the alternatives equivalent access to data and tools. Ordinary agents can already write scripts, and direct tools can also be discovered on demand. Strata needs to earn its place against those alternatives.

## What we have learned so far

**The basic mechanism works.** The prototype can check programs, compose tool calls, reject invalid results, and process large responses before returning a small answer. The demonstration reduces roughly two megabytes of intermediate data to a few hundred bytes of output. That demonstrates local filtering, not an overall cost saving.

**The repository experiments have not shown an advantage.** On the tasks tested, typed programs used fewer agent tool calls but more model tokens and greater estimated cost than ordinary Pi. Shorter type descriptions helped in an initial experiment, but a follow-up did not confirm the improvement. There is no established overall win in task success, cost or speed. The [repository trial report](docs/repo-trials.md) contains the measurements and limitations.

**The application pilot also favored direct tools, but the comparison had a flaw.** Across six tasks repeated three times per approach, typed programs completed 9 of 18 attempts versus 15 for direct tools, at roughly four times the cost per success. We subsequently found that the two paths applied different response-validation settings: the typed path rejected some timestamps that the direct path accepted. The recorded result stays negative, but it does not cleanly isolate the value of typed composition. Correcting the mismatch may or may not improve the outcome. See the [pilot report and review](.work/issues/042-matched-application-comparison.md).

**Small tool-use diagnostics are encouraging, but narrow.** In a small BFCL-based exercise, the model selected functions, supplied arguments and abstained when no function fit. Corrected grading accepted all recorded calls, but some sessions stopped at a request limit. This was neither an official benchmark score nor a comparison proving Strata was better. See the [diagnostic report](docs/bfcl-diagnostic.md).

These results come from limited experiments, largely on one model. They leave room for a useful application, but also for a narrower outcome—or a well-supported conclusion that the added complexity does not pay off.

## Where the research could go

A more interesting fit may be agents with a programmable execution environment: a runtime such as Bun, CLI tools and filesystem access, combined with many APIs and MCP tools. For familiar local coding tasks, shell tools and ordinary scripts are already effective; Strata's extra type definitions and checking may not earn their cost. The repository experiments so far support that caution, without establishing that typed composition can never help coding agents.

With many unfamiliar services, the proposition changes: discover a small set of typed functions, call them from a program, and combine remote results with local work. A function might query an API, invoke a CLI tool or read a file; the program can then join responses, transform data and calculate an answer. The potential benefit comes from one composable interface over those different operations, backed by a general-purpose execution environment. Whether it earns its cost remains a research hypothesis. Execution location and filesystem, network and process permissions remain explicit design choices.

A promising setting may be an agent working across many unfamiliar business services. Existing API descriptions could supply the types; the agent could discover a few relevant functions, combine their results locally, and return an answer without filling its conversation with raw records. Whether that helps more than good direct tools remains an open question.

Possible directions include:

- **More tools through one interface:** explore typed functions for CLI operations, MCP tools and REST APIs, reusing existing schemas and generated clients where practical.
- **Local and remote composition:** combine remote service calls with local sandboxed computation, while keeping execution location and permissions explicit.
- **Larger catalogs:** discover a small relevant set of functions from many available operations, then measure discovery separately from program execution.
- **Changing contracts and permissions:** investigate how an agent recovers when an API changes or access is revoked between discovering a function and calling it.
- **Broader workflows:** consider edits, project checks and state across programs where real tasks demonstrate a need.

The next step is to make both tool paths apply the same validation rules and test that through the interfaces agents actually use. Only then can a new, bounded comparison tell us more. We have not yet tested whether selective discovery or substantially heavier local data processing earns the added cost; those possibilities need concrete tasks and fair baselines, not an assumption that larger workloads will produce a win. Larger catalog experiments come after that. These directions are research possibilities, not committed product features; the [issue board](.work/issues/index.md) records priorities and dependencies.

## Try the prototype

The local demonstration requires Bun and uses bundled test data; it needs no model API key or external service. Linux is the tested environment. Windows support remains limited.

```sh
git clone https://github.com/Fannon/strata-agent.git
cd strata-agent
bun install --frozen-lockfile
bun run check
bun test
bun run demo
```

To try the extension with a model, configure Pi's model credentials and run `bun run pi`. Model use may incur provider charges.

The [prototype guide](docs/prototype-guide.md) covers Pi usage, connecting an MCP server, configuration, tests and benchmark commands.

## Read further

- [How it works](docs/how-it-works.md) explains the execution flow.
- [Architecture](ARCHITECTURE.md) describes the implementation and its trust boundaries.
- [Architectural direction](ACD.md) develops the longer-term design.
- [Evaluation plan](docs/evaluation.md) explains how the hypotheses should be tested.
- [Related research](docs/research/typed-agent-prior-art.md) places the experiment alongside other tools-as-code approaches.
- [Issue board](.work/issues/index.md) and [handoff](docs/handoff.md) track ongoing work.

Plans and issues live in the tracked `.work/issues/` directory. Raw experiment transcripts, credentials, downloaded datasets and generated artifacts stay local.
