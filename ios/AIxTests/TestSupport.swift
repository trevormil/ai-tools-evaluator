import Foundation
@testable import AIx

/// URLProtocol stub: routes every request through a per-test handler so
/// APIClient tests run fully offline and can assert on the outgoing request.
final class MockURLProtocol: URLProtocol {
    nonisolated(unsafe) static var handler: ((URLRequest) throws -> (HTTPURLResponse, Data))?

    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }

    override func startLoading() {
        guard let handler = Self.handler else {
            fatalError("MockURLProtocol.handler not set")
        }
        do {
            let (response, data) = try handler(request)
            client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
            client?.urlProtocol(self, didLoad: data)
            client?.urlProtocolDidFinishLoading(self)
        } catch {
            client?.urlProtocol(self, didFailWithError: error)
        }
    }

    override func stopLoading() {}
}

enum TestSupport {
    static let baseURL = URL(string: "https://aix.test")!

    /// An APIClient whose network is the MockURLProtocol.
    static func client(token: String? = nil) -> APIClient {
        let config = URLSessionConfiguration.ephemeral
        config.protocolClasses = [MockURLProtocol.self]
        return APIClient(
            baseURL: baseURL,
            session: URLSession(configuration: config),
            tokenProvider: { token }
        )
    }

    /// Install a handler returning `json` for any request, capturing requests.
    @discardableResult
    static func stub(status: Int = 200, json: String) -> RequestRecorder {
        let recorder = RequestRecorder()
        MockURLProtocol.handler = { request in
            recorder.record(request)
            let response = HTTPURLResponse(
                url: request.url!, statusCode: status, httpVersion: nil, headerFields: nil
            )!
            return (response, Data(json.utf8))
        }
        return recorder
    }
}

/// Captures outgoing requests (URL, method, headers, body) for assertions.
final class RequestRecorder: @unchecked Sendable {
    private(set) var requests: [URLRequest] = []
    private let lock = NSLock()

    func record(_ request: URLRequest) {
        lock.lock()
        defer { lock.unlock() }
        requests.append(request)
    }

    var last: URLRequest? { requests.last }

    /// Body bytes even when URLSession moved them to a stream.
    var lastBody: Data? {
        guard let request = last else { return nil }
        if let body = request.httpBody { return body }
        guard let stream = request.httpBodyStream else { return nil }
        stream.open()
        defer { stream.close() }
        var data = Data()
        let bufferSize = 4096
        let buffer = UnsafeMutablePointer<UInt8>.allocate(capacity: bufferSize)
        defer { buffer.deallocate() }
        while stream.hasBytesAvailable {
            let read = stream.read(buffer, maxLength: bufferSize)
            if read <= 0 { break }
            data.append(buffer, count: read)
        }
        return data
    }

    var lastBodyJSON: [String: Any]? {
        lastBody.flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
    }
}
