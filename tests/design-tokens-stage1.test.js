const assert = require('assert');
const fs = require('fs');
const path = require('path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const audit = fs.readFileSync(path.join(__dirname, '..', 'docs', 'design', 'AUDIT_2026-07.md'), 'utf8');
const root = html.match(/:root\s*\{([\s\S]*?)\n\s*\}/);

assert(root, 'index.html must retain a :root block');

const tokens = {
  '--ic-blue': '#1a3de8',
  '--ic-blue-hover': '#1533c4',
  '--ic-blue-soft': 'rgba(26,61,232,0.08)',
  '--ic-gray-900': '#37352f',
  '--ic-gray-600': '#6b6a66',
  '--ic-gray-400': '#9b9a97',
  '--ic-gray-200': 'rgba(55,53,47,0.12)',
  '--ic-gray-100': '#f1f1ef',
  '--ic-bg': '#f7f7f5',
  '--ic-surface': '#ffffff',
  '--ic-success': '#16a34a',
  '--ic-warning': '#d97706',
  '--ic-danger': '#dc2626',
  '--fs-xs': '12px',
  '--fs-sm': '13px',
  '--fs-base': '14px',
  '--fs-lg': '16px',
  '--fs-xl': '20px',
  '--fs-2xl': '24px',
  '--r-sm': '6px',
  '--r-md': '10px',
  '--r-full': '999px',
  '--sh-1': '0 1px 3px rgba(15,15,15,0.06)',
  '--sh-2': '0 8px 24px rgba(15,15,15,0.10)',
};

for (const [name, value] of Object.entries(tokens)) {
  assert(root[1].includes(`${name}: ${value};`), `unexpected value for ${name}`);
}

for (const legacy of ['--blue-mid:   #1a3de8;', '--bg:         #f7f7f5;', '--radius:     10px;']) {
  assert(root[1].includes(legacy), `Stage 1 must preserve ${legacy}`);
}

assert(html.includes('[data-theme="dark"]'), 'dark mode must remain opt-in');
assert(html.includes("const saved = localStorage.getItem('ic-theme') || 'light';"), 'first visit must remain light by default');
assert(
  html.includes("const isDark = val === 'dark' || (val === 'system' && prefersDark);"),
  'Stage 1 must preserve the existing explicit system-theme choice',
);
assert(
  audit.includes('Removal target for Stage 3:'),
  'the audit must record the existing prefers-color-scheme behavior as a later removal target',
);

console.log('design tokens Stage 1 contract passed');
