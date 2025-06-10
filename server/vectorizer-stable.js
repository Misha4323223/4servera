#!/usr/bin/env node
/**
 * Абсолютно стабильный векторизатор сервер
 * Использует принудительные механизмы для предотвращения падения
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Глобальные переменные для стабильности
let server;
let keepAliveIntervals = [];
const PORT = process.env.VECTORIZER_PORT || 3001;

// Детальное логирование
const logFile = '/tmp/vectorizer-stable.log';
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

function log(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type}] ${message}\n`;
  logStream.write(logEntry);
  console.log(message);
}

log('🚀 STABLE VECTORIZER STARTUP');

// Принудительная стабилизация процесса
function stabilizeProcess() {
  log('🔒 Активация принудительной стабилизации процесса');
  
  // Множественные keep-alive интервалы
  const intervals = [
    setInterval(() => { /* keep alive 1 */ }, 1000),
    setInterval(() => { /* keep alive 2 */ }, 2000),
    setInterval(() => { /* keep alive 3 */ }, 5000),
    setInterval(() => { 
      log(`💪 Process force-keep-alive: PID ${process.pid}`, 'STABLE');
    }, 30000)
  ];
  
  keepAliveIntervals.push(...intervals);
  
  // Принудительное предотвращение завершения
  process.stdin.resume();
  
  // Блокировка завершения через setTimeout
  const blockExit = () => {
    setTimeout(blockExit, 10000);
  };
  blockExit();
  
  log('✅ Процесс стабилизирован множественными механизмами');
}

// Загрузка маршрутов
async function loadRoutes() {
  try {
    log('📂 Загрузка векторизатор маршрутов...');
    const routesModule = await import('./advanced-vectorizer-routes.js');
    log('✅ Маршруты успешно загружены');
    return routesModule.default;
  } catch (error) {
    log(`❌ Ошибка загрузки маршрутов: ${error.message}`, 'ERROR');
    throw error;
  }
}

// Основная функция запуска
async function startStableVectorizer() {
  log('🎯 Запуск стабильного векторизатора');
  
  // Активируем стабилизацию сразу
  stabilizeProcess();
  
  // Создаем Express приложение
  const app = express();
  
  // CORS настройка
  app.use(cors({
    origin: ['http://localhost:5000', 'http://localhost:3000', /\.replit\.app$/],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
  }));
  
  // Базовые middleware
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));
  
  // Детальное логирование запросов
  app.use((req, res, next) => {
    log(`🌐 ${req.method} ${req.url}`, 'HTTP');
    next();
  });
  
  // Статические файлы
  app.use('/output', express.static(path.join(__dirname, '..', 'output')));
  
  // Health check
  app.get('/health', (req, res) => {
    const health = {
      status: 'ok',
      service: 'vectorizer-server-stable',
      port: PORT,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      pid: process.pid,
      memory: process.memoryUsage(),
      activeHandles: process._getActiveHandles().length
    };
    res.json(health);
  });
  
  // Загружаем и подключаем маршруты векторизатора
  try {
    const vectorizerRoutes = await loadRoutes();
    app.use('/api/vectorizer', vectorizerRoutes);
    log('🎨 Векторизатор маршруты подключены');
  } catch (error) {
    log(`❌ Критическая ошибка подключения маршрутов: ${error.message}`, 'ERROR');
    process.exit(1);
  }
  
  // Запуск сервера
  return new Promise((resolve, reject) => {
    server = app.listen(PORT, '0.0.0.0', (error) => {
      if (error) {
        log(`❌ Ошибка запуска сервера: ${error.message}`, 'ERROR');
        reject(error);
        return;
      }
      
      log(`🎨 Стабильный векторизатор запущен на порту ${PORT}`);
      log(`📍 API: http://localhost:${PORT}/api/vectorizer`);
      log(`🏥 Health: http://localhost:${PORT}/health`);
      
      // Heartbeat с расширенной информацией
      const heartbeat = setInterval(() => {
        const mem = process.memoryUsage();
        const handles = process._getActiveHandles().length;
        log(`💓 Heartbeat: Uptime=${Math.round(process.uptime())}s, Memory=${Math.round(mem.heapUsed/1024/1024)}MB, Handles=${handles}`, 'HEARTBEAT');
      }, 10000);
      
      keepAliveIntervals.push(heartbeat);
      resolve(server);
    });
    
    server.on('error', (error) => {
      log(`❌ Server error: ${error.message}`, 'ERROR');
      reject(error);
    });
  });
}

// Обработка сигналов завершения
process.on('SIGTERM', () => {
  log('📥 SIGTERM получен, корректное завершение...', 'SHUTDOWN');
  cleanup();
});

process.on('SIGINT', () => {
  log('📥 SIGINT получен, корректное завершение...', 'SHUTDOWN');
  cleanup();
});

function cleanup() {
  log('🧹 Очистка ресурсов...', 'SHUTDOWN');
  
  keepAliveIntervals.forEach(interval => {
    clearInterval(interval);
  });
  
  if (server) {
    server.close(() => {
      log('✅ Сервер корректно закрыт', 'SHUTDOWN');
      logStream.end();
      process.exit(0);
    });
  } else {
    logStream.end();
    process.exit(0);
  }
}

// Запуск
(async () => {
  try {
    await startStableVectorizer();
    log('✅ СТАБИЛЬНЫЙ ВЕКТОРИЗАТОР ПОЛНОСТЬЮ ГОТОВ');
  } catch (error) {
    log(`❌ Критическая ошибка запуска: ${error.message}`, 'ERROR');
    process.exit(1);
  }
})();