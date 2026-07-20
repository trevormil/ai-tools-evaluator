import CoreSpotlight
import SwiftUI

@main
struct AIxApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var router = AppRouter.shared
    @StateObject private var favorites = FavoritesStore()

    @Environment(\.scenePhase) private var scenePhase

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(router)
                .environmentObject(favorites)
                // Spotlight results (ticket 0072) deep-link back in.
                .onContinueUserActivity(CSSearchableItemActionType) { activity in
                    guard let id = activity.userInfo?[CSSearchableItemActivityIdentifier] as? String else { return }
                    if id.hasPrefix("item:") {
                        router.openItem(slug: String(id.dropFirst("item:".count)))
                    } else if id.hasPrefix("link:"),
                              let uuid = UUID(uuidString: String(id.dropFirst("link:".count))),
                              let link = favorites.links.first(where: { $0.id == uuid }),
                              let url = link.pageURL {
                        UIApplication.shared.open(url)
                    }
                }
                // Pick up links the share extension queued while we were away.
                .onChange(of: scenePhase) { _, phase in
                    if phase == .active { favorites.drainPendingShared() }
                }
        }
    }
}

/// Cross-tab navigation requests (e.g. the daily-pick notification tap).
@MainActor
final class AppRouter: ObservableObject {
    static let shared = AppRouter()

    enum Tab: Hashable {
        case browse, directory, favorites, settings
    }

    @Published var selectedTab: Tab = {
        // QA affordance: launch straight into a tab (simctl env var).
        switch ProcessInfo.processInfo.environment["AIX_START_TAB"] {
        case "directory": return .directory
        case "favorites": return .favorites
        case "settings": return .settings
        default: return .browse
        }
    }()
    /// Slug the feed should open on next appearance (set by notification taps).
    @Published var pendingItemSlug: String?

    func openDailyPick(slug: String?) {
        selectedTab = .browse
        pendingItemSlug = slug
    }

    /// Open a specific item's detail (Spotlight results, deep links).
    func openItem(slug: String) {
        openDailyPick(slug: slug)
    }
}

struct RootView: View {
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        TabView(selection: $router.selectedTab) {
            BrowseView()
                .tabItem { Label("Browse", systemImage: "globe") }
                .tag(AppRouter.Tab.browse)

            DirectoryView()
                .tabItem { Label("Directory", systemImage: "square.grid.2x2") }
                .tag(AppRouter.Tab.directory)

            FavoritesView()
                .tabItem { Label("Favorites", systemImage: "bookmark") }
                .tag(AppRouter.Tab.favorites)

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(AppRouter.Tab.settings)
        }
    }
}
