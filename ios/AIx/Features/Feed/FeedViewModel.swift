import Foundation
import Observation

/// The home timeline (web `/` parity, read-only): Today's pick card up top,
/// then the unified feed with cursor pagination and client-side dedup.
@Observable
@MainActor
final class FeedViewModel {
    private(set) var entries: [FeedEntry] = []
    private(set) var dailyPick: DailyPick?
    private(set) var latestRecap: Recap?
    private(set) var isLoading = false
    private(set) var isLoadingMore = false
    private(set) var errorMessage: String?
    private var nextCursor: String?
    private var loadedOnce = false

    var canLoadMore: Bool { nextCursor != nil }
    var needsInitialLoad: Bool { !loadedOnce }

    private let client: APIClient

    init(client: APIClient = APIClient()) {
        self.client = client
    }

    func refresh() async {
        isLoading = true
        errorMessage = nil
        do {
            let page = try await client.fetchFeed(cursor: nil)
            entries = dedup(page.entries)
            nextCursor = page.nextCursor
            loadedOnce = true
        } catch APIError.cancelled {
            // Pull-to-refresh torn down mid-flight — not an error.
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        // The pick + recap strip are decoration on the feed — their absence
        // (404 before the first pick/night, or an outage) must never block
        // the timeline.
        dailyPick = try? await client.fetchDailyPick()
        latestRecap = try? await client.fetchLatestRecap()
        isLoading = false
    }

    func loadMore() async {
        guard let cursor = nextCursor, !isLoadingMore else { return }
        isLoadingMore = true
        do {
            let page = try await client.fetchFeed(cursor: cursor)
            entries = dedup(entries + page.entries)
            nextCursor = page.nextCursor
        } catch {
            errorMessage = (error as? APIError)?.errorDescription ?? error.localizedDescription
        }
        isLoadingMore = false
    }

    /// Pages can overlap when new content lands between fetches — keep the first
    /// occurrence of each entry id, preserving order.
    private func dedup(_ list: [FeedEntry]) -> [FeedEntry] {
        var seen = Set<String>()
        return list.filter { entry in
            if case .unknown = entry { return false }
            return seen.insert(entry.id).inserted
        }
    }
}
