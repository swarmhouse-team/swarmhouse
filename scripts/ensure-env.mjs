// Создаёт .env из .env.example при первой установке, чтобы проект запускался без ручных шагов.
import { copyFileSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const target = resolve(root, '.env');

if (!existsSync(target)) {
  copyFileSync(resolve(root, '.env.example'), target);
  console.log('Создан .env из .env.example');
}
