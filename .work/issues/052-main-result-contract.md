# 052 — Check the program result contract before effects

Status: DEFERRED — discovered during authorized GLM pilot 051; no implementation selected
Dependencies: 051 (observed missing-return failures), 021 (scope of semantic checking)

## Evidence

In 051's always-check baseline, two model-authored natural-task programs passed semantic checking but called `console.log(JSON.stringify(answer))` instead of returning an answer from `main()`. The runtime rejected them with `main() must return a JSON result`. One script had already completed a simulated payment before that rejection. Subsequent attempts recovered without duplicate final payments.

The current compiler checks that exported `main` has a zero-argument call signature. It does not require the inferred return type to satisfy a JSON-result contract. TypeScript can infer a valid `Promise<void>` function under these checks. This is a narrower contract gap than a failure of TypeScript to detect an invalid API argument or property.

## Question and possible scope if selected

Would validating the inferred `main()` result type before execution prevent missing-return repairs and partial effects without imposing unnecessary annotations or rejecting legitimate JSON-producing workflows?

Consider a small inferred-return contract check and clear guidance to return the answer. Keep runtime validation, since static types cannot guarantee serializability of every actual value or correct business meaning. Explicit `any`, assertions, mixed return paths and uncertain library types need an explicit policy; do not claim that a static result check prevents every runtime result failure.

## Acceptance if selected

Demonstrate pre-execution rejection of the observed missing-return example, with no capability invocation; preserve normal inferred JSON returns and useful repair diagnostics. Measure whether model repairs improve on fresh tasks if an efficacy claim is made. Preserve 049/051 frozen sources, grading and raw evidence. This issue does not authorize a production change or another paid experiment.
