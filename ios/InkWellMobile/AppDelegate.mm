#import "AppDelegate.h"

#import <React/RCTBundleURLProvider.h>
#import <Firebase.h>
#import <UserNotifications/UserNotifications.h>
#import <FirebaseMessaging/FirebaseMessaging.h>

@interface AppDelegate () <UNUserNotificationCenterDelegate, FIRMessagingDelegate>
@end

@implementation AppDelegate

- (BOOL)application:(UIApplication *)application didFinishLaunchingWithOptions:(NSDictionary *)launchOptions
{
  [FIRApp configure];
  
  // Set up push notification delegates BEFORE requesting permission
  [UNUserNotificationCenter currentNotificationCenter].delegate = self;
  [FIRMessaging messaging].delegate = self;
  
  // Clear badge on app launch - ensures no stuck badges
  [UIApplication sharedApplication].applicationIconBadgeNumber = 0;
  
  self.moduleName = @"InkWellMobile";
  // You can add your custom initial props in the dictionary below.
  // They will be passed down to the ViewController used by React Native.
  self.initialProps = @{};

  return [super application:application didFinishLaunchingWithOptions:launchOptions];
}

// Clear badge when app becomes active (comes to foreground)
- (void)applicationDidBecomeActive:(UIApplication *)application
{
  [UIApplication sharedApplication].applicationIconBadgeNumber = 0;
}

- (NSURL *)sourceURLForBridge:(RCTBridge *)bridge
{
  return [self bundleURL];
}

- (NSURL *)bundleURL
{
#if DEBUG
  return [[RCTBundleURLProvider sharedSettings] jsBundleURLForBundleRoot:@"index"];
#else
  return [[NSBundle mainBundle] URLForResource:@"main" withExtension:@"jsbundle"];
#endif
}

#pragma mark - Push Notification Delegate Methods

// Handle notification when app is in foreground
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
       willPresentNotification:(UNNotification *)notification
         withCompletionHandler:(void (^)(UNNotificationPresentationOptions))completionHandler
{
  NSDictionary *userInfo = notification.request.content.userInfo;
  NSLog(@"📱 Foreground notification received: %@", userInfo);
  
  // Show the notification even when app is in foreground
  if (@available(iOS 14.0, *)) {
    completionHandler(UNNotificationPresentationOptionBanner | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionBadge);
  } else {
    completionHandler(UNNotificationPresentationOptionAlert | UNNotificationPresentationOptionSound | UNNotificationPresentationOptionBadge);
  }
}

// Handle notification tap
- (void)userNotificationCenter:(UNUserNotificationCenter *)center
didReceiveNotificationResponse:(UNNotificationResponse *)response
         withCompletionHandler:(void (^)(void))completionHandler
{
  NSDictionary *userInfo = response.notification.request.content.userInfo;
  NSLog(@"📱 Notification tapped: %@", userInfo);
  
  completionHandler();
}

// Called when APNs has assigned a device token
- (void)application:(UIApplication *)application
didRegisterForRemoteNotificationsWithDeviceToken:(NSData *)deviceToken
{
  NSLog(@"📱 APNs device token received");
  [FIRMessaging messaging].APNSToken = deviceToken;
}

// Called when APNs registration fails
- (void)application:(UIApplication *)application
didFailToRegisterForRemoteNotificationsWithError:(NSError *)error
{
  NSLog(@"❌ APNs registration failed: %@", error.localizedDescription);
}

#pragma mark - FIRMessagingDelegate

// Called when FCM token is received or refreshed
- (void)messaging:(FIRMessaging *)messaging didReceiveRegistrationToken:(NSString *)fcmToken
{
  NSLog(@"📱 FCM token received: %@", [fcmToken substringToIndex:MIN(30, fcmToken.length)]);
  
  // Post notification so React Native can pick it up if needed
  NSDictionary *dataDict = @{@"token": fcmToken ?: @""};
  [[NSNotificationCenter defaultCenter] postNotificationName:@"FCMToken"
                                                      object:nil
                                                    userInfo:dataDict];
}

@end
