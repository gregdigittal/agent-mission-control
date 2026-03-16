import { describe, it, expect, beforeEach } from 'vitest';
import {
  captureException,
  captureMessage,
  addBreadcrumb,
  setUser,
  clearUser,
  getErrorBuffer,
  clearErrorBuffer,
  clearBreadcrumbs,
} from './errorTracking';

beforeEach(() => {
  clearErrorBuffer();
  clearBreadcrumbs();
  clearUser();
});

describe('captureException', () => {
  it('adds event to buffer', () => {
    captureException(new Error('boom'));
    expect(getErrorBuffer()).toHaveLength(1);
    expect(getErrorBuffer()[0].message).toBe('boom');
  });

  it('defaults level to error', () => {
    captureException(new Error('x'));
    expect(getErrorBuffer()[0].level).toBe('error');
  });

  it('respects custom level', () => {
    captureException(new Error('x'), { level: 'warning' });
    expect(getErrorBuffer()[0].level).toBe('warning');
  });

  it('attaches tags', () => {
    captureException(new Error('x'), { tags: { env: 'test' } });
    expect(getErrorBuffer()[0].tags.env).toBe('test');
  });

  it('attaches extra context', () => {
    captureException(new Error('x'), { extra: { userId: 42 } });
    expect(getErrorBuffer()[0].extra.userId).toBe(42);
  });

  it('converts non-Error values to Error message', () => {
    captureException('string error');
    expect(getErrorBuffer()[0].message).toBe('string error');
  });

  it('returns a unique event ID each time', () => {
    const id1 = captureException(new Error('a'));
    const id2 = captureException(new Error('b'));
    expect(id1).not.toBe(id2);
    expect(id1).toHaveLength(32);
  });
});

describe('captureMessage', () => {
  it('captures plain string messages', () => {
    captureMessage('hello world');
    expect(getErrorBuffer()[0].message).toBe('hello world');
  });

  it('defaults level to error', () => {
    captureMessage('info msg', { level: 'info' });
    expect(getErrorBuffer()[0].level).toBe('info');
  });
});

describe('addBreadcrumb', () => {
  it('attaches breadcrumbs to subsequent events', () => {
    addBreadcrumb({ message: 'user clicked submit', category: 'ui' });
    captureException(new Error('submit failed'));
    const crumbs = getErrorBuffer()[0].breadcrumbs;
    expect(crumbs).toHaveLength(1);
    expect(crumbs[0].message).toBe('user clicked submit');
  });

  it('breadcrumbs persist across events', () => {
    addBreadcrumb({ message: 'step 1' });
    captureException(new Error('e1'));
    captureException(new Error('e2'));
    expect(getErrorBuffer()[1].breadcrumbs).toHaveLength(1);
  });
});

describe('setUser / clearUser', () => {
  it('attaches user to events', () => {
    setUser({ id: 'u1', email: 'a@b.com' });
    captureException(new Error('x'));
    expect(getErrorBuffer()[0].user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('clearUser removes user from subsequent events', () => {
    setUser({ id: 'u1' });
    clearUser();
    captureException(new Error('x'));
    expect(getErrorBuffer()[0].user).toBeUndefined();
  });

  it('ctx.user overrides setUser', () => {
    setUser({ id: 'global' });
    captureException(new Error('x'), { user: { id: 'override' } });
    expect(getErrorBuffer()[0].user?.id).toBe('override');
  });
});

describe('ring buffer', () => {
  it('clearErrorBuffer empties the buffer', () => {
    captureException(new Error('x'));
    clearErrorBuffer();
    expect(getErrorBuffer()).toHaveLength(0);
  });
});
