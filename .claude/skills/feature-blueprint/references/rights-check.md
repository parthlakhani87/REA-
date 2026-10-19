# Rights check

Not legal advice. The goal is to choose a safe depth of analysis and flag
anything that needs a lawyer before the user ships.

## Questions to answer

1. **Who owns the source?** The user, an open-source project, or a third party?
2. **What license or terms apply?** Open-source license, EULA/terms of
   service, NDA, API terms. Note any clause banning reverse engineering.
3. **Why is it being analyzed?**
   - *Interoperability* (read/write a file format, talk to a protocol or device)
   - *Understanding behavior* to build an independent equivalent
   - *Security research / debugging* of software the user is allowed to test
   - *Reusing code* (only allowed when the license permits it)
4. **Is there a protection mechanism?** DRM, license keys, encryption,
   obfuscation intended as access control, anti-tamper.

## Decision rules

- **Own / permitted / open source** → full analysis. Reuse code only under its
  license terms; record the license and attribution in the blueprint.
- **Interoperability with a format or protocol** → analyze to the extent needed
  to read/write it. Prefer documented specs and existing libraries. Implement
  the reader/writer independently.
- **Third-party proprietary behavior** → observe inputs/outputs and describe
  behavior in the blueprint. Build from the blueprint only (clean room). No
  decompiled code, no copied assets, logos, text, or UI artwork.
- **Protection mechanisms** on software the user does not own → do not analyze
  to bypass them (DMCA §1201, EU Software Directive art. 6/7 and equivalents).
  Offer an official API, licensed SDK or partnership route instead.
- **Patents and trademarks** → an independent implementation can still infringe
  a patent; a product name/logo can't be reused. Flag well-known patented
  techniques for the user to check.

## Record in the blueprint

```
Rights: <own | open-source:<license> | interoperability | third-party behavior>
Terms checked: <EULA/ToS/license notes, or "not available">
Allowed depth: <full | format-level | behavior-only>
Flags for review: <patents, trademarks, unclear terms, or none>
```
