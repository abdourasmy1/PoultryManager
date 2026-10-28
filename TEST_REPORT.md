# Verification report

Environment: isolated Linux sandbox, 27 October 2026. Tests use temporary SQLite databases and browser contexts. **Test business data is not shipped or seeded into the application.**

## Checks executed

| Check | Result | Evidence |
|---|---|---|
| TypeScript strict check | PASSED | `npm run typecheck` / `tsc --noEmit` |
| Automated accounting and license tests | PASSED | `npm test`: 13 tests, 13 passed, 0 failed |
| Web, Android and iOS JS/asset export | PASSED | `npm run build`, using `expo export --platform all` |
| Browser startup, desktop and phone | PASSED | Chromium smoke test; no uncaught page errors |
| End-to-end supplier → purchase → customer → sale → expense | PASSED | Actual UI entry, live totals and inventory assertions |
| Browser reload persistence | PASSED | Entered financial data survives page reload |
| CSV export and SQLite backup download | PASSED | Download events and filenames verified |
| Business settings and dark/light appearance | PASSED | Saved name, switched themes in browser |
| Mobile bottom-tab sales navigation | PASSED | 390px viewport, invoice visible |
| Offline browser reload | PASSED | Service worker activated, network disabled, reload still displays saved profit |
| Signing CLI | PASSED | Temporary external key generation, signing and public-key verification; temporary keys deleted |
| Missing owner-key production guard | PASSED | Android production environment intentionally fails the build check |
| Native exported bundle fixture scan | PASSED | No TEST-DEVICE, TEST-CLI, TEST-ONLY or PEM private-key marker found |
| ESLint | NOT EXECUTED | No ESLint gate configured; TypeScript and executed functional tests were used |
| Release APK, Gradle build and permission dump | NOT EXECUTED | No Android SDK/device, production signing credentials or provisioned owner public key |

A service-worker syntax error was found during the first offline test, corrected, checked with `node --check`, and the offline browser flow reran successfully. Early browser test selectors also required disambiguation because both page headers and empty states correctly offer the same action; final runs passed.

## Source golden scenarios: exact scope

| Scenario | Result |
|---|---|
| GS1 rounding and large multiplication | PASSED in pure unit tests |
| GS2 purchase 1,000 kg, extras, partial payment, inventory/ledger | PASSED in SQLite tests and browser UI |
| GS3 sale, remaining stock, customer balance, COGS/gross profit | PASSED in SQLite tests and browser UI |
| GS4 expense and 3,300.00 net profit | PASSED in SQLite tests and browser UI |
| GS5 oldest-first customer receipt | PASSED in SQLite test |
| GS6 sale edit to 450 kg and recosting | PASSED in SQLite test |
| GS7 strict oversell rejection and atomic rollback | PASSED; allow-with-confirmation branch NOT EXECUTED / not implemented |
| GS8 purchase cancellation refused when it would cause shortage | PASSED in SQLite test |
| GS9 cancellation and invoice-created payment | PASSED for restoring stock and cancelling the original linked payment; full reference alternatives with later allocated payments NOT EXECUTED / not implemented |
| GS10 supplier payment | PASSED for account payment and oldest allocation; explicit invoice-target overpayment rejection NOT EXECUTED / not implemented |
| GS11 running-balance statement | NOT EXECUTED / not implemented; party history is a transaction list |
| GS12 opening-balance-first allocation | PASSED in SQLite test |
| GS13 backdated purchase recalculates sale costs | PASSED in SQLite test |
| GS14 repeated document UUID | PASSED; UI saving guard present. Similar-transaction warning NOT EXECUTED / not implemented |
| GS15 backup roundtrip, preserved balance/profit/numbering and corruption rejection | PASSED for SQLite format; ZIP/checksum-manifest format NOT EXECUTED / not implemented |
| GS16 name normalization, partial phone, document number | PASSED; date and poultry-type search variants NOT EXECUTED / not implemented |
| GS17 walk-in must pay in full | PASSED in SQLite test |

These are SQL.js SQLite tests through the same repository. The native `expo-sqlite` adapter and on-device versions of these scenarios are **NOT EXECUTED**. Jest, React Native Testing Library, Maestro/Detox and the 100,000-row performance generator were **NOT EXECUTED**. Tests use Node's test runner rather than Jest.

## Licensing (source §27A)

- **LT1, LT2:** PASSED in pure tests with test-only injected Ed25519 fixtures: matching and nonmatching device IDs.
- **LT3:** PASSED for a trial record; separate paid-type test NOT EXECUTED.
- **LT4:** PASSED for exact expiry boundary and revocation.
- **LT5:** PASSED for exact start; future file timestamp rejects as a clock error. Distinct future-license-start fixture NOT EXECUTED.
- **LT6:** PASSED for version mismatch and duplicate IDs; exhaustive malformed schema/date/unknown-field variants NOT EXECUTED.
- **LT7:** NOT EXECUTED against a real endpoint or mocked fetcher; bounded request and JSON/error handling are implemented.
- **LT8:** PASSED for invalid/missing signature, changed signed payload, whitespace/key canonicalization. Shared CLI canonicalization is exercised by signing/verification smoke test.
- **LT9:** PASSED for grace at one millisecond before and at three days, and trusted rejection. Actual SecureStore/process-restart device cases NOT EXECUTED.
- **LT10:** PASSED for observed clock rollback and older issued_at in pure tests. Real device clock changes, forward movement and all residual clock attacks NOT EXECUTED.
- **LT11:** NOT EXECUTED; the owner has not generated/provisioned production keys or edited real license records.
- **LT12:** NOT EXECUTED on device. Gate leaves SQLite untouched and only changes access to UI; no deep-link or notification navigation system is configured.
- **LT13:** NOT EXECUTED on device. License state is stored separately in SecureStore and is not part of the SQLite backup.
- **LT14:** PASSED for CLI keygen/sign/verify; exhaustive refusal cases NOT EXECUTED.

## WhatsApp, connectivity and contacts

- **WA1–WA7:** NOT EXECUTED on real Android/WhatsApp. UI request buttons, URL encoding, available-device-ID message construction and fallback copy are implemented. Browser request intentionally has no fabricated Android/device/license ID.
- **NET1:** NOT EXECUTED; no APK permission dump. App config requests INTERNET and blocks contact permissions.
- **NET2–NET7:** NOT EXECUTED on real Android. The actual owner-signed endpoint cannot be validated without owner provisioning. Native request timeout is 12 seconds; browser offline business workflow was tested separately and is not proof of licensing connectivity.
- **NET8:** Static review found no TLS verification bypass, cleartext-traffic setting or custom trust manager; no packet-level or APK security test was run.
- **CT1–CT8:** NOT EXECUTED on real Android. Implemented API is `Contact.presentPicker()` + selected-field `getDetails()` from installed Expo Contacts. Contact values stay editable and are saved only on explicit Save; multiple-phone selection and overwrite confirmation exist. Native permission behavior must still be verified.

## Release decision

The web application is ready for functional preview with local data. A production Android release is **not approved** until owner public-key provisioning, release build, native financial/storage tests, license/network/contact/print QA, and any required missing reference features are completed. No tests are represented as passed merely because their code exists.
