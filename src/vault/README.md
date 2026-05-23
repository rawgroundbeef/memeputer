vault/ — VENDORED COPIES of memeputer_vault on-chain artifacts

DO NOT EDIT BY HAND. These two files are vendored copies of the canonical
on-chain program artifacts emitted by `anchor build` and committed in
Plan 03:

- `idl.json`            ← `programs/memeputer_vault/idl/memeputer_vault.json`
- `memeputer-vault.ts`  ← `programs/memeputer_vault/types/memeputer_vault.ts`

They live inside `packages/sdk/src/` so the published `memeputer` npm
package self-contains them — consumers do not need to depend on the
monorepo's `programs/` tree. tsup bundles the JSON via the
`with { type: 'json' }` import attribute and the TS types are
erased at compile time.

To resync after a new `anchor build` (Plan 03 deploy runbook handles this):

  cp programs/memeputer_vault/idl/memeputer_vault.json packages/sdk/src/vault/idl.json
  cp programs/memeputer_vault/types/memeputer_vault.ts packages/sdk/src/vault/memeputer-vault.ts

A CI gate (Plan 08 DEPLOY-RUNBOOK) verifies these two files match the
canonical source before publishing the SDK to npm. If they drift, the
publish workflow fails with a clear "vault IDL out of sync" message.

Why vendor instead of importing from `../../../programs/`:

1. Path resolution from `packages/sdk/src/rooms.ts` would require widening
   `rootDir` in `packages/sdk/tsconfig.json` to repo root — feasible but
   leaks repo-relative paths into the published `dist/` source-maps.
2. The published SDK MUST contain the IDL so consumers can construct an
   Anchor `Program` against it; vendoring is the simplest way to ensure
   the bundle includes the JSON.
3. Drift detection lives in CI (one-line `diff` check), so the cost of
   vendoring is bounded by the trivial sync script.
