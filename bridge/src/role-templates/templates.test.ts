/**
 * Role template tests — validates schema of each built-in template
 * and tests the loadRoleTemplate / listRoleTemplates functions.
 */
import { describe, it, expect } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadRoleTemplate, listRoleTemplates } from './loader.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Schema validation ─────────────────────────────────────────────────────────

const REQUIRED_STRING_FIELDS = ['name', 'version', 'description', 'systemPrompt'] as const;
const EXPECTED_TEMPLATES = [
  'data-analyst',
  'devops-engineer',
  'frontend-dev',
  'qa-specialist',
  'security-reviewer',
] as const;

describe('Role template schema', () => {
  for (const templateName of EXPECTED_TEMPLATES) {
    describe(templateName, () => {
      let template: Record<string, unknown>;

      it('file exists and is valid JSON', async () => {
        const raw = await readFile(join(__dirname, `${templateName}.json`), 'utf-8');
        template = JSON.parse(raw) as Record<string, unknown>;
        expect(template).toBeTruthy();
      });

      it('has all required string fields', async () => {
        const raw = await readFile(join(__dirname, `${templateName}.json`), 'utf-8');
        const t = JSON.parse(raw) as Record<string, unknown>;
        for (const field of REQUIRED_STRING_FIELDS) {
          expect(typeof t[field], `${field} must be a string`).toBe('string');
          expect((t[field] as string).length, `${field} must not be empty`).toBeGreaterThan(0);
        }
      });

      it('has allowedTools as non-empty string array', async () => {
        const raw = await readFile(join(__dirname, `${templateName}.json`), 'utf-8');
        const t = JSON.parse(raw) as Record<string, unknown>;
        expect(Array.isArray(t['allowedTools'])).toBe(true);
        const tools = t['allowedTools'] as unknown[];
        expect(tools.length).toBeGreaterThan(0);
        tools.forEach(tool => expect(typeof tool).toBe('string'));
      });

      it('has directoryScope as non-empty string array', async () => {
        const raw = await readFile(join(__dirname, `${templateName}.json`), 'utf-8');
        const t = JSON.parse(raw) as Record<string, unknown>;
        expect(Array.isArray(t['directoryScope'])).toBe(true);
        const scope = t['directoryScope'] as unknown[];
        expect(scope.length).toBeGreaterThan(0);
        scope.forEach(s => expect(typeof s).toBe('string'));
      });

      it('has maxTurns as positive number', async () => {
        const raw = await readFile(join(__dirname, `${templateName}.json`), 'utf-8');
        const t = JSON.parse(raw) as Record<string, unknown>;
        expect(typeof t['maxTurns']).toBe('number');
        expect((t['maxTurns'] as number)).toBeGreaterThan(0);
      });

      it('name matches filename', async () => {
        const raw = await readFile(join(__dirname, `${templateName}.json`), 'utf-8');
        const t = JSON.parse(raw) as Record<string, unknown>;
        expect(t['name']).toBe(templateName);
      });
    });
  }
});

// ── loadRoleTemplate ──────────────────────────────────────────────────────────

describe('loadRoleTemplate', () => {
  it('loads a known template successfully', async () => {
    const template = await loadRoleTemplate('frontend-dev');
    expect(template).not.toBeNull();
    expect(template!.name).toBe('frontend-dev');
    expect(template!.allowedTools).toContain('Read');
    expect(template!.allowedTools).toContain('Edit');
    expect(template!.directoryScope).toContain('app/src/');
    expect(template!.maxTurns).toBeGreaterThan(0);
  });

  it('returns null for unknown template', async () => {
    const result = await loadRoleTemplate('nonexistent-template');
    expect(result).toBeNull();
  });

  it('returns null for name with path traversal characters', async () => {
    const result = await loadRoleTemplate('../config/adminPolicy');
    expect(result).toBeNull();
  });

  it('returns null for empty name', async () => {
    const result = await loadRoleTemplate('');
    expect(result).toBeNull();
  });

  it('returns null for name with uppercase (not matching filename convention)', async () => {
    const result = await loadRoleTemplate('Frontend-Dev');
    expect(result).toBeNull();
  });

  it('loads security-reviewer as read-only (Glob+Grep+Read only)', async () => {
    const template = await loadRoleTemplate('security-reviewer');
    expect(template).not.toBeNull();
    expect(template!.allowedTools).toContain('Read');
    expect(template!.allowedTools).toContain('Glob');
    expect(template!.allowedTools).toContain('Grep');
    expect(template!.allowedTools).not.toContain('Edit');
    expect(template!.allowedTools).not.toContain('Write');
    expect(template!.allowedTools).not.toContain('Bash');
  });

  it('loads qa-specialist with test-scoped directory scope', async () => {
    const template = await loadRoleTemplate('qa-specialist');
    expect(template).not.toBeNull();
    const scope = template!.directoryScope;
    expect(scope.some(s => s.includes('.test.'))).toBe(true);
  });
});

// ── listRoleTemplates ─────────────────────────────────────────────────────────

describe('listRoleTemplates', () => {
  it('returns all 5 built-in templates', async () => {
    const list = await listRoleTemplates();
    for (const expected of EXPECTED_TEMPLATES) {
      expect(list).toContain(expected);
    }
  });

  it('returns sorted list', async () => {
    const list = await listRoleTemplates();
    const sorted = [...list].sort();
    expect(list).toEqual(sorted);
  });

  it('excludes non-json files (like loader.ts, templates.test.ts)', async () => {
    const list = await listRoleTemplates();
    expect(list.some(n => n.endsWith('.ts'))).toBe(false);
  });
});
