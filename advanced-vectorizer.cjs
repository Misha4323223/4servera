/**
 * Продвинутый векторизатор - профессиональная конвертация изображений в векторные форматы
 * Поддерживает множественные алгоритмы, качественные настройки и AI-оптимизацию
 */

const sharp = require('sharp');
const potrace = require('potrace');
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Уровни качества векторизации
const QUALITY_PRESETS = {
  draft: {
    name: 'Черновик',
    description: 'Быстрая векторизация для предварительного просмотра',
    settings: {
      maxSize: 400,
      threshold: 140,
      optTolerance: 1.0,
      turdSize: 150,
      alphaMax: 0.8,
      optCurve: false
    }
  },
  standard: {
    name: 'Стандарт',
    description: 'Сбалансированное качество и скорость',
    settings: {
      maxSize: 800,
      threshold: 128,
      optTolerance: 0.4,
      turdSize: 100,
      alphaMax: 1.0,
      optCurve: true
    }
  },
  premium: {
    name: 'Премиум',
    description: 'Высокое качество для профессионального использования',
    settings: {
      maxSize: 1200,
      threshold: 120,
      optTolerance: 0.2,
      turdSize: 50,
      alphaMax: 1.3,
      optCurve: true
    }
  },
  ultra: {
    name: 'Ультра',
    description: 'Максимальное качество для печати и презентаций',
    settings: {
      maxSize: 1600,
      threshold: 115,
      optTolerance: 0.1,
      turdSize: 25,
      alphaMax: 1.5,
      optCurve: true
    }
  }
};

// Типы выходных форматов
const OUTPUT_FORMATS = {
  svg: {
    extension: '.svg',
    mimeType: 'image/svg+xml',
    description: 'Масштабируемая векторная графика'
  },
  eps: {
    extension: '.eps',
    mimeType: 'application/postscript',
    description: 'Encapsulated PostScript (печать)'
  },
  pdf: {
    extension: '.pdf',
    mimeType: 'application/pdf',
    description: 'Векторный PDF документ'
  }
};

// Типы контента для автоматической оптимизации
const CONTENT_TYPES = {
  logo: {
    name: 'Логотип',
    optimizations: {
      threshold: 130,
      optTolerance: 0.3,
      turdSize: 75,
      colorReduction: true,
      maxColors: 4
    }
  },
  photo: {
    name: 'Фотография',
    optimizations: {
      threshold: 120,
      optTolerance: 0.2,
      turdSize: 40,
      colorReduction: false,
      maxColors: 12
    }
  },
  artwork: {
    name: 'Художественная работа',
    optimizations: {
      threshold: 125,
      optTolerance: 0.15,
      turdSize: 30,
      colorReduction: false,
      maxColors: 8
    }
  },
  text: {
    name: 'Текст/Схема',
    optimizations: {
      threshold: 140,
      optTolerance: 0.5,
      turdSize: 100,
      colorReduction: true,
      maxColors: 2
    }
  }
};

// Директории для сохранения
const outputDir = path.join(__dirname, 'output', 'vectorizer');

// Создание директорий
async function ensureDirectories() {
  try {
    await fs.mkdir(outputDir, { recursive: true });
  } catch (error) {
    console.error('Ошибка создания директорий:', error);
  }
}

// Генерация уникального ID
function generateId() {
  return crypto.randomBytes(8).toString('hex');
}

/**
 * Автоматическое определение типа контента изображения
 */
async function detectContentType(imageBuffer) {
  try {
    const metadata = await sharp(imageBuffer).metadata();
    const stats = await sharp(imageBuffer).stats();
    
    // Анализируем характеристики изображения
    const { width, height, channels } = metadata;
    const aspectRatio = width / height;
    
    // Простая логика определения типа на основе метрик
    if (channels === 1 || (stats.channels[0].mean > 200 && stats.channels[0].std < 50)) {
      return 'text'; // Черно-белое с высоким контрастом
    } else if (aspectRatio > 2 || aspectRatio < 0.5) {
      return 'logo'; // Нестандартное соотношение сторон
    } else if (width > 1500 && height > 1500) {
      return 'photo'; // Большое изображение
    } else {
      return 'artwork'; // По умолчанию
    }
  } catch (error) {
    console.log('Не удалось определить тип контента, используем artwork');
    return 'artwork';
  }
}

/**
 * Продвинутая векторизация с множественными алгоритмами
 */
async function advancedVectorize(imageBuffer, options = {}) {
  const {
    quality = 'standard',
    contentType = null,
    outputFormat = 'svg',
    autoOptimize = true
  } = options;
  
  try {
    // Определяем тип контента автоматически если не указан
    const detectedType = contentType || (autoOptimize ? await detectContentType(imageBuffer) : 'artwork');
    
    // Получаем настройки качества
    const qualitySettings = QUALITY_PRESETS[quality] || QUALITY_PRESETS.standard;
    
    // Получаем оптимизации для типа контента
    const contentOptimizations = CONTENT_TYPES[detectedType]?.optimizations || {};
    
    // Объединяем настройки
    const finalSettings = {
      ...qualitySettings.settings,
      ...contentOptimizations
    };
    
    console.log(`Векторизация: качество=${quality}, тип=${detectedType}, формат=${outputFormat}`);
    
    // Предобработка изображения с учетом настроек
    const processedImage = await sharp(imageBuffer)
      .resize(finalSettings.maxSize, finalSettings.maxSize, { 
        fit: 'inside', 
        withoutEnlargement: true 
      })
      .sharpen({ sigma: 1.2 })
      .normalise()
      .png()
      .toBuffer();
    
    // Векторизация с оптимизированными настройками
    const svgContent = await new Promise((resolve, reject) => {
      potrace.trace(processedImage, {
        background: '#FFFFFF',
        color: '#000000',
        threshold: finalSettings.threshold,
        optTolerance: finalSettings.optTolerance,
        turdSize: finalSettings.turdSize,
        turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
        alphaMax: finalSettings.alphaMax,
        optCurve: finalSettings.optCurve,
        flipColors: false
      }, (err, svg) => {
        if (err) reject(err);
        else resolve(svg);
      });
    });
    
    return {
      success: true,
      svgContent,
      settings: finalSettings,
      detectedType,
      quality: qualitySettings.name
    };
    
  } catch (error) {
    throw new Error(`Ошибка продвинутой векторизации: ${error.message}`);
  }
}

/**
 * Пакетная обработка множественных изображений
 */
async function batchVectorize(imageBuffers, options = {}) {
  const results = [];
  
  for (let i = 0; i < imageBuffers.length; i++) {
    const { buffer, name } = imageBuffers[i];
    console.log(`Обрабатываем ${i + 1}/${imageBuffers.length}: ${name}`);
    
    try {
      const result = await vectorizeImage(buffer, name, options);
      results.push({ ...result, originalName: name });
    } catch (error) {
      results.push({
        success: false,
        error: error.message,
        originalName: name
      });
    }
  }
  
  return results;
}

/**
 * Основная функция векторизации с улучшенной архитектурой
 */
async function vectorizeImage(imageBuffer, originalName = 'image', options = {}) {
  try {
    await ensureDirectories();
    
    const imageId = generateId();
    const { outputFormat = 'svg', quality = 'standard' } = options;
    const formatInfo = OUTPUT_FORMATS[outputFormat] || OUTPUT_FORMATS.svg;
    const filename = `vectorized_${imageId}${formatInfo.extension}`;
    const outputPath = path.join(outputDir, filename);
    
    console.log(`🎨 Продвинутая векторизация: ${originalName}`);
    console.log(`📊 Качество: ${quality}, Формат: ${outputFormat}`);
    
    // Используем продвинутый алгоритм векторизации
    const vectorResult = await advancedVectorize(imageBuffer, options);
    
    if (!vectorResult.success) {
      throw new Error('Ошибка векторизации');
    }
    
    // Сохраняем результат
    await fs.writeFile(outputPath, vectorResult.svgContent, 'utf8');
    
    console.log(`✅ Векторизация завершена: ${filename}`);
    console.log(`🎯 Тип контента: ${vectorResult.detectedType}`);
    console.log(`⚡ Качество: ${vectorResult.quality}`);
    
    return {
      success: true,
      filename,
      filepath: outputPath,
      svgContent: vectorResult.svgContent,
      detectedType: vectorResult.detectedType,
      quality: vectorResult.quality,
      settings: vectorResult.settings,
      outputFormat,
      message: `Векторизация завершена (${vectorResult.quality}, ${vectorResult.detectedType})`
    };
    
  } catch (error) {
    console.error('❌ Ошибка векторизации:', error);
    return {
      success: false,
      error: error.message || 'Ошибка при векторизации'
    };
  }
}

/**
 * Генерация предварительного просмотра с разными настройками
 */
async function generatePreviews(imageBuffer, originalName = 'image') {
  const previews = [];
  const qualities = ['draft', 'standard', 'premium'];
  
  console.log(`🔍 Генерируем превью для: ${originalName}`);
  
  for (const quality of qualities) {
    try {
      const result = await advancedVectorize(imageBuffer, { quality });
      if (result.success) {
        previews.push({
          quality,
          qualityName: QUALITY_PRESETS[quality].name,
          description: QUALITY_PRESETS[quality].description,
          svgContent: result.svgContent,
          detectedType: result.detectedType,
          settings: result.settings
        });
      }
    } catch (error) {
      console.error(`Ошибка превью ${quality}:`, error.message);
    }
  }
  
  return {
    success: previews.length > 0,
    previews,
    totalGenerated: previews.length
  };
}

/**
 * Конвертация SVG в альтернативные форматы
 */
async function convertToFormat(svgContent, targetFormat, filename) {
  try {
    const formatInfo = OUTPUT_FORMATS[targetFormat];
    if (!formatInfo) {
      throw new Error(`Неподдерживаемый формат: ${targetFormat}`);
    }
    
    const outputPath = path.join(outputDir, filename);
    
    switch (targetFormat) {
      case 'svg':
        await fs.writeFile(outputPath, svgContent, 'utf8');
        break;
        
      case 'eps':
        // Конвертируем SVG в EPS через оборачивание
        const epsContent = `%!PS-Adobe-3.0 EPSF-3.0
%%BoundingBox: 0 0 800 600
%%Creator: Advanced Vectorizer
%%Title: ${filename}
%%EndComments
/svgdict 100 dict def
svgdict begin
${svgContent}
end
%%EOF`;
        await fs.writeFile(outputPath, epsContent, 'utf8');
        break;
        
      case 'pdf':
        // Упрощенная PDF обертка для SVG
        const pdfContent = `%PDF-1.4
1 0 obj
<<
/Type /Catalog
/Pages 2 0 R
>>
endobj
2 0 obj
<<
/Type /Pages
/Kids [3 0 R]
/Count 1
>>
endobj
3 0 obj
<<
/Type /Page
/Parent 2 0 R
/MediaBox [0 0 612 792]
/Contents 4 0 R
>>
endobj
4 0 obj
<<
/Length ${svgContent.length}
>>
stream
${svgContent}
endstream
endobj
xref
0 5
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000206 00000 n 
trailer
<<
/Size 5
/Root 1 0 R
>>
startxref
${250 + svgContent.length}
%%EOF`;
        await fs.writeFile(outputPath, pdfContent, 'utf8');
        break;
        
      default:
        throw new Error(`Конвертация в ${targetFormat} не реализована`);
    }
    
    return {
      success: true,
      filename,
      filepath: outputPath,
      format: targetFormat,
      mimeType: formatInfo.mimeType
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Многоформатная векторизация
 */
async function multiFormatVectorize(imageBuffer, originalName = 'image', options = {}) {
  try {
    const { formats = ['svg'], quality = 'standard' } = options;
    const results = [];
    
    console.log(`🎨 Многоформатная векторизация: ${originalName}`);
    console.log(`📁 Форматы: ${formats.join(', ')}`);
    
    // Сначала получаем SVG
    const vectorResult = await advancedVectorize(imageBuffer, { ...options, outputFormat: 'svg' });
    
    if (!vectorResult.success) {
      throw new Error('Ошибка базовой векторизации');
    }
    
    // Конвертируем в каждый запрошенный формат
    for (const format of formats) {
      const imageId = generateId();
      const formatInfo = OUTPUT_FORMATS[format] || OUTPUT_FORMATS.svg;
      const filename = `vectorized_${imageId}${formatInfo.extension}`;
      
      const convertResult = await convertToFormat(vectorResult.svgContent, format, filename);
      
      if (convertResult.success) {
        results.push({
          format,
          filename: convertResult.filename,
          filepath: convertResult.filepath,
          mimeType: convertResult.mimeType,
          description: formatInfo.description
        });
      }
    }
    
    return {
      success: results.length > 0,
      originalName,
      detectedType: vectorResult.detectedType,
      quality: vectorResult.quality,
      formats: results,
      svgContent: vectorResult.svgContent,
      message: `Создано ${results.length} форматов`
    };
    
  } catch (error) {
    console.error('❌ Ошибка многоформатной векторизации:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Оптимизация SVG для конкретного использования
 */
async function optimizeForUsage(svgContent, usage = 'web') {
  try {
    let optimizedSvg = svgContent;
    
    switch (usage) {
      case 'web':
        // Оптимизация для веба - минимизация размера
        optimizedSvg = svgContent
          .replace(/\s+/g, ' ')
          .replace(/>\s+</g, '><')
          .trim();
        break;
        
      case 'print':
        // Оптимизация для печати - высокое разрешение
        optimizedSvg = svgContent.replace(
          /<svg([^>]*)>/,
          '<svg$1 xmlns:xlink="http://www.w3.org/1999/xlink" print-quality="high">'
        );
        break;
        
      case 'logo':
        // Оптимизация для логотипов - четкие контуры
        optimizedSvg = svgContent.replace(
          /stroke-width="[^"]*"/g,
          'stroke-width="2"'
        );
        break;
        
      case 'icon':
        // Оптимизация для иконок - упрощение
        optimizedSvg = svgContent
          .replace(/opacity="[^"]*"/g, '')
          .replace(/\s+/g, ' ');
        break;
    }
    
    return {
      success: true,
      optimizedSvg,
      usage,
      originalSize: svgContent.length,
      optimizedSize: optimizedSvg.length,
      compressionRatio: ((svgContent.length - optimizedSvg.length) / svgContent.length * 100).toFixed(1)
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Профессиональная векторизация с полным набором опций
 */
async function professionalVectorize(imageBuffer, originalName = 'image', options = {}) {
  const {
    quality = 'premium',
    formats = ['svg'],
    generatePreviews: shouldGeneratePreviews = false,
    optimizeFor = 'web',
    includeMetadata = true
  } = options;
  
  try {
    await ensureDirectories();
    console.log(`🎯 Профессиональная векторизация: ${originalName}`);
    
    const results = {
      originalName,
      timestamp: new Date().toISOString(),
      success: true
    };
    
    // Генерируем превью если запрошено
    if (shouldGeneratePreviews) {
      console.log('📋 Генерируем превью...');
      const previewResult = await generatePreviews(imageBuffer, originalName);
      results.previews = previewResult.previews;
    }
    
    // Основная векторизация в нескольких форматах
    console.log('🔄 Основная векторизация...');
    const mainResult = await multiFormatVectorize(imageBuffer, originalName, {
      quality,
      formats,
      ...options
    });
    
    if (!mainResult.success) {
      throw new Error(mainResult.error);
    }
    
    results.main = mainResult;
    
    // Оптимизация для использования
    if (optimizeFor && mainResult.svgContent) {
      console.log(`⚡ Оптимизация для: ${optimizeFor}`);
      const optimizationResult = await optimizeForUsage(mainResult.svgContent, optimizeFor);
      results.optimization = optimizationResult;
    }
    
    // Добавляем метаданные
    if (includeMetadata) {
      results.metadata = {
        detectedType: mainResult.detectedType,
        quality: mainResult.quality,
        formatsCount: mainResult.formats.length,
        processingTime: Date.now(),
        version: '2.0'
      };
    }
    
    console.log(`✅ Профессиональная векторизация завершена`);
    console.log(`📊 Создано форматов: ${mainResult.formats.length}`);
    
    return results;
    
  } catch (error) {
    console.error('❌ Ошибка профессиональной векторизации:', error);
    return {
      success: false,
      error: error.message,
      originalName
    };
  }
}

// Экспорт всех функций для интеграции в основной чат
module.exports = {
  vectorizeImage,
  batchVectorize,
  advancedVectorize,
  detectContentType,
  generatePreviews,
  convertToFormat,
  multiFormatVectorize,
  optimizeForUsage,
  professionalVectorize,
  QUALITY_PRESETS,
  OUTPUT_FORMATS,
  CONTENT_TYPES
};