export { createGitHubSource, buildQueries, rotationSeed } from "./github";
export { createArxivSource, parseArxivFeed } from "./arxiv";
export { createProductHuntSource, parsePostsResponse, rankByUpvotes } from "./producthunt";
export { createHackerNewsSource, parseHnStory } from "./hackernews";
export {
  evaluateQualityGate,
  starVelocity,
  type QualityThresholds,
  type RepoSignals,
  type GateDecision,
} from "./quality-gate";
