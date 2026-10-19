# Blueprint: <feature name>

## Frame
- **Feature:** <one sentence of observable behavior>
- **Source:** <app / format / site / device, version, where the sample is>
- **Destination:** <user's app, stack, definition of done>

## Rights
- Rights: <own | open-source:<license> | interoperability | third-party behavior>
- Terms checked: <notes>
- Allowed depth: <full | format-level | behavior-only>
- Flags for review: <none | ...>

## Question checklist
| # | Question | Status (answered / partial / unresolved) | Ledger refs |
|---|---|---|---|
| 1 | | | |

## Behavior
### Trigger
<what starts the feature: user action, file upload, schedule, API call>

### Inputs
| Input | Format | Fields / structure | Units | Validation |
|---|---|---|---|---|

### Processing rules
<step-by-step behavior; formulas; decision tables. Mark each rule as
observed (from evidence), inferred, or user-defined policy.>

### Outputs
| Output | Format | Location / destination | Fields / structure |
|---|---|---|---|

### Edge cases and failures
- <case> → <expected behavior>

## Configuration (user's own rules)
```yaml
# parameters the user can change without code
```

## Acceptance tests
| # | Input | Expected output |
|---|---|---|

## Dependencies
| Library / service | Purpose | License | Version |
|---|---|---|---|

## Open questions and risks
- <question> — risk: <impact> — next step: <action>
