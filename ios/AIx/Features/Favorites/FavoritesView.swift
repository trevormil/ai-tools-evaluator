import SwiftUI

/// Favorites tab (ticket 0068): bookmarked AIx items + a custom reading
/// list of pasted links. Everything lives on-device.
struct FavoritesView: View {
    enum Segment: String, CaseIterable, Identifiable {
        case items = "Saved items"
        case links = "Links"
        var id: String { rawValue }
    }

    @EnvironmentObject private var favorites: FavoritesStore
    @State private var segment: Segment = .items
    @State private var showAddLink = false

    var body: some View {
        NavigationStack {
            VStack(spacing: 10) {
                Picker("Section", selection: $segment) {
                    ForEach(Segment.allCases) { s in Text(s.rawValue).tag(s) }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)

                content
            }
            .navigationTitle("")
            .navigationBarTitleDisplayMode(.inline)
            .navigationDestination(for: String.self) { slug in
                ItemDetailView(slug: slug)
            }
            .toolbar {
                if segment == .links {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button {
                            showAddLink = true
                        } label: {
                            Image(systemName: "plus")
                        }
                        .accessibilityLabel("Add link")
                    }
                }
            }
            .sheet(isPresented: $showAddLink) {
                AddLinkSheet()
            }
        }
    }

    @ViewBuilder
    private var content: some View {
        switch segment {
        case .items:
            if favorites.items.isEmpty {
                MessageState(
                    systemImage: "bookmark",
                    title: "Nothing saved yet",
                    message: "Tap the bookmark on any tool's page to keep it here."
                )
            } else {
                List {
                    ForEach(favorites.items) { item in
                        FavoriteItemRow(item: item)
                            .plainNavigation(value: item.slug)
                    }
                    .onDelete { offsets in
                        for index in offsets {
                            favorites.removeItem(slug: favorites.items[index].slug)
                        }
                    }
                }
                .listStyle(.plain)
            }
        case .links:
            if favorites.links.isEmpty {
                MessageState(
                    systemImage: "link.badge.plus",
                    title: "No links yet",
                    message: "Save anything — an X post, a skill, a repo. Tap + and paste the URL."
                )
            } else {
                List {
                    ForEach(favorites.links) { link in
                        SavedLinkRow(link: link)
                    }
                    .onDelete { offsets in
                        for index in offsets {
                            favorites.removeLink(id: favorites.links[index].id)
                        }
                    }
                }
                .listStyle(.plain)
            }
        }
    }
}

private struct FavoriteItemRow: View {
    let item: FavoriteItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ItemThumbnail(url: item.coverURL, verdict: item.verdict)
            VStack(alignment: .leading, spacing: 6) {
                Text(item.title).font(.headline).lineLimit(2)
                Text(item.tagline)
                    .font(.footnote)
                    .foregroundStyle(.secondary)
                    .lineLimit(3)
                HStack(spacing: 8) {
                    VerdictBadge(verdict: item.verdict, compact: true)
                    Spacer()
                    ScoreChip(score: item.overallScore)
                }
            }
        }
        .padding(.vertical, 6)
    }
}

private struct SavedLinkRow: View {
    let link: SavedLink

    var body: some View {
        Group {
            if let url = link.pageURL {
                Link(destination: url) { rowBody }
                    .buttonStyle(.plain)
            } else {
                rowBody
            }
        }
    }

    private var rowBody: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "link")
                .font(.system(size: 18))
                .foregroundStyle(Color.accentColor)
                .frame(width: 40, height: 40)
                .background(Color.accentColor.opacity(0.1), in: RoundedRectangle(cornerRadius: 10))
            VStack(alignment: .leading, spacing: 4) {
                Text(link.title).font(.headline).lineLimit(2)
                Text(link.pageURL?.host() ?? link.url)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(1)
                if let note = link.note {
                    Text(note)
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                        .lineLimit(3)
                }
            }
            Spacer()
            Image(systemName: "arrow.up.right")
                .font(.caption2)
                .foregroundStyle(.tertiary)
        }
        .padding(.vertical, 6)
    }
}

/// Paste-a-URL sheet with optional title + note.
private struct AddLinkSheet: View {
    @EnvironmentObject private var favorites: FavoritesStore
    @Environment(\.dismiss) private var dismiss

    @State private var url = ""
    @State private var title = ""
    @State private var note = ""
    @State private var invalid = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        TextField("https://…", text: $url)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .keyboardType(.URL)
                        Button {
                            if let pasted = UIPasteboard.general.string {
                                url = pasted
                            }
                        } label: {
                            Image(systemName: "doc.on.clipboard")
                        }
                        .accessibilityLabel("Paste")
                    }
                } header: {
                    Text("Link")
                } footer: {
                    if invalid {
                        Text("That doesn't look like a valid web link (or it's already saved).")
                            .foregroundStyle(.red)
                    }
                }
                Section("Title (optional)") {
                    TextField("What is this?", text: $title)
                }
                Section("Note (optional)") {
                    TextField("Why you saved it…", text: $note, axis: .vertical)
                        .lineLimit(2...5)
                }
            }
            .navigationTitle("Save a link")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        if favorites.addLink(url: url, title: title, note: note) {
                            dismiss()
                        } else {
                            invalid = true
                        }
                    }
                    .disabled(url.trimmingCharacters(in: .whitespaces).isEmpty)
                }
            }
        }
        .presentationDetents([.medium, .large])
    }
}
