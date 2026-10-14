# Contracts ownership

This workspace reserves the canonical language-neutral schema, shared configuration and compatibility-fixture boundary settled in [decision #15](https://github.com/shivang991/DashDevil2D/issues/15#issuecomment-6144509055). It exports no runtime API yet.

#25 introduces configuration definitions; #27 introduces protocol schemas, mechanical Go/TypeScript generation, fixtures and stale-generated-output checks. Generated Go packages stay inside `apps/server`’s native module. Implement those real checks before claiming them available; the root generation task dependencies already establish ordering. Shared packages must never import applications.
