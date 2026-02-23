# Day-1 Known Limitations

- Single-tenant only (`x-tenant-id` must match one configured tenant).
- Connector ingestion is fixture-backed for deterministic audit demo; OAuth token exchange endpoints are placeholders.
- LLM rationale is optional and schema-validated; current implementation uses deterministic stub output.
- Worker and API both include fallback inline execution when Redis queueing is unavailable.
- No write-back actions are implemented.
- Security hardening is limited to tenant header checks and audit logging for all routes.
