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

/// A row in any item list. Title, verdict badge, score, category.
struct ItemRow: View {
    let item: PublicItem
    var rank: Int? = nil

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            if let rank {
                Text("\(rank)")
                    .font(.title3.weight(.heavy).monospacedDigit())
                    .foregroundStyle(.secondary)
                    .frame(width: 28, alignment: .center)
            }
            VStack(alignment: .leading, spacing: 6) {
                Text(item.title)
                    .font(.headline)
                    .lineLimit(2)
                Text(item.tagline)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)
                HStack(spacing: 8) {
                    VerdictBadge(verdict: item.verdict, compact: true)
                    Text(item.category.label)
                        .font(.caption)
                        .foregroundStyle(.secondary)
                    Spacer()
                    ScoreChip(score: item.overallScore)
                }
            }
        }
        .padding(.vertical, 6)
    }
}
