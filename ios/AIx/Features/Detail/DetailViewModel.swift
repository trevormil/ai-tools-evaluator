import Foundation
import Observation

@Observable
@MainActor
final class DetailViewModel {
    let slug: String
    var state: LoadState<Evaluation> = .idle

    private let client: APIClient

    init(slug: String, client: APIClient = APIClient()) {
        self.slug = slug
        self.client = client
    }

    func load() async {
        state = .loading
        do {
            let evaluation = try await client.fetchEvaluation(slug: slug)
            state = .loaded(evaluation)
        } catch {
            state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }
}
