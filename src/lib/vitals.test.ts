import { describe, expect, it } from 'vitest';
import { telemetryPage } from './browserTelemetry';

describe('speed reports', () => {
  it('name pages by pattern, never with record ids', () => {
    expect(telemetryPage('/panel/sales/customers/105/payments')).toBe(
      '/panel/sales/customers/:id/payments',
    );
    expect(telemetryPage('/panel/payments/501')).toBe('/panel/payments/:id');
    expect(telemetryPage('/panel/documents/sop')).toBe('/panel/documents/sop');
    expect(telemetryPage('/panel/pay/privateinvoicecode')).toBe('/panel/pay/:token');
  });
});
