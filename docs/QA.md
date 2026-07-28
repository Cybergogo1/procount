# ProCount — Manual QA Checklist

Run through this on a **physical device** with a development or preview build
(the camera, haptics, audio and RevenueCat all require native modules and won't
work in Expo Go or a simulator).

Prerequisites:

- `.env` configured with Supabase URL + anon key (and RevenueCat keys for the
  paywall checks).
- Supabase migrations applied; the `send-session-report` Edge Function deployed
  with `RESEND_API_KEY` set.
- A RevenueCat sandbox account + product configured (for subscription checks).

Legend: ☐ = to test.

## Auth

- ☐ Sign up with a new email → "check your email" screen appears.
- ☐ Confirm via the emailed link, then sign in → lands on the Scanner.
- ☐ Sign in with a wrong password → inline error, no crash.
- ☐ Invalid email format is rejected before submit.
- ☐ Kill and reopen the app while signed in → goes straight to the Scanner (no
  auth flash, splash holds until ready).

## Scan flow

- ☐ Grant camera permission when prompted → live viewfinder appears.
- ☐ Scan a barcode → haptic + beep fire, scanner pauses, barcode shows, "Confirm
  to scan again" overlay appears.
- ☐ Tap **Confirm** → live count increases, row added to the top of the list,
  camera reactivates, quantity resets to 1.
- ☐ Adjust quantity with − / + before confirming → committed quantity matches.
- ☐ Tap the quantity number → numeric keypad opens, typed value is committed.
- ☐ Tap **×**, enter N, Set → next scan commits with quantity N, then the
  multiplier clears.

## Quantity edit (recent list)

- ☐ Tap a row's quantity → keypad opens, edit commits on done/blur.
- ☐ Live total at the top updates instantly.

## Delete + undo

- ☐ Tap the trash icon → row disappears immediately, total updates, no
  confirmation dialog.
- ☐ "Removed — UNDO" toast appears; tap **UNDO** within 4s → row returns to its
  original position.
- ☐ Let the toast expire → deletion stays.

## Sync status

- ☐ With a good connection, the badge reads **Synced** when idle and
  **Syncing…** briefly after actions.
- ☐ Confirm scans appear in Supabase (`scans` table) shortly after.

## Weak / dropped connection (airplane mode mid-session)

- ☐ Enable airplane mode, keep scanning → UI stays instant, badge shows
  **Syncing…**, count never blocks.
- ☐ Try **End Session & Export** while pending → button is disabled and shows
  "Finishing up — just a moment…".
- ☐ Disable airplane mode → queue flushes, badge returns to **Synced**, rows
  appear in Supabase.

## End session & export

- ☐ Tap **End Session & Export** → modal sheet opens.
- ☐ Invalid email is rejected.
- ☐ Choose **Excel** (default) or **CSV**, enter a valid email, **Send Report**.
- ☐ Success toast "Report sent — new session started", modal closes, list clears,
  count resets to 0.
- ☐ The report email arrives at the entered address with the correct attachment
  (Barcode / Quantity / Timestamp columns + header).
- ☐ Force a failure (e.g. bad email service config) → modal stays open with an
  error and allows retry.

## Paywall gate (RevenueCat)

- ☐ A fresh account (within 7-day trial) can use the Scanner and export.
- ☐ With trial expired and no subscription → opening the Scanner routes to the
  paywall; Settings is still reachable.
- ☐ Paywall shows the price pulled from RevenueCat (not hardcoded).
- ☐ Subscribe (sandbox) → returns to the Scanner, access granted.
- ☐ Cancelling the purchase sheet → stays on the paywall, no error dialog.

## Restore purchases

- ☐ On a reinstall / different device with the same store account, **Restore
  purchases** (paywall or Settings) re-grants access.

## Settings

- ☐ Account email is shown.
- ☐ Subscription row reflects state ("Trial — N days left" / "Active
  subscription" / "No active subscription").
- ☐ Manage subscription opens the system subscription screen.
- ☐ Contact support opens the mail client to support@procount.app.
- ☐ App version shows at the bottom.

## Sign out / in

- ☐ Sign out → confirmation, then returns to sign-in.
- ☐ Sign back in → Scanner, previous active session resumes (scans still there).

## Permissions edge cases

- ☐ Deny camera permission → explainer screen with **Allow camera** (or **Open
  settings** if permanently denied).
- ☐ Granting via settings and returning → camera works.

## General

- ☐ No red error screens or console warnings on startup or during the scan loop.
- ☐ Primary actions are at least 56px tall and easy to tap one-handed.
- ☐ Fonts render (Oswald for the count number, Inter for body).
