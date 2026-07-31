// ProxyAI — PricingRepository Interface
// Billing Design Review v2 — Revision 5 (Pricing Versioning)
// Milestone 1: interface only. Implementation arrives with services.

import type { PricingVersion, Prisma } from '@prisma/client'

export interface PricingVersionCreateInput {
  modelId: string
  version: number
  inputPrice: Prisma.Decimal // per 1M tokens
  outputPrice: Prisma.Decimal // per 1M tokens
  markupPercent: Prisma.Decimal
  serviceFee: Prisma.Decimal
  effectiveFrom: Date
  effectiveTo?: Date | null
}

export interface PricingRepository {
  /** Find the active pricing version for a model at a point in time. */
  findActiveByModelId(modelId: string, at: Date): Promise<PricingVersion | null>

  /** Find a pricing version by id (used to hydrate usage snapshots). */
  findById(id: string): Promise<PricingVersion | null>

  /** List all versions of a model, newest first (pricing history). */
  findByModelId(modelId: string): Promise<PricingVersion[]>

  /** Create a new pricing version (immutable history). */
  create(input: PricingVersionCreateInput, tx?: Prisma.TransactionClient): Promise<PricingVersion>

  /** Archive a version (soft end of validity). */
  archive(id: string, effectiveTo: Date, tx?: Prisma.TransactionClient): Promise<PricingVersion>
}
