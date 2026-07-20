import SwiftUI

/// Full-bleed centered message used for empty/error/loading states.
struct MessageState: View {
    let systemImage: String
    let title: String
    var message: String? = nil
    var retry: (() -> Void)? = nil

    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: systemImage)
                .font(.system(size: 40))
                .foregroundStyle(.secondary)
            Text(title)
                .font(.headline)
                .multilineTextAlignment(.center)
            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
            }
            if let retry {
                Button("Try Again", action: retry)
                    .buttonStyle(.borderedProminent)
                    .padding(.top, 4)
            }
        }
        .padding(32)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

/// A row in any item list — small square thumbnail top-left, title, tagline,
/// verdict + score. One layout shared by the directory, feed, and recap.
struct ItemRow: View {
    let title: String
    let tagline: String
    let verdict: Verdict
    let overallScore: Int
    let coverURL: URL?
    var isPending: Bool = false
    var rank: Int? = nil

    init(item: PublicItem, rank: Int? = nil) {
        self.title = item.title
        self.tagline = item.tagline
        self.verdict = item.verdict
        self.overallScore = item.overallScore
        self.coverURL = item.coverURL
        self.rank = rank
    }

    init(item: DBItem) {
        self.title = item.title
        self.tagline = item.tagline
        self.verdict = item.verdict
        self.overallScore = item.overallScore
        self.coverURL = item.coverURL
        self.isPending = item.isPending
    }

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let rank {
                Text("\(rank)")
                    .font(.title3.weight(.heavy).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 28, alignment: .center)
            }
            ItemThumbnail(url: coverURL, verdict: verdict, title: title)
            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.headline)
                    .lineLimit(2)
                Text(tagline)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(5)
                HStack(spacing: 8) {
                    if isPending {
                        Text("AWAITING SCORE…")
                            .font(.caption2.weight(.bold))
                            .padding(.horizontal, 6).padding(.vertical, 2)
                            .background(Color.secondary.opacity(0.15), in: Capsule())
                            .foregroundStyle(.secondary)
                    } else {
                        VerdictBadge(verdict: verdict, compact: true)
                    }
                    Spacer()
                    if !isPending {
                        ScoreChip(score: overallScore)
                    }
                }
            }
        }
        .padding(.vertical, 6)
    }
}

/// Small square cover thumbnail. Items without a real cover get a monogram
/// tile (first letter on the verdict tint) — distinct per item, never the
/// same repeated glyph.
struct ItemThumbnail: View {
    let url: URL?
    let verdict: Verdict
    var title: String = ""
    var size: CGFloat = 52

    var body: some View {
        Group {
            if let url {
                AsyncImage(url: url) { phase in
                    if case .success(let image) = phase {
                        image.resizable().aspectRatio(contentMode: .fill)
                    } else {
                        fallback
                    }
                }
            } else {
                fallback
            }
        }
        .frame(width: size, height: size)
        .clipShape(RoundedRectangle(cornerRadius: 10))
        .accessibilityHidden(true)
    }

    private var monogram: String {
        let letters = title.filter { $0.isLetter || $0.isNumber }
        return letters.isEmpty ? "•" : String(letters.prefix(1)).uppercased()
    }

    private var fallback: some View {
        RoundedRectangle(cornerRadius: 10)
            .fill(Theme.color(for: verdict).opacity(0.16))
            .overlay(
                Text(monogram)
                    .font(.system(size: size * 0.42, weight: .bold, design: .rounded))
                    .foregroundStyle(Theme.color(for: verdict))
            )
    }
}
