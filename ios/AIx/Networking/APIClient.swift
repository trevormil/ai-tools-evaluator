import Foundation

/// Typed error surface for the API layer.
enum APIError: LocalizedError, Equatable {
    case badURL
    case notFound
    case unauthorized
    case http(Int)
    case decoding(String)
    case transport(String)

    var errorDescription: String? {
        switch self {
        case .badURL: return "Invalid request URL."
        case .notFound: return "Not found."
        case .unauthorized: return "Sign in to do that."
        case .http(let code): return "Server returned HTTP \(code)."
        case .decoding(let msg): return "Couldn't read the response. \(msg)"
        case .transport(let msg): return msg
        }
    }
}

/// Filters for the directory list. All optional; empty ones are omitted.
struct ItemQuery {
    var category: Category?
    var verdict: Verdict?
    var audience: PrimaryAudience?
    var minScore: Int?
    var search: String?
    var sort: ItemSort?
    var limit: Int = 50

    var queryItems: [URLQueryItem] {
        var items: [URLQueryItem] = []
        if let category { items.append(.init(name: "category", value: category.rawValue)) }
        if let verdict { items.append(.init(name: "verdict", value: verdict.rawValue)) }
        if let audience { items.append(.init(name: "audience", value: audience.rawValue)) }
        if let minScore { items.append(.init(name: "minScore", value: String(minScore))) }
        if let search, !search.isEmpty { items.append(.init(name: "q", value: search)) }
        if let sort { items.append(.init(name: "sort", value: sort.rawValue)) }
        items.append(.init(name: "limit", value: String(limit)))
        return items
    }
}

/// Async URLSession client for the AIx API — public reads plus the
/// bearer-authed social surface (token from AuthStore, tickets 0057/0058).
struct APIClient {
    var baseURL: URL
    private let session: URLSession
    private let tokenProvider: () -> String?
    private let decoder = JSONDecoder()

    init(
        baseURL: URL = AppConfig.baseURL,
        session: URLSession = .shared,
        tokenProvider: @escaping () -> String? = { nil }
    ) {
        self.baseURL = baseURL
        self.session = session
        self.tokenProvider = tokenProvider
    }

    // MARK: Directory + evaluation (public v1)

    func fetchItems(_ query: ItemQuery) async throws -> [PublicItem] {
        let response: ItemsResponse = try await get(url(path: "/api/v1/items", query: query.queryItems))
        return response.items
    }

    func fetchEvaluation(slug: String) async throws -> Evaluation {
        let response: DetailResponse = try await get(url(path: "/api/v1/items/\(slug)"))
        return response.evaluation
    }

    // MARK: Social reads (public v1, ticket 0058)

    func fetchItemSocial(slug: String) async throws -> SocialResponse {
        try await get(url(path: "/api/v1/items/\(slug)/social"))
    }

    func fetchProfile(username: String) async throws -> ProfileResponse {
        try await get(url(path: "/api/v1/users/\(username)"))
    }

    func fetchLeaderboard() async throws -> LeaderboardResponse {
        try await get(url(path: "/api/v1/leaderboard"))
    }

    func fetchLatestRecap() async throws -> Recap {
        let response: RecapResponse = try await get(url(path: "/api/v1/recap"))
        return response.recap
    }

    func fetchRecap(date: String) async throws -> Recap {
        let response: RecapResponse = try await get(url(path: "/api/v1/recap/\(date)"))
        return response.recap
    }

    func fetchRecapArchive() async throws -> [String] {
        let response: RecapArchive = try await get(url(path: "/api/v1/recap/archive"))
        return response.dates
    }

    // MARK: Feed

    func fetchFeed(mode: String, cursor: String?, limit: Int = 30) async throws -> FeedPage {
        var query = [
            URLQueryItem(name: "mode", value: mode),
            URLQueryItem(name: "limit", value: String(limit)),
        ]
        if let cursor { query.append(URLQueryItem(name: "cursor", value: cursor)) }
        return try await get(url(path: "/api/feed", query: query))
    }

    // MARK: Session

    func fetchMe() async throws -> MeResponse {
        try await get(url(path: "/api/me"))
    }

    func logout() async throws {
        let _: OkResult = try await send("POST", url(path: "/api/auth/logout"), body: EmptyBody())
    }

    func devLogin(username: String) async throws -> DevLoginResult {
        try await get(url(path: "/api/auth/dev", query: [
            URLQueryItem(name: "u", value: username),
            URLQueryItem(name: "client", value: "ios"),
        ]))
    }

    // MARK: Writes (bearer-authed)

    func vote(targetType: String, targetId: String, value: Int) async throws -> VoteResult {
        try await send("POST", url(path: "/api/votes"), body: [
            "targetType": AnyEncodable(targetType),
            "targetId": AnyEncodable(targetId),
            "value": AnyEncodable(value),
        ])
    }

    func postComment(body: String, itemId: String?, postId: String?, parentId: String?) async throws -> CommentResult {
        var payload: [String: AnyEncodable] = ["body": AnyEncodable(body)]
        if let itemId { payload["itemId"] = AnyEncodable(itemId) }
        if let postId { payload["postId"] = AnyEncodable(postId) }
        if let parentId { payload["parentId"] = AnyEncodable(parentId) }
        return try await send("POST", url(path: "/api/comments"), body: payload)
    }

    func toggleFollow(targetUserId: String) async throws -> FollowResult {
        try await send("POST", url(path: "/api/follows"), body: ["targetUserId": AnyEncodable(targetUserId)])
    }

    func upsertStack(itemId: String?, toolName: String?, status: String, take: String?, rating: Int?) async throws -> StackUpsertResult {
        var payload: [String: AnyEncodable] = ["status": AnyEncodable(status)]
        if let itemId { payload["itemId"] = AnyEncodable(itemId) }
        if let toolName { payload["toolName"] = AnyEncodable(toolName) }
        if let take { payload["take"] = AnyEncodable(take) }
        if let rating { payload["rating"] = AnyEncodable(rating) }
        return try await send("POST", url(path: "/api/stack"), body: payload)
    }

    func deleteStackEntry(id: String) async throws {
        let _: OkResult = try await send("DELETE", url(path: "/api/stack"), body: ["id": AnyEncodable(id)])
    }

    func toggleRepost(targetType: String, targetId: String, quote: String?) async throws -> RepostResult {
        var payload: [String: AnyEncodable] = [
            "targetType": AnyEncodable(targetType),
            "targetId": AnyEncodable(targetId),
        ]
        if let quote { payload["quote"] = AnyEncodable(quote) }
        return try await send("POST", url(path: "/api/reposts"), body: payload)
    }

    func requestRescore(slug: String) async throws -> RescoreResult {
        try await send("POST", url(path: "/api/rescore"), body: ["slug": AnyEncodable(slug)])
    }

    func submitLink(url urlString: String, note: String?) async throws -> SubmitResult {
        var payload: [String: AnyEncodable] = ["url": AnyEncodable(urlString)]
        if let note, !note.isEmpty { payload["note"] = AnyEncodable(note) }
        return try await send("POST", url(path: "/api/submissions"), body: payload)
    }

    func fetchMySubmissions() async throws -> [Submission] {
        let response: SubmissionsResponse = try await get(url(path: "/api/submissions"))
        return response.submissions
    }

    func updateProfile(displayName: String?, bio: String?) async throws {
        var payload: [String: AnyEncodable] = [:]
        if let displayName { payload["displayName"] = AnyEncodable(displayName) }
        if let bio { payload["bio"] = AnyEncodable(bio) }
        let _: OkResult = try await send("PATCH", url(path: "/api/profile"), body: payload)
    }

    // MARK: Notifications + messages

    func fetchNotifications() async throws -> NotificationsResponse {
        try await get(url(path: "/api/notifications"))
    }

    func markNotificationsRead() async throws {
        let _: OkResult = try await send("POST", url(path: "/api/notifications"), body: EmptyBody())
    }

    func fetchConversations() async throws -> [Conversation] {
        let response: ConversationsResponse = try await get(url(path: "/api/messages"))
        return response.conversations
    }

    func fetchThread(userId: String) async throws -> [DBMessage] {
        let response: ThreadResponse = try await get(url(path: "/api/messages/\(userId)"))
        return response.messages
    }

    func sendMessage(toUserId: String, body: String) async throws -> DBMessage {
        struct MessageResult: Codable { let message: DBMessage }
        let result: MessageResult = try await send("POST", url(path: "/api/messages"), body: [
            "toUserId": AnyEncodable(toUserId),
            "body": AnyEncodable(body),
        ])
        return result.message
    }

    // MARK: Plumbing

    private func url(path: String, query: [URLQueryItem] = []) throws -> URL {
        guard var components = URLComponents(url: baseURL, resolvingAgainstBaseURL: false) else {
            throw APIError.badURL
        }
        components.path = path
        if !query.isEmpty { components.queryItems = query }
        guard let url = components.url else { throw APIError.badURL }
        return url
    }

    private func get<T: Decodable>(_ url: @autoclosure () throws -> URL) async throws -> T {
        try await run(request(for: url(), method: "GET", body: nil))
    }

    private func send<B: Encodable, T: Decodable>(
        _ method: String,
        _ url: @autoclosure () throws -> URL,
        body: B
    ) async throws -> T {
        let data = try JSONEncoder().encode(body)
        return try await run(request(for: url(), method: method, body: data))
    }

    private func request(for url: URL, method: String, body: Data?) -> URLRequest {
        var request = URLRequest(url: url)
        request.httpMethod = method
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 20
        if let token = tokenProvider() {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        if let body {
            request.httpBody = body
            request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        }
        return request
    }

    private func run<T: Decodable>(_ request: URLRequest) async throws -> T {
        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await session.data(for: request)
        } catch {
            throw APIError.transport(error.localizedDescription)
        }

        if let http = response as? HTTPURLResponse {
            if http.statusCode == 401 { throw APIError.unauthorized }
            if http.statusCode == 404 { throw APIError.notFound }
            guard (200..<300).contains(http.statusCode) else {
                throw APIError.http(http.statusCode)
            }
        }

        do {
            return try decoder.decode(T.self, from: data)
        } catch {
            throw APIError.decoding(String(describing: error))
        }
    }
}

/// Type-erased Encodable for heterogeneous JSON bodies.
struct AnyEncodable: Encodable {
    private let encodeClosure: (Encoder) throws -> Void
    init<T: Encodable>(_ value: T) {
        encodeClosure = { try value.encode(to: $0) }
    }
    func encode(to encoder: Encoder) throws {
        try encodeClosure(encoder)
    }
}

private struct EmptyBody: Encodable {}

struct OkResult: Codable {
    let ok: Bool?
}
