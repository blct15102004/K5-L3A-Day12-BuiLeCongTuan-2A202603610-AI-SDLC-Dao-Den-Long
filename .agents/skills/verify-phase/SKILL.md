---
name: verify-phase
description: End-to-end verification checklist before tagging or releasing any phase of Đảo Đèn Lồng. Run whenever code in src/ or game.contract.json is changed or before creating a phase tag.
---

# Verification Skill: verify-phase

Follow these steps strictly in order before declaring a phase complete or creating a git tag:

1. **Verify Browser Safety**:
   Confirm `src/core/` and `src/render/` contain zero `node:*` imports (e.g., `node:fs`, `node:path`) so the browser ES module UI works cleanly alongside Node headless mode.
2. **Verify Contract Synchronization**:
   Confirm `game.contract.json` (`contract_version` and every key in `tuning`) matches `TUNING` in `src/core/constants.js` identically.
3. **Run Automated Test Suite**:
   Execute `npm test` via `run_command` (sandboxed) and confirm exit code `0` with zero skipped or failing tests.
4. **Verify Determinism & Performance**:
   Confirm Night 1, 2, and 3 produce byte-identical JSONL outputs across repeated runs with the same seed, and that a full 21,600-tick Night 3 headless simulation finishes well under 30 seconds.
5. **Update Phase Proof Document**:
   Record actual observed command outputs, timing benchmarks, and requirement traceability in `docs/proof/phase-N-proof.md`. Never fabricate or extrapolate unrun outputs.
