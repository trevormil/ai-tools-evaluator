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
        case .loaded(let markdown):
            if let markdown, !markdown.isEmpty {
                ReadmePane(markdown: markdown)
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
