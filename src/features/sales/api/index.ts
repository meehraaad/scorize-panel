/**
 * Seller pages of the sales panel: one response per screen (as the applicant panel does), so a
 * phone waits for one round trip. Django: `/api/sales/v1/` (backend-changes.md S1–S40).
 */

export * from './today';
export * from './leads';
export * from './board';
export * from './customer';
export * from './month';
export * from './consultations';
export * from './purchases';
export * from './payments';
export * from './info';
export * from './apply';
export * from './sell';
export * from './offer';
export * from './manager';
export * from './contract';
