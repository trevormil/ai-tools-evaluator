import SwiftUI

@main
struct AIxApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate
    @StateObject private var router = AppRouter.shared
    @StateObject private var favorites = FavoritesStore()

    var body: some Scene {
        WindowGroup {
            RootView()
                .environmentObject(router)
                .environmentObject(favorites)
        }
    }
}

/// Cross-tab navigation requests (e.g. the daily-pick notification tap).
@MainActor
final class AppRouter: ObservableObject {
    static let shared = AppRouter()

    enum Tab: Hashable {
        case feed, trending, directory, favorites, settings
    }

    @Published var selectedTab: Tab = .feed
    /// Slug the feed should open on next appearance (set by notification taps).
    @Published var pendingItemSlug: String?

    func openDailyPick(slug: String?) {
        selectedTab = .feed
        pendingItemSlug = slug
    }
}

struct RootView: View {
    @EnvironmentObject private var router: AppRouter

    var body: some View {
        TabView(selection: $router.selectedTab) {
            FeedView()
                .tabItem { Label("Feed", systemImage: "bolt.horizontal") }
                .tag(AppRouter.Tab.feed)

            TrendingView()
                .tabItem { Label("Trending", systemImage: "chart.line.uptrend.xyaxis") }
                .tag(AppRouter.Tab.trending)

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
