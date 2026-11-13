import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const projectRoot = resolve(fileURLToPath(new URL('..', import.meta.url)));
const cliPath = join(projectRoot, 'bin', 'senvyr-devsecops.mjs');

function sandbox(t) {
  const path = mkdtempSync(join(tmpdir(), 'senvyr-devsecops-test-'));
  t.after(() => rmSync(path, { recursive: true, force: true }));
  return path;
}

function fixture(target, directory, extras = {}) {
  const path = join(target, directory);
  mkdirSync(path, { recursive: true });
  writeFileSync(
    join(path, 'package.json'),
    JSON.stringify({
      scripts: {
        lint: 'eslint .',
        test: 'node --test',
        build: 'tsc',
        ...extras,
      },
    }),
  );
  writeFileSync(join(path, 'package-lock.json'), '{}');
}

function run(target, ...args) {
  return spawnSync(process.execPath, [cliPath, '--target', target, ...args], {
    encoding: 'utf8',
  });
}

test('simulation sans ecriture', (t) => {
  const target = sandbox(t);
  fixture(target, '');

  const result = run(target);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Mode simulation/);
  assert.equal(existsSync(join(target, '.github', 'workflows', 'ci.yml')), false);
});

test('installation fullstack : deux jobs Node et securite', (t) => {
  const target = sandbox(t);
  fixture(target, 'frontend');
  fixture(target, 'backend', {
    'test:e2e': 'jest --config ./test/jest-e2e.json',
    'format:check': 'prettier --check src test',
  });

  const result = run(target, '--apply');
  assert.equal(result.status, 0, result.stderr);
  const yaml = readFileSync(join(target, '.github', 'workflows', 'ci.yml'), 'utf8');

  assert.match(yaml, /^  frontend:$/m);
  assert.match(yaml, /^  backend:$/m);
  assert.match(yaml, /^  security:$/m);
  assert.match(yaml, /working-directory: frontend/);
  assert.match(yaml, /working-directory: backend/);
  assert.match(yaml, /npm run test:e2e/);
  assert.match(yaml, /npm run format:check/);
  assert.match(yaml, /ghcr\.io\/gitleaks\/gitleaks/);
  assert.match(yaml, /aquasecurity\/trivy-action/);
  assert.doesNotMatch(yaml, /__NODE_JOBS__|__WORKDIR__|__OPTIONAL_STEPS__/);
});

test('installation root-only avec node 22', (t) => {
  const target = sandbox(t);
  fixture(target, '');

  const result = run(target, '--node-version', '22', '--apply');
  assert.equal(result.status, 0, result.stderr);
  const yaml = readFileSync(join(target, '.github', 'workflows', 'ci.yml'), 'utf8');

  assert.match(yaml, /^  application:$/m);
  assert.doesNotMatch(yaml, /^  frontend:$/m);
  assert.doesNotMatch(yaml, /^  backend:$/m);
  assert.match(yaml, /node-version: '22'/);
});

test('ne remplace jamais un workflow existant', (t) => {
  const target = sandbox(t);
  fixture(target, '');
  const path = join(target, '.github', 'workflows');
  mkdirSync(path, { recursive: true });
  writeFileSync(join(path, 'ci.yml'), 'original\n');

  const result = run(target, '--apply');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Workflow deja present/);
  assert.equal(readFileSync(join(path, 'ci.yml'), 'utf8'), 'original\n');
});

test('refuse les scripts manquants', (t) => {
  const target = sandbox(t);
  fixture(target, '', { build: '' });

  const result = run(target, '--apply');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /script obligatoire manquant/);
  assert.equal(existsSync(join(target, '.github')), false);
});

test('refuse ESLint --fix en CI', (t) => {
  const target = sandbox(t);
  fixture(target, '', { lint: 'eslint . --fix' });

  const result = run(target, '--apply');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /sans --fix/);
});

test('refuse un Vitest interactif', (t) => {
  const target = sandbox(t);
  fixture(target, '', { test: 'vitest' });

  const result = run(target, '--apply');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /vitest run/);
});

test('refuse un projet sans package-lock', (t) => {
  const target = sandbox(t);
  mkdirSync(join(target, 'frontend'));
  writeFileSync(join(target, 'frontend', 'package.json'), '{}');

  const result = run(target, '--apply');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /package-lock\.json est requis/);
});

test('le workflow genere possede une structure YAML valide (PyYAML disponible)', (t) => {
  const probe = spawnSync('python3', ['-c', 'import yaml'], { encoding: 'utf8' });
  if (probe.error || probe.status !== 0) {
    t.skip('PyYAML non installe sur cette machine');
    return;
  }

  const target = sandbox(t);
  fixture(target, 'frontend');
  fixture(target, 'backend', { 'test:e2e': 'jest --runInBand' });
  const result = run(target, '--apply');
  assert.equal(result.status, 0, result.stderr);

  const yaml = readFileSync(join(target, '.github', 'workflows', 'ci.yml'), 'utf8');
  const validation = spawnSync(
    'python3',
    [
      '-c',
      'import sys, yaml; d = yaml.safe_load(sys.stdin.read()); assert set(d["jobs"]) == {"frontend", "backend", "security"}; print("YAML valide")',
    ],
    { encoding: 'utf8', input: yaml },
  );

  assert.equal(validation.status, 0, validation.stderr);
  assert.match(validation.stdout, /YAML valide/);
});
