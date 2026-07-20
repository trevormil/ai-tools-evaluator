import SwiftUI

/// The three web leaderboard lists: top rated, most discussed, hall of shame.
struct LeaderboardView: View {
    @State private var vm = LeaderboardViewModel()

    var body: some View {
        NavigationStack {
            content
                .navigationTitle("Leaderboard")
                .navigationDestination(for: String.self) { slug in
                    ItemDetailView(slug: slug)
                }
        }
        .task { if case .idle = vm.state { await vm.load() } }
    }

    @ViewBuilder
    private var content: some View {
        switch vm.state {
        case .idle, .loading:
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            MessageState(
                systemImage: "trophy",
                title: "Couldn't load the leaderboard",
                message: message,
                retry: { Task { await vm.load() } }
            )
        case .loaded(let board):
            List {
                rankedSection(
                    board.topRated,
                    header: Label("Top Rated", systemImage: "trophy.fill"),
                    ranked: true
                )
                rankedSection(
                    board.mostDiscussed,
                    header: Label("Most Discussed", systemImage: "bubble.left.and.bubble.right.fill"),
                    ranked: false,
                    footer: "Where the arguments are actually happening."
                )
                rankedSection(
                    board.hallOfShame,
                    header: Label("Complexity Trap Hall of Shame", systemImage: "exclamationmark.triangle.fill"),
                    ranked: false,
                    footer: "Judged complexity-trap or redundant — noisiest first. The site's whole point is to name these out loud."
                )
            }
            .listStyle(.insetGrouped)
            .refreshable { await vm.load() }
        }
    }

    @ViewBuilder
    private func rankedSection(
        _ items: [PublicItem],
        header: Label<Text, Image>,
        ranked: Bool,
        footer: String? = nil
    ) -> some View {
        if !items.isEmpty {
            Section {
                ForEach(Array(items.enumerated()), id: \.element.id) { index, item in
                    NavigationLink(value: item.slug) {
                        ItemRow(item: item, rank: ranked ? index + 1 : nil)
                    }
                }
            } header: {
                header
            } footer: {
                if let footer { Text(footer) }
            }
        }
    }
}
