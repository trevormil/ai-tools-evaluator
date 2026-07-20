import Social
import UIKit
import UniformTypeIdentifiers

/// Minimal share-sheet handler (ticket 0072): grabs the shared URL, queues it
/// in the App Group container, and closes. The main app drains the queue into
/// Favorites → Links on next launch/foreground.
final class ShareViewController: UIViewController {
    private static let appGroupID = "group.com.trevormil.aix"
    private static let pendingKey = "aix.favorites.pendingShared"

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .clear

        let providers = (extensionContext?.inputItems as? [NSExtensionItem])?
            .flatMap { $0.attachments ?? [] } ?? []
        guard let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }) else {
            finish()
            return
        }
        let pageTitle = (extensionContext?.inputItems.first as? NSExtensionItem)?
            .attributedContentText?.string

        provider.loadItem(forTypeIdentifier: UTType.url.identifier) { [weak self] value, _ in
            if let url = value as? URL {
                Self.enqueue(url: url.absoluteString, title: pageTitle)
            }
            DispatchQueue.main.async { self?.finish() }
        }
    }

    private static func enqueue(url: String, title: String?) {
        guard let defaults = UserDefaults(suiteName: appGroupID) else { return }
        var pending = defaults.array(forKey: pendingKey) as? [[String: String]] ?? []
        var entry = ["url": url]
        if let title, !title.isEmpty { entry["title"] = title }
        pending.append(entry)
        defaults.set(pending, forKey: pendingKey)
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
