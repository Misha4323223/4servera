/**
 * Standalone сервер векторизатора изображений
 * Работает на порту 3001, изолированно от основного приложения
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Настройка детального логирования в файл
const logFile = '/tmp/vectorizer-detailed.log';
const logStream = fs.createWriteStream(logFile, { flags: 'w' });

function detailedLog(message, type = 'INFO') {
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] [${type}] ${message}\n`;
  
  // Пишем в файл
  logStream.write(logEntry);
  
  // Также выводим в консоль
  console.log(`${message}`);
}

function logError(message, error = null) {
  const timestamp = new Date().toISOString();
  let logEntry = `[${timestamp}] [ERROR] ${message}\n`;
  
  if (error) {
    logEntry += `[${timestamp}] [ERROR] Stack: ${error.stack}\n`;
    logEntry += `[${timestamp}] [ERROR] Message: ${error.message}\n`;
    logEntry += `[${timestamp}] [ERROR] Type: ${error.constructor.name}\n`;
    logEntry += `[${timestamp}] [ERROR] Code: ${error.code}\n`;
    logEntry += `[${timestamp}] [ERROR] Errno: ${error.errno}\n`;
  }
  
  logStream.write(logEntry);
  console.error(message);
  if (error) {
    console.error('Stack:', error.stack);
  }
}

// Глубокая диагностика системы
function logSystemState(reason = 'periodic') {
  const timestamp = new Date().toISOString();
  const mem = process.memoryUsage();
  const handles = process._getActiveHandles();
  const requests = process._getActiveRequests();
  
  let logEntry = `[${timestamp}] [SYSTEM] === SYSTEM STATE (${reason}) ===\n`;
  logEntry += `[${timestamp}] [SYSTEM] PID: ${process.pid}\n`;
  logEntry += `[${timestamp}] [SYSTEM] Uptime: ${process.uptime()}s\n`;
  logEntry += `[${timestamp}] [SYSTEM] Memory RSS: ${Math.round(mem.rss/1024/1024)}MB\n`;
  logEntry += `[${timestamp}] [SYSTEM] Memory HeapUsed: ${Math.round(mem.heapUsed/1024/1024)}MB\n`;
  logEntry += `[${timestamp}] [SYSTEM] Memory HeapTotal: ${Math.round(mem.heapTotal/1024/1024)}MB\n`;
  logEntry += `[${timestamp}] [SYSTEM] Memory External: ${Math.round(mem.external/1024/1024)}MB\n`;
  logEntry += `[${timestamp}] [SYSTEM] Active Handles: ${handles.length}\n`;
  logEntry += `[${timestamp}] [SYSTEM] Active Requests: ${requests.length}\n`;
  logEntry += `[${timestamp}] [SYSTEM] Event Loop Delay: ${process.hrtime.bigint()}\n`;
  
  // Детали активных handles (ограничиваем до 5)
  handles.slice(0, 5).forEach((handle, index) => {
    if (handle && handle.constructor) {
      logEntry += `[${timestamp}] [SYSTEM] Handle ${index}: ${handle.constructor.name}\n`;
    }
  });
  if (handles.length > 5) {
    logEntry += `[${timestamp}] [SYSTEM] ... и еще ${handles.length - 5} handles\n`;
  }
  
  logStream.write(logEntry);
  detailedLog(`SYSTEM STATE: PID=${process.pid}, Handles=${handles.length}, Memory=${Math.round(mem.heapUsed/1024/1024)}MB`, 'SYSTEM');
}

detailedLog('🚀 VECTORIZER SERVER STARTUP INITIATED');
detailedLog('📁 Log file created: ' + logFile);

// Асинхронная функция запуска сервера
async function startVectorizerServer() {
  // Импортируем готовые маршруты векторизатора с обработкой ошибок
  let vectorizerRoutes;
  try {
    detailedLog('🔍 Загрузка модуля vectorizer routes...');
    vectorizerRoutes = await import('./advanced-vectorizer-routes.js');
    vectorizerRoutes = vectorizerRoutes.default;
    detailedLog('  ✓ Vectorizer routes загружены успешно');
  } catch (error) {
    logError('❌ ОШИБКА загрузки vectorizer routes', error);
    process.exit(1);
  }

  const app = express();
  const PORT = process.env.VECTORIZER_PORT || 3001;

  // Детальное логирование для диагностики
  detailedLog('🔍 Диагностика запуска векторизатора:');
  detailedLog('  ✓ Express импортирован');
  detailedLog('  ✓ CORS импортирован');
  detailedLog(`  ✓ Порт: ${PORT}`);
  detailedLog('  ✓ __dirname: ' + __dirname);

  // Детальное логирование всех событий процесса
  detailedLog('📝 Настройка обработчиков событий процесса...');
  logSystemState('startup');
  
  // Отслеживание ВСЕХ системных событий
  const allProcessEvents = [
    'uncaughtException', 'unhandledRejection', 'warning', 'exit', 'beforeExit',
    'SIGTERM', 'SIGINT', 'SIGHUP', 'SIGBREAK', 'message', 'disconnect',
    'multipleResolves', 'rejectionHandled'
  ];
  
  allProcessEvents.forEach(eventName => {
    process.on(eventName, (...args) => {
      // Убираем избыточное логирование для каждого события
      detailedLog(`🔔 PROCESS EVENT: ${eventName}`, 'EVENT');
      
      if (eventName === 'uncaughtException') {
        const error = args[0];
        logError('❌ FATAL: uncaughtException detected', error);
        logSystemState('uncaughtException');
        process.exit(1);
      }
      
      if (eventName === 'unhandledRejection') {
        const [reason, promise] = args;
        logError('❌ FATAL: unhandledRejection detected: ' + reason);
        logSystemState('unhandledRejection');
        if (reason instanceof Error) {
          logError('   Rejection details', reason);
        }
        process.exit(1);
      }
      
      if (eventName === 'exit') {
        logSystemState('process-exit');
        detailedLog(`🚪 PROCESS EXIT CODE: ${args[0]}`, 'EXIT');
        detailedLog(`   Exit reason: Normal termination or forced exit`, 'EXIT');
        detailedLog(`   Stack trace at exit: ${new Error().stack}`, 'EXIT');
      }
      
      if (eventName === 'beforeExit') {
        logSystemState('before-exit');
        detailedLog(`🚪 BEFORE EXIT CODE: ${args[0]}`, 'EXIT');
        detailedLog(`   Event loop empty, process about to exit`, 'EXIT');
        detailedLog(`   Stack trace at beforeExit: ${new Error().stack}`, 'EXIT');
        
        // Попытка спасти процесс
        setTimeout(() => {
          detailedLog('🆘 RESCUE ATTEMPT: Adding timeout to prevent exit', 'EXIT');
        }, 100);
      }
      
      if (eventName === 'warning') {
        const warning = args[0];
        detailedLog(`⚠️ Process Warning: ${warning.name} - ${warning.message}`, 'WARN');
        if (warning.stack) {
          detailedLog(`   Stack: ${warning.stack}`, 'WARN');
        }
      }
    });
  });



// Настройка CORS для кросс-доменных запросов
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:5000', 'http://localhost:3000', /\.replit\.app$/],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Middleware для парсинга JSON и URL-encoded данных
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статическая раздача выходных файлов векторизатора
app.use('/output', express.static(path.join(__dirname, '..', 'output')));

// Логирование запросов (единое middleware)
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${req.method} ${req.path} - Vectorizer Server`);
  next();
});

// Подключаем маршруты векторизатора
app.use('/api/vectorizer', vectorizerRoutes);

// Healthcheck endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'vectorizer-server',
    port: PORT,
    timestamp: new Date().toISOString(),
    endpoints: [
      '/api/vectorizer/analyze',
      '/api/vectorizer/convert',
      '/api/vectorizer/professional',
      '/api/vectorizer/batch',
      '/api/vectorizer/previews',
      '/api/vectorizer/multi-format',
      '/api/vectorizer/formats',
      '/api/vectorizer/health'
    ]
  });
});

// Информация о сервисе
app.get('/', (req, res) => {
  res.json({
    name: 'BOOOMERANGS AI - Vectorizer Service',
    description: 'Продвинутая векторизация изображений в SVG/EPS/PDF форматы',
    version: '1.0.0',
    port: PORT,
    endpoints: {
      health: '/health',
      api: '/api/vectorizer/*',
      output: '/output/*'
    }
  });
});

// Обработка 404 ошибок
app.use((req, res) => {
  res.status(404).json({
    error: 'Endpoint not found',
    message: `Path ${req.path} не существует в векторизаторе`,
    availableEndpoints: [
      '/health',
      '/api/vectorizer/*'
    ]
  });
});

// Глобальная обработка ошибок
app.use((err, req, res, next) => {
  console.error('Vectorizer Server Error:', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Внутренняя ошибка сервера векторизации',
    timestamp: new Date().toISOString()
  });
});

// Запуск сервера с детальным логированием
console.log(`🚀 Попытка запуска сервера на порту ${PORT}...`);
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 Vectorizer Server запущен на порту ${PORT}`);
  console.log(`📍 API доступен по адресу: http://localhost:${PORT}/api/vectorizer`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Output files: http://localhost:${PORT}/output`);
  console.log(`⏰ Время запуска: ${new Date().toISOString()}`);
  
  // Упрощенная проверка состояния без избыточного логирования
  const healthInterval = setInterval(() => {
    try {
      const memUsage = process.memoryUsage();
      const handles = process._getActiveHandles();
      
      console.log(`💓 Health: ${Math.round(process.uptime())}s, ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB, ${handles.length} handles`);
      
      // Критическая проверка состояния сервера
      if (!server.listening) {
        console.error('❌ CRITICAL: Server no longer listening!');
        clearInterval(healthInterval);
        return;
      }
      
      // Проверка утечек памяти
      if (memUsage.heapUsed > 100 * 1024 * 1024) {
        console.warn(`⚠️ HIGH MEMORY: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      }
      
    } catch (error) {
      console.error('❌ Heartbeat error:', error.message);
    }
  }, 10000);
  
  // Сохраняем интервал для очистки при завершении
  server.healthInterval = healthInterval;
  
  // МНОЖЕСТВЕННЫЕ механизмы удержания процесса
  const keepAliveIntervals = [];
  
  // Основной keep-alive интервал  
  const mainKeepAlive = setInterval(() => {
    detailedLog(`🔄 MAIN Keep-alive: процесс активен, PID: ${process.pid}`, 'KEEPALIVE');
  }, 5000);
  keepAliveIntervals.push(mainKeepAlive);
  
  // Удаляем избыточные интервалы
  

  

  
  // Сохраняем keep-alive интервалы
  server.keepAliveIntervals = keepAliveIntervals;
  
  // Обновляем обработчики завершения для очистки интервалов
  const cleanupAndExit = (code = 0) => {
    console.log(`🧹 Очистка ресурсов перед завершением...`);
    if (server.healthInterval) {
      clearInterval(server.healthInterval);
      console.log('  ✓ Health interval очищен');
    }
    // Очищаем все keep-alive интервалы
    if (server.keepAliveIntervals) {
      server.keepAliveIntervals.forEach(interval => clearInterval(interval));
      console.log('  ✓ Keep-alive intervals очищены');
    }
    if (server.listening) {
      server.close(() => {
        console.log('  ✓ HTTP сервер закрыт');
        process.exit(code);
      });
    } else {
      process.exit(code);
    }
  };
  
  // Упрощенные обработчики завершения
  process.on('SIGTERM', () => {
    console.log('📥 Получен SIGTERM, завершаем работу...');
    cleanupAndExit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('📥 Получен SIGINT, завершаем работу...');
    cleanupAndExit(0);
  });

  // Упрощенные обработчики серверных событий
  server.on('error', (error) => {
    console.error('❌ Server Error:', error.message);
    if (error.code === 'EADDRINUSE') {
      console.error(`Port ${PORT} уже используется`);
      process.exit(1);
    }
  });

  server.on('close', () => {
    console.log('🛑 Сервер закрыт');
    if (server.healthInterval) {
      clearInterval(server.healthInterval);
    }
    if (server.keepAliveIntervals) {
      server.keepAliveIntervals.forEach(interval => clearInterval(interval));
    }
  });

  console.log('✅ Векторизатор полностью инициализирован и готов к работе');
});
}

// Простой запуск сервера
startVectorizerServer().catch(error => {
  console.error('❌ Ошибка запуска:', error.message);
  process.exit(1);
});
