# Entitlements

Entitlements answer: what products and plan features can this user access?

Initial products:

- `nexa_ai`
- `nexa_browser`
- `nexa_cloud`
- `nexa_storage`
- `nexa_database`
- `nexa_ide`
- `nexa_gpu`

Plans are centralized in `PlanService`: Free, Plus, Pro, Premium, and Business. Product code should call Nexa Identity instead of hardcoding plan decisions.

Product services can call `POST /v1/entitlements/check-feature` with a feature name and optional product id.

Plans are publicly readable from `GET /v1/plans` so product UIs can render pricing/access state without duplicating plan IDs.
