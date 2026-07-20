import SwiftUI

/// The unified home tab: source chips — AIx (the judged feed) first, then
/// what's rising on GitHub / Product Hunt / HN / Hugging Face. Every row
/// pushes a full in-app detail (evaluations, READMEs, model cards) so you
/// rarely need to leave the app.
struct BrowseView: View {
    @EnvironmentObject private var router: AppRouter
    @State private var vm = TrendingViewModel()
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            VStack(spacing: 8) {
                SourceChipRow(selected: $vm.source)

                if vm.source == .aix {
                    FeedPane()
                } else {
                    content
                }
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                // Time window rides the nav bar (same pattern as the
                // directory's sort); AIx and HF don't have windows.
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
            .navigationDestination(for: String.self) { slug in
                ItemDetailView(slug: slug)
            }
            .navigationDestination(for: RecapRoute.self) { _ in
                RecapScreen()
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
            .onChange(of: router.pendingItemSlug) { _, slug in
                openPending(slug)
            }
            .onAppear { openPending(router.pendingItemSlug) }
        }
    }

    /// A notification/Spotlight tap requested a specific AIx item.
    private func openPending(_ slug: String?) {
        guard let slug else { return }
        router.pendingItemSlug = nil
        vm.source = .aix
        path.append(slug)
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
            SourceBadge(source: .huggingface, size: 48)
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

// MARK: - Source picker (chips with brand badges)

/// Roomy, scrollable source chips — replaces the cramped 4-way segmented
/// control. Badges are drawn in brand colors (no bundled logo assets).
struct SourceChipRow: View {
    @Binding var selected: TrendingViewModel.Source

    var body: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 8) {
                ForEach(TrendingViewModel.Source.allCases) { source in
                    chip(source)
                }
            }
            .padding(.horizontal)
            .padding(.vertical, 2)
        }
    }

    private func chip(_ source: TrendingViewModel.Source) -> some View {
        let isSelected = source == selected
        return Button {
            selected = source
        } label: {
            HStack(spacing: 7) {
                SourceBadge(source: source, size: 22)
                Text(source.fullName)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(isSelected ? Color.accentColor : .primary)
            }
            .padding(.horizontal, 12)
            .padding(.vertical, 7)
            .background(
                isSelected ? Color.accentColor.opacity(0.14) : Theme.cardBackground,
                in: Capsule()
            )
            .overlay(
                Capsule().strokeBorder(
                    isSelected ? Color.accentColor.opacity(0.7) : Color.clear,
                    lineWidth: 1.5
                )
            )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(source.fullName)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }
}

/// Brand mark for each source: AIx's funnel, GitHub's official Octocat mark
/// (bundled per github.com/logos, used to link to GitHub), PH's white-P
/// circle, HN's Y square, and Hugging Face's 🤗 (its actual logo).
struct SourceBadge: View {
    let source: TrendingViewModel.Source
    var size: CGFloat = 22

    var body: some View {
        ZStack {
            shape
            glyph
        }
        .frame(width: size, height: size)
        .accessibilityHidden(true)
    }

    @ViewBuilder
    private var shape: some View {
        // PH's mark is a circle; the rest are rounded squares.
        if source == .producthunt {
            Circle().fill(background)
        } else {
            RoundedRectangle(cornerRadius: size * 0.24).fill(background)
        }
    }

    private var background: Color {
        switch source {
        case .aix: return Color(red: 0.04, green: 0.06, blue: 0.13) // #0a1020
        case .github: return .white
        case .producthunt: return Color(red: 0.85, green: 0.33, blue: 0.18)
        case .hackernews: return Color(red: 1.0, green: 0.40, blue: 0.0)
        case .huggingface: return Color(red: 1.0, green: 0.82, blue: 0.26)
        }
    }

    @ViewBuilder
    private var glyph: some View {
        switch source {
        case .aix:
            // The funnel from the site logo, in the brand blue.
            Image(systemName: "line.3.horizontal.decrease")
                .font(.system(size: size * 0.55, weight: .bold))
                .foregroundStyle(Color(red: 0.18, green: 0.50, blue: 0.96))
        case .github:
            // The official Octocat mark ships black-on-white — show as-is.
            Image("GitHubMark")
                .resizable()
                .scaledToFit()
                .frame(width: size * 0.86, height: size * 0.86)
        case .producthunt:
            Text("P")
                .font(.system(size: size * 0.62, weight: .heavy, design: .rounded))
                .foregroundStyle(.white)
        case .hackernews:
            Text("Y")
                .font(.system(size: size * 0.62, weight: .heavy))
                .foregroundStyle(.white)
        case .huggingface:
            Text("🤗")
                .font(.system(size: size * 0.60))
        }
    }
}
