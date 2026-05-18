# TODO

- [ ] Inspect current request/response shape used by frontend for `/api/v1/calculations`.
- [ ] Add helper functions in `backend/server.ts` to find nearest compute/storage equivalents by (vcpu + memory) distance per provider.
- [ ] Implement new endpoint `POST /api/v1/calculations/multicloud-compare` that mirrors compute+storage mapping accuracy logic.
- [ ] Persist the new calculation in `calculations` table with `pricing_model`/metadata.
- [ ] Return `provider_breakdowns` + `cheapest_provider` + monthly/annual totals.
- [ ] Run TypeScript build / lint and do a quick runtime smoke check.

