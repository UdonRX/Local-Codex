# Free-only operating policy

This policy is a hard product requirement.

## Forbidden

- Paid AI APIs or metered endpoints.
- Paid model gateways.
- Required paid hosting or server runtime.
- Required subscription or membership.
- Automatic upgrade from free to paid.
- Automatic fallback to any provider that can bill the user.
- Any design that requires a credit card merely to keep the core product working.

## Allowed only after verification

- Local open-weight models and local inference engines.
- Provider free tiers that explicitly allow the intended use.
- Free static hosting.
- GitHub Actions within the current free allowance.
- Free public model downloads.

## Mandatory guardrails

- Provider allowlist; unknown providers are blocked.
- No billing-enabled endpoint is configured.
- Free quota is tracked conservatively.
- Stop cloud requests before the quota boundary, with a safety margin.
- If quota or pricing cannot be verified, disable that provider.
- When quota is exhausted, route to local inference or pause.
- No credit-card requirement is accepted as a default assumption.
- User can disable all cloud assistance with one switch.
- Show a clear cost state before each provider is enabled.

## Maintenance

Free plans and quotas can change. Re-check provider pricing, terms, privacy, and card requirements at implementation time and periodically thereafter. “Free today” must never be represented as “free forever.”
