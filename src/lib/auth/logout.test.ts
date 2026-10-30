import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { queryClient } from '@/lib/api/queryClient';
import { toast } from '@/lib/toast';
import { server } from '@/test/server';
import { logout } from './logout';

const LOGOUT = '/api/profile/auth/v1/logout/';

describe('logout', () => {
  const assign = vi.fn();

  beforeEach(() => {
    const { href, origin } = window.location;
    vi.stubGlobal('location', { href, origin, assign });
    vi.spyOn(toast, 'error');
    queryClient.setQueryData(['applicant', 'overview'], { stage: 'applying' });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    assign.mockReset();
    queryClient.clear();
  });

  it('leaves for the site once Django ended the session', async () => {
    await logout();
    expect(assign).toHaveBeenCalledWith('/');
    expect(queryClient.getQueryData(['applicant', 'overview'])).toBeUndefined();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it.each([403, 500])('stays logged in and says so when Django answers %i', async (status) => {
    server.use(http.post(LOGOUT, () => new HttpResponse(null, { status })));
    await logout();
    expect(assign).not.toHaveBeenCalled();
    expect(queryClient.getQueryData(['applicant', 'overview'])).toEqual({ stage: 'applying' });
    expect(toast.error).toHaveBeenCalledOnce();
  });

  it('stays logged in when the request never reaches Django', async () => {
    server.use(http.post(LOGOUT, () => HttpResponse.error()));
    await logout();
    expect(assign).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledOnce();
  });
});
