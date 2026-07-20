import SwiftUI

/// Home tab — Today's pick + the unified timeline (web `/` parity, read-only).
struct FeedView: View {
    @EnvironmentObject private var router: AppRouter
    @State private var vm = FeedViewModel()
    @State private var path = NavigationPath()

    var body: some View {
        NavigationStack(path: $path) {
            Group {
                if let error = vm.errorMessage, vm.entries.isEmpty {
                    MessageState(
                        systemImage: "exclamationmark.triangle",
                        title: "Couldn't load the feed",
                        message: error,
                        retry: { Task { await vm.refresh() } }
                    )
                } else if vm.entries.isEmpty && vm.isLoading {
                    ProgressView("Loading…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                } else {
                    feedList
                }
            }
            .navigationTitle("AIx")
            .navigationDestination(for: String.self) { slug in
                ItemDetailView(slug: slug)
            }
            .task { if vm.needsInitialLoad { await vm.refresh() } }
            .onChange(of: router.pendingItemSlug) { _, slug in
                openPending(slug)
            }
            .onAppear { openPending(router.pendingItemSlug) }
        }
    }

    /// A notification tap requested a specific item (the daily pick).
    private func openPending(_ slug: String?) {
        guard let slug else { return }
        router.pendingItemSlug = nil
        path.append(slug)
    }

    private var feedList: some View {
        List {
            if let pick = vm.dailyPick {
                Section {
                    NavigationLink(value: pick.item.slug) {
                        DailyPickCard(pick: pick)
                    }
                    .buttonStyle(.plain)
                    .listRowSeparator(.hidden)
                }
            }

            ForEach(vm.entries) { entry in
                FeedEntryRow(entry: entry)
                    .onAppear {
                        if entry.id == vm.entries.last?.id {
                            Task { await vm.loadMore() }
                        }
                    }
            }

            if vm.isLoadingMore {
                HStack { Spacer(); ProgressView(); Spacer() }
                    .listRowSeparator(.hidden)
            }
        }
        .listStyle(.plain)
        .refreshable { await vm.refresh() }
    }
}

/// "Today's pick" — the headline card above the timeline (web home parity).
struct DailyPickCard: View {
    let pick: DailyPick

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("TODAY'S PICK", systemImage: "sun.max.fill")
                .font(.caption.weight(.heavy))
                .foregroundStyle(.orange)
            Text(pick.item.title).font(.title3.weight(.bold))
            Text(pick.item.tagline)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .lineLimit(3)
            HStack(spacing: 8) {
                VerdictBadge(verdict: pick.item.verdict, compact: true)
                ScoreChip(score: pick.item.overallScore)
                Spacer()
                Text(pick.item.category.label)
                    .font(.caption).foregroundStyle(.secondary)
            }
        }
        .padding(14)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            LinearGradient(
                colors: [Color.orange.opacity(0.12), Theme.cardBackground],
                startPoint: .topLeading, endPoint: .bottomTrailing
            ),
            in: RoundedRectangle(cornerRadius: 14)
        )
        .overlay(
            RoundedRectangle(cornerRadius: 14)
                .strokeBorder(Color.orange.opacity(0.25))
        )
    }
}

/// One timeline entry: a fresh item, a legacy post, or a social activity —
/// all rendered read-only.
struct FeedEntryRow: View {
    let entry: FeedEntry

    var body: some View {
        switch entry {
        case .item(let item, _):
            NavigationLink(value: item.slug) {
                FeedItemCard(item: item)
            }
            .buttonStyle(.plain)
        case .post(let post, let author, let item, _):
            VStack(alignment: .leading, spacing: 8) {
                actorLine(name: author.name, label: "posted", avatarURL: author.avatarURL)
                Text(post.body).font(.body)
                if let item { embeddedItem(item) }
                countsLine(upvotes: post.upvotes, comments: post.commentCount, createdAt: post.createdAt)
            }
            .padding(.vertical, 4)
        case .activity(_, let actor, let label, let quote, let embed, let createdAt):
            VStack(alignment: .leading, spacing: 8) {
                actorLine(name: actor.name, label: label, avatarURL: actor.avatarURL)
                if let quote, !quote.isEmpty {
                    Text("“\(quote)”").font(.callout.italic()).foregroundStyle(.secondary)
                }
                embedView(embed)
                Text(RelativeTime.string(from: createdAt))
                    .font(.caption2).foregroundStyle(.tertiary)
            }
            .padding(.vertical, 4)
        case .unknown:
            EmptyView()
        }
    }

    private func actorLine(name: String, label: String, avatarURL: URL?) -> some View {
        HStack(spacing: 8) {
            AvatarView(url: avatarURL, name: name, size: 28)
            (Text(name).bold() + Text(" \(label)"))
                .font(.subheadline)
                .lineLimit(2)
        }
    }

    @ViewBuilder
    private func embedView(_ embed: FeedEmbed?) -> some View {
        switch embed {
        case .item(let item):
            embeddedItem(item)
        case .post(let post, let author, _):
            embedCard {
                Text("@\(author.username)").font(.caption.bold())
                Text(post.body).font(.callout).lineLimit(3)
            }
        case .stack(let item, let toolName, let status, let take):
            embedCard {
                Text("\(status.replacingOccurrences(of: "-", with: " ")) · \(item?.title ?? toolName ?? "a tool")")
                    .font(.caption.bold())
                if let take, !take.isEmpty {
                    Text(take).font(.callout).lineLimit(3)
                }
            }
        case .comment(let body, let item, _):
            embedCard {
                if let item { Text("on \(item.title)").font(.caption.bold()) }
                Text(body).font(.callout).lineLimit(3)
            }
        case .unknown, nil:
            EmptyView()
        }
    }

    private func embedCard(@ViewBuilder content: () -> some View) -> some View {
        VStack(alignment: .leading, spacing: 4, content: content)
            .padding(10)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 10))
    }

    private func embeddedItem(_ item: DBItem) -> some View {
        NavigationLink(value: item.slug) {
            FeedItemCard(item: item)
        }
        .buttonStyle(.plain)
    }

    private func countsLine(upvotes: Int, comments: Int, createdAt: Int) -> some View {
        HStack(spacing: 12) {
            Label("\(upvotes)", systemImage: "arrow.up")
            Label("\(comments)", systemImage: "bubble.right")
            Spacer()
            Text(RelativeTime.string(from: createdAt))
        }
        .font(.caption)
        .foregroundStyle(.secondary)
    }
}

/// Compact item card used inside feed entries.
struct FeedItemCard: View {
    let item: DBItem

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                if item.isPending {
                    Text("AWAITING SCORE…")
                        .font(.caption2.weight(.bold))
                        .padding(.horizontal, 6).padding(.vertical, 2)
                        .background(Color.secondary.opacity(0.15), in: Capsule())
                        .foregroundStyle(.secondary)
                } else {
                    VerdictBadge(verdict: item.verdict, compact: true)
                    ScoreChip(score: item.overallScore)
                }
                Spacer()
            }
            Text(item.title).font(.headline)
            Text(item.tagline).font(.subheadline).foregroundStyle(.secondary).lineLimit(2)
            HStack(spacing: 12) {
                Text(item.category.label)
                Label("\(item.upvotes)", systemImage: "arrow.up")
                Label("\(item.commentCount)", systemImage: "bubble.right")
            }
            .font(.caption)
            .foregroundStyle(.secondary)
        }
        .padding(12)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 12))
    }
}

/// Epoch-seconds → "3h ago" style labels.
enum RelativeTime {
    static func string(from epochSeconds: Int) -> String {
        let date = Date(timeIntervalSince1970: TimeInterval(epochSeconds))
        let formatter = RelativeDateTimeFormatter()
        formatter.unitsStyle = .abbreviated
        return formatter.localizedString(for: date, relativeTo: Date())
    }
}
