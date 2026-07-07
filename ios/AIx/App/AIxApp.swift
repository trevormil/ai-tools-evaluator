import SwiftUI

@main
struct AIxApp: App {
    var body: some Scene {
        WindowGroup {
            RootView()
        }
    }
}

struct RootView: View {
    var body: some View {
        TabView {
            DirectoryView()
                .tabItem { Label("Directory", systemImage: "square.grid.2x2") }

            LeaderboardView()
                .tabItem { Label("Leaderboard", systemImage: "trophy") }

            SettingsView()
                .tabItem { Label("Settings", systemImage: "gearshape") }
        }
    }
}
