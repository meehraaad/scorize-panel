import { describe, expect, it } from 'vitest';
import indexHtml from '../../index.html?raw';
import nginxConf from '../../nginx.conf.template?raw';
import securityHeaders from '../../security-headers.conf?raw';

async function sha256Base64(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return btoa(String.fromCharCode(...new Uint8Array(digest)));
}

describe('Content-Security-Policy (security-headers.conf)', () => {
  it('allows the inline boot script of index.html by its current hash', async () => {
    const inline = /<script>([\s\S]*?)<\/script>/.exec(indexHtml)?.[1];
    expect(inline).toBeDefined();
    const hash = await sha256Base64(inline ?? '');
    // Edited the boot script? Put this hash in security-headers.conf.
    expect(securityHeaders).toContain(`'sha256-${hash}'`);
  });

  it('is included in every location that serves panel files', () => {
    const serving = nginxConf
      .split(/\n\s*location /)
      .slice(1)
      .filter((block) => block.includes('try_files'));
    expect(serving.length).toBeGreaterThan(0);
    for (const block of serving)
      expect(block).toContain('include /etc/nginx/snippets/security-headers.conf;');
  });
});
