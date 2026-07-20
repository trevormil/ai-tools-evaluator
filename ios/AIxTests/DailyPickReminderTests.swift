import XCTest
import UserNotifications
@testable import AIx

/// The daily reminder scheduler, against a fake notification center.
@MainActor
final class DailyPickReminderTests: XCTestCase {
    override func setUp() {
        super.setUp()
        UserDefaults.standard.removeObject(forKey: DailyPickReminder.enabledKey)
    }

    func testEnableSchedulesOneRepeatingNineAMCalendarTrigger() async {
        let center = FakeNotificationCenter(authorize: true)
        let granted = await DailyPickReminder.enable(center: center)

        XCTAssertTrue(granted)
        XCTAssertTrue(DailyPickReminder.isEnabled)
        XCTAssertEqual(center.added.count, 1)
        let request = center.added[0]
        XCTAssertEqual(request.identifier, DailyPickReminder.identifier)
        XCTAssertEqual(request.content.userInfo["aix.route"] as? String, "daily-pick")
        let trigger = request.trigger as? UNCalendarNotificationTrigger
        XCTAssertEqual(trigger?.dateComponents.hour, DailyPickReminder.fireHour)
        XCTAssertEqual(trigger?.repeats, true)
    }

    func testDeniedPermissionDisablesAndSchedulesNothing() async {
        let center = FakeNotificationCenter(authorize: false)
        let granted = await DailyPickReminder.enable(center: center)

        XCTAssertFalse(granted)
        XCTAssertFalse(DailyPickReminder.isEnabled)
        XCTAssertTrue(center.added.isEmpty)
    }

    func testDisableRemovesThePendingRequest() async {
        let center = FakeNotificationCenter(authorize: true)
        _ = await DailyPickReminder.enable(center: center)

        DailyPickReminder.disable(center: center)
        XCTAssertEqual(center.removed, [DailyPickReminder.identifier])
        XCTAssertFalse(DailyPickReminder.isEnabled)
    }
}

final class FakeNotificationCenter: NotificationScheduling, @unchecked Sendable {
    let authorize: Bool
    private(set) var added: [UNNotificationRequest] = []
    private(set) var removed: [String] = []

    init(authorize: Bool) {
        self.authorize = authorize
    }

    func requestAuthorization() async throws -> Bool { authorize }

    func add(_ request: UNNotificationRequest) async throws {
        added.append(request)
    }

    func removePendingRequests(withIdentifiers identifiers: [String]) {
        removed.append(contentsOf: identifiers)
    }
}
