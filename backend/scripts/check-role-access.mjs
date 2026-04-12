import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(backendRoot, '..');

const routeDir = path.join(backendRoot, 'src', 'routes');
const appPath = path.join(projectRoot, 'frontend', 'src', 'App.tsx');
const sidebarPath = path.join(projectRoot, 'frontend', 'src', 'components', 'layout', 'Sidebar.tsx');

const failures = [];

const routeFiles = fs
  .readdirSync(routeDir)
  .filter((file) => file.endsWith('.js') || file.endsWith('.ts'));

for (const file of routeFiles) {
  const filePath = path.join(routeDir, file);
  const content = fs.readFileSync(filePath, 'utf8');

  if (content.includes("authorize(['admin', 'hr'])") || content.includes('authorize(["admin", "hr"])')) {
    failures.push(`${file}: found legacy admin/hr guard without ceo`);
  }
}

const appContent = fs.readFileSync(appPath, 'utf8');
if (!appContent.includes('requiredPermission')) {
  failures.push('frontend/src/App.tsx: missing permissions-based route guard');
}

const sidebarContent = fs.readFileSync(sidebarPath, 'utf8');
if (!sidebarContent.includes('permission:')) {
  failures.push('frontend/src/components/layout/Sidebar.tsx: missing permission-based menu configuration');
}

if (failures.length > 0) {
  console.error('Role access checks failed:');
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log('Role access checks passed.');
