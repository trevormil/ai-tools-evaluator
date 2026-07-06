import Foundation
import Observation

@Observable
@MainActor
final class LeaderboardViewModel {
    var top: LoadState<[PublicItem]> = .idle
    var complexityTraps: LoadState<[PublicItem]> = .idle

    private let client: APIClient

    init(client: APIClient = APIClient()) {
        self.client = client
    }

    func load() async {
        async let topResult = fetch(ItemQuery(sort: .top, limit: 25))
        async let trapResult = fetch(ItemQuery(verdict: .complexityTrap, sort: .top, limit: 15))
        top = await topResult
        complexityTraps = await trapResult
    }

    func refresh() async { await load() }

    private func fetch(_ query: ItemQuery) async -> LoadState<[PublicItem]> {
        do {
            return .loaded(try await client.fetchItems(query))
        } catch {
            return .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }
}
