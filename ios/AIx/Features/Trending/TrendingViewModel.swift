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
    var window: TrendingWindow = .daily
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
        if !force, case .loaded = panes[paneKey] ?? .idle { return }
        panes[paneKey] = .loading
        do {
            switch source {
            case .github:
                panes[paneKey] = .loaded(.repos(try await client.fetchGithubTrending(window: window)))
            case .producthunt:
                panes[paneKey] = .loaded(.products(try await client.fetchProductHuntTrending(window: window)))
            }
        } catch APIError.http(503) {
            panes[paneKey] = .failed("This source isn't configured on the server yet.")
        } catch {
            panes[paneKey] = .failed((error as? APIError)?.errorDescription ?? error.localizedDescription)
        }
    }
}
