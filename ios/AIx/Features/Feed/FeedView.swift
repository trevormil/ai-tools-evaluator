import SwiftUI

/// Home tab — Today's pick, last night's recap strip, and the unified
/// timeline (web `/` parity, read-only).
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
            .navigationDestination(for: RecapRoute.self) { _ in
                RecapScreen()
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
                NavigationLink(value: pick.item.slug) {
                    DailyPickCard(pick: pick)
                }
                .buttonStyle(.plain)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 4, trailing: 16))
            }

            if let recap = vm.latestRecap {
                NavigationLink(value: RecapRoute()) {
                    RecapStrip(recap: recap)
                }
                .buttonStyle(.plain)
                .listRowSeparator(.hidden)
                .listRowInsets(EdgeInsets(top: 4, leading: 16, bottom: 10, trailing: 16))
            }

            ForEach(vm.entries) { entry in
                FeedEntryRow(entry: entry)
                    .listRowSeparator(.hidden)
                    .listRowInsets(EdgeInsets(top: 6, leading: 16, bottom: 6, trailing: 16))
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

/// Pushed-recap navigation token (the feed's stack owns the destinations).
struct RecapRoute: Hashable {}

// MARK: - Today's pick

/// "Today's pick" — the headline card above the timeline.
struct DailyPickCard: View {
    let pick: DailyPick

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CoverImage(url: pick.item.coverURL, verdict: pick.item.verdict, height: 150)
            VStack(alignment: .leading, spacing: 8) {
                Label("TODAY'S PICK", systemImage: "sun.max.fill")
                    .font(.caption.weight(.heavy))
                    .foregroundStyle(.orange)
                Text(pick.item.title).font(.title3.weight(.bold))
                Text(pick.item.tagline)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                HStack(spacing: 8) {
                    VerdictBadge(verdict: pick.item.verdict, compact: true)
                    ScoreChip(score: pick.item.overallScore)
                    Spacer()
                    Text(pick.item.category.label)
                        .font(.caption).foregroundStyle(.secondary)
                }
            }
            .padding(14)
        }
        .background(Theme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .overlay(
            RoundedRectangle(cornerRadius: 16)
                .strokeBorder(Color.orange.opacity(0.35), lineWidth: 1.5)
        )
    }
}

// MARK: - Recap strip

/// One-line "last night" summary that opens the full recap.
struct RecapStrip: View {
    let recap: Recap

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "moon.stars.fill")
                .font(.system(size: 18))
                .foregroundStyle(Color.accentColor)
                .frame(width: 36, height: 36)
                .background(Color.accentColor.opacity(0.12), in: Circle())
            VStack(alignment: .leading, spacing: 2) {
                Text("Last night's recap")
                    .font(.subheadline.weight(.semibold))
                Text("\(recap.total) judged · \(recap.summary)")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
            }
            Spacer()
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(.tertiary)
        }
        .padding(12)
        .background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 14))
    }
}

// MARK: - Timeline entries

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
                actorLine(name: author.name, label: "posted", avatarURL: author.avatarURL, createdAt: post.createdAt)
                Text(post.body).font(.callout)
                if let item { embeddedItem(item) }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 14))
        case .activity(_, let actor, let label, let quote, let embed, let createdAt):
            VStack(alignment: .leading, spacing: 8) {
                actorLine(name: actor.name, label: label, avatarURL: actor.avatarURL, createdAt: createdAt)
                if let quote, !quote.isEmpty {
                    Text("“\(quote)”").font(.callout.italic()).foregroundStyle(.secondary)
                }
                embedView(embed)
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Theme.cardBackground, in: RoundedRectangle(cornerRadius: 14))
        case .unknown:
            EmptyView()
        }
    }

    private func actorLine(name: String, label: String, avatarURL: URL?, createdAt: Int) -> some View {
        HStack(alignment: .top, spacing: 8) {
            AvatarView(url: avatarURL, name: name, size: 30)
            (Text(name).bold() + Text(" \(label)"))
                .font(.subheadline)
                .lineLimit(2)
            Spacer(minLength: 8)
            Text(RelativeTime.string(from: createdAt))
                .font(.caption2)
                .foregroundStyle(.tertiary)
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
            .background(Color.primary.opacity(0.05), in: RoundedRectangle(cornerRadius: 10))
    }

    private func embeddedItem(_ item: DBItem) -> some View {
        NavigationLink(value: item.slug) {
            FeedItemCard(item: item, embedded: true)
        }
        .buttonStyle(.plain)
    }
}

/// Item card in the feed — cover image up top when the item has one.
struct FeedItemCard: View {
    let item: DBItem
    var embedded: Bool = false

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            if !embedded {
                CoverImage(url: item.coverURL, verdict: item.verdict, height: 140)
            }
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
                    Text(item.category.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                Text(item.title).font(.headline)
                Text(item.tagline)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
            }
            .padding(12)
        }
        .background(embedded ? Color.primary.opacity(0.05) : Theme.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: embedded ? 10 : 14))
    }
}

/// Cover image with a verdict-tinted placeholder — shared by feed cards.
struct CoverImage: View {
    let url: URL?
    let verdict: Verdict
    var height: CGFloat = 140

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    switch phase {
                    case .success(let image):
                        image.resizable().aspectRatio(contentMode: .fill)
                    default:
                        placeholder
                    }
                }
            } else {
                placeholder
            }
        }
        .frame(height: height)
        .frame(maxWidth: .infinity)
        .clipped()
    }

    private var placeholder: some View {
        LinearGradient(
            colors: [Theme.color(for: verdict).opacity(0.25), Theme.color(for: verdict).opacity(0.08)],
            startPoint: .topLeading, endPoint: .bottomTrailing
        )
        .overlay(
            Image(systemName: "cube.transparent")
                .font(.system(size: 34))
                .foregroundStyle(Theme.color(for: verdict).opacity(0.7))
        )
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
