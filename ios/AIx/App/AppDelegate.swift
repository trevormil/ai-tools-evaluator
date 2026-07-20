import UIKit
import UserNotifications

/// Routes daily-pick notification taps into the app (Feed tab → pick detail).
final class AppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
    ) -> Bool {
        UNUserNotificationCenter.current().delegate = self
        return true
    }

    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        didReceive response: UNNotificationResponse
    ) async {
        let userInfo = response.notification.request.content.userInfo
        guard userInfo["aix.route"] as? String == "daily-pick" else { return }
        // Resolve the current pick, then route to it (fall back to the feed).
        let slug = (try? await APIClient().fetchDailyPick())?.item.slug
        await MainActor.run {
            AppRouter.shared.openDailyPick(slug: slug)
        }
    }

    /// Show the reminder even when the app is foregrounded.
    func userNotificationCenter(
        _ center: UNUserNotificationCenter,
        willPresent notification: UNNotification
    ) async -> UNNotificationPresentationOptions {
        [.banner, .sound]
    }
}
