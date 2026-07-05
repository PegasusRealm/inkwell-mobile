import {useState} from 'react';

/**
 * Hook to track unread coach replies — NEUTRALIZED 2026-07-04.
 * Connect (coach layer) retired 2026-07-01; the live Firestore listener
 * this hook ran was pure cost for a dead feature. Kept as an inert stub so
 * consuming screens compile until the M2 screen rebuilds remove them.
 * Full excision rides the Connect sweep (see CONNECT-REMOVAL-INVENTORY.md).
 */
export function useUnreadReplies() {
  const [unreadCount] = useState(0);
  return {unreadCount, loading: false};
}
