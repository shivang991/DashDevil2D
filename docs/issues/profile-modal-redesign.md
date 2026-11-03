# Simplify Profile modal and restrict username changes to admins

## Problem

Profile currently exposes an editable username, a file input, avatar format/size guidance, and other persistent help text. Avatar selection rejects source images over 2 MB. Self-service profile updates also permit renaming on the server.

## Proposed behavior

Use the supplied sketch as a rough hierarchy: Profile title, centered avatar with a small pencil at its top right, username beneath, Change password, and Close. Follow existing shared UI components, tokens, spacing, icon, and dialog conventions; do not copy the sketch's dimensions, borders, or typography literally.

- Replace the visible avatar upload/change control with a pencil icon button at the avatar's top right. Clicking it opens the image picker. Give it an accessible name such as “Change avatar,” visible keyboard focus, and a usable touch target.
- Display the username as text. Remove the editable field and rename-specific help/validation from Profile. Username changes belong exclusively to the existing admin management flow, including when an admin views their own Profile.
- Remove routine explanatory paragraphs and persistent format/size guidance. Retain field labels, accessible dialog semantics, concise actionable errors, and essential password-change consequences without duplicate notices.
- Preserve Change password, its existing validation and session behavior, and Close. Keep avatar removal available as a compact secondary action when applicable. Show Save only for a pending avatar change; preserve the existing explicit-save flow and discard unsaved changes on close.
- Apply button and widget state changes immediately, without transitions.

## Image handling

- Use a browser image compression module to resize/compress selected images before encoding and uploading. Choose the module during implementation using the project's dependency conventions.
- Replace the source-file 2 MB rejection with compression to fit the server's upload byte and pixel bounds. Valid source images over 2 MB should work when compression can produce an acceptable upload.
- Keep supported JPEG, PNG, and WebP handling aligned with the server. Check the actual compressed result before sending; show a short error if processing fails or cannot meet the bounds.
- Preserve server-side byte limits, image decoding, pixel bounds, and sanitization. Browser compression improves selection UX; it does not replace server validation.
- Handle processing/upload states, cancellation, repeated selection, and failures without stale previews or accidental saves. Keep the saved avatar intact on failure; allow retry. Do not upload the original file as a fallback.

## Authorization and integration

- Update the self-service profile API/client contract to support avatar changes without requesting a username change. Reject attempted renames on the server, including crafted requests; leave the account and avatar unchanged on rejection.
- Preserve authorized username editing through admin management and reject unauthorized calls to that endpoint. Retain existing username uniqueness/validation rules there.
- Account for the shared AvatarEditor used by both Profile and Admin. Preserve admin editing capabilities and apply compatible compression behavior to shared upload paths.
- Refresh the displayed avatar after a successful save through the existing account update mechanism. Preserve authentication and temporary-password restrictions.

## Acceptance criteria

- [ ] Default Profile shows the title, avatar/pencil, read-only username, Change password, and Close using existing UI conventions, with minimal helper copy.
- [ ] Pencil opens the picker by mouse and keyboard, with an accessible label and visible focus. Modal focus management and dismissal remain usable on narrow screens.
- [ ] Valid images larger than 2 MB are compressed before upload and save when the resulting file meets server limits; no original-size rejection/help text remains.
- [ ] Invalid images and compression/upload failures produce concise errors, preserve the saved avatar, and permit retry. Cancellation leaves the current selection unchanged; stale processing cannot replace a newer selection or affect a closed dialog.
- [ ] Avatar preview, explicit save, removal, reopening, and account refresh work. Save is unavailable during processing/upload; successful persistence is distinguishable from an unsaved preview.
- [ ] Self-service rename attempts fail without partial mutation; avatar-only updates succeed. Admin management can still rename accounts, including an admin's own account.
- [ ] Password changes retain validation and logout of other devices. Essential consequences remain clear with reduced copy.
- [ ] Button and widget states change immediately, without transitions.

## Verification

Update Profile and AvatarEditor Storybook interactions for the simplified layout, keyboard picker access, pending/save/error states, removal, and password flow. Extend existing avatar tests for compression of oversized valid source images, invalid/failed output, cancellation, and stale asynchronous results. Update browser account coverage and server profile/admin tests for avatar-only updates, rejected self-service renames with no partial writes, and authorized admin renames. Verify desktop/narrow layout and run affected checks.

## Implementation references

- `apps/client/src/screens/ProfileDialog.tsx` and its stories
- `apps/client/src/components/AvatarEditor.tsx` and its stories
- `apps/client/src/screens/AdminScreen.tsx`
- `apps/client/src/components/ui/button.tsx`
- `apps/client/src/transport/account.ts`
- `apps/server/accounts/profile.go`
- `apps/server/transport/profile_test.go`

## Scope

This document is an issue draft; implementation is follow-up work. No new admin workflows, username rules, password policy, or unrelated account/menu redesign is proposed.
