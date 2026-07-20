import Foundation

/// A bookmarked AIx item — enough of a snapshot to render a row offline;
/// tapping through loads the live evaluation by slug.
struct FavoriteItem: Codable, Hashable, Identifiable {
    let slug: String
    let title: String
    let tagline: String
    let verdict: Verdict
    let overallScore: Int
    let coverImageUrl: String?
    let savedAt: Int

    var id: String { slug }
    var coverURL: URL? { coverImageUrl.flatMap(URL.init(string:)) }
}

/// A free-form saved link (an X post, a skill, anything pasteable).
struct SavedLink: Codable, Hashable, Identifiable {
    let id: UUID
    var url: String
    var title: String
    var note: String?
    let savedAt: Int

    var pageURL: URL? { URL(string: url) }
}

/// Device-local favorites (ticket 0068): bookmarked AIx items + a custom
/// reading list. No accounts — persisted as Codable JSON in UserDefaults
/// (small data, CA92.1 in the privacy manifest already covers it).
@MainActor
final class FavoritesStore: ObservableObject {
    @Published private(set) var items: [FavoriteItem] = []
    @Published private(set) var links: [SavedLink] = []

    nonisolated static let appGroupID = "group.com.trevormil.aix"
    private static let itemsKey = "aix.favorites.items"
    private static let linksKey = "aix.favorites.links"
    /// URLs the share extension queued while the app wasn't running.
    static let pendingSharedKey = "aix.favorites.pendingShared"
    private let defaults: UserDefaults

    /// Standard defaults for now: the App Group suite (shared with the
    /// share extension) needs an entitlement free personal teams can't
    /// provision — flip to `UserDefaults(suiteName: appGroupID)` when the
    /// paid enrollment lands (ticket 0072; the migration below handles it).
    nonisolated static func sharedDefaults() -> UserDefaults {
        .standard
    }

    init(defaults: UserDefaults = FavoritesStore.sharedDefaults()) {
        self.defaults = defaults
        // One-time migration: favorites saved before the App Group move.
        if defaults !== UserDefaults.standard, defaults.data(forKey: Self.itemsKey) == nil,
           defaults.data(forKey: Self.linksKey) == nil {
            for key in [Self.itemsKey, Self.linksKey] {
                if let legacy = UserDefaults.standard.data(forKey: key) {
                    defaults.set(legacy, forKey: key)
                }
            }
        }
        items = Self.read([FavoriteItem].self, from: defaults, key: Self.itemsKey) ?? []
        links = Self.read([SavedLink].self, from: defaults, key: Self.linksKey) ?? []
        drainPendingShared()
        reindexSpotlight()
    }

    /// Pull in links the share extension queued (called at init and on
    /// foreground). Each entry: {url, title?}.
    func drainPendingShared() {
        guard let pending = defaults.array(forKey: Self.pendingSharedKey) as? [[String: String]],
              !pending.isEmpty
        else { return }
        defaults.removeObject(forKey: Self.pendingSharedKey)
        for entry in pending.reversed() {
            if let url = entry["url"] {
                addLink(url: url, title: entry["title"], note: nil)
            }
        }
    }

    // MARK: AIx items

    func isFavorite(slug: String) -> Bool {
        items.contains { $0.slug == slug }
    }

    /// Toggle a bookmark; returns the new state.
    @discardableResult
    func toggle(_ item: FavoriteItem) -> Bool {
        if isFavorite(slug: item.slug) {
            removeItem(slug: item.slug)
            return false
        }
        items.insert(item, at: 0)
        persist()
        return true
    }

    func removeItem(slug: String) {
        items.removeAll { $0.slug == slug }
        persist()
    }

    // MARK: Custom links

    /// Add a pasted URL. Returns false (and saves nothing) for non-http(s)
    /// or duplicate URLs.
    @discardableResult
    func addLink(url rawURL: String, title: String?, note: String?) -> Bool {
        let trimmed = rawURL.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let parsed = URL(string: trimmed),
              let scheme = parsed.scheme?.lowercased(),
              scheme == "http" || scheme == "https",
              parsed.host() != nil
        else { return false }

        let normalized = normalize(trimmed)
        guard !links.contains(where: { normalize($0.url) == normalized }) else { return false }

        let cleanTitle = title?.trimmingCharacters(in: .whitespacesAndNewlines)
        let cleanNote = note?.trimmingCharacters(in: .whitespacesAndNewlines)
        links.insert(
            SavedLink(
                id: UUID(),
                url: trimmed,
                title: cleanTitle?.isEmpty == false ? cleanTitle! : (parsed.host() ?? trimmed),
                note: cleanNote?.isEmpty == false ? cleanNote : nil,
                savedAt: Int(Date().timeIntervalSince1970)
            ),
            at: 0
        )
        persist()
        return true
    }

    func removeLink(id: UUID) {
        links.removeAll { $0.id == id }
        persist()
    }

    // MARK: Plumbing

    /// Case-insensitive host, no trailing slash — enough to catch re-pastes.
    private func normalize(_ url: String) -> String {
        var s = url.lowercased()
        while s.hasSuffix("/") { s.removeLast() }
        return s
    }

    private func persist() {
        if let data = try? JSONEncoder().encode(items) {
            defaults.set(data, forKey: Self.itemsKey)
        }
        if let data = try? JSONEncoder().encode(links) {
            defaults.set(data, forKey: Self.linksKey)
        }
        reindexSpotlight()
    }

    private static func read<T: Decodable>(_ type: T.Type, from defaults: UserDefaults, key: String) -> T? {
        guard let data = defaults.data(forKey: key) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    /// System-search integration (ticket 0072): everything you saved is
    /// findable from Spotlight. Injected as a seam so tests never touch the
    /// real index.
    var spotlight: FavoritesSpotlightIndexing = FavoritesSpotlightIndexer()

    private func reindexSpotlight() {
        spotlight.reindex(items: items, links: links)
    }
}

extension FavoriteItem {
    /// Snapshot an evaluation for the favorites list.
    init(evaluation: Evaluation) {
        self.init(
            slug: evaluation.slug,
            title: evaluation.source.title,
            tagline: evaluation.tagline,
            verdict: evaluation.verdict,
            overallScore: evaluation.overallScore,
            coverImageUrl: evaluation.coverURL?.absoluteString,
            savedAt: Int(Date().timeIntervalSince1970)
        )
    }
}
