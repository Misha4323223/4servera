/**
 * Standalone сервер векторизатора изображений
 * Работает на порту 5006, изолированно от основного приложения
 */

import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Асинхронная функция запуска сервера
async function startVectorizerServer() {
  // Импортируем готовые маршруты векторизатора с обработкой ошибок
  let vectorizerRoutes;
  try {
    console.log('🔍 Загрузка модуля vectorizer routes...');
    vectorizerRoutes = await import('./advanced-vectorizer-routes.js');
    vectorizerRoutes = vectorizerRoutes.default;
    console.log('  ✓ Vectorizer routes загружены успешно');
  } catch (error) {
    console.error('❌ ОШИБКА загрузки vectorizer routes:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }

  const app = express();
  const PORT = process.env.VECTORIZER_PORT || 5006;

  // Детальное логирование для диагностики
  console.log('🔍 Диагностика запуска векторизатора:');
  console.log('  ✓ Express импортирован');
  console.log('  ✓ CORS импортирован');
  console.log(`  ✓ Порт: ${PORT}`);
  console.log('  ✓ __dirname:',  __dirname);

  // Детальное логирование всех событий процесса
  console.log('📝 Настройка обработчиков событий процесса...');
  
  // Логируем все возможные события процесса
  const processEvents = [
    'uncaughtException', 'unhandledRejection', 'warning', 'exit', 'beforeExit',
    'SIGTERM', 'SIGINT', 'SIGHUP', 'SIGBREAK', 'message', 'disconnect'
  ];
  
  processEvents.forEach(eventName => {
    process.on(eventName, (...args) => {
      console.log(`🔔 Process Event: ${eventName} at ${new Date().toISOString()}`);
      console.log('   Args:', args);
      
      if (eventName === 'uncaughtException') {
        const error = args[0];
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА - uncaughtException:', error.message);
        console.error('   Error type:', error.constructor.name);
        console.error('   Stack trace:', error.stack);
        process.exit(1);
      }
      
      if (eventName === 'unhandledRejection') {
        const [reason, promise] = args;
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА - unhandledRejection:', reason);
        console.error('   Promise:', promise);
        if (reason instanceof Error) {
          console.error('   Stack:', reason.stack);
        }
        process.exit(1);
      }
      
      if (eventName === 'warning') {
        const warning = args[0];
        console.warn('⚠️ Process Warning:', warning.name, warning.message);
        console.warn('   Stack:', warning.stack);
      }
    });
  });

  process.on('exit', (code) => {
    console.log(`🚪 Process exiting with code: ${code} at ${new Date().toISOString()}`);
  });

  process.on('beforeExit', (code) => {
    console.log(`🚪 Before exit with code: ${code} at ${new Date().toISOString()}`);
  });

// Настройка CORS для кросс-доменных запросов
app.use(cors({
  origin: ['http://localhost:5000', 'http://localhost:3000', /\.replit\.app$/],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

// Детальное логирование всех HTTP запросов
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  console.log(`🌐 HTTP ${req.method} ${req.url} from ${req.ip} at ${timestamp}`);
  console.log(`   User-Agent: ${req.get('User-Agent')}`);
  
  // Логируем ответ
  const originalSend = res.send;
  res.send = function(data) {
    console.log(`📤 Response ${res.statusCode} for ${req.method} ${req.url} at ${new Date().toISOString()}`);
    return originalSend.call(this, data);
  };
  
  next();
});

// Middleware для парсинга JSON и URL-encoded данных
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Статическая раздача выходных файлов векторизатора
app.use('/output', express.static(path.join(__dirname, '..', 'output')));

// Логирование запросов
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
  
  // Интенсивная проверка состояния (каждые 2 секунды)
  const healthInterval = setInterval(() => {
    try {
      const memUsage = process.memoryUsage();
      const uptime = process.uptime();
      const handles = process._getActiveHandles();
      const requests = process._getActiveRequests();
      
      console.log(`💓 Heartbeat ${new Date().toISOString()}`);
      console.log(`   Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`);
      console.log(`   Uptime: ${Math.round(uptime)}s`);
      console.log(`   Active handles: ${handles.length}`);
      console.log(`   Active requests: ${requests.length}`);
      console.log(`   Server listening: ${server.listening}`);
      console.log(`   PID: ${process.pid}`);
      
      // Детальная проверка состояния сервера
      if (!server.listening) {
        console.error('❌ КРИТИЧНО: Сервер больше не слушает на порту!');
        console.error('   Server state:', server.readyState);
        clearInterval(healthInterval);
      }
      
      // Проверяем event loop
      if (handles.length === 0 && requests.length === 0) {
        console.warn('⚠️ Event loop почти пуст - добавляем keep-alive задачи');
      }
      
    } catch (error) {
      console.error('❌ КРИТИЧЕСКАЯ ошибка в heartbeat:', error.message);
      console.error('   Stack:', error.stack);
    }
  }, 2000);
  
  // Сохраняем интервал для очистки при завершении
  server.healthInterval = healthInterval;
  
  // Принудительно держим процесс живым - создаем постоянный интервал
  const keepAliveInterval = setInterval(() => {
    // Этот интервал существует только для поддержания event loop
    // Логируем раз в минуту чтобы не засорять вывод
    if (Date.now() % 60000 < 2000) {
      console.log(`🔄 Keep-alive: процесс активен, PID: ${process.pid}`);
    }
  }, 1000);
  
  // Сохраняем keep-alive интервал
  server.keepAliveInterval = keepAliveInterval;
  
  // Обновляем обработчики завершения для очистки интервалов
  const cleanupAndExit = (code = 0) => {
    console.log(`🧹 Очистка ресурсов перед завершением...`);
    if (server.healthInterval) {
      clearInterval(server.healthInterval);
      console.log('  ✓ Health interval очищен');
    }
    if (server.keepAliveInterval) {
      clearInterval(server.keepAliveInterval);
      console.log('  ✓ Keep-alive interval очищен');
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
  
  // Переопределяем обработчики для корректной очистки
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  
  process.on('SIGTERM', () => {
    console.log('📥 Получен SIGTERM, завершаем работу...');
    cleanupAndExit(0);
  });
  
  process.on('SIGINT', () => {
    console.log('📥 Получен SIGINT, завершаем работу...');
    cleanupAndExit(0);
  });
});

// Детальное логирование событий сервера
server.on('error', (error) => {
  console.error('❌ КРИТИЧЕСКАЯ ОШИБКА СЕРВЕРА:', error.message);
  console.error('   Error code:', error.code);
  console.error('   Error type:', error.constructor.name);
  console.error('   Time:', new Date().toISOString());
  console.error('   Stack:', error.stack);
  
  if (error.code === 'EADDRINUSE') {
    console.error(`   Порт ${PORT} уже используется другим процессом`);
  } else if (error.code === 'EACCES') {
    console.error(`   Нет доступа к порту ${PORT}`);
  }
});

server.on('close', () => {
  console.log(`🛑 Сервер закрыт в: ${new Date().toISOString()}`);
  if (server.healthInterval) {
    clearInterval(server.healthInterval);
    console.log('🧹 Health interval очищен');
  }
});

server.on('connection', (socket) => {
  console.log(`🔗 Новое соединение: ${new Date().toISOString()}`);
  
  socket.on('error', (error) => {
    console.error('❌ Ошибка сокета:', error.message);
    console.error('   Time:', new Date().toISOString());
  });
  
  socket.on('close', (hadError) => {
    console.log(`🔌 Сокет закрыт: ${new Date().toISOString()}, had error: ${hadError}`);
  });
  
  socket.on('timeout', () => {
    console.warn('⏰ Socket timeout:', new Date().toISOString());
  });
});

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Vectorizer Server получил SIGTERM, завершение...');
    if (server.healthInterval) {
      clearInterval(server.healthInterval);
    }
    server.close(() => {
      console.log('✅ Сервер корректно закрыт');
      process.exit(0);
    });
  });

  process.on('SIGINT', () => {
    console.log('🛑 Vectorizer Server получил SIGINT, завершение...');
    if (server.healthInterval) {
      clearInterval(server.healthInterval);
    }
    server.close(() => {
      console.log('✅ Сервер корректно закрыт');
      process.exit(0);
    });
  });

  // Предотвращаем автоматическое завершение процесса
  console.log('🔒 Процесс зафиксирован для работы сервера');
  
  // Keep-alive механизм для предотвращения завершения
  const keepAlive = setInterval(() => {
    // Пустая функция для поддержания event loop
  }, 30000);
  
  // Добавляем обработчик для отладки неожиданного завершения
  process.on('exit', (code) => {
    console.log(`🚪 Process exiting with code: ${code} at ${new Date().toISOString()}`);
    console.log('   Last heartbeat was running, unexpected exit detected');
    clearInterval(keepAlive);
    if (server.healthInterval) {
      clearInterval(server.healthInterval);
    }
  });

  process.on('beforeExit', (code) => {
    console.log(`🚪 Before exit with code: ${code} at ${new Date().toISOString()}`);
    console.log('   Event loop became empty, this should not happen with server running');
    // Принудительно поддерживаем процесс живым
    setTimeout(() => {
      console.log('⚡ Keep-alive timeout executed');
    }, 1000);
  });
  
  // Возвращаем объект для предотвращения завершения async функции
  return new Promise((resolve, reject) => {
    server.on('close', () => {
      console.log('🛑 Server closed, resolving promise');
      clearInterval(keepAlive);
      resolve();
    });
    
    server.on('error', (error) => {
      console.error('❌ Server error, rejecting promise:', error);
      clearInterval(keepAlive);
      reject(error);
    });
  });
}

// Запуск сервера с обработкой ошибок
startVectorizerServer().catch((error) => {
  console.error('❌ Критическая ошибка при запуске векторизатора:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});