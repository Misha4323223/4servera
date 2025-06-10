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

  // Перехват всех ошибок процесса
  process.on('uncaughtException', (error) => {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА - uncaughtException:', error);
    console.error('Stack trace:', error.stack);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА - unhandledRejection:', reason);
    console.error('Promise:', promise);
    process.exit(1);
  });

// Настройка CORS для кросс-доменных запросов
app.use(cors({
  origin: ['http://localhost:5000', 'http://localhost:3000', /\.replit\.app$/],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));

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

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🎨 Vectorizer Server запущен на порту ${PORT}`);
  console.log(`📍 API доступен по адресу: http://localhost:${PORT}/api/vectorizer`);
  console.log(`🏥 Health check: http://localhost:${PORT}/health`);
  console.log(`📁 Output files: http://localhost:${PORT}/output`);
});

  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('🛑 Vectorizer Server получил SIGTERM, завершение...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    console.log('🛑 Vectorizer Server получил SIGINT, завершение...');
    process.exit(0);
  });
}

// Запуск сервера с обработкой ошибок
startVectorizerServer().catch((error) => {
  console.error('❌ Критическая ошибка при запуске векторизатора:', error);
  console.error('Stack:', error.stack);
  process.exit(1);
});