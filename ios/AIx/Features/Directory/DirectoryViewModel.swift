import Foundation
import Observation

/// Generic async loading state.
enum LoadState<Value> {
    case idle
    case loading
    case loaded(Value)
    case failed(String)
}

@Observable
@MainActor
final class DirectoryViewModel {
    var state: LoadState<[PublicItem]> = .idle

    // Filters (bound to the UI).
    var search: String = ""
    var category: Category?
    var verdict: Verdict?
    var audience: PrimaryAudience?
    var sort: ItemSort = .hot

    private let client: APIClient
    private var loadTask: Task<Void, Never>?

    init(client: APIClient = APIClient()) {
        self.client = client
    }

    var currentQuery: ItemQuery {
        ItemQuery(
            category: category,
            verdict: verdict,
            audience: audience,
            minScore: nil,
            search: search.trimmingCharacters(in: .whitespaces),
            sort: sort,
            limit: 60
        )
    }

    /// Debounced-ish reload: cancels any in-flight fetch first.
    func load() {
        loadTask?.cancel()
        let query = currentQuery
        loadTask = Task { [weak self] in
            guard let self else { return }
            if case .loaded = self.state {} else { self.state = .loading }
            do {
                let items = try await self.client.fetchItems(query)
                if Task.isCancelled { return }
                self.state = .loaded(items)
            } catch is CancellationError {
                // superseded by a newer load
            } catch {
                if Task.isCancelled { return }
                self.state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
            }
        }
    }

    func refresh() async {
        do {
            let items = try await client.fetchItems(currentQuery)
            state = .loaded(items)
        } catch {
            state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    func clearFilters() {
        category = nil
        verdict = nil
        audience = nil
        load()
    }

    var hasActiveFilters: Bool {
        category != nil || verdict != nil || audience != nil
    }
}
