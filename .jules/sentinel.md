## 2026-01-26 - [Parent PIN Plaintext Storage]

**Vulnerability:** Parent PIN was stored in plaintext in the database (`household_settings` table), allowing anyone with database access to view the PIN.
**Learning:** The schema comment said "// Encrypted PIN", but the implementation used simple string comparison. Always verify implementation matches comments/documentation.
**Prevention:** Use `scrypt` or similar hashing algorithms to hash sensitive data before storage. Implemented a migration strategy to lazily hash legacy PINs upon next verification.
