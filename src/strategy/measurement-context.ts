import type { BrandId } from "../identity/brand.js";

/** Explicit scope for every Strategy read. Omitting providerAccountId intentionally aggregates
 * all accounts belonging to this brand; omitting brandId is not representable. */
export interface StrategyMeasurementContext {
  brandId: BrandId;
  providerAccountId?: string;
}

/** Parse the shared Strategy CLI contract. Every DB-backed strategy command must opt into a
 * brand; an account narrows the read while its omission explicitly permits a brand aggregate. */
export function parseStrategyMeasurementContext(argv = process.argv.slice(2)): StrategyMeasurementContext {
  const value = (name: string): string | undefined => {
    const i = argv.indexOf(name);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const brandId = value("--brand");
  if (brandId !== "human-inference" && brandId !== "charles" && brandId !== "fiction") {
    throw new Error("strategy measurement requires explicit --brand human-inference|charles|fiction");
  }
  const providerAccountId = value("--account");
  return providerAccountId ? { brandId, providerAccountId } : { brandId };
}

export interface MeasurementScope {
  sql: string;
  params: unknown[];
}

/**
 * SQL predicate for a post/metric pair. Legacy NULL rows are excluded, and the two identity
 * dimensions must agree on both sides of the join. Account aggregation is explicit: it happens
 * only when the caller supplies a brand without providerAccountId.
 */
export function measurementScope(
  context: StrategyMeasurementContext,
  postAlias = "p",
  metricAlias = "m"
): MeasurementScope {
  const account = context.providerAccountId
    ? ` AND ${postAlias}.provider_account_id = ? AND ${metricAlias}.provider_account_id = ?`
    : "";
  return {
    sql: `${postAlias}.brand_id = ? AND ${metricAlias}.brand_id = ?
      AND ${postAlias}.brand_id = ${metricAlias}.brand_id
      AND ${postAlias}.provider_account_id = ${metricAlias}.provider_account_id${account}`,
    params: context.providerAccountId
      ? [context.brandId, context.brandId, context.providerAccountId, context.providerAccountId]
      : [context.brandId, context.brandId],
  };
}

/** Latest metric rows restricted to the same explicit identity as the requested context. */
export function latestMetricsJoin(context: StrategyMeasurementContext): MeasurementScope {
  const scope = measurementScope(context, "m", "m");
  return {
    sql: `SELECT m.* FROM metrics m
      JOIN (SELECT post_id, MAX(captured_at) AS mc FROM metrics
            WHERE ${scope.sql.replaceAll("m.brand_id", "brand_id").replaceAll("m.provider_account_id", "provider_account_id")}
            GROUP BY post_id) lm
        ON m.post_id = lm.post_id AND m.captured_at = lm.mc
      WHERE ${scope.sql}`,
    params: [...scope.params, ...scope.params],
  };
}
