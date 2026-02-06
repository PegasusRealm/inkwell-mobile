import {useState, useEffect} from 'react';
import auth from '@react-native-firebase/auth';
import firestore from '@react-native-firebase/firestore';

/**
 * Hook to track unread coach replies in real-time
 * Uses Firestore onSnapshot listener for live updates
 */
export function useUnreadReplies() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth().currentUser;
    if (!user) {
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    console.log('📬 Setting up real-time listener for unread coach replies');

    // Real-time listener for entries with newCoachReply: true
    const unsubscribe = firestore()
      .collection('journalEntries')
      .where('userId', '==', user.uid)
      .where('newCoachReply', '==', true)
      .onSnapshot(
        (snapshot) => {
          const count = snapshot.docs.length;
          console.log(`📬 Unread coach replies: ${count}`);
          setUnreadCount(count);
          setLoading(false);
        },
        (error) => {
          console.error('❌ Error listening to unread replies:', error);
          setLoading(false);
        }
      );

    // Cleanup listener on unmount
    return () => {
      console.log('📬 Cleaning up unread replies listener');
      unsubscribe();
    };
  }, []);

  // Re-setup listener when auth state changes
  useEffect(() => {
    const authUnsubscribe = auth().onAuthStateChanged((user) => {
      if (!user) {
        setUnreadCount(0);
      }
    });

    return () => authUnsubscribe();
  }, []);

  return {unreadCount, loading};
}
