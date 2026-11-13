#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const workflowTemplatePath = join(packageRoot, 'templates', 'workflow.yml');
const nodeJobTemplatePath = join(packageRoot, 'templates', 'node-job.yml');

function usage() {
  return `SENVYR DevSecOps Starter 0.1.0

Usage:
  node bin/senvyr-devsecops.mjs [--target DOSSIER] [--node-version 24] [--dry-run]
  node bin/senvyr-devsecops.mjs [--target DOSSIER] [--node-version 24] --apply

Sans --apply, la commande ne modifie aucun fichier.
Le workflow existant n'est jamais remplace.
Prerequis : Node >= 20, package.json, package-lock.json et scripts lint/test/build.
`;
}

function parseArguments(args) {
  const options = {
    target: '.',
    nodeVersion: '24',
    apply: false,
    help: false,
  };

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];

    if (argument === '--help' || argument === '-h') {
      options.help = true;
    } else if (argument === '--apply') {
      options.apply = true;
    } else if (argument === '--dry-run') {
      options.apply = false;
    } else if (argument === '--target' || argument === '--node-version') {
      const value = args[++index];
      if (!value || value.startsWith('--')) {
        throw new Error(`Valeur manquante apres ${argument}`);
      }
      if (argument === '--target') {
        options.target = value;
      } else {
        options.nodeVersion = value;
      }
    } else {
      throw new Error(`Argument inconnu : ${argument}`);
    }
  }

  if (!/^(20|22|24)$/.test(options.nodeVersion)) {
    throw new Error('Version Node.js prise en charge : 20, 22 ou 24.');
  }

  return options;
}

function readPackage(directory) {
  const packagePath = join(directory, 'package.json');
  if (!existsSync(packagePath)) {
    return null;
  }

  if (!existsSync(join(directory, 'package-lock.json'))) {
    throw new Error(`${packagePath} : package-lock.json est requis pour npm ci.`);
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(packagePath, 'utf8'));
  } catch {
    throw new Error(`${packagePath} : JSON invalide.`);
  }

  const scripts = manifest.scripts ?? {};
  for (const required of ['lint', 'test', 'build']) {
    if (typeof scripts[required] !== 'string' || !scripts[required].trim()) {
      throw new Error(`${packagePath} : script obligatoire manquant (${required}).`);
    }
  }

  if (!/eslint/.test(scripts.lint) || /(?:^|\s)--fix(?:\s|$)/.test(scripts.lint)) {
    throw new Error(`${packagePath} : lint doit utiliser ESLint sans --fix.`);
  }

  if (/\bvitest\b/.test(scripts.test) && !/\b(?:run|--run)\b/.test(scripts.test)) {
    throw new Error(`${packagePath} : utiliser "vitest run" pour une CI non interactive.`);
  }

  return { manifest, scripts };
}

function detectPackages(target) {
  const frontend = readPackage(join(target, 'frontend'));
  const backend = readPackage(join(target, 'backend'));

  if (frontend || backend) {
    return [
      ...(frontend ? [{ id: 'frontend', label: 'Frontend', directory: 'frontend', ...frontend }] : []),
      ...(backend ? [{ id: 'backend', label: 'Backend', directory: 'backend', ...backend }] : []),
    ];
  }

  const rootPackage = readPackage(target);
  if (rootPackage) {
    return [{ id: 'application', label: 'Application', directory: '.', ...rootPackage }];
  }

  throw new Error('Aucun projet Node/npm detecte (racine, frontend/ ou backend/).');
}

function extraSteps(pkg) {
  const steps = [];
  if (pkg.scripts['format:check']) {
    steps.push('      - name: Prettier / format check\n        run: npm run format:check');
  }
  if (pkg.scripts['test:e2e']) {
    steps.push('      - name: End-to-end tests\n        run: npm run test:e2e');
  }
  return steps.length > 0 ? `\n${steps.join('\n\n')}\n` : '';
}

function renderJob(pkg, nodeVersion) {
  const template = readFileSync(nodeJobTemplatePath, 'utf8');
  let output = template;
  const replacements = {
    '__JOB_ID__': pkg.id,
    '__JOB_LABEL__': pkg.label,
    '__WORKDIR__': pkg.directory,
    '__NODE_VERSION__': nodeVersion,
    '__TEST_COMMAND__': 'npm test',
    '__OPTIONAL_STEPS__': extraSteps(pkg),
  };

  for (const [placeholder, value] of Object.entries(replacements)) {
    output = output.replaceAll(placeholder, value);
  }
  return output.trimEnd();
}

function renderWorkflow(packages, nodeVersion) {
  const jobs = packages.map((pkg) => renderJob(pkg, nodeVersion)).join('\n\n');
  return readFileSync(workflowTemplatePath, 'utf8').replace('__NODE_JOBS__', jobs);
}

function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    process.stdout.write(usage());
    return;
  }

  const target = resolve(options.target);
  const outputPath = join(target, '.github', 'workflows', 'ci.yml');

  if (!existsSync(target)) {
    throw new Error(`Dossier cible inexistant : ${target}`);
  }

  if (existsSync(outputPath)) {
    throw new Error(`Workflow deja present : ${outputPath}. Aucune modification effectuee.`);
  }

  const packages = detectPackages(target);
  const workflow = renderWorkflow(packages, options.nodeVersion);
  const detected = packages.map((pkg) => pkg.directory).join(', ');

  process.stdout.write(`Projet(s) detecte(s) : ${detected}\n`);
  process.stdout.write(`Destination : ${outputPath}\n`);
  process.stdout.write(`Node.js CI : ${options.nodeVersion}\n`);

  if (!options.apply) {
    process.stdout.write('Mode simulation : aucun fichier modifie. Ajouter --apply pour installer.\n');
    return;
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, workflow, { encoding: 'utf8', flag: 'wx', mode: 0o644 });
  process.stdout.write('Workflow installe. Verifier son contenu avant git add / commit.\n');
}

try {
  main();
} catch (error) {
  process.stderr.write(`ERREUR : ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
