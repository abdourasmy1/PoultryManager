# مدير الدواجن — Poultry Manager

An Arabic-first, locally stored poultry trading application built with **React Native, Expo and TypeScript**. The reference URL resolves to a written business specification, not an image; the application uses an original green-and-ivory interface, a bundled Tajawal font, and locally created rooster/ledger illustrations.

## Delivered application

- Responsive Arabic RTL interface: sidebar on desktop, five native bottom tabs on phones, keyboard-aware modal forms, light/dark/system appearance, loading, error and empty states.
- Live dashboard with real period totals, a seven-day purchase/sales chart, financial balances, recent transactions, inventory and a working onboarding checklist.
- Customers and suppliers with phone/address/notes, opening balances, normalized Arabic name search and inline party creation.
- Multi-item purchase and sale invoices, count/cages/weight, exact line totals, purchase transport/other costs, partial payments and walk-in full-payment validation.
- Weighted-average inventory replay, strict oversell prevention, invoice editing/cancellation, automatic ledger updates, customer receipts, supplier payments, oldest-first allocations and operating expenses.
- Reports for profit, sales, purchases, expenses, debts, stock and payments; CSV downloads; printable Arabic invoices and transaction reports. Native PDF output uses Expo Print/Sharing; browser output uses the print dialog.
- SQLite backup/restore with integrity/schema checks; persisted business settings; local notification inbox for setup/backup reminders.
- Device-bound Android license gate, signature verification, a signing CLI, grace-period decisions and user-triggered WhatsApp requests. **Owner key provisioning is required before Android can be activated.**
- No sample transactions or sample parties are shipped. The protected walk-in customer and poultry configuration names are the only initial business records.

## Run, test and export

```sh
npm ci --legacy-peer-deps
npm run typecheck
npm test
node tests/signer-smoke.cjs
npm run build
npm run test:browser
```

`npm run build` runs `expo export --platform all` and then prepares the local web offline cache. Output is in `dist/`. Serve that directory with a static HTTPS host. The browser tests start a short-lived static server themselves and shut it down when finished. Their Chromium executable path is configured for the supplied sandbox; adjust it if running elsewhere.

`npm start` can be used locally for normal Expo development. Device APIs and licensing require a native build rather than Expo Go.

### Storage

- **Android/iOS:** `expo-sqlite`, WAL and foreign keys. Financial changes run inside a SQLite transaction. A failure in inventory validation rolls the entire write back.
- **Browser:** real SQLite via SQL.js/WASM, serialized into localStorage after committed writes. A failed persistence attempt restores the prior database. Nothing is uploaded. Browser storage quotas apply; clearing site data or using ephemeral/private browsing can erase the local copy. Export backups regularly.
- A service worker caches the static browser app, fonts and WASM so an already loaded installation can reload without internet. First installation requires a connection.
- The backup is a **SQLite `.sqlite` file**, not the ZIP/checksum-manifest format described in the larger reference. Restore validates integrity and schema before replacing the current database and rolls back on failure.

## Structure

```text
App.tsx                    Providers, error boundary, startup and native license gate
components/                Reusable UI, responsive navigation, sheets and forms
screens/                   Dashboard, documents, parties, stock, reports, settings
lib/domain.ts              Pure integer-money, weight, allocation and inventory logic
lib/repository.ts          Schema, transactional repository, ledger and aggregate queries
lib/driver.ts              Native SQLite adapter
lib/driver.web.ts          Browser SQLite adapter
lib/ar.ts                  Main Arabic UI resource dictionary
lib/files.ts               CSV, SQLite backup, HTML/PDF output
lib/license-core.ts        Pure signature/schema/grace decision logic
lib/license.ts             Device ID, HTTPS verification and secure storage
lib/license-keys.ts        Owner-provisioned public keys; no private key
assets/                    Bundled font and original illustrations
tests/                     Accounting, licensing, browser and CLI verification
tools/license-signer/      Owner-side Ed25519 signing CLI
```

The presentation uses React Navigation rather than Expo Router, and a small React context/repository boundary rather than Zustand/TanStack Query. The schema uses unified documents and parties with separate item, allocation, ledger, inventory, counter and audit tables; it is not a byte-for-byte implementation of the reference schema.

## Accounting rules

Money is stored as integer minor units, weights as integer grams. Decimal inputs accept Western and Arabic-Indic digits. Intermediate multiplication uses `bigint`; line totals use half-up rounding. Purchase extras are allocated by largest remainder. Sales consume weighted-average stock pools, so unsold inventory is not charged to profit. Backdated purchases and edits trigger deterministic inventory replay. Negative stock is blocked. Party balances are derived from opening balance plus active ledger effects, never a mutable balance field.

Invoice-created payments are allocated to that invoice; other receipts/vouchers allocate to opening balances and then the oldest open invoices. Invoice edits cannot reduce payable below allocated payments. Cancelling an invoice also cancels its invoice-created payment; independently created account payments remain on the account. Account overpayments ask for confirmation in the UI and become credit balances.

## Android licensing administration

**No genuine license or owner public key was supplied.** The Android gate therefore fails closed. The browser workspace is an explicitly unlicensed, functional web edition; it is not a substitute for testing an Android license. An EAS production Android build is refused while `LICENSE_PUBLIC_KEYS` is empty. There is no fixed device ID, bundled private key or test-license bypass.

1. Generate an owner key pair **outside this repository**:
   ```sh
   npm run license -- keygen /absolute/private/owner-license-keys
   ```
2. Copy only the printed base64 public key into `lib/license-keys.ts`.
3. Prepare a version-1 JSON file with `licenses`, using actual device IDs displayed by the Android app.
4. Sign and verify it:
   ```sh
   npm run license -- sign source.json licenses.json /absolute/private/owner-license-keys/private.pem
   npm run license -- verify licenses.json /absolute/private/owner-license-keys/public.pem
   ```
5. Publish the signed file to the configured raw GitHub location in `lib/license-core.ts`. No GitHub token is required or bundled. Protect the owner account with 2FA and restrict write access.
6. Re-sign whenever any signed data changes. The signer sets `issued_at`; the signed canonical payload is every field except `signature`. These two fields enable tamper detection and stale-file rejection.

The ID is a truncated SHA-256 of the scoped Android ID, formatted with a `PM-` prefix. If that ID is unavailable, an installation UUID is persisted in SecureStore; it can be lost on reinstall. Preserve the release signing keystore: changing it can change Android IDs.

Secure license state is outside the SQLite database and backups. Validity is `start <= now < end`; grace is strictly under three days and never outlives the license. Trusted rejection prevents offline re-entry. The implementation rejects observed clock rollback and older signed files; it does not claim to defeat rooted devices, patched binaries, replay on a first-seen installation, or every clock manipulation.

WhatsApp opens only after the user presses the request button. Android requests include the actual available derived device ID. The browser does not invent one. No business/customer/database contents are included.

### Native build configuration

- Android application ID: `com.poultrymanager.app`, editable at `expo.android.package` in `app.json`.
- EAS production profile targets APK output. After owner provisioning, run `eas build --platform android --profile production` in a properly authenticated owner environment.
- `INTERNET` requested; `READ_CONTACTS` and `WRITE_CONTACTS` blocked; Android automatic app backup disabled; Expo OTA updates disabled.
- Contact import uses the installed SDK's `Contact.presentPicker()` and `getDetails()`, with explicit overwrite confirmation and a multiple-number chooser. It does not save until the user presses Save. Native permissions/picker behavior still require real-device validation.
- No `android/` folder was generated here, and no release APK or permission dump was produced. Native min/target SDK values have therefore **not been verified**.

## Versions and reproducibility

The scaffold uses Expo SDK **57** (`expo 57.0.26`), React Native **0.86.3**, React **19.2.3**, SQL.js **1.13.0**. Exact installed dependency versions are recorded in `VERSIONS.json` and `package-lock.json`. The supplied registry did not contain the transitive `@expo/config-plugins` version requested by one package; an explicit `57.0.9` override is recorded in `package.json`. React Navigation bottom tabs was installed at a compatible available version. These are the versions actually exported, not a claim about the latest stable ecosystem.

## Assumptions and known gaps

This is a functional, tested local application, **not a claim of complete production parity with the extensive source specification or accounting certification**.

- The web edition starts directly at the dashboard with setup guidance instead of blocking onboarding. Currency is EGP; Western digits are the display default.
- Strict stock blocking is supported. Oversell-with-confirmation, refunds, stock/balance adjustment documents, recycle-bin restoration, permanent deletion, document-level manual allocation choices and cancelling all later allocated payments are not implemented.
- Parties support create/edit, not archive/delete; configuration supports adding poultry types, not full reorder/deactivate/delete workflows. Phone-duplicate warning and near-duplicate-transaction confirmation are not implemented.
- Custom date ranges, grouping every report, full running-balance statements, date/poultry global-search parsing and configurable PDF paper sizes are not implemented. Printed party history is labelled transactions, not a running-balance statement.
- Notifications are an in-app inbox, not scheduled operating-system reminders. Automatic daily backups, ZIP manifests, external checksum verification, safety-backup history and full reset/rebuild tooling are not implemented.
- Main document lists load in increments of 50. Some report/export and replay operations read larger sets; party pickers currently cap at 200 records. The 100,000-row performance target has not been validated. Browser storage is not suitable for unbounded accounting history.
- Native module behavior, font shaping in native PDFs, licensing against the owner's actual GitHub records, release security/permissions and device lifecycle need real Android QA before use with financial data.

See `TEST_REPORT.md` for executed checks and explicit unexecuted cases.
