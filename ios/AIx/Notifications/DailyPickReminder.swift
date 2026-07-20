import Foundation
import UserNotifications

/// The slice of UNUserNotificationCenter we use — protocol-backed so the
/// scheduling logic is unit-testable without notification permissions.
protocol NotificationScheduling {
    func requestAuthorization() async throws -> Bool
    func add(_ request: UNNotificationRequest) async throws
    func removePendingRequests(withIdentifiers identifiers: [String])
}

extension UNUserNotificationCenter: NotificationScheduling {
    func requestAuthorization() async throws -> Bool {
        try await requestAuthorization(options: [.alert, .sound, .badge])
    }

    func removePendingRequests(withIdentifiers identifiers: [String]) {
        removePendingNotificationRequests(withIdentifiers: identifiers)
    }
}

/// Schedules the daily "today's pick is live" local reminder. One repeating
/// calendar trigger; tapping it deep-links to the pick via AppRouter.
enum DailyPickReminder {
    static let identifier = "aix.daily-pick-reminder"
    static let enabledKey = "aix.dailyPickReminderEnabled"
    /// Fires after the daily pick's morning post-time gate on the server.
    static let fireHour = 9

    static var isEnabled: Bool {
        UserDefaults.standard.bool(forKey: enabledKey)
    }

    /// Ask permission (first time) and install the repeating daily trigger.
    /// Returns false when the user denied notification permission.
    @discardableResult
    static func enable(center: NotificationScheduling = UNUserNotificationCenter.current()) async -> Bool {
        guard (try? await center.requestAuthorization()) == true else {
            UserDefaults.standard.set(false, forKey: enabledKey)
            return false
        }

        let content = UNMutableNotificationContent()
        content.title = "Today's AIx pick is in"
        content.body = "One tool judged worth your attention today. See the verdict."
        content.sound = .default
        content.userInfo = ["aix.route": "daily-pick"]

        var components = DateComponents()
        components.hour = fireHour
        let trigger = UNCalendarNotificationTrigger(dateMatching: components, repeats: true)

        let request = UNNotificationRequest(identifier: identifier, content: content, trigger: trigger)
        do {
            try await center.add(request)
        } catch {
            UserDefaults.standard.set(false, forKey: enabledKey)
            return false
        }
        UserDefaults.standard.set(true, forKey: enabledKey)
        return true
    }

    static func disable(center: NotificationScheduling = UNUserNotificationCenter.current()) {
        center.removePendingRequests(withIdentifiers: [identifier])
        UserDefaults.standard.set(false, forKey: enabledKey)
    }
}
