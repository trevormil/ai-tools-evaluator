import Foundation
import Observation

/// Live trending browser (ticket 0067): GitHub / Product Hunt × today / week.
/// Each (source, window) pane keeps its own loaded state so flipping segments
/// is instant once visited.
@Observable
@MainActor
final class TrendingViewModel {
    enum Source: String, CaseIterable, Identifiable {
        case github, producthunt
        var id: String { rawValue }
        var label: String { self == .github ? "GitHub" : "Product Hunt" }
    }

    enum Pane {
        case repos([TrendingRepo])
        case products([TrendingProduct])
    }

    var source: Source = .github
    var window: TrendingWindow = .weekly
    private(set) var panes: [String: LoadState<Pane>] = [:]

    private let client: APIClient

    init(client: APIClient = APIClient()) {
        self.client = client
    }

    var currentState: LoadState<Pane> {
        panes[key(source, window)] ?? .idle
    }

    private func key(_ source: Source, _ window: TrendingWindow) -> String {
        "\(source.rawValue):\(window.rawValue)"
    }

    /// Load the selected pane (no-op if already loaded; `force` refetches).
    func loadCurrent(force: Bool = false) async {
        let paneKey = key(source, window)
        let existing = panes[paneKey] ?? .idle
        if !force, case .loaded = existing { return }
        // Keep the list on screen through a pull-to-refresh — swapping to a
        // spinner tears down the gesture and cancels the request.
        if case .loaded = existing {} else { panes[paneKey] = .loading }
        do {
            switch source {
            case .github:
                panes[paneKey] = .loaded(.repos(try await client.fetchGithubTrending(window: window)))
            case .producthunt:
                panes[paneKey] = .loaded(.products(try await client.fetchProductHuntTrending(window: window)))
            }
        } catch APIError.cancelled {
            // View lifecycle, not a failure — keep whatever we had.
        } catch APIError.http(503) {
            panes[paneKey] = .failed("This source isn't configured on the server yet.")
        } catch {
            panes[paneKey] = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }
}
