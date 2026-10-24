import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api/client';
import type { Degree } from '@/lib/applicant/approval';

export type { Degree };

/**
 * Shared by every sales-panel page (seller and manager): the lead model, its stages, sources and
 * score, and the actions several pages offer. Endpoints: docs/backend-changes.md S1–S40.
 */

/** Every sales query key starts with this, so one change refreshes every sales page. */
export const SALES_KEY = ['sales'] as const;
export const SALES_API = '/sales/v1';

/**
 * Where a lead is (replaces SaleLead's "called: yes/no"; backend-changes S3). `draft`: a contract
 * draft waits for the sales manager; `won`: contract signed (first instalment on the board).
 */
export const STAGES = ['new', 'contacted', 'consulted', 'offer', 'draft', 'won', 'lost'] as const;
export type LeadStage = (typeof STAGES)[number];

/** SaleLead.Cause, grouped the way sellers think of them (S2). */
export const SOURCES = [
  'failed_purchase',
  'call_request',
  'chance_estimate',
  'campaign',
  'consultation',
  'manual',
] as const;
export type LeadSource = (typeof SOURCES)[number];

/** Why a deal was lost: required to close a lead (S3). */
export const LOST_REASONS = ['budget', 'competitor', 'gave_up', 'later', 'no_answer'] as const;
export type LostReason = (typeof LOST_REASONS)[number];

/** Automatic lead score 0–100 (S5), shown as a band. */
export type ScoreBand = 'hot' | 'warm' | 'cold';
export const SCORE_BANDS = ['hot', 'warm', 'cold'] as const;
export const scoreBand = (score: number): ScoreBand =>
  score >= 70 ? 'hot' : score >= 45 ? 'warm' : 'cold';

/** Team goal for the first call after a lead arrives. */
export const FIRST_CALL_TARGET_MINUTES = 15;

/** Ways to reach a customer. Messages open the app with a ready text (S7). */
export type Channel = 'call' | 'whatsapp' | 'telegram' | 'sms' | 'meeting';
export const MESSAGE_CHANNELS = ['whatsapp', 'telegram', 'sms'] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

/** 09xxxxxxxxx → 989xxxxxxxxx (international, no plus). */
const international = (phone: string) => `98${phone.replace(/^0/, '')}`;

/** A link that opens the messaging app with `text` ready to send. */
export function messageHref(channel: MessageChannel, phone: string, text = '') {
  const body = encodeURIComponent(text);
  if (channel === 'whatsapp') return `https://wa.me/${international(phone)}?text=${body}`;
  if (channel === 'telegram') return `https://t.me/+${international(phone)}`;
  return `sms:${phone}${text ? `?body=${body}` : ''}`;
}

/**
 * "0912 ••• 4418": enough to recognise a number on screen, not to copy it. Wrapped in a
 * left-to-right isolate so it keeps its order inside Persian text.
 */
export const maskPhone = (phone: string) =>
  `\u2066${phone.length === 11 ? `${phone.slice(0, 4)} ••• ${phone.slice(-4)}` : phone}\u2069`;

/**
 * Confirms a card-transfer receipt. Reuses Django's existing staff endpoint
 * (PaymentViewSet.confirm_receipt, api/user_profile/staff), so it works today.
 */
export function useConfirmReceipt() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ customer, payment }: { customer: number; payment: number }) =>
      api(
        `/profile/staff/v1/users/${String(customer)}/payments/${String(payment)}/confirm_receipt/`,
        { method: 'PATCH' },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: SALES_KEY }),
  });
}
