import Foundation
import Observation

/// Nightly recap browser (web /recap + /recap/[date] + archive parity).
@Observable
@MainActor
final class RecapViewModel {
    var state: LoadState<Recap> = .idle
    private(set) var dates: [String] = []

    private let client: APIClient

    init(client: APIClient = APIClient()) {
        self.client = client
    }

    /// Load the archive index and the latest recap.
    func loadLatest() async {
        state = .loading
        do {
            async let archive = client.fetchRecapArchive()
            async let latest = client.fetchLatestRecap()
            dates = try await archive
            state = .loaded(try await latest)
        } catch APIError.notFound {
            state = .failed("No recap yet — check back after the first nightly scan.")
        } catch {
            state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    func load(date: String) async {
        state = .loading
        do {
            state = .loaded(try await client.fetchRecap(date: date))
        } catch APIError.notFound {
            state = .failed("Nothing was judged on \(date).")
        } catch {
            state = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }

    /// Neighbor date in the archive (dates are newest-first).
    func neighborDate(of date: String, offset: Int) -> String? {
        guard let idx = dates.firstIndex(of: date) else { return nil }
        let target = idx + offset
        guard dates.indices.contains(target) else { return nil }
        return dates[target]
    }
}
