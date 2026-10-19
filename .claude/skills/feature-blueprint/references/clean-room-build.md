# Clean-room build

Build the feature from the blueprint, in the user's own design.

## Separation

- The implementation is written from `blueprint.md` only. Don't paste or
  paraphrase decompiled code, minified bundles or proprietary source.
- Use the user's naming, architecture and stack. Matching the *behavior* is the
  goal; matching internal structure is not.
- Licensed open-source components may be used as dependencies under their
  license; record them in the blueprint with license and version.

## Build order

1. **Acceptance tests** from the blueprint's input → output pairs.
2. **Data layer**: parsers/readers for the input formats; validators that
   reject or warn on bad input instead of producing wrong output.
3. **Rules engine**: the user's business logic as configuration
   (`rules.yaml` / JSON / admin screen) loaded at runtime, with defaults and
   units stated.
4. **Outputs**: documents, drawings, files, API responses.
5. **UI / integration**: upload, preview/confirm step for anything the system
   detected automatically, export.

## Verification

- Run the acceptance tests and any real sample files.
- Compare against the original where permitted (same input, compare outputs);
  log differences in the findings ledger as fixed, accepted, or open.
- Anything safety- or compliance-related (electrical, structural, medical,
  financial, legal) is output as a **draft for qualified review**.

## Final report

- What was built and where (paths).
- Checklist status: answered / partially answered / unresolved.
- Known limits, open risks, and the next step for each.
