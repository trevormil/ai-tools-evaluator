import CoreSpotlight
import Foundation
import UniformTypeIdentifiers

/// Seam so FavoritesStore tests don't touch the real Spotlight index.
protocol FavoritesSpotlightIndexing {
    func reindex(items: [FavoriteItem], links: [SavedLink])
}

/// Indexes saved favorites into Core Spotlight so system search finds them.
/// Identifiers: `item:<slug>` (opens item detail) and `link:<uuid>` (opens
/// the URL) — resolved in AIxApp's onContinueUserActivity.
struct FavoritesSpotlightIndexer: FavoritesSpotlightIndexing {
    static let domain = "com.trevormil.aix.favorites"

    func reindex(items: [FavoriteItem], links: [SavedLink]) {
        let index = CSSearchableIndex.default()
        var searchables: [CSSearchableItem] = []

        for item in items {
            let attributes = CSSearchableItemAttributeSet(contentType: .content)
            attributes.title = item.title
            attributes.contentDescription = item.tagline
            attributes.keywords = ["AIx", item.verdict.label, "AI tool"]
            searchables.append(CSSearchableItem(
                uniqueIdentifier: "item:\(item.slug)",
                domainIdentifier: Self.domain,
                attributeSet: attributes
            ))
        }
        for link in links {
            let attributes = CSSearchableItemAttributeSet(contentType: .url)
            attributes.title = link.title
            attributes.contentDescription = link.note ?? link.url
            attributes.contentURL = link.pageURL
            attributes.keywords = ["AIx", "saved link"]
            searchables.append(CSSearchableItem(
                uniqueIdentifier: "link:\(link.id.uuidString)",
                domainIdentifier: Self.domain,
                attributeSet: attributes
            ))
        }

        // Full re-index each save: N is tiny and it keeps deletes honest.
        index.deleteSearchableItems(withDomainIdentifiers: [Self.domain]) { _ in
            if !searchables.isEmpty {
                index.indexSearchableItems(searchables, completionHandler: nil)
            }
        }
    }
}
