import SwiftUI

/// Circular avatar with an initial-letter fallback.
struct AvatarView: View {
    let url: URL?
    let name: String
    var size: CGFloat = 36

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
        .clipShape(Circle())
        .accessibilityHidden(true)
    }

    private var fallback: some View {
        Circle()
            .fill(Color.accentColor.opacity(0.2))
            .overlay(
                Text(String(name.prefix(1)).uppercased())
                    .font(.system(size: size * 0.45, weight: .semibold))
                    .foregroundStyle(Color.accentColor)
            )
    }
}
