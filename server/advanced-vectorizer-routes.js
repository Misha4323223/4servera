/**
 * Маршруты для продвинутого векторизатора
 * REST API endpoints для векторизации изображений
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const advancedVectorizer = require('../advanced-vectorizer.cjs');

// Настройка multer для загрузки файлов
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB лимит
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Unsupported file type'), false);
    }
  }
});

/**
 * POST /api/vectorizer/analyze
 * Анализирует изображение и определяет оптимальные настройки
 */
router.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Изображение не предоставлено'
      });
    }

    const contentType = await advancedVectorizer.detectContentType(req.file.buffer);
    
    res.json({
      success: true,
      analysis: {
        detectedType: contentType.type,
        confidence: contentType.confidence,
        recommendedQuality: contentType.recommendedSettings.quality,
        recommendedFormat: contentType.recommendedSettings.outputFormat,
        description: contentType.description
      }
    });

  } catch (error) {
    console.error('Ошибка анализа изображения:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vectorizer/convert
 * Основная конвертация изображения в векторный формат
 */
router.post('/convert', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Изображение не предоставлено'
      });
    }

    const options = {
      quality: req.body.quality || 'standard',
      outputFormat: req.body.format || 'svg',
      optimizeFor: req.body.optimizeFor || 'web',
      autoDetectType: req.body.autoDetectType !== 'false'
    };

    console.log(`🎯 Векторизация через API:`, {
      filename: req.file.originalname,
      size: req.file.size,
      options
    });

    const result = await advancedVectorizer.vectorizeImage(
      req.file.buffer,
      req.file.originalname,
      options
    );

    if (result.success) {
      res.json({
        success: true,
        result: {
          svgContent: result.svgContent,
          detectedType: result.detectedType,
          quality: result.quality,
          filename: result.filename,
          optimizationStats: result.optimization
        }
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }

  } catch (error) {
    console.error('Ошибка векторизации:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vectorizer/professional
 * Профессиональная векторизация с полным набором опций
 */
router.post('/professional', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Изображение не предоставлено'
      });
    }

    const options = {
      quality: req.body.quality || 'premium',
      formats: req.body.formats ? req.body.formats.split(',') : ['svg'],
      generatePreviews: req.body.generatePreviews === 'true',
      optimizeFor: req.body.optimizeFor || 'web',
      includeMetadata: req.body.includeMetadata !== 'false'
    };

    console.log(`🚀 Профессиональная векторизация через API:`, {
      filename: req.file.originalname,
      options
    });

    const result = await advancedVectorizer.professionalVectorize(
      req.file.buffer,
      req.file.originalname,
      options
    );

    res.json(result);

  } catch (error) {
    console.error('Ошибка профессиональной векторизации:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vectorizer/batch
 * Пакетная обработка нескольких изображений
 */
router.post('/batch', upload.array('images', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Изображения не предоставлены'
      });
    }

    const options = {
      quality: req.body.quality || 'standard',
      outputFormat: req.body.format || 'svg'
    };

    console.log(`📦 Пакетная векторизация: ${req.files.length} файлов`);

    const imageBuffers = req.files.map(file => ({
      buffer: file.buffer,
      originalName: file.originalname
    }));

    const result = await advancedVectorizer.batchVectorize(imageBuffers, options);

    res.json(result);

  } catch (error) {
    console.error('Ошибка пакетной векторизации:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vectorizer/previews
 * Генерация превью с разными настройками качества
 */
router.post('/previews', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Изображение не предоставлено'
      });
    }

    console.log(`🔍 Генерация превью для: ${req.file.originalname}`);

    const result = await advancedVectorizer.generatePreviews(
      req.file.buffer,
      req.file.originalname
    );

    res.json(result);

  } catch (error) {
    console.error('Ошибка генерации превью:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/vectorizer/multi-format
 * Конвертация в несколько форматов одновременно
 */
router.post('/multi-format', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Изображение не предоставлено'
      });
    }

    const formats = req.body.formats ? req.body.formats.split(',') : ['svg', 'eps', 'pdf'];
    const options = {
      quality: req.body.quality || 'premium',
      formats: formats
    };

    console.log(`🎨 Многоформатная векторизация:`, {
      filename: req.file.originalname,
      formats: formats
    });

    const result = await advancedVectorizer.multiFormatVectorize(
      req.file.buffer,
      req.file.originalname,
      options
    );

    res.json(result);

  } catch (error) {
    console.error('Ошибка многоформатной векторизации:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * GET /api/vectorizer/formats
 * Получение списка доступных форматов и настроек
 */
router.get('/formats', (req, res) => {
  res.json({
    success: true,
    formats: advancedVectorizer.OUTPUT_FORMATS,
    qualities: advancedVectorizer.QUALITY_PRESETS,
    contentTypes: advancedVectorizer.CONTENT_TYPES
  });
});

/**
 * GET /api/vectorizer/health
 * Проверка состояния модуля векторизации
 */
router.get('/health', async (req, res) => {
  try {
    // Проверяем доступность выходных директорий
    const outputDir = path.join(__dirname, '..', 'output');
    const tempDir = path.join(__dirname, '..', 'temp');
    
    await fs.access(outputDir).catch(() => fs.mkdir(outputDir, { recursive: true }));
    await fs.access(tempDir).catch(() => fs.mkdir(tempDir, { recursive: true }));

    res.json({
      success: true,
      status: 'healthy',
      module: 'advanced-vectorizer',
      version: '2.0',
      directories: {
        output: outputDir,
        temp: tempDir
      },
      capabilities: [
        'auto-detection',
        'multi-format',
        'quality-levels',
        'batch-processing',
        'optimization',
        'previews'
      ]
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      status: 'unhealthy',
      error: error.message
    });
  }
});

// Обработка ошибок multer
router.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        success: false,
        error: 'Файл слишком большой (максимум 10MB)'
      });
    }
  }
  
  res.status(500).json({
    success: false,
    error: error.message
  });
});

module.exports = router;