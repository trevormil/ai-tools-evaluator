import SwiftUI

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
        .task { if case .idle = vm.top { await vm.load() } }
    }

    @ViewBuilder
    private var content: some View {
        switch vm.top {
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
        case .loaded(let topItems):
            List {
                Section {
                    ForEach(Array(topItems.enumerated()), id: \.element.id) { index, item in
                        NavigationLink(value: item.slug) {
                            ItemRow(item: item, rank: index + 1)
                        }
                    }
                } header: {
                    Label("Top by Score", systemImage: "trophy.fill")
                }

                trapsSection
            }
            .listStyle(.insetGrouped)
            .refreshable { await vm.refresh() }
        }
    }

    @ViewBuilder
    private var trapsSection: some View {
        if case .loaded(let traps) = vm.complexityTraps, !traps.isEmpty {
            Section {
                ForEach(traps) { item in
                    NavigationLink(value: item.slug) {
                        ItemRow(item: item)
                    }
                }
            } header: {
                Label("Complexity Trap", systemImage: "exclamationmark.triangle.fill")
            } footer: {
                Text("High moving-part count, low real payoff — adds complexity without earning it.")
            }
        }
    }
}
