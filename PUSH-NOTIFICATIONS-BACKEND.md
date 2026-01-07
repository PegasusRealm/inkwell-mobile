# Push Notifications Backend Integration

## Overview
Mobile app now supports FCM (Firebase Cloud Messaging) push notifications. Users' FCM tokens are stored in Firestore and can be used to send notifications.

## Firestore Schema
When users log in to mobile app, their FCM token is stored at:
```
users/{userId}/
  - fcmToken: string (the FCM token)
  - platform: 'ios' | 'android'
  - lastTokenUpdate: timestamp
```

## Backend Changes Needed

### 1. Update Cloud Functions to Send FCM Instead of SMS for Mobile Users

Modify these functions to check if user has `fcmToken` field:

#### `sendWishMilestone` Function
```typescript
// Check if user has FCM token (mobile app)
const userDoc = await admin.firestore().collection('users').doc(userId).get();
const userData = userDoc.data();

if (userData?.fcmToken) {
  // Send FCM push notification instead of SMS
  await admin.messaging().send({
    token: userData.fcmToken,
    notification: {
      title: '✨ WISH Milestone!',
      body: milestoneMessage,
    },
    data: {
      type: 'milestone',
      wishId: wishId,
      daysElapsed: daysElapsed.toString(),
    },
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
  });
} else if (userData?.phoneNumber) {
  // Fallback to SMS for web users
  await sendSMS(userData.phoneNumber, milestoneMessage);
}
```

#### `notifyCoachOfTaggedEntry` Function
```typescript
// Notify practitioner via FCM if they have mobile app
const practitionerDoc = await admin.firestore()
  .collection('practitioners')
  .doc(practitionerId)
  .get();
  
const practitionerData = practitionerDoc.data();

if (practitionerData?.fcmToken) {
  await admin.messaging().send({
    token: practitionerData.fcmToken,
    notification: {
      title: '📬 New Journal Entry',
      body: `${userName} tagged you in a journal entry`,
    },
    data: {
      type: 'practitioner_reply',
      entryId: entryId,
      userId: userId,
    },
  });
} else if (practitionerData?.email) {
  // Fallback to email
  await sendEmail(practitionerData.email, emailContent);
}
```

### 2. New Cloud Function: Send Practitioner Reply Notification
```typescript
export const notifyUserOfPractitionerReply = functions.https.onCall(async (data, context) => {
  const {userId, entryId, practitionerName} = data;
  
  const userDoc = await admin.firestore().collection('users').doc(userId).get();
  const userData = userDoc.data();
  
  if (userData?.fcmToken) {
    await admin.messaging().send({
      token: userData.fcmToken,
      notification: {
        title: '💬 New Reply from ' + practitionerName,
        body: 'Your practitioner responded to your journal entry',
      },
      data: {
        type: 'practitioner_reply',
        entryId: entryId,
      },
    });
  }
});
```

## FCM Message Types

### Milestone Notifications
```json
{
  "notification": {
    "title": "✨ WISH Milestone!",
    "body": "7 days into your WISH journey..."
  },
  "data": {
    "type": "milestone",
    "wishId": "abc123",
    "daysElapsed": "7"
  }
}
```

### Practitioner Tagged Notifications
```json
{
  "notification": {
    "title": "📬 New Journal Entry",
    "body": "User tagged you in an entry"
  },
  "data": {
    "type": "practitioner_reply",
    "entryId": "xyz789",
    "userId": "user123"
  }
}
```

### Practitioner Reply Notifications
```json
{
  "notification": {
    "title": "💬 New Reply from Dr. Smith",
    "body": "Your practitioner responded"
  },
  "data": {
    "type": "practitioner_reply",
    "entryId": "xyz789"
  }
}
```

## Testing

### Testing on Simulator (iOS)
- ❌ Push notifications don't work on iOS simulator
- ✅ Test on real iOS device via TestFlight

### Testing on Emulator (Android)
- ✅ Push notifications work on Android emulator
- Need to have Google Play Services installed

### Testing FCM Token Storage
Check Firestore after login:
```javascript
// In Firebase Console > Firestore
users/{userId}
  fcmToken: "eX3... (long token)"
  platform: "ios"
  lastTokenUpdate: Timestamp
```

### Send Test Notification
Use Firebase Console > Cloud Messaging > Send test message:
1. Enter FCM token from Firestore
2. Customize notification title/body
3. Send

## Cost Savings
- **SMS**: $0.0075 - $0.03 per message
- **FCM**: FREE unlimited notifications
- **Estimated savings**: $100-500/month for 10k users

## Deployment Checklist
- [x] Install @react-native-firebase/messaging
- [x] Add notification permissions (iOS/Android)
- [x] Create NotificationService
- [x] Initialize in App.tsx on user login
- [x] Store FCM tokens in Firestore
- [ ] Update Cloud Functions to send FCM
- [ ] Test on real devices
- [ ] Submit to App Store with push notification capability
- [ ] Submit to Google Play
