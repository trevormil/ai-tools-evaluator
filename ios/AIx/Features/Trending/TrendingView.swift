import SwiftUI

/// Trending tab — what's rising on GitHub / Product Hunt right now.
/// Rows push a full in-app detail (README, screenshots, stats) so you rarely
/// need to leave the app.
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
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Text(vm.source.fullName)
                        .font(.subheadline.weight(.semibold))
                        .foregroundStyle(.secondary)
                }
                // Time window rides the nav bar (same pattern as the
                // directory's sort) instead of a second segmented row.
                ToolbarItem(placement: .topBarTrailing) {
                    if vm.source.supportsWindow {
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
            }
            .navigationDestination(for: TrendingRepo.self) { repo in
                TrendingRepoDetailView(repo: repo)
            }
            .navigationDestination(for: TrendingProduct.self) { product in
                TrendingProductDetailView(product: product)
            }
            .navigationDestination(for: TrendingStory.self) { story in
                TrendingStoryDetailView(story: story)
            }
            .navigationDestination(for: TrendingModel.self) { model in
                TrendingModelDetailView(model: model)
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
                            .plainNavigation(value: repo)
                    }
                case .products(let products):
                    ForEach(Array(products.enumerated()), id: \.element.id) { index, product in
                        TrendingProductRow(product: product, rank: index + 1)
                            .plainNavigation(value: product)
                    }
                case .stories(let stories):
                    ForEach(Array(stories.enumerated()), id: \.element.id) { index, story in
                        TrendingStoryRow(story: story, rank: index + 1)
                            .plainNavigation(value: story)
                    }
                case .models(let models):
                    ForEach(Array(models.enumerated()), id: \.element.id) { index, model in
                        TrendingModelRow(model: model, rank: index + 1)
                            .plainNavigation(value: model)
                    }
                }
            }
            .listStyle(.plain)
            .refreshable { await vm.loadCurrent(force: true) }
        }
    }
}

// MARK: - Rows

private struct TrendingRepoRow: View {
    let repo: TrendingRepo
    let rank: Int

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            rankGutter(rank)
            SquareThumb(url: repo.avatarURL, fallbackSymbol: "chevron.left.forwardslash.chevron.right")
            VStack(alignment: .leading, spacing: 5) {
                Text(repo.fullName)
                    .font(.headline)
                    .lineLimit(1)
                    .truncationMode(.middle)
                if let description = repo.description, !description.isEmpty {
                    Text(description)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(5)
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
                }
            }
        }
        .padding(.vertical, 6)
    }
}

private struct TrendingProductRow: View {
    let product: TrendingProduct
    let rank: Int

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            rankGutter(rank)
            SquareThumb(url: product.thumbnailURL, fallbackSymbol: "shippingbox")
            VStack(alignment: .leading, spacing: 5) {
                Text(product.name).font(.headline)
                Text(product.tagline)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(5)
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
                }
            }
        }
        .padding(.vertical, 6)
    }
}

private func rankGutter(_ rank: Int) -> some View {
    Text("\(rank)")
        .font(.subheadline.weight(.heavy).monospacedDigit())
        .foregroundStyle(.secondary)
        .frame(width: 24, alignment: .center)
        .padding(.top, 2)
}

/// Small square image with an SF Symbol fallback (avatars, PH thumbnails).
struct SquareThumb: View {
    let url: URL?
    var fallbackSymbol: String = "cube.transparent"
    var size: CGFloat = 48

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityHidden(true)
    }

    private var fallback: some View {
        RoundedRectangle(cornerRadius: 10)
            .fill(Color.accentColor.opacity(0.12))
            .overlay(
                Image(systemName: fallbackSymbol)
                    .font(.system(size: size * 0.4))
                    .foregroundStyle(Color.accentColor.opacity(0.7))
            )
    }
}

private struct TrendingStoryRow: View {
    let story: TrendingStory
    let rank: Int

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            rankGutter(rank)
            SquareThumb(url: nil, fallbackSymbol: "newspaper")
            VStack(alignment: .leading, spacing: 5) {
                Text(story.title)
                    .font(.headline)
                    .lineLimit(3)
                HStack(spacing: 12) {
                    Label("\(story.points)", systemImage: "arrowtriangle.up.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.orange)
                    Label("\(story.comments)", systemImage: "bubble.right")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let domain = story.domain {
                        Text(domain)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer()
                }
            }
        }
        .padding(.vertical, 6)
    }
}

private struct TrendingModelRow: View {
    let model: TrendingModel
    let rank: Int

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            rankGutter(rank)
            SquareThumb(url: nil, fallbackSymbol: "cpu")
            VStack(alignment: .leading, spacing: 5) {
                Text(model.modelName).font(.headline).lineLimit(2)
                Text(model.owner)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                HStack(spacing: 12) {
                    Label("\(model.likes)", systemImage: "heart.fill")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.pink)
                    Label(compactCount(model.downloads), systemImage: "arrow.down.circle")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    if let pipeline = model.pipelineTag {
                        Text(pipeline)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                    Spacer()
                }
            }
        }
        .padding(.vertical, 6)
    }
}

/// 1234567 → "1.2M" style download counts.
func compactCount(_ n: Int) -> String {
    switch n {
    case 1_000_000...: return String(format: "%.1fM", Double(n) / 1_000_000)
    case 1_000...: return String(format: "%.1fK", Double(n) / 1_000)
    default: return "\(n)"
    }
}
