Inspect the existing CustomAOV frontend Room invitation and queue joining flow.

This is a READ-ONLY inspection. Do not implement or modify anything yet.

Check the complete flow:

1. User opens a Room invitation URL.
2. The application resolves the Room and validates access.
3. User explicitly confirms joining.
4. The existing backend join operation executes.
5. A success popup/toast appears only after confirmed success.
6. The success UI displays the user's actual queue position and queue size.
7. The displayed queue position updates when membership/order changes.
8. Duplicate joins, full queues, closed Rooms, unauthenticated users and join failures are handled correctly.

Inspect actual routes, React components, hooks, Room RPC calls, returned queue data and existing tests.

Distinguish:
- Implemented and tested.
- Implemented but not tested.
- Partially implemented.
- Missing.

Do not infer that a successful backend join automatically means the confirmation popup and queue-position UX exist.

Report exact source file paths and relevant test coverage.

Do not modify Backend, Production, Git, Linear or any application files.

Finish with a clear verdict:

INVITE → CONFIRM → JOIN → QUEUE POSITION:
COMPLETE / PARTIAL / MISSING.