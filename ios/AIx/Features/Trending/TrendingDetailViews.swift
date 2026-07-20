import SwiftUI

// MARK: - GitHub repo detail (in-app README, stats, save)

struct TrendingRepoDetailView: View {
    let repo: TrendingRepo
    @EnvironmentObject private var favorites: FavoritesStore
    @State private var readme: LoadState<String?> = .idle
    @State private var client = APIClient()
    @State private var savedFlash = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    SquareThumb(url: repo.avatarURL, fallbackSymbol: "chevron.left.forwardslash.chevron.right", size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(repo.fullName)
                            .font(.title3.weight(.bold))
                            .lineLimit(2)
                            .truncationMode(.middle)
                        if let language = repo.language {
                            Text(language).font(.caption).foregroundStyle(.secondary)
                        }
                    }
                }

                if let description = repo.description, !description.isEmpty {
                    Text(description)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                }

                statChips

                if !repo.topics.isEmpty {
                    topicCloud(repo.topics)
                }

                actionButtons

                Divider()

                readmeSection
            }
            .padding()
        }
        .navigationTitle(repo.fullName.components(separatedBy: "/").last ?? repo.fullName)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            if case .idle = readme {
                readme = .loading
                do {
                    readme = .loaded(try await client.fetchTrendingReadme(repo: repo.fullName))
                } catch APIError.cancelled {
                    readme = .idle
                } catch {
                    readme = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
                }
            }
        }
    }

    private var statChips: some View {
        HStack(spacing: 10) {
            chip("star.fill", "\(repo.stars)", tint: .orange)
            chip("tuningfork", "\(repo.forks) forks", tint: .secondary)
            chip("exclamationmark.circle", "\(repo.openIssues) issues", tint: .secondary)
            if let license = repo.license {
                chip("checkmark.seal", license, tint: .secondary)
            }
        }
        .font(.caption.weight(.semibold))
    }

    private func chip(_ symbol: String, _ text: String, tint: Color) -> some View {
        Label(text, systemImage: symbol)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.primary.opacity(0.06), in: Capsule())
            .foregroundStyle(tint == .secondary ? Color.secondary : tint)
    }

    private var actionButtons: some View {
        HStack(spacing: 10) {
            if let url = repo.pageURL {
                Link(destination: url) {
                    Label("GitHub", systemImage: "arrow.up.right.square")
                }
                .buttonStyle(.borderedProminent)
            }
            if let homepage = repo.homepageURL {
                Link(destination: homepage) {
                    Label("Site", systemImage: "globe")
                }
                .buttonStyle(.bordered)
            }
            Button {
                savedFlash = favorites.addLink(
                    url: repo.url,
                    title: repo.fullName,
                    note: repo.description
                )
            } label: {
                Label(savedFlash ? "Saved" : "Save", systemImage: savedFlash ? "bookmark.fill" : "bookmark")
            }
            .buttonStyle(.bordered)
        }
        .font(.subheadline.weight(.semibold))
    }

    @ViewBuilder
    private var readmeSection: some View {
        switch readme {
        case .idle, .loading:
            HStack { Spacer(); ProgressView("Loading README…"); Spacer() }
                .padding(.vertical, 20)
        case .failed(let message):
            Text("Couldn't load the README. \(message)")
                .font(.footnote)
                .foregroundStyle(.secondary)
        case .loaded(let html):
            if let html, !html.isEmpty {
                // Base URL resolves any relative image paths GitHub left in.
                ReadmePane(html: html, baseURL: URL(string: "https://github.com/\(repo.fullName)/raw/HEAD/"))
            } else {
                Text("This repo has no README.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

// MARK: - Product Hunt detail (full story, screenshots, save)

struct TrendingProductDetailView: View {
    let product: TrendingProduct
    @EnvironmentObject private var favorites: FavoritesStore
    @State private var savedFlash = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    SquareThumb(url: product.thumbnailURL, fallbackSymbol: "shippingbox", size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(product.name).font(.title3.weight(.bold))
                        Text(product.tagline)
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                }

                HStack(spacing: 10) {
                    Label("\(product.votes)", systemImage: "arrowtriangle.up.fill")
                        .foregroundStyle(.orange)
                    Label("\(product.commentsCount) comments", systemImage: "bubble.right")
                        .foregroundStyle(.secondary)
                }
                .font(.caption.weight(.semibold))

                if !product.topics.isEmpty {
                    topicCloud(product.topics)
                }

                HStack(spacing: 10) {
                    if let url = product.pageURL {
                        Link(destination: url) {
                            Label("Product Hunt", systemImage: "arrow.up.right.square")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    if let website = product.websiteURL {
                        Link(destination: website) {
                            Label("Site", systemImage: "globe")
                        }
                        .buttonStyle(.bordered)
                    }
                    Button {
                        savedFlash = favorites.addLink(
                            url: product.url,
                            title: product.name,
                            note: product.tagline
                        )
                    } label: {
                        Label(savedFlash ? "Saved" : "Save", systemImage: savedFlash ? "bookmark.fill" : "bookmark")
                    }
                    .buttonStyle(.bordered)
                }
                .font(.subheadline.weight(.semibold))

                if let description = product.description, !description.isEmpty {
                    Divider()
                    Text(description)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                }

                if !product.mediaUrls.isEmpty {
                    Divider()
                    Text("Screenshots").font(.headline)
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 10) {
                            ForEach(product.mediaUrls, id: \.self) { urlString in
                                if let url = URL(string: urlString) {
                                    AsyncImage(url: url) { phase in
                                        if case .success(let image) = phase {
                                            image.resizable().aspectRatio(contentMode: .fill)
                                        } else {
                                            Color.primary.opacity(0.06)
                                        }
                                    }
                                    .frame(width: 260, height: 170)
                                    .clipShape(RoundedRectangle(cornerRadius: 12))
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .navigationTitle(product.name)
        .navigationBarTitleDisplayMode(.inline)
    }
}

// MARK: - Shared

@ViewBuilder
func topicCloud(_ topics: [String]) -> some View {
    ScrollView(.horizontal, showsIndicators: false) {
        HStack(spacing: 6) {
            ForEach(topics, id: \.self) { topic in
                Text(topic)
                    .font(.caption2.weight(.medium))
                    .padding(.horizontal, 8)
                    .padding(.vertical, 3)
                    .background(Color.primary.opacity(0.07), in: Capsule())
            }
        }
    }
}

// MARK: - HackerNews story detail (post + discussion + linked-repo README)

struct TrendingStoryDetailView: View {
    let story: TrendingStory
    @EnvironmentObject private var favorites: FavoritesStore
    @State private var discussion: LoadState<HnItemDetail> = .idle
    @State private var readme: LoadState<String?> = .idle
    @State private var client = APIClient()
    @State private var savedFlash = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                Text(story.title)
                    .font(.title3.weight(.bold))
                    .fixedSize(horizontal: false, vertical: true)

                HStack(spacing: 10) {
                    Label("\(story.points) points", systemImage: "arrowtriangle.up.fill")
                        .foregroundStyle(.orange)
                    Label("\(story.comments) comments", systemImage: "bubble.right")
                        .foregroundStyle(.secondary)
                    if let author = story.author {
                        Text("by \(author)").foregroundStyle(.secondary)
                    }
                }
                .font(.caption.weight(.semibold))

                HStack(spacing: 10) {
                    if let url = story.pageURL {
                        Link(destination: url) {
                            Label(story.domain ?? "Open", systemImage: "arrow.up.right.square")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    if let discussionURL = story.discussionURL {
                        Link(destination: discussionURL) {
                            Label("HN", systemImage: "bubble.left.and.bubble.right")
                        }
                        .buttonStyle(.bordered)
                    }
                    Button {
                        savedFlash = favorites.addLink(
                            url: story.url ?? story.hnUrl,
                            title: story.title,
                            note: "Show HN · \(story.points) points"
                        )
                    } label: {
                        Label(savedFlash ? "Saved" : "Save", systemImage: savedFlash ? "bookmark.fill" : "bookmark")
                    }
                    .buttonStyle(.bordered)
                }
                .font(.subheadline.weight(.semibold))

                // The submitter's own text post, when there is one.
                if case .loaded(let detail) = discussion, let text = detail.text, !text.isEmpty {
                    Text(text)
                        .font(.callout)
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(12)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 12))
                }

                if let repo = story.githubRepo {
                    Divider()
                    repoReadme(repo)
                }

                Divider()
                discussionSection
            }
            .padding()
        }
        .navigationTitle("Show HN")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await loadDiscussion()
            await loadReadme()
        }
    }

    private func loadDiscussion() async {
        guard let id = story.storyID, case .idle = discussion else { return }
        discussion = .loading
        do {
            discussion = .loaded(try await client.fetchHNItem(id: id))
        } catch APIError.cancelled {
            discussion = .idle
        } catch {
            discussion = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    private func loadReadme() async {
        guard let repo = story.githubRepo, case .idle = readme else { return }
        readme = .loading
        do {
            readme = .loaded(try await client.fetchTrendingReadme(repo: repo))
        } catch APIError.cancelled {
            readme = .idle
        } catch {
            readme = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    @ViewBuilder
    private var discussionSection: some View {
        Text("Discussion").font(.headline)
        switch discussion {
        case .idle, .loading:
            HStack { Spacer(); ProgressView("Loading comments…"); Spacer() }
                .padding(.vertical, 12)
        case .failed(let message):
            Text("Couldn't load the discussion. \(message)")
                .font(.footnote)
                .foregroundStyle(.secondary)
        case .loaded(let detail):
            if detail.comments.isEmpty {
                Text("No comments yet.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            } else {
                ForEach(detail.comments) { comment in
                    HnCommentRow(comment: comment)
                }
                if let discussionURL = story.discussionURL {
                    Link("Full thread on Hacker News →", destination: discussionURL)
                        .font(.footnote.weight(.semibold))
                }
            }
        }
    }

    @ViewBuilder
    private func repoReadme(_ repo: String) -> some View {
        switch readme {
        case .idle, .loading:
            HStack { Spacer(); ProgressView("Loading README…"); Spacer() }
                .padding(.vertical, 20)
        case .failed(let message):
            Text("Couldn't load the README. \(message)")
                .font(.footnote)
                .foregroundStyle(.secondary)
        case .loaded(let html):
            if let html, !html.isEmpty {
                DisclosureGroup {
                    ReadmePane(html: html, baseURL: URL(string: "https://github.com/\(repo)/raw/HEAD/"))
                } label: {
                    Label("README — \(repo)", systemImage: "doc.text")
                        .font(.subheadline.weight(.semibold))
                }
            } else {
                Text("\(repo) has no README.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}

/// One top-level HN comment (plain text, server-stripped).
private struct HnCommentRow: View {
    let comment: HnComment

    var body: some View {
        VStack(alignment: .leading, spacing: 5) {
            HStack(spacing: 8) {
                Text(comment.author ?? "anonymous")
                    .font(.caption.weight(.bold))
                if comment.replies > 0 {
                    Text("\(comment.replies) repl\(comment.replies == 1 ? "y" : "ies")")
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
                Spacer()
            }
            Text(comment.text)
                .font(.callout)
                .fixedSize(horizontal: false, vertical: true)
                .lineLimit(12)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Hugging Face model detail (model card in-app)

struct TrendingModelDetailView: View {
    let model: TrendingModel
    @EnvironmentObject private var favorites: FavoritesStore
    @State private var card: LoadState<String?> = .idle
    @State private var client = APIClient()
    @State private var savedFlash = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 16) {
                HStack(spacing: 12) {
                    SquareThumb(url: model.authorAvatarURL, monogram: model.modelName, size: 56)
                    VStack(alignment: .leading, spacing: 4) {
                        Text(model.modelName).font(.title3.weight(.bold))
                        Text(model.owner).font(.subheadline).foregroundStyle(.secondary)
                    }
                }

                if let description = model.description, !description.isEmpty {
                    Text(description)
                        .font(.body)
                        .fixedSize(horizontal: false, vertical: true)
                }

                HStack(spacing: 10) {
                    Label("\(model.likes)", systemImage: "heart.fill")
                        .foregroundStyle(.pink)
                    Label("\(compactCount(model.downloads)) downloads", systemImage: "arrow.down.circle")
                        .foregroundStyle(.secondary)
                    if let pipeline = model.pipelineTag {
                        Text(pipeline).foregroundStyle(.secondary)
                    }
                }
                .font(.caption.weight(.semibold))

                if !model.tags.isEmpty {
                    topicCloud(model.tags)
                }

                HStack(spacing: 10) {
                    if let url = model.pageURL {
                        Link(destination: url) {
                            Label("Hugging Face", systemImage: "arrow.up.right.square")
                        }
                        .buttonStyle(.borderedProminent)
                    }
                    Button {
                        savedFlash = favorites.addLink(
                            url: model.url,
                            title: model.id,
                            note: model.pipelineTag
                        )
                    } label: {
                        Label(savedFlash ? "Saved" : "Save", systemImage: savedFlash ? "bookmark.fill" : "bookmark")
                    }
                    .buttonStyle(.bordered)
                }
                .font(.subheadline.weight(.semibold))

                Divider()

                cardSection
            }
            .padding()
        }
        .navigationTitle(model.modelName)
        .navigationBarTitleDisplayMode(.inline)
        .task {
            guard case .idle = card else { return }
            card = .loading
            do {
                card = .loaded(try await client.fetchModelCard(model: model.id))
            } catch APIError.cancelled {
                card = .idle
            } catch {
                card = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }

    @ViewBuilder
    private var cardSection: some View {
        switch card {
        case .idle, .loading:
            HStack { Spacer(); ProgressView("Loading model card…"); Spacer() }
                .padding(.vertical, 20)
        case .failed(let message):
            Text("Couldn't load the model card. \(message)")
                .font(.footnote)
                .foregroundStyle(.secondary)
        case .loaded(let html):
            if let html, !html.isEmpty {
                // Base URL resolves relative images in the card.
                ReadmePane(html: html, baseURL: URL(string: "https://huggingface.co/\(model.id)/resolve/main/"))
            } else {
                Text("This model has no card.")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
    }
}
