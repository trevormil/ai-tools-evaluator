import Foundation
import Observation

@Observable
@MainActor
final class LeaderboardViewModel {
    var state: LoadState<LeaderboardResponse> = .idle

    private let client: APIClient

    init(client: APIClient = APIClient()) {
        self.client = client
    }

    func load() async {
        if case .loaded = state {} else { state = .loading }
        do {
            state = .loaded(try await client.fetchLeaderboard())
        } catch {
            state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }
}
