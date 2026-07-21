import XCTest

/// Captures the App Store screenshot set. Not a correctness test — it drives the
/// real app against the live API and writes PNGs to `AIX_SCREENSHOT_DIR`, so the
/// listing can be regenerated with one command instead of hand-tapping a
/// simulator every release. Run via `scripts/screenshots.sh` (scheme
/// `AIxScreenshots`), which keeps it out of the normal test action.
final class ScreenshotTests: XCTestCase {
  private var app: XCUIApplication!
  private var outputDir: URL!

  override func setUpWithError() throws {
    continueAfterFailure = false

    let path = ProcessInfo.processInfo.environment["AIX_SCREENSHOT_DIR"]
    try XCTSkipIf(path == nil, "set AIX_SCREENSHOT_DIR to capture screenshots")
    outputDir = URL(fileURLWithPath: path!)
    try FileManager.default.createDirectory(at: outputDir, withIntermediateDirectories: true)

    app = XCUIApplication()
    app.launch()
  }

  func testCaptureStoreScreenshots() throws {
    let tabs = app.tabBars.firstMatch
    XCTAssertTrue(tabs.waitForExistence(timeout: 30), "tab bar never appeared")

    // 1 — Browse: the daily pick and everything judged, as it lands.
    waitForContent()
    capture("01-browse")

    // 2 — Directory: searchable, filterable, verdict badges.
    tabs.buttons["Directory"].tap()
    waitForContent()
    capture("02-directory")

    // 3 — Item detail, Evaluation tab: the verdict and the write-up.
    let firstItem = app.collectionViews.cells.firstMatch.exists
      ? app.collectionViews.cells.firstMatch
      : app.tables.cells.firstMatch
    XCTAssertTrue(firstItem.waitForExistence(timeout: 30), "no items in the directory")
    firstItem.tap()
    waitForContent()
    capture("03-evaluation")

    // 4 — Scorecard tab: the 10 metric bars that are the product's core.
    let scorecard = app.buttons["Scorecard"].exists
      ? app.buttons["Scorecard"]
      : app.staticTexts["Scorecard"]
    if scorecard.waitForExistence(timeout: 10) {
      scorecard.tap()
      waitForContent()
      capture("04-scorecard")
    } else {
      XCTFail("Scorecard tab not found on item detail")
    }
  }

  /// Screens are network-fed; give the API a beat so we never shoot a spinner.
  private func waitForContent() {
    _ = app.staticTexts.element(boundBy: 0).waitForExistence(timeout: 30)
    Thread.sleep(forTimeInterval: 2.5)
  }

  private func capture(_ name: String) {
    let png = XCUIScreen.main.screenshot().pngRepresentation
    let url = outputDir.appendingPathComponent("\(name).png")
    do {
      try png.write(to: url)
    } catch {
      XCTFail("could not write \(url.path): \(error)")
    }

    // Also attach, so a failed run is still inspectable in the .xcresult.
    let attachment = XCTAttachment(screenshot: XCUIScreen.main.screenshot())
    attachment.name = name
    attachment.lifetime = .keepAlways
    add(attachment)
  }
}
