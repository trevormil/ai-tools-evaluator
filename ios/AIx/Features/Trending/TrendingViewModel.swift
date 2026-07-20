import Foundation
import Observation

/// Live trending browser (tickets 0067/0071): GitHub / Product Hunt /
/// HackerNews / Hugging Face. Each (source, window) pane keeps its own
/// loaded state so flipping segments is instant once visited.
@Observable
@MainActor
final class TrendingViewModel {
    enum Source: String, CaseIterable, Identifiable {
        case aix, github, producthunt, hackernews, huggingface
        var id: String { rawValue }

        var fullName: String {
            switch self {
            case .aix: return "AIx"
            case .github: return "GitHub"
            case .producthunt: return "Product Hunt"
            case .hackernews: return "Hacker News"
            case .huggingface: return "Hugging Face"
            }
        }

        /// The AIx feed is a timeline and HF's trending score is inherently
        /// recent — the today/week menu only applies to GH/PH/HN.
        var supportsWindow: Bool {
            switch self {
            case .aix, .huggingface: return false
            case .github, .producthunt, .hackernews: return true
            }
        }
    }

    enum Pane {
        case repos([TrendingRepo])
        case products([TrendingProduct])
        case stories([TrendingStory])
        case models([TrendingModel])
    }

    var source: Source = .aix
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
        source.supportsWindow ? "\(source.rawValue):\(window.rawValue)" : source.rawValue
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
            case .aix:
                // The AIx pane is the home feed — FeedViewModel owns it.
                panes[paneKey] = .idle
            case .github:
                panes[paneKey] = .loaded(.repos(try await client.fetchGithubTrending(window: window)))
            case .producthunt:
                panes[paneKey] = .loaded(.products(try await client.fetchProductHuntTrending(window: window)))
            case .hackernews:
                panes[paneKey] = .loaded(.stories(try await client.fetchHackerNewsTrending(window: window)))
            case .huggingface:
                panes[paneKey] = .loaded(.models(try await client.fetchHuggingFaceTrending()))
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
