import SwiftUI

/// Trending tab — what's rising on GitHub / Product Hunt right now.
/// Rows open the upstream page (these aren't AIx-judged items).
struct TrendingView: View {
    @State private var vm = TrendingViewModel()

    var body: some View {
        NavigationStack {
            VStack(spacing: 8) {
                Picker("Source", selection: $vm.source) {
                    ForEach(TrendingViewModel.Source.allCases) { s in
                        Text(s.label).tag(s)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                content
            }
            .navigationTitle("Trending")
            .toolbar {
                // Time window rides the nav bar (same pattern as the
                // directory's sort) instead of a second segmented row.
                ToolbarItem(placement: .topBarTrailing) {
                    Menu {
                        Picker("Window", selection: $vm.window) {
                            ForEach(TrendingWindow.allCases) { w in
                                Text(w.label).tag(w)
                            }
                        }
                    } label: {
                        Label(vm.window.label, systemImage: "calendar")
                            .labelStyle(.titleAndIcon)
                            .font(.subheadline.weight(.semibold))
                    }
                }
            }
            .task { await vm.loadCurrent() }
            .onChange(of: vm.source) { _, _ in Task { await vm.loadCurrent() } }
            .onChange(of: vm.window) { _, _ in Task { await vm.loadCurrent() } }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch vm.currentState {
        case .idle, .loading:
            ProgressView("Loading…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .failed(let message):
            MessageState(
                systemImage: "chart.line.uptrend.xyaxis",
                title: "Couldn't load trending",
                message: message,
                retry: { Task { await vm.loadCurrent(force: true) } }
            )
        case .loaded(let pane):
            List {
                switch pane {
                case .repos(let repos):
                    ForEach(Array(repos.enumerated()), id: \.element.id) { index, repo in
                        TrendingRepoRow(repo: repo, rank: index + 1)
                    }
                case .products(let products):
                    ForEach(Array(products.enumerated()), id: \.element.id) { index, product in
                        TrendingProductRow(product: product, rank: index + 1)
                    }
                }
            }
            .listStyle(.plain)
            .refreshable { await vm.loadCurrent(force: true) }
        }
    }
}

private struct TrendingRepoRow: View {
    let repo: TrendingRepo
    let rank: Int

    var body: some View {
        row(rank: rank, url: repo.pageURL) {
            Text(repo.fullName)
                .font(.headline)
                .lineLimit(1)
                .truncationMode(.middle)
            if let description = repo.description, !description.isEmpty {
                Text(description)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
            }
            HStack(spacing: 12) {
                Label("\(repo.stars)", systemImage: "star.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
                if let language = repo.language {
                    Text(language)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

private struct TrendingProductRow: View {
    let product: TrendingProduct
    let rank: Int

    var body: some View {
        row(rank: rank, url: product.pageURL) {
            Text(product.name)
                .font(.headline)
            Text(product.tagline)
                .font(.footnote)
                .foregroundStyle(.secondary)
                .lineLimit(3)
            HStack(spacing: 12) {
                Label("\(product.votes)", systemImage: "arrowtriangle.up.fill")
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(.orange)
                if !product.topics.isEmpty {
                    Text(product.topics.prefix(3).joined(separator: " · "))
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .lineLimit(1)
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(.caption2)
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

/// Shared rank-gutter row chrome; the whole row links out to the source page.
@ViewBuilder
private func row(rank: Int, url: URL?, @ViewBuilder content: () -> some View) -> some View {
    let body = HStack(alignment: .top, spacing: 12) {
        Text("\(rank)")
            .font(.title3.weight(.heavy).monospacedDigit())
            .foregroundStyle(.secondary)
            .frame(width: 28, alignment: .center)
        VStack(alignment: .leading, spacing: 5, content: content)
    }
    .padding(.vertical, 6)

    if let url {
        Link(destination: url) { body }
            .buttonStyle(.plain)
    } else {
        body
    }
}
