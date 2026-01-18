import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testDbPath = path.resolve(__dirname, '../../data/finance.test.db');

export default function setup() {
  // Delete existing test database to start fresh
  if (fs.existsSync(testDbPath)) {
    fs.unlinkSync(testDbPath);
  }

  // Use drizzle-kit push to create tables from schema
  execSync('npx drizzle-kit push --force', {
    cwd: __dirname,
    env: { ...process.env, DATABASE_URL: testDbPath },
    stdio: 'pipe',
  });
}
