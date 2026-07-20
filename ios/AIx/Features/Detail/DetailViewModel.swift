import Foundation
import Observation

@Observable
@MainActor
final class DetailViewModel {
    let slug: String
    var state: LoadState<DetailResponse> = .idle

    private let client: APIClient

    init(slug: String, client: APIClient = APIClient()) {
        self.slug = slug
        self.client = client
    }

    func load() async {
        state = .loading
        do {
            let detail = try await client.fetchItemDetail(slug: slug)
            state = .loaded(detail)
        } catch {
            state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }
}
