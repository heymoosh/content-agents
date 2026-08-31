import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { withFileLock } from "../runtime/file-lock.js";
import { appendRows, readQueue, type NewQueueRow } from "../publish/queue.js";
import { normalizeGrowSchedulerFacts } from "./queue-facts.js";
import { adaptQueueRowToGrowFacts } from "./live-facts.js";
import { buildGrowDeliveryBinding, type GrowDeliveryBinding, type GrowDeliveryBindingLineage } from "./delivery-binding.js";
import {
  buildGrowExperimentDecision,
  type GrowExperimentDecisionInput,
  type GrowExperimentProposal,
  type GrowExperimentSlice,
} from "./experiment-slice.js";

export const GROW_EXPERIMENT_QUEUE_HANDOFF_VERSION = "grow-experiment-queue-handoff-v1" as const;

export interface GrowExperimentQueueHandoffAsset {
  readonly variantId: string;
  readonly relativePath: string;
  readonly body: string;
  readonly content: string;
}

export interface GrowExperimentQueueHandoffRow extends NewQueueRow {
  readonly lineage: GrowDeliveryBindingLineage & { readonly publishId: null };
  readonly reviewBundleId: string;
  readonly deliveryRecordId: string;
}

export interface GrowExperimentQueueHandoff {
  readonly kind: "grow_experiment_queue_handoff";
  readonly version: typeof GROW_EXPERIMENT_QUEUE_HANDOFF_VERSION;
  readonly proposalDigest: string;
  readonly decision: GrowExperimentSlice;
  readonly assets: GrowExperimentQueueHandoffAsset[];
  readonly rows: GrowExperimentQueueHandoffRow[];
  readonly autoScheduling: false;
  readonly autoPublishing: false;
}

export interface AppliedGrowExperimentQueueHandoff extends GrowExperimentQueueHandoff {
  readonly folder: string;
  readonly created: number;
  readonly existing: number;
  readonly bindings: GrowDeliveryBinding[];
}

function safeId(value: string): string {
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(value)) throw new Error(`variant id is unsafe for a queue row or asset path: ${value}`);
  return value;
}

function yaml(value: string): string {
  return JSON.stringify(value);
}

function derivativeContent(
  proposal: GrowExperimentProposal,
  record: GrowExperimentSlice["approvedRecords"][number],
  decidedAt: string,
): string {
  return [
    "---",
    `platform: ${yaml(record.platform)}`,
    `medium: ${yaml(record.medium)}`,
    `format: ${yaml(record.format)}`,
    `grow_proposal_digest: ${yaml(proposal.digest)}`,
    `source_id: ${yaml(proposal.source.id)}`,
    `cut_id: ${yaml(proposal.cut.id)}`,
    `variant_id: ${yaml(record.variantId)}`,
    `treatment_id: ${yaml(record.treatmentRef)}`,
    `experiment_id: ${yaml(record.experimentId)}`,
    `review_bundle_id: ${yaml(`review:${proposal.id}:${record.variantId}`)}`,
    `delivery_record_id: ${yaml(record.deliveryRecordId)}`,
    `approved_by: muxin`,
    `approved_at: ${yaml(decidedAt)}`,
    "---",
    "",
    record.body,
    "",
  ].join("\n");
}

/**
 * Validate a digest-bound Muxin decision and produce the exact queue handoff, without writing,
 * scheduling, publishing, or treating edited/rejected candidates as approved.
 */
export function buildGrowExperimentQueueHandoff(
  proposal: GrowExperimentProposal,
  decisionInput: GrowExperimentDecisionInput,
): GrowExperimentQueueHandoff {
  const decision = buildGrowExperimentDecision(proposal, decisionInput);
  const bundleByVariant = new Map(decision.reviewBundles.map((bundle) => [bundle.variantRefs[0]?.id, bundle]));
  const assets: GrowExperimentQueueHandoffAsset[] = [];
  const rows: GrowExperimentQueueHandoffRow[] = [];
  for (const record of decision.approvedRecords) {
    const variantId = safeId(record.variantId);
    const bundle = bundleByVariant.get(variantId);
    if (!bundle || bundle.status !== "approved" || bundle.humanDecision.status !== "approved") {
      throw new Error(`approved variant ${variantId} has no canonical approved review bundle`);
    }
    const relativePath = `derivatives/grow-${variantId}.md`;
    const lineage = {
      sourceId: proposal.source.id,
      cutId: proposal.cut.id,
      variantId,
      treatmentId: record.treatmentRef,
      experimentId: record.experimentId,
      publishId: null,
    } as const;
    assets.push({
      variantId,
      relativePath,
      body: record.body,
      content: derivativeContent(proposal, record, decision.review.decidedAt),
    });
    rows.push({
      id: variantId,
      platform: record.platform,
      format: record.format,
      asset: relativePath,
      status: "approve",
      notes: `Grow ${proposal.experiment.id}; Muxin-approved decision ${proposal.digest}`,
      origin: "from GUI queue",
      lineage,
      reviewBundleId: bundle.id,
      deliveryRecordId: record.deliveryRecordId,
    });
  }
  return {
    kind: "grow_experiment_queue_handoff",
    version: GROW_EXPERIMENT_QUEUE_HANDOFF_VERSION,
    proposalDigest: proposal.digest,
    decision,
    assets,
    rows,
    autoScheduling: false,
    autoPublishing: false,
  };
}

function assertFolder(folder: string): void {
  if (!folder || !existsSync(folder) || !lstatSync(folder).isDirectory()) throw new Error("content folder does not exist");
  const queue = join(folder, "review-queue.md");
  if (!existsSync(queue) || !lstatSync(queue).isFile() || lstatSync(queue).isSymbolicLink()) {
    throw new Error("canonical review-queue.md is missing or unsafe");
  }
  const derivatives = join(folder, "derivatives");
  if (existsSync(derivatives) && (!lstatSync(derivatives).isDirectory() || lstatSync(derivatives).isSymbolicLink())) {
    throw new Error("derivatives path is unsafe");
  }
}

function target(folder: string, relativePath: string): string {
  const resolved = join(folder, relativePath);
  const rel = relative(folder, resolved);
  if (rel.startsWith("..") || rel === "" || basename(resolved) === "") throw new Error("asset path escapes the content folder");
  return resolved;
}

/**
 * Materialize approved variants into the existing Content review queue under a folder lock.
 * The operation is idempotent for byte-identical assets/rows and rejects every conflict before
 * its first write. It deliberately stops at `approve`; scheduling stays an explicit downstream act.
 */
export function applyGrowExperimentQueueHandoff(
  folder: string,
  proposal: GrowExperimentProposal,
  decisionInput: GrowExperimentDecisionInput,
): AppliedGrowExperimentQueueHandoff {
  const plan = buildGrowExperimentQueueHandoff(proposal, decisionInput);
  assertFolder(folder);
  return withFileLock(join(folder, ".grow-queue-handoff.lock"), () => {
    const existingRows = readQueue(folder).rows;
    const byId = new Map(existingRows.map((row) => [row.id, row]));
    const pendingRows: GrowExperimentQueueHandoffRow[] = [];
    const pendingAssets: GrowExperimentQueueHandoffAsset[] = [];
    let existing = 0;

    for (let index = 0; index < plan.rows.length; index += 1) {
      const row = plan.rows[index]!;
      const asset = plan.assets[index]!;
      const priorRow = byId.get(row.id);
      const assetPath = target(folder, asset.relativePath);
      const sameRow = priorRow !== undefined
        && priorRow.platform === row.platform
        && priorRow.format === row.format
        && priorRow.asset === row.asset
        && priorRow.status === row.status
        && priorRow.notes === row.notes
        && priorRow.origin === row.origin;
      const hasAsset = existsSync(assetPath);
      const sameAsset = hasAsset && lstatSync(assetPath).isFile() && !lstatSync(assetPath).isSymbolicLink()
        && readFileSync(assetPath, "utf8") === asset.content;
      if (priorRow !== undefined || hasAsset) {
        if (!sameRow || !sameAsset) throw new Error(`Grow queue handoff conflict for ${row.id}`);
        existing += 1;
      } else {
        pendingRows.push(row);
        pendingAssets.push(asset);
      }
    }

    const createdAssets: string[] = [];
    try {
      for (const asset of pendingAssets) {
        const final = target(folder, asset.relativePath);
        mkdirSync(dirname(final), { recursive: true });
        writeFileSync(final, asset.content, { encoding: "utf8", mode: 0o600, flag: "wx" });
        createdAssets.push(final);
      }
      appendRows(folder, pendingRows);
    } catch (error) {
      for (const path of createdAssets) if (existsSync(path)) rmSync(path, { force: true });
      throw error;
    }

    const liveRows = new Map(readQueue(folder).rows.map((row) => [row.id, row]));
    const bundleById = new Map(plan.decision.reviewBundles.map((bundle) => [bundle.id, bundle]));
    const bindings = plan.rows.map((planned) => {
      const live = liveRows.get(planned.id);
      if (!live) throw new Error(`queue row disappeared during Grow handoff: ${planned.id}`);
      const queueFacts = adaptQueueRowToGrowFacts(live, planned.lineage);
      const schedulerFacts = normalizeGrowSchedulerFacts({
        deliveryId: `delivery:${planned.reviewBundleId}:${planned.id}`,
        status: "approved",
        lineage: planned.lineage,
      });
      const capacitySlice = plan.decision.capacityManifest.slices.find((slice) =>
        slice.day === plan.decision.capacityManifest.days[0] && slice.platform === planned.platform) ?? null;
      return buildGrowDeliveryBinding({
        reviewBundle: bundleById.get(planned.reviewBundleId)!,
        candidate: {
          id: planned.id,
          day: plan.decision.capacityManifest.days[0]!,
          platform: planned.platform,
          variantId: planned.lineage.variantId,
          lineage: planned.lineage,
        },
        capacitySlice,
        queueFacts: { ...queueFacts, lineage: planned.lineage },
        schedulerFacts: { ...schedulerFacts, lineage: planned.lineage },
        providerFacts: null,
        deliveryMode: "provider",
      });
    });
    return { ...plan, folder, created: pendingRows.length, existing, bindings };
  });
}
