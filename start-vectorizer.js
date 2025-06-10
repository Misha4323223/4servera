#!/usr/bin/env node
/**
 * Standalone запуск векторизатора
 * Используется для тестирования и автономной работы
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎨 Запуск BOOOMERANGS AI Vectorizer Server...');

const vectorizerPath = path.join(__dirname, 'server', 'vectorizer-server.js');

const vectorizer = spawn('node', [vectorizerPath], {
  stdio: 'inherit',
  env: {
    ...process.env,
    VECTORIZER_PORT: process.env.VECTORIZER_PORT || '3001'
  }
});

vectorizer.on('error', (error) => {
  console.error('❌ Ошибка запуска векторизатора:', error);
  process.exit(1);
});

vectorizer.on('close', (code) => {
  console.log(`🛑 Vectorizer Server завершен с кодом ${code}`);
  process.exit(code);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Получен SIGTERM, завершение векторизатора...');
  vectorizer.kill('SIGTERM');
});

process.on('SIGINT', () => {
  console.log('🛑 Получен SIGINT, завершение векторизатора...');
  vectorizer.kill('SIGINT');
});