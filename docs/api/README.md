# Classéo API reference

For engineers working on the application or integrating with it.

Classéo has two kinds of server entry points:

- **HTTP route handlers** under `src/app/api`: downloads (CSV, PDF, files),
  speech and translation, offline replay, online payment status and the
  payment webhook. They are described in [openapi.yaml](openapi.yaml)
  (OpenAPI 3.1), together with the internal voice function `api/kora-tts.py`.
- **Server actions** (`"use server"` modules in `src/features/*/actions.ts`):
  every form and button that writes. They are not an HTTP API: Next.js calls
  them through its own action protocol, with an origin check, and their ids
  change with each build. They are listed below so that the permission
  behind each write can be found quickly.

The spec is not exposed by the application: there is no route serving it.

## Browsing the spec

[index.html](index.html) renders `openapi.yaml` with Redoc 2.5.4 loaded from
jsDelivr (pinned, with a subresource integrity hash; no npm dependency).
Browsers do not load the spec from a `file://` page, so serve the folder over
HTTP:

```bash
python3 -m http.server 8081 --directory docs/api
```

then open http://localhost:8081/.

To check the spec after a change:

```bash
npx --yes @redocly/cli@latest lint docs/api/openapi.yaml
```

It reports the spec as valid with four warnings, all expected: no licence
field, a `localhost` server, two paths Redocly considers ambiguous
(`/api/paiements/en-ligne/{id}` and `/api/paiements/{provider}/webhook`,
which Next.js resolves by its static segment first), and `GET /api/voix`,
which has no 4xx answer.

When a route is added or changed under `src/app/api`, update `openapi.yaml`
in the same change.

## Server actions

### How every action runs

Actions built with `createAction` (`src/lib/action.ts`) run in this order:

1. read the session (`getCurrentUser`);
2. check the permission code with `authorize`; with `permission: null` any
   signed in user passes and the handler scopes by user id or checks rights
   itself;
3. refuse any write under a temporary password;
4. validate the input with the zod schema (a `FormData` is converted first;
   keys ending in `[]` and repeated keys become arrays);
5. run the handler, which scopes its queries through `src/lib/auth/scope.ts`,
   writes, audits and invalidates caches.

The result is an `ActionState`: `{ ok, message?, fieldErrors?, data? }`.
`DomainError` and `ForbiddenError` become `ok: false` with their French
message; any other error is logged and answered with a generic message.
Most handlers also call `assertWritable` (`src/lib/guards.ts`), which refuses
writes on a closed year or a suspended school.

Holding the permission is never enough on its own: the object must also be
inside the account's territorial scope, which each handler checks with the
scope filters.

### Actions per feature

The permission column is the code passed to `createAction`. Codes are
defined in `src/lib/auth/permissions.ts`; roles grant them from the rights
matrix.

| Feature (`src/features/...`) | Action | Permission |
|---|---|---|
| `grades` | `createSheet` | `grade:create` |
| | `updateSheet`, `saveGrades` | `grade:update` |
| | `deleteSheet` | `grade:delete` |
| | `setSheetLock`, `setClassLock` | `grade:lock` |
| `report-cards` | `publishReportCards` | `report_card:publish` |
| `council` | `saveCouncilDecisions` | `report_card:publish` |
| `attendance` | `saveAttendance` | `attendance:create` |
| | `saveTeacherAttendance` | `teacher:update` |
| `students` | `createStudent` | `student:create` |
| | `updateStudent`, `setEnrollmentStatus`, `updateStudentPhoto`, `removeStudentPhoto` | `student:update` |
| `transfers` | `changeClass`, `requestSchoolChange`, `cancelTransfer` | `student:update` |
| | `decideAsGuardian` (primary guardian only) | `student:view` |
| | `decideAsDestination` | `student:create` |
| `student-history` | `grantRecordAccess`, `revokeRecordAccess` | `student:update` |
| `classes` | `createClassroom` | `class:create` |
| | `updateClassroom`, `saveAssignment`, `deleteAssignment` | `class:update` |
| | `deleteClassroom` | `class:delete` |
| `subjects` | `createSubject`, `renameSubject`, `deleteSubject` | `subject:create`, `subject:update`, `subject:delete` |
| | `proposeSubject` | `request:create` |
| | `decideSubject` | `subject:approve` |
| `timetable` | `createSlot` | `timetable:create` |
| | `updateSlot`, `cancelSlotOnDate`, `restoreSlot` | `timetable:update` |
| | `deleteSlot` | `timetable:delete` |
| `teachers` | `searchTeacherRegistry`, `appointTeacher`, `createTeacher` | `teacher:create` |
| | `updateTeacher`, `recordStateTeacher` | `teacher:update` |
| `parents` | `createGuardian` | `parent:create` |
| | `updateGuardian`, `addChild`, `removeChild` | `parent:update` |
| `fees` | `createFeeType`, `generateInvoices` | `fee:create` |
| | `updateFeeType`, `savePlan`, `deletePlan` | `fee:update` |
| | `deleteFeeType` | `fee:delete` |
| `payments` | `recordPayment` | `payment:create` |
| | `cancelPayment` | `payment:delete` |
| `online-payment` | `startOnlinePayment`, `declarePayment` (guardian accounts only) | `fee:view` |
| | `confirmDeclaration`, `rejectDeclaration` | `payment:create` |
| | `createPaymentAccount`, `togglePaymentAccount` | `fee:update` |
| `payroll` | `savePayslip` | `payroll:create` |
| | `advancePayslip` | `payroll:approve` |
| | `deletePayslip` | `payroll:delete` |
| `family-documents` | `submitFamilyDocument` | `family_document:create` |
| | `reviewFamilyDocument` | `null`, then `family_document:approve`, or `health_document:approve` for a health piece |
| | `addRequiredPiece`, `archiveRequiredPiece` | `family_document:approve` |
| `document-requests` | `createDocRequests` | `document_request:create` |
| | `uploadDocFile`, `removeDocFile`, `submitDocRequest` | `document_request:update` |
| | `reviewDocRequest` | `document_request:approve` |
| `mock-exams` | `createExam`, `inviteSchools`, `submitExam`, `closeExam` | `mock_exam:create` |
| | `respondInvitation`, `decideExam` | `mock_exam:approve` |
| | `saveResults` | `mock_exam:update` |
| `messages` | `startConversation`, `sendMessage`, `sendVoiceNote` | `message:create` |
| `contents` | `createContent` | `content:create` |
| | `updateContent` | `content:update` |
| | `publishContent`, `archiveContent` | `content:publish` |
| | `deleteContent` | `content:delete` |
| `requests` | `createRequest` | `request:create` |
| | `decideRequest` | `request:approve` |
| `schools` | `createSchool` | `school:create` |
| | `updateSchool` | `school:update` |
| `school-settings` | `updateSchoolProfile`, `savePaymentAccount`, `deletePaymentAccount`, `updateEvaluationOptions` | `school:update` |
| `school-status` | `setSchoolStatus` | `school:lock` |
| `calendar` | `saveYear`, `activateYear` | `calendar:update` |
| | `setYearClosed` | `calendar:lock` |
| | `createExtension`, `endExtension` | `calendar:approve` |
| `users` | `createUser` | `user:create` |
| | `setUserActive`, `resetUserPassword`, `revokeUserSessions`, `changeUserRole` | `user:update` |
| `password-help` | `resolveHelpRequest`, `rejectHelpRequest` | `user:update` |
| `roles` | `createRole`, `updateRoleDetails`, `deleteRole`, `updateRolePermissions` | `role:update` |
| `signatures` | `uploadSignatureImage`, `saveDrawnSignature`, `removeSignatureImage`, `signDocument`, `signClassReportCards` | `null`, then school heads and territorial authorities only (`signerKind`) |
| `verification` | `revokeDocument` | `null`, then `canRevoke` (issuer's school or authority) |
| `push` | `subscribePush`, `unsubscribePush`, `checkPushDevice`, `sendTestPush` | `null` (own subscriptions) |
| `auth` | `switchSchool` (`school-actions.ts`) | `null` (schools the account holds) |

### Actions outside `createAction`

These run before a session exists, or manage the session itself, so they
carry their own checks.

| Module | Action | Checks |
|---|---|---|
| `src/features/auth/actions.ts` | `login` | zod; rate limits of 30 attempts per address and 10 per identifier per 15 minutes; lockout for 15 minutes after 5 failures; the same answer for an unknown identifier and a wrong password |
| | `logout` | revokes the session row, deletes the cookie |
| | `changePassword` | signed in; current password verified; closes every other session |
| `src/features/auth/reset-actions.ts` | `requestPasswordReset`, `resetPasswordWithCode` | reset by a code sent by e-mail; rate limited per address and per e-mail; the request answers the same way whether the account exists or not |
| `src/features/password-help/actions.ts` | `requestPasswordHelp` | public; rate limits of 20 per address and 3 per identifier per 15 minutes; same answer whether the identifier exists or not |
| `src/features/notifications/actions.ts` | `markNotificationRead`, `markAllNotificationsRead`, `openNotification`, `unreadSnapshot` | signed in, own notifications only |
| `src/components/shell/switch-school.ts` | `switchSchool` | signed in, schools the account holds |

Sequence diagrams of the main journeys are in [../flows.md](../flows.md).
