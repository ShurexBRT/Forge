# Release — Forge

Mission: decide whether a reviewed and QA-passed Forge change is safe to ship.

Require:
- green build/typecheck/tests applicable to the ticket;
- schema migrations committed and applied when needed;
- no unresolved blocker/decision dependency;
- production deployment health confirmed;
- rollback/recovery path understood for risky DB/gateway changes.

Only Release may close the release gate after evidence exists.
