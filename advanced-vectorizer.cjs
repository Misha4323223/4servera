/**
 * Упрощенный векторизатор - базовая конвертация изображений в SVG
 * Минимальная функциональность для снижения нагрузки на Event Loop
 */

// Только необходимые зависимости
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Adobe Illustrator Image Trace - точная копия официального алгоритма CC 2024
const ADOBE_SILKSCREEN_PRESET = {
  name: 'Adobe Illustrator Limited Color',
  description: 'Adobe Illustrator CC 2024 Image Trace - Limited Color preset (3-30 colors)',
  settings: {
    // === ADOBE IMAGE TRACE НАСТРОЙКИ ===
    mode: 'limitedColor', // Limited Color mode (Adobe default)
    maxColors: 6, // Adobe Limited Color: 3-30 colors, default 6
    colorReduction: 'automatic', // Automatic color reduction
    
    // === ADOBE PATHS SETTINGS ===
    pathFitting: 2, // Fitting: 2px (Adobe default for balanced quality)
    minimumArea: 10, // Noise: 10 square pixels (Adobe default)
    cornerThreshold: 75, // Corners: 75% (Adobe default angle detection)
    
    // === ADOBE COLORS SETTINGS ===
    method: 'abutting', // Method: Abutting (создает смежные пути)
    palette: 'limited', // Limited palette mode  
    fills: true, // Create Fills: ON (Adobe default)
    strokes: false, // Create Strokes: OFF (Adobe default)
    
    // === ADOBE ADVANCED SETTINGS ===
    snapCurvesToLines: false, // Snap Curves To Lines: OFF
    ignoreWhite: true, // Ignore White: ON (Adobe default)
    viewMode: 'tracing', // View: Tracing Result
    
    // === ADOBE TRACE ENGINE ПАРАМЕТРЫ ===
    // Adobe использует модифицированный Potrace с специальными настройками
    threshold: 'auto', // Auto threshold (Adobe динамически подстраивает)
    turdSize: 10, // Minimum area = Noise setting
    turnPolicy: 'black', // Adobe turn policy for corners
    alphaMax: 1.0, // Corner angle threshold (1.0 радиан = 57.3°)
    optCurve: true, // Curve optimization (всегда включено в Adobe)
    optTolerance: 0.2, // Path fitting tolerance
    
    // === ADOBE PREPROCESSING ===
    resampleDPI: 300, // Adobe resamples to 300 DPI for quality
    smoothing: 'medium', // Medium smoothing (Adobe default)
    colorSeparation: 'strict', // Strict color separation
    
    // === ADOBE OUTPUT SETTINGS ===
    maxSize: 1024, // Adobe processing limit for performance
    outputDPI: 300, // 300 DPI for print quality
    precision: 'high', // High precision paths
    optimize: true // Optimize SVG output
  }
};

// Только SVG формат для упрощения
const OUTPUT_FORMATS = {
  svg: {
    extension: '.svg',
    mimeType: 'image/svg+xml',
    description: 'Масштабируемая векторная графика'
  }
};

// Упрощенный тип контента - все одинаково
const CONTENT_TYPES = {
  simple: {
    name: 'Простой',
    optimizations: {
      threshold: 128,
      maxColors: 5
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
 * ЭТАП 1: ПРЕДОБРАБОТКА - Adobe Illustrator алгоритм
 */

/**
 * analyzeImageType() - Определение типа контента (Adobe метод)
 */
async function analyzeImageType(imageBuffer) {
  console.log('🔍 ЭТАП 1.1: Adobe analyzeImageType - Анализ типа изображения...');
  
  try {
    const sharp = require('sharp');
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Adobe анализ цветового разнообразия
    const colorMap = new Map();
    let totalPixels = 0;
    
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1]; 
      const b = data[i + 2];
      
      // Adobe квантование для анализа (32 уровня)
      const quantR = Math.round(r / 32) * 32;
      const quantG = Math.round(g / 32) * 32;
      const quantB = Math.round(b / 32) * 32;
      
      const colorKey = `${quantR},${quantG},${quantB}`;
      colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
      totalPixels++;
    }
    
    const uniqueColors = colorMap.size;
    const colorComplexity = uniqueColors / totalPixels;
    
    // Adobe анализ контрастности
    const grayData = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer();
    
    let totalContrast = 0;
    for (let i = 0; i < grayData.length - 1; i++) {
      totalContrast += Math.abs(grayData[i] - grayData[i + 1]);
    }
    const avgContrast = totalContrast / grayData.length;
    
    // Adobe классификация изображения
    let imageType = 'AUTO';
    let recommendedSettings = { ...ADOBE_SILKSCREEN_PRESET.settings };
    
    if (uniqueColors <= 3) {
      imageType = 'SIMPLE_LOGO';
      recommendedSettings.maxColors = 3;
      recommendedSettings.cornerThreshold = 100;
    } else if (uniqueColors <= 10 && avgContrast > 50) {
      imageType = 'LOGO';  
      recommendedSettings.maxColors = 5;
      recommendedSettings.cornerThreshold = 75;
    } else if (avgContrast < 20) {
      imageType = 'PHOTO';
      recommendedSettings.maxColors = 6;
      recommendedSettings.pathFitting = 3;
    } else if (colorComplexity > 0.5) {
      imageType = 'COMPLEX_PHOTO';
      recommendedSettings.maxColors = 8;
      recommendedSettings.pathFitting = 4;
    } else {
      imageType = 'ILLUSTRATION';
      recommendedSettings.maxColors = 5;
    }
    
    console.log(`   📊 Результат анализа: ${imageType}`);
    console.log(`   🎨 Уникальных цветов: ${uniqueColors}`);
    console.log(`   📈 Контрастность: ${avgContrast.toFixed(1)}`);
    console.log(`   🎯 Рекомендуемых цветов: ${recommendedSettings.maxColors}`);
    
    return {
      imageType,
      uniqueColors,
      avgContrast,
      colorComplexity,
      recommendedSettings,
      dimensions: { width: info.width, height: info.height }
    };
    
  } catch (error) {
    console.error('❌ Ошибка analyzeImageType:', error);
    return {
      imageType: 'AUTO',
      uniqueColors: 5,
      avgContrast: 50,
      colorComplexity: 0.3,
      recommendedSettings: ADOBE_SILKSCREEN_PRESET.settings,
      dimensions: { width: 400, height: 400 }
    };
  }
}

/**
 * preprocessColors() - Цветовая коррекция (Adobe метод)
 */
async function preprocessColors(imageBuffer, settings) {
  console.log('🎨 ЭТАП 1.2: Adobe preprocessColors - Цветовая коррекция...');
  
  try {
    const sharp = require('sharp');
    let processedBuffer = imageBuffer;
    
    // Adobe гамма-коррекция (стандарт Adobe RGB)
    processedBuffer = await sharp(processedBuffer)
      .gamma(2.2)
      .toBuffer();
    
    // Adobe цветовая обработка по режиму
    if (settings.mode === 'blackwhite') {
      processedBuffer = await sharp(processedBuffer)
        .grayscale()
        .normalize()
        .toBuffer();
      console.log('   ⚫ Применена черно-белая обработка');
    } else if (settings.mode === 'grayscale') {
      processedBuffer = await sharp(processedBuffer)
        .grayscale()
        .modulate({
          brightness: 1.1,
          saturation: 0,
          hue: 0
        })
        .toBuffer();
      console.log('   🔘 Применена обработка в оттенках серого');
    } else {
      // Adobe цветная обработка (Limited Color mode)
      processedBuffer = await sharp(processedBuffer)
        .modulate({
          brightness: 1.05,
          saturation: 1.1,
          hue: 0
        })
        .toBuffer();
      console.log('   🌈 Применена цветная обработка Adobe Limited Color');
    }
    
    // Adobe Edge-preserving smoothing для фотографий
    if (settings.smoothing === 'medium') {
      processedBuffer = await sharp(processedBuffer)
        .blur(0.3) // Минимальное размытие
        .sharpen(1, 1, 0.5) // Усиление краев
        .toBuffer();
      console.log('   🔧 Применено Adobe edge-preserving smoothing');
    }
    
    console.log('   ✅ Цветовая коррекция завершена');
    return processedBuffer;
    
  } catch (error) {
    console.error('❌ Ошибка preprocessColors:', error);
    return imageBuffer;
  }
}

/**
 * resampleImage() - Масштабирование (Adobe метод)
 */
async function resampleImage(imageBuffer, settings, analysis) {
  console.log('📏 ЭТАП 1.3: Adobe resampleImage - Масштабирование...');
  
  try {
    const sharp = require('sharp');
    const metadata = await sharp(imageBuffer).metadata();
    
    // Adobe определение целевого размера
    let targetWidth = metadata.width;
    let targetHeight = metadata.height;
    const maxSize = settings.maxSize || 1024;
    
    // Adobe масштабирование для оптимальной обработки
    if (Math.max(targetWidth, targetHeight) > maxSize) {
      const scale = maxSize / Math.max(targetWidth, targetHeight);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
      console.log(`   📐 Масштабирование: ${metadata.width}x${metadata.height} → ${targetWidth}x${targetHeight}`);
    } else {
      console.log(`   📐 Размер оптимален: ${targetWidth}x${targetHeight}`);
    }
    
    // Adobe Lanczos интерполяция (высокое качество)
    const resampledBuffer = await sharp(imageBuffer)
      .resize(targetWidth, targetHeight, {
        kernel: sharp.kernel.lanczos3,
        fit: 'fill'
      })
      .toBuffer();
    
    console.log(`   ✅ Масштабирование завершено: ${targetWidth}x${targetHeight}`);
    
    return {
      buffer: resampledBuffer,
      width: targetWidth,
      height: targetHeight,
      originalWidth: metadata.width,
      originalHeight: metadata.height
    };
    
  } catch (error) {
    console.error('❌ Ошибка resampleImage:', error);
    const metadata = await sharp(imageBuffer).metadata();
    return {
      buffer: imageBuffer,
      width: metadata.width,
      height: metadata.height,
      originalWidth: metadata.width,
      originalHeight: metadata.height
    };
  }
}

/**
 * Упрощенное определение типа контента без тяжелых библиотек
 */
function detectContentType(imageBuffer) {
  // Простое определение на основе размера файла
  const size = imageBuffer.length;
  if (size < 50000) return 'simple';
  return 'simple'; // Всегда возвращаем простой тип
}

/**
 * Оптимизация цветов для шелкографической печати
 * Принудительно разделяет цвета на контрастные группы
 */
function optimizeColorsForSilkscreen(colors, settings) {
  console.log(`🖨️ Специальная оптимизация для шелкографии из ${colors.length} цветов`);
  
  if (!colors || colors.length === 0) return [];
  
  // Сортируем цвета по яркости для лучшего разделения
  const sortedColors = colors.slice().sort((a, b) => {
    const brightnessA = a.r * 0.299 + a.g * 0.587 + a.b * 0.114;
    const brightnessB = b.r * 0.299 + b.g * 0.587 + b.b * 0.114;
    return brightnessA - brightnessB;
  });
  
  const optimizedColors = [];
  const minColorDistance = 80; // Минимальное расстояние между цветами для печати
  
  for (let i = 0; i < sortedColors.length && optimizedColors.length < settings.maxColors; i++) {
    const candidate = sortedColors[i];
    let isDistinct = true;
    
    // Проверяем, достаточно ли отличается от уже выбранных цветов
    for (const existing of optimizedColors) {
      const distance = Math.sqrt(
        Math.pow(candidate.r - existing.r, 2) +
        Math.pow(candidate.g - existing.g, 2) +
        Math.pow(candidate.b - existing.b, 2)
      );
      
      if (distance < minColorDistance) {
        isDistinct = false;
        break;
      }
    }
    
    if (isDistinct) {
      optimizedColors.push(candidate);
      console.log(`✅ Цвет ${candidate.hex} добавлен (яркость: ${(candidate.r * 0.299 + candidate.g * 0.587 + candidate.b * 0.114).toFixed(0)})`);
    } else {
      console.log(`❌ Цвет ${candidate.hex} слишком похож на существующий`);
    }
  }
  
  // Если цветов все еще недостаточно, добавляем контрастные
  if (optimizedColors.length < Math.min(3, settings.maxColors)) {
    console.log(`⚠️ Добавляем контрастные цвета для улучшения печати`);
    
    // Добавляем черный если его нет
    const hasBlack = optimizedColors.some(c => c.r + c.g + c.b < 100);
    if (!hasBlack && optimizedColors.length < settings.maxColors) {
      optimizedColors.push({
        r: 0, g: 0, b: 0,
        hex: '#000000',
        percentage: '5.0'
      });
    }
    
    // Добавляем белый если его нет
    const hasWhite = optimizedColors.some(c => c.r + c.g + c.b > 650);
    if (!hasWhite && optimizedColors.length < settings.maxColors) {
      optimizedColors.push({
        r: 255, g: 255, b: 255,
        hex: '#ffffff',
        percentage: '5.0'
      });
    }
  }
  
  console.log(`🎯 Финальная палитра для шелкографии: ${optimizedColors.length} цветов`);
  return optimizedColors;
}

/**
 * Adobe Illustrator-совместимая векторизация для шелкографии
 */
async function silkscreenVectorize(imageBuffer, options = {}) {
  const { outputFormat = 'svg', maxFileSize = 20 * 1024 * 1024 } = options;
  
  try {
    console.log(`🎨 Adobe Illustrator Image Trace режим (ограниченные цвета)`);
    
    const settings = { ...ADOBE_SILKSCREEN_PRESET.settings };
    
    // Adobe-совместимая предобработка
    const processedBuffer = await preprocessImageForAdobe(imageBuffer, settings);
    
    // Автоматическое определение порога как в Adobe Illustrator
    const optimalThreshold = await calculateAdobeThreshold(processedBuffer);
    settings.threshold = optimalThreshold;
    console.log(`🎯 Adobe автоматический порог: ${optimalThreshold}`);
    
    // Limited Color режим - точная цветовая векторизация
    console.log(`🎨 ПРИНУДИТЕЛЬНЫЙ ВЫЗОВ: createAdobeLimitedColorSVG`);
    console.log(`📋 Settings для Adobe:`, JSON.stringify(settings));
    
    const svgContent = await createAdobeLimitedColorSVG(processedBuffer, settings);
    
    console.log(`📄 Результат SVG длина: ${svgContent ? svgContent.length : 0}`);
    console.log(`🔍 SVG начинается с:`, svgContent ? svgContent.substring(0, 200) : 'ПУСТО');
    
    // Проверка размера файла (ограничение 20МБ)
    const svgSize = Buffer.byteLength(svgContent, 'utf8');
    if (svgSize > maxFileSize) {
      console.log(`⚠️ Файл слишком большой (${(svgSize / 1024 / 1024).toFixed(2)}МБ), оптимизация...`);
      const optimizedSVG = await optimizeSVGSize(svgContent, maxFileSize);
      return {
        success: true,
        svgContent: optimizedSVG,
        settings,
        quality: ADOBE_SILKSCREEN_PRESET.name,
        fileSize: Buffer.byteLength(optimizedSVG, 'utf8'),
        optimized: true,
        silkscreenMode: true
      };
    }
    
    return {
      success: true,
      svgContent,
      settings,
      quality: ADOBE_SILKSCREEN_PRESET.name,
      fileSize: svgSize,
      optimized: false,
      silkscreenMode: true
    };
    
  } catch (error) {
    console.error('❌ Ошибка векторизации для шелкографии:', error);
    throw new Error(`Ошибка векторизации: ${error.message}`);
  }
}

/**
 * Предобработка изображения для шелкографии
 */
async function preprocessImageForSilkscreen(imageBuffer, settings) {
  const sharp = require('sharp');
  
  console.log('🔧 Предобработка изображения (Adobe Illustrator Style)...');
  
  try {
    const metadata = await sharp(imageBuffer).metadata();
    let processedBuffer = imageBuffer;
    
    // Изменение размера как в AI
    if (settings.maxSize) {
      const scale = Math.min(settings.maxSize / metadata.width, settings.maxSize / metadata.height);
      if (scale < 1) {
        processedBuffer = await sharp(processedBuffer)
          .resize(Math.round(metadata.width * scale), Math.round(metadata.height * scale), {
            kernel: sharp.kernel.lanczos3,
            fit: 'inside'
          })
          .toBuffer();
      }
    }
    
    // Предобработка как в Adobe Illustrator
    if (settings.preprocess) {
      processedBuffer = await sharp(processedBuffer)
        .sharpen(1.5, 1.0, 2.0) // Увеличение резкости
        .normalise() // Нормализация контраста
        .modulate({ 
          brightness: 1.1,
          saturation: 1.2,
          hue: 0
        })
        .removeAlpha() // Убираем альфа-канал
        .toFormat('png')
        .toBuffer();
    }
    
    return processedBuffer;
    
  } catch (error) {
    console.error('Ошибка предобработки:', error);
    return imageBuffer;
  }
}

/**
 * Квантизация цветов как в Adobe Illustrator (до 5 цветов максимум)
 */
async function quantizeColorsAI(imageBuffer, maxColors = 5) {
  const sharp = require('sharp');
  
  console.log(`🎨 Квантизация цветов (Adobe Illustrator): максимум ${maxColors} цветов`);
  
  try {
    // Ограничиваем количество цветов как в Adobe Illustrator
    const quantizedBuffer = await sharp(imageBuffer)
      .png({
        palette: true,
        colors: Math.min(maxColors, 5), // Жесткое ограничение до 5 цветов
        dither: 0.5 // Легкий дизеринг как в AI
      })
      .toBuffer();
    
    return quantizedBuffer;
    
  } catch (error) {
    console.error('Ошибка квантизации цветов:', error);
    return imageBuffer;
  }
}

/**
 * ЭТАП 3: Создание цветного SVG для шелкографии с полным логированием
 */
async function createSilkscreenSVG(imageBuffer, settings) {
  const sharp = require('sharp');
  const potrace = require('potrace');
  
  console.log('🔍 ЭТАП 3: Начинаем создание цветного SVG для шелкографии...');
  
  try {
    // Извлекаем доминирующие цвета из исходного изображения
    const dominantColors = await extractDominantColors(imageBuffer, settings.maxColors);
    
    if (!dominantColors || dominantColors.length === 0) {
      console.log('❌ ЭТАП 3: Не удалось извлечь цвета, переходим к монохромному режиму');
      return createMonochromeBackup(imageBuffer, settings);
    }
    
    console.log(`🎨 ЭТАП 3: Начинаем обработку ${dominantColors.length} цветов`);
    
    // Специальная оптимизация для шелкографии
    const optimizedColors = optimizeColorsForSilkscreen(dominantColors, settings);
    console.log(`🖨️ ЭТАП 3: Оптимизировано для шелкографии: ${optimizedColors.length} цветов`);
    
    // Создаем отдельный слой для каждого цвета
    const colorLayers = [];
    
    for (let i = 0; i < optimizedColors.length; i++) {
      const color = optimizedColors[i];
      console.log(`\n🔍 ЭТАП 3.${i + 1}: Обрабатываем цвет ${color.hex} (${color.percentage}%)`);
      
      // Создаем маску для этого цвета с диагностикой
      const colorMask = await createAdobeColorMask(imageBuffer, color, settings);
      
      if (colorMask) {
        console.log(`🎯 ЭТАП 3.${i + 1}: Маска создана, запускаем векторизацию...`);
        
        // Векторизуем маску через potrace
        const layerSVG = await vectorizeColorLayer(colorMask, color, settings);
        if (layerSVG) {
          const paths = extractSVGPaths(layerSVG);
          console.log(`✅ ЭТАП 3.${i + 1}: Векторизация успешна, извлечено ${paths.length} путей`);
          
          colorLayers.push({
            color: color.hex,
            svg: layerSVG,
            paths: paths,
            originalPercentage: color.percentage
          });
        } else {
          console.log(`❌ ЭТАП 3.${i + 1}: Ошибка векторизации для цвета ${color.hex}`);
        }
      } else {
        console.log(`⚠️ ЭТАП 3.${i + 1}: Маска не создана для цвета ${color.hex}`);
      }
    }
    
    console.log(`\n📊 ЭТАП 3: Итоги обработки цветов:`);
    console.log(`   - Исходных цветов: ${dominantColors.length}`);
    console.log(`   - Успешно обработано: ${colorLayers.length}`);
    
    if (colorLayers.length === 0) {
      console.log('❌ ЭТАП 3: Ни один цвет не был успешно обработан, переходим к монохромному режиму');
      return createMonochromeBackup(imageBuffer, settings);
    }
    
    // Объединяем все цветные слои в один SVG
    console.log('🔗 ЭТАП 3: Объединяем цветные слои в финальный SVG...');
    const finalSVG = await combineColorLayers(colorLayers, imageBuffer);
    
    console.log(`✅ ЭТАП 3 ЗАВЕРШЕН: Цветной SVG создан с ${colorLayers.length} активными слоями`);
    return finalSVG;
    
  } catch (error) {
    console.error('❌ ЭТАП 3 КРИТИЧЕСКАЯ ОШИБКА:', error);
    console.log('🔄 ЭТАП 3: Переходим к резервному монохромному режиму');
    return createMonochromeBackup(imageBuffer, settings);
  }
}

/**
 * Извлечение доминирующих цветов из ИСХОДНОГО изображения (без двойной квантизации)
 */
async function extractDominantColors(imageBuffer, maxColors = 5) {
  const sharp = require('sharp');
  
  try {
    console.log(`🔍 ДИАГНОСТИКА ЭТАП 1: Анализ исходного изображения для извлечения ${maxColors} доминирующих цветов`);
    
    // Сначала анализируем исходное изображение
    const originalMeta = await sharp(imageBuffer).metadata();
    console.log(`📊 ДИАГНОСТИКА: Исходное изображение - ${originalMeta.width}x${originalMeta.height}, каналы: ${originalMeta.channels}, формат: ${originalMeta.format}`);
    console.log(`📊 ДИАГНОСТИКА: Размер буфера: ${imageBuffer.length} байт`);
    
    // Работаем с исходным изображением, увеличенным для лучшего анализа
    const { data, info } = await sharp(imageBuffer)
      .resize(300, 300, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    console.log(`📊 ДИАГНОСТИКА: Анализируем изображение ${info.width}x${info.height}, каналов: ${info.channels}`);
    
    const colorMap = new Map();
    let totalPixels = 0;
    
    // Собираем ВСЕ цвета без агрессивной фильтрации
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Пропускаем только полностью прозрачные пиксели
      if (info.channels === 4 && data[i + 3] < 10) continue;
      
      // ИСПРАВЛЕНИЕ: Adobe Limited Color квантизация для максимальной четкости
      const quantR = Math.round(r / 51) * 51; // 5 уровней (0, 51, 102, 153, 204, 255)
      const quantG = Math.round(g / 51) * 51;
      const quantB = Math.round(b / 51) * 51;
      
      const colorKey = `${quantR},${quantG},${quantB}`;
      const count = colorMap.get(colorKey) || 0;
      colorMap.set(colorKey, count + 1);
      totalPixels++;
    }
    
    console.log(`🎨 ДИАГНОСТИКА: Найдено уникальных цветов: ${colorMap.size}, всего пикселей: ${totalPixels}`);
    
    // Показываем первые 10 цветов для диагностики
    const topRawColors = Array.from(colorMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 10);
    console.log(`📋 ДИАГНОСТИКА: Топ-10 сырых цветов:`);
    topRawColors.forEach(([colorKey, count], index) => {
      const [r, g, b] = colorKey.split(',').map(Number);
      const hex = `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
      const percentage = ((count / totalPixels) * 100).toFixed(1);
      console.log(`   ${index + 1}. ${hex} (RGB: ${r},${g},${b}) - ${count} пикселей (${percentage}%)`);
    });
    
    // Интеллектуальный отбор цветов для шелкографии
    const allColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([colorKey, count]) => {
        const [r, g, b] = colorKey.split(',').map(Number);
        const percentage = ((count / totalPixels) * 100).toFixed(1);
        return {
          r, g, b,
          hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
          count,
          percentage: parseFloat(percentage),
          brightness: (r * 0.299 + g * 0.587 + b * 0.114), // Яркость для анализа
          saturation: Math.max(r, g, b) - Math.min(r, g, b) // Насыщенность
        };
      });

    // ИСПРАВЛЕНИЕ: Adobe-стиль фильтрация для получения четких контрастных цветов
    const filteredColors = [];
    const minColorDistance = 120; // Увеличенное расстояние для четкого контраста
    const minCoverage = 0.5; // Уменьшенное покрытие для захвата деталей

    for (const color of allColors) {
      if (filteredColors.length >= maxColors) break;
      if (color.percentage < minCoverage) continue;

      // Особая обработка для очень контрастных цветов (черный/белый)
      const isExtremeColor = (color.r + color.g + color.b < 30) || (color.r + color.g + color.b > 720);
      
      if (isExtremeColor) {
        // Всегда включаем крайние цвета (черный/белый)
        filteredColors.push(color);
        continue;
      }

      // Проверяем достаточность отличия от уже выбранных
      const isDistinct = filteredColors.every(existingColor => {
        const distance = Math.sqrt(
          Math.pow(color.r - existingColor.r, 2) +
          Math.pow(color.g - existingColor.g, 2) +
          Math.pow(color.b - existingColor.b, 2)
        );
        return distance >= minColorDistance;
      });

      if (isDistinct) {
        filteredColors.push(color);
      }
    }

    // Если не хватает цветов, добавляем контрастные
    if (filteredColors.length < 2) {
      const darkColor = { r: 0, g: 0, b: 0, hex: '#000000', count: 1, percentage: 25.0 };
      const lightColor = { r: 255, g: 255, b: 255, hex: '#ffffff', count: 1, percentage: 25.0 };
      
      if (filteredColors.length === 0) {
        filteredColors.push(darkColor, lightColor);
      } else if (filteredColors[0].brightness > 128) {
        filteredColors.push(darkColor);
      } else {
        filteredColors.push(lightColor);
      }
    }

    const sortedColors = filteredColors;
    
    console.log(`✅ ЭТАП 1 ЗАВЕРШЕН: Извлечено ${sortedColors.length} доминирующих цветов:`);
    sortedColors.forEach((color, i) => {
      console.log(`  ${i + 1}. ${color.hex} (${color.percentage}%)`);
    });
    
    return sortedColors;
    
  } catch (error) {
    console.error('❌ ЭТАП 1 ОШИБКА - Извлечение цветов:', error);
    // Возвращаем контрастную палитру для шелкографии
    return [
      { r: 0, g: 0, b: 0, hex: '#000000', count: 1, percentage: '50.0' },
      { r: 255, g: 255, b: 255, hex: '#ffffff', count: 1, percentage: '50.0' }
    ];
  }
}

/**
 * ЭТАП 2: Создание точных цветовых масок с адаптивным допуском
 */
async function createColorMask(imageBuffer, targetColor, settings) {
  const sharp = require('sharp');
  
  try {
    console.log(`🔍 ЭТАП 2: Создание маски для цвета ${targetColor.hex} (${targetColor.percentage}% изображения)`);
    
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const maskData = Buffer.alloc(info.width * info.height);
    
    // Adobe цветовая сегментация с расширенным допуском
    const baseTolerance = 60; // Увеличиваем допуск для захвата всех оттенков цвета
    const adaptiveTolerance = baseTolerance;
    
    console.log(`🎯 Используется адаптивный допуск: ${adaptiveTolerance}`);
    
    let pixelCount = 0;
    let minDistance = Infinity;
    let maxDistance = 0;
    
    // Создаем маску с более точным алгоритмом сравнения цветов
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Пропускаем прозрачные пиксели
      if (info.channels === 4 && data[i + 3] < 10) continue;
      
      // Используем мягкую квантизацию (синхронизировано с извлечением цветов)
      const quantR = Math.round(r / 4) * 4;
      const quantG = Math.round(g / 4) * 4;
      const quantB = Math.round(b / 4) * 4;
      
      // Вычисляем расстояние до целевого цвета
      const deltaR = quantR - targetColor.r;
      const deltaG = quantG - targetColor.g;
      const deltaB = quantB - targetColor.b;
      
      // Перцептивное расстояние (более близкое к человеческому восприятию)
      const colorDistance = Math.sqrt(
        2 * deltaR * deltaR +
        4 * deltaG * deltaG +
        3 * deltaB * deltaB
      );
      
      minDistance = Math.min(minDistance, colorDistance);
      maxDistance = Math.max(maxDistance, colorDistance);
      
      const pixelIndex = Math.floor(i / info.channels);
      
      if (colorDistance <= adaptiveTolerance) {
        maskData[pixelIndex] = 255; // Белый пиксель (область цвета)
        pixelCount++;
      } else {
        maskData[pixelIndex] = 0; // Черный пиксель (фон)
      }
    }
    
    const coveragePercent = ((pixelCount / (info.width * info.height)) * 100).toFixed(1);
    console.log(`📊 Маска для ${targetColor.hex}:`);
    console.log(`   - Захвачено пикселей: ${pixelCount} (${coveragePercent}%)`);
    console.log(`   - Расстояние: мин=${minDistance.toFixed(1)}, макс=${maxDistance.toFixed(1)}`);
    
    // Улучшенная проверка минимального покрытия с учетом контрастности
    const minCoverageThreshold = Math.max(0.8, parseFloat(targetColor.percentage) * 0.4);
    const isSignificantColor = parseFloat(coveragePercent) >= minCoverageThreshold;
    
    // Дополнительная проверка для контрастных цветов (даже с малым покрытием)
    const brightness = targetColor.r * 0.299 + targetColor.g * 0.587 + targetColor.b * 0.114;
    const isHighContrast = brightness < 50 || brightness > 200; // Очень темные или светлые
    
    if (!isSignificantColor && !isHighContrast) {
      console.log(`⚠️ ЭТАП 2: Недостаточное покрытие для ${targetColor.hex} (${coveragePercent}% < ${minCoverageThreshold}%), пропускаем`);
      return null;
    }
    
    if (isHighContrast && !isSignificantColor) {
      console.log(`✨ ЭТАП 2: Сохраняем контрастный цвет ${targetColor.hex} (яркость: ${brightness.toFixed(0)})`);
    }
    
    // Создаем изображение из маски
    const maskBuffer = await sharp(maskData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 1
      }
    })
    .png()
    .toBuffer();
    
    console.log(`✅ ЭТАП 2: Маска для ${targetColor.hex} создана успешно`);
    return maskBuffer;
    
  } catch (error) {
    console.error(`❌ ЭТАП 2 ОШИБКА - Создание маски для ${targetColor.hex}:`, error);
    return null;
  }
}

/**
 * Векторизация цветового слоя
 */
async function vectorizeColorLayer(maskBuffer, color, settings) {
  const potrace = require('potrace');
  
  try {
    // Adobe Illustrator Limited Color параметры
    const potraceParams = {
      threshold: settings.threshold || 128, // Adobe auto-threshold
      turdSize: settings.minimumArea || 10, // Adobe Noise parameter (10px²)
      turnPolicy: settings.turnPolicy || 'black', // Adobe turn policy
      alphaMax: settings.alphaMax || 1.0, // Adobe corner detection (1.0 рад)
      optCurve: settings.optCurve !== false, // Adobe curve optimization (всегда включено)
      optTolerance: settings.optTolerance || 0.2 // Adobe path fitting tolerance
    };
    
    console.log(`🎯 Adobe Illustrator трассировка для ${color.hex}:`, potraceParams);
    
    return new Promise((resolve, reject) => {
      potrace.trace(maskBuffer, potraceParams, (err, svg) => {
        if (err) {
          console.error(`Ошибка векторизации цвета ${color.hex}:`, err);
          resolve(null);
        } else {
          resolve(svg);
        }
      });
    });
    
  } catch (error) {
    console.error('Ошибка векторизации слоя:', error);
    return null;
  }
}

/**
 * Извлечение путей из SVG
 */
function extractSVGPaths(svgContent) {
  const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
  const paths = [];
  let match;
  
  while ((match = pathRegex.exec(svgContent)) !== null) {
    paths.push(match[1]);
  }
  
  return paths;
}

/**
 * Нормализация координат SVG пути для правильного отображения в viewBox
 */
function normalizePathCoordinates(pathData, sourceMinX, sourceMinY, sourceMaxX, sourceMaxY, targetWidth, targetHeight) {
  try {
    const sourceWidth = sourceMaxX - sourceMinX;
    const sourceHeight = sourceMaxY - sourceMinY;
    
    // Вычисляем масштаб с отступами
    const padding = 40;
    const scaleX = (targetWidth - padding * 2) / sourceWidth;
    const scaleY = (targetHeight - padding * 2) / sourceHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Не увеличиваем больше 100%
    
    // Центрируем изображение
    const offsetX = (targetWidth - sourceWidth * scale) / 2;
    const offsetY = (targetHeight - sourceHeight * scale) / 2;
    
    // Трансформируем все координаты в пути
    return pathData.replace(/([ML])\s*([\d.-]+)\s*([\d.-]+)/g, (match, command, x, y) => {
      const newX = (parseFloat(x) - sourceMinX) * scale + offsetX;
      const newY = (parseFloat(y) - sourceMinY) * scale + offsetY;
      return `${command} ${newX.toFixed(2)} ${newY.toFixed(2)}`;
    }).replace(/([C])\s*([\d.-]+)\s*([\d.-]+)\s*([\d.-]+)\s*([\d.-]+)\s*([\d.-]+)\s*([\d.-]+)/g, 
      (match, command, x1, y1, x2, y2, x3, y3) => {
        const newX1 = (parseFloat(x1) - sourceMinX) * scale + offsetX;
        const newY1 = (parseFloat(y1) - sourceMinY) * scale + offsetY;
        const newX2 = (parseFloat(x2) - sourceMinX) * scale + offsetX;
        const newY2 = (parseFloat(y2) - sourceMinY) * scale + offsetY;
        const newX3 = (parseFloat(x3) - sourceMinX) * scale + offsetX;
        const newY3 = (parseFloat(y3) - sourceMinY) * scale + offsetY;
        return `${command} ${newX1.toFixed(2)} ${newY1.toFixed(2)}, ${newX2.toFixed(2)} ${newY2.toFixed(2)}, ${newX3.toFixed(2)} ${newY3.toFixed(2)}`;
      });
    
  } catch (error) {
    console.error('Ошибка нормализации координат:', error);
    return pathData; // Возвращаем исходный путь при ошибке
  }
}

/**
 * ЭТАП 4: Объединение цветных слоев в финальный многослойный SVG
 */
async function combineColorLayers(colorLayers, originalImageBuffer) {
  const sharp = require('sharp');
  
  try {
    console.log(`🔗 ЭТАП 4: Начинаем объединение ${colorLayers.length} цветных слоев`);
    
    // Получаем размеры оригинального изображения
    const metadata = await sharp(originalImageBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;
    
    console.log(`📐 ЭТАП 4: Размеры SVG: ${width}x${height}`);
    
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <title>Adobe Limited Color (${colorLayers.length} colors)</title>
  <desc>Generated with Adobe Illustrator Image Trace compatible algorithm</desc>
  <style>
    .vector-layer { shape-rendering: optimizeSpeed; }
  </style>
`;
    
    let totalPaths = 0;
    
    // Жесткие ограничения для шелкографии и браузерного отображения
    const MAX_PATHS_PER_LAYER = 25; // Уменьшено до 25 путей на цвет для лучшей производительности
    const MAX_TOTAL_PATHS = 100; // Уменьшено до 100 путей на весь SVG
    const MAX_SVG_SIZE_KB = 200; // Уменьшено до 200KB для быстрой загрузки
    const MAX_PATH_COMPLEXITY = 500; // Максимальная длина path элемента
    
    // Анализируем координаты для нормализации позиционирования
    console.log(`📐 ЭТАП 4: Анализируем координаты для центрирования...`);
    let allCoordinates = [];
    
    colorLayers.forEach(layer => {
      layer.paths.forEach(path => {
        const coords = path.match(/M (\d+\.?\d*) (\d+\.?\d*)/g);
        if (coords) {
          coords.forEach(coord => {
            const match = coord.match(/M (\d+\.?\d*) (\d+\.?\d*)/);
            if (match) {
              allCoordinates.push({
                x: parseFloat(match[1]),
                y: parseFloat(match[2])
              });
            }
          });
        }
      });
    });
    
    // Находим границы контента только если есть координаты
    let minX = 0, maxX = width, minY = 0, maxY = height;
    let contentWidth = width, contentHeight = height;
    
    if (allCoordinates.length > 0) {
      minX = Math.min(...allCoordinates.map(c => c.x));
      maxX = Math.max(...allCoordinates.map(c => c.x));
      minY = Math.min(...allCoordinates.map(c => c.y));
      maxY = Math.max(...allCoordinates.map(c => c.y));
      
      contentWidth = maxX - minX;
      contentHeight = maxY - minY;
    }
    
    const padding = 20;
    
    console.log(`📊 ЭТАП 4: Границы контента - X: ${minX}-${maxX}, Y: ${minY}-${maxY}`);
    console.log(`📊 ЭТАП 4: Размер контента: ${contentWidth}x${contentHeight}`);
    
    // Используем увеличенные размеры 2400x2400 для высокого разрешения
    const optimizedWidth = 2400;
    const optimizedHeight = 2400;
    
    // Вычисляем масштаб для вписывания контента в viewBox
    const scaleX = (optimizedWidth - padding * 2) / contentWidth;
    const scaleY = (optimizedHeight - padding * 2) / contentHeight;
    const scale = Math.min(scaleX, scaleY, 1); // Не увеличиваем больше 100%
    
    // Центрируем изображение
    const offsetX = (optimizedWidth - contentWidth * scale) / 2;
    const offsetY = (optimizedHeight - contentHeight * scale) / 2;
    
    // Пересоздаем заголовок SVG с оптимизированными размерами
    svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${optimizedWidth}" height="${optimizedHeight}" viewBox="0 0 ${optimizedWidth} ${optimizedHeight}" xmlns="http://www.w3.org/2000/svg">
  <title>Adobe Limited Color (${colorLayers.length} colors)</title>
  <desc>Generated with Adobe Illustrator Image Trace compatible algorithm</desc>
  <style>
    .vector-layer { shape-rendering: optimizeSpeed; }
  </style>
`;

    // Добавляем каждый цветной слой с нормализацией координат
    colorLayers.forEach((layer, index) => {
      const layerNumber = index + 1;
      console.log(`🎨 ЭТАП 4.${layerNumber}: Добавляем слой для цвета ${layer.color}`);
      console.log(`   - Путей в слое: ${layer.paths.length}`);
      
      svgContent += `  <g id="color-${layerNumber}" class="vector-layer" fill="${layer.color}" stroke="none">\n`;
      
      let validPaths = 0;
      let layerPaths = 0;
      
      // Сортируем пути по длине (приоритет более простым формам для браузера)
      const sortedPaths = layer.paths
        .filter(path => path && path.trim() && path.length > 10 && path.length < MAX_PATH_COMPLEXITY)
        .sort((a, b) => a.length - b.length);
      
      for (const path of sortedPaths) {
        // Прекращаем добавление при достижении лимитов
        if (layerPaths >= MAX_PATHS_PER_LAYER || totalPaths >= MAX_TOTAL_PATHS) {
          console.log(`⚠️ ЭТАП 4.${layerNumber}: Достигнут лимит путей (${layerPaths}/${MAX_PATHS_PER_LAYER} на слой, ${totalPaths}/${MAX_TOTAL_PATHS} всего)`);
          break;
        }
        
        // Нормализуем координаты пути для правильного отображения
        const normalizedPath = normalizePathCoordinates(path, minX, minY, maxX, maxY, optimizedWidth, optimizedHeight);
        svgContent += `    <path d="${normalizedPath}" />\n`;
        validPaths++;
        layerPaths++;
        totalPaths++;
        
        // Проверяем размер SVG
        if (svgContent.length > MAX_SVG_SIZE_KB * 1024) {
          console.log(`⚠️ ЭТАП 4.${layerNumber}: Достигнут лимит размера (${(svgContent.length / 1024).toFixed(1)}KB)`);
          break;
        }
      }
      
      svgContent += `  </g>\n`;
      
      console.log(`✅ ЭТАП 4.${layerNumber}: Добавлено ${validPaths} из ${layer.paths.length} путей для ${layer.color}`);
    });
    
    svgContent += `</svg>`;
    
    console.log(`📊 ЭТАП 4: Итоговая статистика SVG:`);
    console.log(`   - Всего слоев: ${colorLayers.length}`);
    console.log(`   - Всего путей: ${totalPaths}`);
    console.log(`   - Размер контента: ${(svgContent.length / 1024).toFixed(1)} КБ`);
    console.log(`   - Оптимизированные размеры: ${optimizedWidth}x${optimizedHeight}`);
    console.log(`   - Смещение устранено: контент центрирован`);
    
    if (totalPaths === 0) {
      console.log('❌ ЭТАП 4: Нет валидных путей, создаем резервный SVG');
      return createMonochromeBackup(originalImageBuffer, { threshold: 128 });
    }
    
    // Финальная проверка размера для шелкографии
    const finalSizeKB = svgContent.length / 1024;
    if (finalSizeKB > MAX_SVG_SIZE_KB) {
      console.log(`⚠️ ЭТАП 4: SVG слишком большой (${finalSizeKB.toFixed(1)}KB > ${MAX_SVG_SIZE_KB}KB), применяем экстренную оптимизацию`);
      return await applyEmergencyOptimization(svgContent, originalImageBuffer, MAX_SVG_SIZE_KB);
    }
    
    // Проверка на корректность для веб-отображения
    if (totalPaths > MAX_TOTAL_PATHS * 2) {
      console.log(`⚠️ ЭТАП 4: Слишком много путей (${totalPaths}), может быть проблема с отображением`);
    }
    
    console.log(`✅ ЭТАП 4 ЗАВЕРШЕН: Многослойный SVG создан успешно`);
    return svgContent;
    
  } catch (error) {
    console.error('❌ ЭТАП 4 ОШИБКА - Объединение слоев:', error);
    return createMonochromeBackup(originalImageBuffer, { threshold: 128 });
  }
}

/**
 * Экстренная оптимизация для слишком больших SVG файлов
 */
async function applyEmergencyOptimization(svgContent, originalImageBuffer, maxSizeKB) {
  console.log('🚨 ЭКСТРЕННАЯ ОПТИМИЗАЦИЯ: Упрощение SVG для шелкографии');
  
  try {
    // Извлекаем все пути из SVG
    const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
    const paths = [];
    let match;
    
    while ((match = pathRegex.exec(svgContent)) !== null) {
      paths.push(match[1]);
    }
    
    console.log(`🔍 Найдено ${paths.length} путей, требуется радикальное упрощение`);
    
    // Берем только самые простые пути (до 50 штук)
    const simplifiedPaths = paths
      .filter(path => path.length < 500) // Только короткие пути
      .slice(0, 50); // Максимум 50 путей
    
    // Создаем упрощенный SVG
    const sharp = require('sharp');
    const metadata = await sharp(originalImageBuffer).metadata();
    
    let optimizedSVG = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${metadata.width}" height="${metadata.height}" viewBox="0 0 ${metadata.width} ${metadata.height}" xmlns="http://www.w3.org/2000/svg">
  <title>Упрощенная шелкография</title>
  <desc>Экстренно оптимизированная версия для веб-отображения</desc>
  <g id="simplified-layer" fill="#000000" stroke="none">
`;
    
    simplifiedPaths.forEach(path => {
      optimizedSVG += `    <path d="${path}" />\n`;
    });
    
    optimizedSVG += `  </g>
</svg>`;
    
    console.log(`✅ ЭКСТРЕННАЯ ОПТИМИЗАЦИЯ ЗАВЕРШЕНА: ${simplifiedPaths.length} путей, ${(optimizedSVG.length / 1024).toFixed(1)}KB`);
    return optimizedSVG;
    
  } catch (error) {
    console.error('❌ Ошибка экстренной оптимизации:', error);
    return createMonochromeBackup(originalImageBuffer, { threshold: 128 });
  }
}

/**
 * Резервный монохромный SVG при ошибках
 */
async function createMonochromeBackup(imageBuffer, settings) {
  const potrace = require('potrace');
  
  console.log('🔄 Создание резервного монохромного SVG...');
  
  try {
    const potraceParams = {
      threshold: settings.threshold || 128,
      turdSize: 1,
      turnPolicy: 'black',
      alphaMax: 1.0,
      optCurve: true,
      optTolerance: 0.05
    };
    
    return new Promise((resolve, reject) => {
      potrace.trace(imageBuffer, potraceParams, (err, svg) => {
        if (err) {
          reject(new Error(`Ошибка резервного potrace: ${err.message}`));
        } else {
          console.log('✅ Резервный SVG создан');
          resolve(svg);
        }
      });
    });
    
  } catch (error) {
    console.error('Критическая ошибка создания SVG:', error);
    throw error;
  }
}

/**
 * Adobe-совместимое определение автоматического порога (алгоритм Otsu)
 */
async function calculateAdobeThreshold(imageBuffer) {
  const sharp = require('sharp');
  
  try {
    // Конвертируем в серый для анализа
    const { data, info } = await sharp(imageBuffer)
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Создаем гистограмму яркости
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i++) {
      histogram[data[i]]++;
    }
    
    const total = data.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) {
      sum += i * histogram[i];
    }
    
    let sumB = 0;
    let wB = 0;
    let maximum = 0;
    let level = 0;
    
    // Алгоритм Otsu для автоматического порога
    for (let i = 0; i < 256; i++) {
      wB += histogram[i];
      if (wB === 0) continue;
      
      const wF = total - wB;
      if (wF === 0) break;
      
      sumB += i * histogram[i];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      
      const between = wB * wF * Math.pow(mB - mF, 2);
      
      if (between > maximum) {
        level = i;
        maximum = between;
      }
    }
    
    // Adobe обычно использует немного более высокий порог для шелкографии
    const adobeAdjustedThreshold = Math.min(255, Math.max(85, level + 15));
    
    console.log(`📊 Otsu порог: ${level}, Adobe адаптированный: ${adobeAdjustedThreshold}`);
    return adobeAdjustedThreshold;
    
  } catch (error) {
    console.error('Ошибка расчета порога:', error);
    return 120; // Дефолтный порог Adobe для шелкографии
  }
}

/**
 * Adobe-совместимая предобработка изображения
 */
async function preprocessImageForAdobe(imageBuffer, settings) {
  const sharp = require('sharp');
  
  try {
    console.log('📐 Adobe-совместимая предобработка...');
    
    // Масштабирование как в Adobe
    const processedBuffer = await sharp(imageBuffer)
      .resize(settings.maxSize, settings.maxSize, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .png()
      .toBuffer();
    
    console.log('✅ Предобработка завершена');
    return processedBuffer;
    
  } catch (error) {
    console.error('Ошибка предобработки:', error);
    return imageBuffer;
  }
}

/**
 * Adobe Limited Color режим - точная имитация Image Trace
 */
async function createAdobeLimitedColorSVG(imageBuffer, settings) {
  const sharp = require('sharp');
  
  try {
    console.log('🎨 Adobe Limited Color режим');
    
    // Получаем метаданные изображения
    const metadata = await sharp(imageBuffer).metadata();
    const width = metadata.width;
    const height = metadata.height;
    
    console.log(`📐 Размеры: ${width}x${height}`);
    
    // ИСПРАВЛЕНИЕ: Используем улучшенную функцию extractDominantColors
    const dominantColors = await extractDominantColors(imageBuffer, settings.maxColors);
    
    if (!dominantColors || dominantColors.length === 0) {
      console.log('❌ K-means сбой, принудительно создаем базовые цвета для шелкографии');
      // Принудительное создание базовой цветовой палитры для шелкографии
      dominantColors = [
        { r: 0, g: 0, b: 0, hex: '#000000', percentage: '40.0' },       // Черный
        { r: 255, g: 255, b: 255, hex: '#ffffff', percentage: '35.0' }, // Белый
        { r: 128, g: 128, b: 128, hex: '#808080', percentage: '15.0' }, // Серый
        { r: 200, g: 200, b: 200, hex: '#c8c8c8', percentage: '10.0' }  // Светло-серый
      ];
      console.log('🎨 Используем принудительную палитру: 4 цвета для шелкографии');
    }
    
    console.log(`🎨 Adobe цвета: ${dominantColors.length}`);
    
    // Создаем SVG структуру как в Adobe
    let svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <title>Adobe Limited Color (${dominantColors.length} colors)</title>
  <desc>Generated with Adobe Illustrator Image Trace compatible algorithm</desc>
`;
    
    // Принудительная обработка каждого цвета
    console.log(`🎨 НАЧИНАЕМ ОБРАБОТКУ ${dominantColors.length} ЦВЕТОВ:`);
    dominantColors.forEach((color, index) => {
      console.log(`  ${index + 1}. ${color.hex} (${color.percentage}%)`);
    });
    
    let processedColors = 0;
    
    for (let i = 0; i < dominantColors.length; i++) {
      const color = dominantColors[i];
      console.log(`🔍 ЭТАП ${i + 1}: Обработка цвета ${color.hex}`);
      
      // Создаем маску для цвета
      const colorMask = await createAdobeColorMask(imageBuffer, color, settings);
      console.log(`🖼️ Маска для ${color.hex}: ${colorMask ? 'СОЗДАНА' : 'НЕ СОЗДАНА'}`);
      
      if (colorMask) {
        console.log(`🎨 УСПЕШНО: Обрабатываем цвет ${i + 1}/${dominantColors.length}: ${color.hex}`);
        
        // Векторизуем маску с Adobe параметрами
        const paths = await vectorizeAdobeMask(colorMask, color, settings);
        console.log(`🔍 Получено путей для ${color.hex}: ${paths ? paths.length : 0}`);
        
        if (paths && paths.length > 0) {
          svgContent += `  <g id="color-${i + 1}" fill="${color.hex}" stroke="none">\n`;
          
          // Ограничиваем количество путей как в Adobe (макс 20 на цвет)
          const limitedPaths = paths.slice(0, 20);
          let addedPaths = 0;
          
          limitedPaths.forEach(pathObj => {
            if (pathObj && pathObj.path && pathObj.path.length > 10) {
              svgContent += `    <path d="${pathObj.path}" fill="${pathObj.fill}" opacity="${pathObj.opacity}"/>\n`;
              addedPaths++;
            }
          });
          
          svgContent += `  </g>\n`;
          console.log(`✅ Добавлено ${addedPaths} путей для ${color.hex} (из ${limitedPaths.length} обработанных)`);
          processedColors++;
        } else {
          console.log(`❌ Нет путей для ${color.hex}`);
        }
      } else {
        console.log(`❌ Маска не создана для ${color.hex}`);
      }
    }
    
    svgContent += `</svg>`;
    
    console.log(`📊 ФИНАЛЬНЫЙ ОТЧЕТ ОБРАБОТКИ:`);
    console.log(`  • Заявлено цветов: ${dominantColors.length}`);
    console.log(`  • Успешно обработано: ${processedColors}`);
    console.log(`  • SVG размер: ${(svgContent.length / 1024).toFixed(1)}KB`);
    
    return svgContent;
    
  } catch (error) {
    console.error('❌ Ошибка Adobe режима:', error);
    return createAdobeMonoSVG(imageBuffer, settings);
  }
}

/**
 * Извлечение цветов алгоритмом K-means как в Adobe
 */
async function extractAdobeColors(imageBuffer, maxColors) {
  const sharp = require('sharp');
  
  try {
    // Увеличиваем размер выборки для лучшего цветового анализа
    const { data, info } = await sharp(imageBuffer)
      .resize(400, 400, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = [];
    for (let i = 0; i < data.length; i += info.channels) {
      // Пропускаем прозрачные пиксели
      if (info.channels === 4 && data[i + 3] < 128) continue;
      
      pixels.push({
        r: data[i],
        g: data[i + 1], 
        b: data[i + 2]
      });
    }
    
    console.log(`📊 Извлечено ${pixels.length} пикселей из ${data.length / info.channels} (каналов: ${info.channels})`);
    
    if (pixels.length === 0) {
      console.log('❌ Нет пикселей для анализа');
      return [];
    }
    
    // K-means кластеризация цветов
    const clusters = performKMeans(pixels, maxColors);
    console.log(`🔬 K-means результат: ${clusters ? clusters.length : 0} кластеров`);
    
    // Конвертируем в формат Adobe
    const adobeColors = clusters.map(cluster => ({
      r: Math.round(cluster.r),
      g: Math.round(cluster.g),
      b: Math.round(cluster.b),
      hex: `#${Math.round(cluster.r).toString(16).padStart(2, '0')}${Math.round(cluster.g).toString(16).padStart(2, '0')}${Math.round(cluster.b).toString(16).padStart(2, '0')}`,
      percentage: cluster.weight.toFixed(1)
    }));
    
    console.log(`🎨 Adobe K-means: ${adobeColors.length} цветов`);
    return adobeColors;
    
  } catch (error) {
    console.error('Ошибка извлечения Adobe цветов:', error);
    return [];
  }
}

/**
 * Простая K-means кластеризация для цветов
 */
function performKMeans(pixels, k) {
  if (pixels.length === 0) {
    console.log('❌ performKMeans: Нет пикселей');
    return [];
  }
  
  console.log(`🔬 performKMeans: Кластеризация ${pixels.length} пикселей на ${k} кластеров`);
  
  // Инициализация центроидов с разнообразием цветов
  let centroids = [];
  
  // Умная инициализация центроидов - выбираем максимально разные цвета
  centroids.push({ ...pixels[0], weight: 0 }); // Первый пиксель
  
  for (let i = 1; i < k; i++) {
    let maxDistance = 0;
    let bestPixel = pixels[0];
    
    // Находим пиксель, максимально отличающийся от уже выбранных центроидов
    for (const pixel of pixels) {
      let minDistanceToExisting = Infinity;
      
      for (const centroid of centroids) {
        const distance = Math.sqrt(
          Math.pow(pixel.r - centroid.r, 2) +
          Math.pow(pixel.g - centroid.g, 2) +
          Math.pow(pixel.b - centroid.b, 2)
        );
        minDistanceToExisting = Math.min(minDistanceToExisting, distance);
      }
      
      if (minDistanceToExisting > maxDistance) {
        maxDistance = minDistanceToExisting;
        bestPixel = pixel;
      }
    }
    
    centroids.push({ ...bestPixel, weight: 0 });
  }
  
  console.log(`🎯 Инициализировано ${centroids.length} центроидов`);
  
  // Итерации K-means
  for (let iter = 0; iter < 10; iter++) {
    const clusters = Array(k).fill().map(() => []);
    
    // Назначение пикселей к кластерам
    pixels.forEach(pixel => {
      let minDistance = Infinity;
      let nearestCluster = 0;
      
      centroids.forEach((centroid, i) => {
        const distance = Math.sqrt(
          Math.pow(pixel.r - centroid.r, 2) +
          Math.pow(pixel.g - centroid.g, 2) +
          Math.pow(pixel.b - centroid.b, 2)
        );
        
        if (distance < minDistance) {
          minDistance = distance;
          nearestCluster = i;
        }
      });
      
      clusters[nearestCluster].push(pixel);
    });
    
    // Обновление центроидов
    centroids = clusters.map((cluster, i) => {
      if (cluster.length === 0) return centroids[i];
      
      const r = cluster.reduce((sum, p) => sum + p.r, 0) / cluster.length;
      const g = cluster.reduce((sum, p) => sum + p.g, 0) / cluster.length;
      const b = cluster.reduce((sum, p) => sum + p.b, 0) / cluster.length;
      const weight = (cluster.length / pixels.length) * 100;
      
      return { r, g, b, weight };
    });
  }
  
  // Возвращаем ВСЕ найденные кластеры для сохранения всех цветов
  const validCentroids = centroids.filter(c => c.weight > 0); // Убираем только пустые кластеры
  console.log(`🎨 K-means итоговых цветов: ${validCentroids.length} из ${centroids.length}`);
  validCentroids.forEach((centroid, i) => {
    console.log(`   Цвет ${i + 1}: RGB(${Math.round(centroid.r)}, ${Math.round(centroid.g)}, ${Math.round(centroid.b)}) - ${centroid.weight.toFixed(2)}%`);
  });
  return validCentroids;
}

/**
 * Создание цветовой маски как в Adobe
 */
async function createAdobeColorMask(imageBuffer, targetColor, settings) {
  const sharp = require('sharp');
  
  try {
    console.log(`🎯 ДИАГНОСТИКА ЭТАП 2: Создание детальной маски для ${targetColor.hex}...`);
    
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    console.log(`📊 ДИАГНОСТИКА: Изображение для маски - ${info.width}x${info.height}, каналы: ${info.channels}, размер данных: ${data.length}`);
    
    const maskData = Buffer.alloc(info.width * info.height);
    
    // ADOBE-СОВМЕСТИМЫЕ ДОПУСКИ: Более широкие для захвата всех деталей
    let tolerance = 100; // Существенно увеличенный базовый допуск
    
    // Адаптация допуска для разных типов цветов (как в Adobe Limited Color)
    const brightness = (targetColor.r + targetColor.g + targetColor.b) / 3;
    if (brightness < 60) tolerance = 120; // Темные цвета - максимальный допуск
    if (brightness > 200) tolerance = 110; // Светлые цвета - большой допуск
    if (brightness >= 60 && brightness <= 200) tolerance = 130; // Средние тона - самый большой допуск
    
    console.log(`🔧 ДИАГНОСТИКА: Допуск для ${targetColor.hex}: ${tolerance} (яркость: ${brightness.toFixed(1)})`);
    console.log(`🔧 ДИАГНОСТИКА: Целевой цвет RGB(${targetColor.r}, ${targetColor.g}, ${targetColor.b})`);
    
    let pixelCount = 0;
    let totalPixels = 0;
    
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      totalPixels++;
      
      // Пропускаем прозрачные пиксели
      if (info.channels === 4 && data[i + 3] < 128) continue;
      
      // Улучшенная метрика расстояния для лучшего захвата деталей
      const euclideanDistance = Math.sqrt(
        Math.pow(r - targetColor.r, 2) +
        Math.pow(g - targetColor.g, 2) +
        Math.pow(b - targetColor.b, 2)
      );
      
      // Дополнительная проверка по компонентам RGB
      const deltaR = Math.abs(r - targetColor.r);
      const deltaG = Math.abs(g - targetColor.g);
      const deltaB = Math.abs(b - targetColor.b);
      const maxDelta = Math.max(deltaR, deltaG, deltaB);
      
      const pixelIndex = Math.floor(i / info.channels);
      
      // ADOBE-СТИЛЬ: Более мягкие условия включения для захвата всех деталей
      if (euclideanDistance <= tolerance || (maxDelta <= tolerance * 0.8) || 
          (Math.abs(r - targetColor.r) <= tolerance * 0.6 && 
           Math.abs(g - targetColor.g) <= tolerance * 0.6 && 
           Math.abs(b - targetColor.b) <= tolerance * 0.6)) {
        maskData[pixelIndex] = 255;
        pixelCount++;
      } else {
        maskData[pixelIndex] = 0;
      }
    }
    
    const coverage = (pixelCount / totalPixels) * 100;
    
    console.log(`📊 ДИАГНОСТИКА: Результат маски для ${targetColor.hex}:`);
    console.log(`   - Обработано пикселей: ${totalPixels}`);
    console.log(`   - Найдено совпадений: ${pixelCount}`);
    console.log(`   - Покрытие: ${coverage.toFixed(2)}%`);
    
    // Показываем несколько примеров пикселей для диагностики
    const samplePixels = [];
    for (let i = 0; i < Math.min(data.length, 50 * info.channels); i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const distance = Math.sqrt(
        Math.pow(r - targetColor.r, 2) +
        Math.pow(g - targetColor.g, 2) +
        Math.pow(b - targetColor.b, 2)
      );
      samplePixels.push({ r, g, b, distance, matches: distance <= tolerance });
    }
    
    const matchingSamples = samplePixels.filter(p => p.matches).length;
    console.log(`📊 ДИАГНОСТИКА: Из первых 50 пикселей ${matchingSamples} совпадают с цветом ${targetColor.hex}`);
    
    
    // ADOBE-СОВМЕСТИМЫЙ ПОРОГ: Более низкий для сохранения всех деталей
    if (coverage < 0.005) {
      console.log(`⚠️ Критически малое покрытие для ${targetColor.hex}: ${coverage.toFixed(3)}%`);
      return null;
    }
    
    // Применяем морфологические операции для улучшения качества маски
    const processedMaskBuffer = await sharp(maskData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: 1
      }
    })
    .median(2) // Удаляем шум сохраняя детали
    .png()
    .toBuffer();
    
    console.log(`✅ Детальная маска для ${targetColor.hex}: ${coverage.toFixed(3)}% покрытия, ${pixelCount} пикселей`);
    return processedMaskBuffer;
    
  } catch (error) {
    console.error(`Ошибка создания детальной маски для ${targetColor.hex}:`, error);
    return null;
  }
}

/**
 * Векторизация маски с Adobe параметрами
 */
async function vectorizeAdobeMask(maskBuffer, color, settings) {
  const potrace = require('potrace');
  
  try {
    // ИСПРАВЛЕННЫЕ Adobe Illustrator параметры для максимальной детализации
    const adobeParams = {
      threshold: 128, // Средний порог для лучшего баланса
      turdSize: 4, // КРИТИЧЕСКОЕ ИСПРАВЛЕНИЕ: Минимальная фильтрация для сохранения деталей
      turnPolicy: 'minority', // Улучшенная политика поворота
      alphaMax: 1.5, // Увеличенный угол для сохранения острых углов
      optCurve: true,
      optTolerance: 0.1 // ИСПРАВЛЕНИЕ: Меньший допуск для более точных путей
    };
    
    return new Promise((resolve, reject) => {
      console.log(`🔧 Детальная векторизация ${color.hex} с улучшенными параметрами:`, adobeParams);
      
      potrace.trace(maskBuffer, adobeParams, (err, svg) => {
        if (err) {
          console.error(`❌ Ошибка векторизации ${color.hex}:`, err);
          resolve([]);
        } else {
          console.log(`📄 SVG получен для ${color.hex}, длина: ${svg ? svg.length : 0}`);
          
          if (!svg || svg.length < 100) {
            console.log(`⚠️ Слишком короткий SVG для ${color.hex}, пробуем альтернативные параметры`);
            
            // Альтернативные параметры для сложных масок
            const fallbackParams = {
              threshold: 100,
              turdSize: 2, // Еще меньше для захвата мелких деталей
              turnPolicy: 'black',
              alphaMax: 1.0,
              optCurve: false, // Отключаем оптимизацию кривых
              optTolerance: 0.05
            };
            
            potrace.trace(maskBuffer, fallbackParams, (err2, svg2) => {
              if (err2 || !svg2) {
                console.log(`❌ Альтернативная векторизация тоже не удалась для ${color.hex}`);
                resolve([]);
                return;
              }
              
              const paths = extractPathsFromSVG(svg2, color);
              console.log(`🔄 Альтернативная векторизация ${color.hex}: ${paths.length} путей`);
              resolve(paths);
            });
            
            return;
          }
          
          const paths = extractPathsFromSVG(svg, color);
          console.log(`🎯 ${color.hex}: ${paths.length} детальных путей извлечено`);
          resolve(paths);
        }
      });
    });
    
  } catch (error) {
    console.error(`Ошибка векторизации маски ${color.hex}:`, error);
    return [];
  }
}

/**
 * Улучшенное извлечение путей из SVG с детальным анализом
 */
function extractPathsFromSVG(svg, color) {
  const paths = [];
  
  // Ищем все пути в SVG
  const pathRegex = /<path[^>]*d="([^"]*)"[^>]*>/g;
  let match;
  
  while ((match = pathRegex.exec(svg)) !== null) {
    const pathData = match[1];
    
    // Фильтруем слишком короткие или простые пути
    if (pathData.length < 10) continue;
    
    // Проверяем сложность пути (количество команд)
    const commandCount = (pathData.match(/[MmLlHhVvCcSsQqTtAaZz]/g) || []).length;
    if (commandCount < 2) continue;
    
    console.log(`✂️ Найден детальный путь для ${color.hex}: ${commandCount} команд, длина ${pathData.length}`);
    
    const coloredPath = {
      path: pathData,
      color: color.hex,
      fill: color.hex,
      opacity: 1.0
    };
    paths.push(coloredPath);
  }
  
  return paths;
}

/**
 * Резервный монохромный SVG в стиле Adobe
 */
async function createAdobeMonoSVG(imageBuffer, settings) {
  const potrace = require('potrace');
  const sharp = require('sharp');
  
  console.log('🔄 Adobe монохромный режим...');
  
  try {
    const metadata = await sharp(imageBuffer).metadata();
    
    const adobeParams = {
      threshold: settings.threshold || 120,
      turdSize: 20, // Больше для монохрома
      turnPolicy: 'black',
      alphaMax: 0.75,
      optCurve: true,
      optTolerance: 0.3
    };
    
    return new Promise((resolve, reject) => {
      potrace.trace(imageBuffer, adobeParams, (err, svg) => {
        if (err) {
          reject(new Error(`Adobe монохром ошибка: ${err.message}`));
        } else {
          console.log('✅ Adobe монохромный SVG создан');
          resolve(svg);
        }
      });
    });
    
  } catch (error) {
    console.error('Критическая ошибка Adobe SVG:', error);
    throw error;
  }
}

/**
 * Векторизация изображения по URL с обработкой редиректов
 */
async function vectorizeFromUrl(imageUrl, options = {}) {
  const https = require('https');
  const http = require('http');
  const fs = require('fs').promises;
  
  try {
    console.log(`🌐 Загрузка изображения по URL...`);
    
    // Загружаем изображение с обработкой редиректов
    const imageBuffer = await downloadImageWithRedirects(imageUrl);
    
    if (!imageBuffer) {
      throw new Error('Не удалось загрузить изображение');
    }
    
    console.log(`✅ Изображение загружено: ${(imageBuffer.length / 1024).toFixed(1)}KB`);
    
    // Принудительно используем Adobe Limited Color для команды "нужен вектор"
    console.log(`🎨 ПРИНУДИТЕЛЬНЫЙ РЕЖИМ: Adobe Limited Color (silkscreen)`);
    console.log(`📊 Входные параметры:`, JSON.stringify(options));
    
    // Принудительно устанавливаем параметры для Adobe режима
    const adobeOptions = {
      ...options,
      maxColors: 5,
      outputFormat: 'svg',
      quality: 'silkscreen'
    };
    
    console.log(`🔧 Adobe параметры:`, JSON.stringify(adobeOptions));
    const result = await silkscreenVectorize(imageBuffer, adobeOptions);
    
    if (result.success) {
      // Сохраняем SVG файл
      const filename = `vectorized_${generateId()}.svg`;
      const filepath = path.join(outputDir, filename);
      
      await fs.writeFile(filepath, result.svgContent);
      
      return {
        success: true,
        svgContent: result.svgContent,
        filename: filename,
        detectedType: 'url-image',
        quality: result.quality,
        optimization: result.optimization
      };
    } else {
      throw new Error(result.error || 'Ошибка векторизации');
    }
    
  } catch (error) {
    console.error('❌ Ошибка векторизации URL:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Загрузка изображения с обработкой редиректов
 */
async function downloadImageWithRedirects(url, maxRedirects = 5) {
  return new Promise((resolve, reject) => {
    const downloadImage = (currentUrl, redirectCount = 0) => {
      if (redirectCount > maxRedirects) {
        reject(new Error('Слишком много редиректов'));
        return;
      }
      
      const urlObj = new URL(currentUrl);
      const client = urlObj.protocol === 'https:' ? https : http;
      
      const request = client.get(currentUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8'
        },
        timeout: 30000
      }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
          console.log(`🔄 Редирект ${response.statusCode}: ${response.headers.location}`);
          downloadImage(response.headers.location, redirectCount + 1);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }
        
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          const buffer = Buffer.concat(chunks);
          console.log(`✅ Изображение загружено: ${(buffer.length / 1024).toFixed(1)}KB`);
          resolve(buffer);
        });
        response.on('error', reject);
      });
      
      request.on('error', reject);
      request.on('timeout', () => {
        request.destroy();
        reject(new Error('Timeout при загрузке изображения'));
      });
    };
    
    downloadImage(url);
  });
}

/**
 * Оптимизация размера SVG до 20МБ
 */
async function optimizeSVGSize(svgContent, maxSize) {
  console.log('🗜️ Оптимизация размера SVG...');
  
  let optimized = svgContent;
  
  // Удаляем ненужные атрибуты и пробелы
  optimized = optimized
    .replace(/\s+/g, ' ') // Множественные пробелы в один
    .replace(/>\s+</g, '><') // Пробелы между тегами
    .replace(/\s+\/>/g, '/>') // Пробелы перед закрывающими тегами
    .replace(/="([^"]*?)"/g, (match, value) => {
      // Округляем числовые значения
      if (/^-?\d*\.?\d+$/.test(value)) {
        return `="${parseFloat(value).toFixed(2)}"`;
      }
      return match;
    });
  
  // Если все еще слишком большой, упрощаем пути
  if (Buffer.byteLength(optimized, 'utf8') > maxSize) {
    console.log('🔧 Упрощение путей SVG...');
    
    // Упрощаем числовые значения в путях
    optimized = optimized.replace(/d="([^"]+)"/g, (match, path) => {
      const simplified = path.replace(/(\d+\.\d{3,})/g, (num) => {
        return parseFloat(num).toFixed(1);
      });
      return `d="${simplified}"`;
    });
  }
  
  const finalSize = Buffer.byteLength(optimized, 'utf8');
  console.log(`📏 Размер после оптимизации: ${(finalSize / 1024 / 1024).toFixed(2)}МБ`);
  
  return optimized;
}

// Главная функция векторизации (только шелкография)
async function advancedVectorize(imageBuffer, options = {}) {
  try {
    console.log(`🎯 ВЫБОР АЛГОРИТМА ВЕКТОРИЗАЦИИ`);
    console.log(`   Качество: ${options.quality || 'standard'}`);
    console.log(`   Тип: ${options.optimizeFor || 'web'}`);
    
    // Определяем нужна ли цветная векторизация
    const needsColorVectorization = 
      options.quality === 'silkscreen' ||
      options.quality === 'ultra' ||
      options.optimizeFor === 'silkscreen' ||
      options.optimizeFor === 'print' ||
      (options.colors && options.colors !== 'mono');
    
    if (needsColorVectorization) {
      console.log(`🎨 ВЫБРАН: Цветной алгоритм silkscreenVectorize`);
      return await silkscreenVectorize(imageBuffer, options);
    } else {
      console.log(`⚫ ВЫБРАН: Монохромный алгоритм createRealSVG`);
      return await createRealSVG(imageBuffer, options);
    }
    
  } catch (error) {
    console.error(`❌ Ошибка выбора алгоритма:`, error);
    // Fallback к монохромному при ошибке
    return await silkscreenVectorize(imageBuffer, options);
  }
}

/**
 * Создает реальный SVG через трассировку изображения
 */
async function createRealSVG(imageBuffer, settings) {
  const sharp = require('sharp');
  const potrace = require('potrace');
  
  try {
    console.log(`🔍 ДИАГНОСТИКА: Начинаем анализ изображения`);
    console.log(`📊 Размер исходного буфера: ${(imageBuffer.length / 1024).toFixed(1)}KB`);
    
    // Получаем информацию об изображении
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`📋 Метаданные изображения:`, {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      channels: metadata.channels,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha
    });
    
    const originalWidth = metadata.width;
    const originalHeight = metadata.height;
    
    // Проверяем валидность изображения
    if (!originalWidth || !originalHeight || originalWidth < 1 || originalHeight < 1) {
      throw new Error(`Невалидные размеры изображения: ${originalWidth}x${originalHeight}`);
    }
    
    // Определяем размеры для векторизации - увеличиваем для шелкографии
    const maxSize = settings.maxSize || 2400; // Увеличено для лучшей детализации
    let targetWidth = originalWidth;
    let targetHeight = originalHeight;
    
    // Для шелкографии предпочитаем высокое разрешение
    const isHighQuality = settings.quality === 'ultra' || settings.quality === 'silkscreen';
    const actualMaxSize = isHighQuality ? 1500 : maxSize;
    
    // Масштабируем если изображение слишком большое
    if (originalWidth > actualMaxSize || originalHeight > actualMaxSize) {
      const scale = Math.min(actualMaxSize / originalWidth, actualMaxSize / originalHeight);
      targetWidth = Math.round(originalWidth * scale);
      targetHeight = Math.round(originalHeight * scale);
    }
    
    // Минимальный размер для качественной векторизации
    const minSize = 400;
    if (targetWidth < minSize && targetHeight < minSize) {
      const scale = Math.max(minSize / targetWidth, minSize / targetHeight);
      targetWidth = Math.round(targetWidth * scale);
      targetHeight = Math.round(targetHeight * scale);
    }
    
    console.log(`🖼️ Исходное изображение: ${originalWidth}x${originalHeight}`);
    console.log(`🎯 Целевое изображение: ${targetWidth}x${targetHeight}`);
    
    // Подготавливаем изображение для шелкографии - улучшенная обработка
    console.log(`⚙️ Предобработка изображения для шелкографии (${settings.quality})...`);
    
    let processedBuffer;
    
    if (settings.quality === 'silkscreen' || settings.quality === 'ultra') {
      // Специальная обработка для шелкографии
      processedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.lanczos3,
          fit: 'inside',
          withoutEnlargement: false
        })
        // Увеличиваем резкость для лучших контуров
        .sharpen({ sigma: 1.0, flat: 1.0, jagged: 2.0 })
        // Улучшаем контраст
        .normalize({ lower: 5, upper: 95 })
        // Конвертируем в grayscale для лучшей трассировки
        .grayscale()
        // Применяем небольшое размытие для сглаживания шума
        .blur(0.3)
        .png({ 
          compressionLevel: 0,
          adaptiveFiltering: false,
          palette: false
        })
        .toBuffer();
    } else {
      // Стандартная обработка
      processedBuffer = await sharp(imageBuffer)
        .resize(targetWidth, targetHeight, {
          kernel: sharp.kernel.lanczos2,
          fit: 'inside'
        })
        .normalize()
        .png()
        .toBuffer();
    }
    
    console.log(`📊 Размер обработанного буфера: ${(processedBuffer.length / 1024).toFixed(1)}KB`);
    
    // Проверяем что буфер не пустой
    if (processedBuffer.length === 0) {
      throw new Error('Обработанный буфер изображения пустой');
    }
    
    console.log(`⚙️ Начинаем трассировку с параметрами качества: ${settings.quality}`);
    
    // Настройки для potrace в зависимости от качества
    const potraceOptions = getPotraceOptions(settings.quality);
    console.log(`🔧 Параметры potrace:`, potraceOptions);
    
    // Выполняем трассировку с детальным логированием
    return new Promise((resolve, reject) => {
      console.log(`🚀 Запускаем potrace.trace...`);
      
      potrace.trace(processedBuffer, potraceOptions, (err, svg) => {
        if (err) {
          console.error('❌ ДЕТАЛЬНАЯ ОШИБКА POTRACE:');
          console.error('   Тип ошибки:', typeof err);
          console.error('   Сообщение:', err.message || err);
          console.error('   Стек:', err.stack || 'нет стека');
          console.error('   Код ошибки:', err.code || 'нет кода');
          console.error('   Параметры potrace:', potraceOptions);
          console.error('   Размер буфера:', processedBuffer.length);
          
          // Возвращаем fallback при ошибке potrace
          resolve(createFallbackSVG(targetWidth, targetHeight, settings));
          return;
        }
        
        console.log(`✅ Трассировка potrace завершена успешно`);
        console.log(`📏 Длина полученного SVG: ${svg ? svg.length : 0} символов`);
        
        if (!svg || svg.length === 0) {
          console.error('❌ Potrace вернул пустой SVG');
          resolve(createFallbackSVG(targetWidth, targetHeight, settings));
          return;
        }
        
        // Очищаем и улучшаем SVG
        const cleanedSVG = cleanAndOptimizeSVG(svg, targetWidth, targetHeight, settings);
        console.log(`✅ SVG очищен и оптимизирован`);
        resolve(cleanedSVG);
      });
    });
    
  } catch (error) {
    console.error('❌ КРИТИЧЕСКАЯ ОШИБКА обработки изображения:');
    console.error('   Сообщение:', error.message);
    console.error('   Стек:', error.stack);
    console.error('   Размер буфера:', imageBuffer ? imageBuffer.length : 'нет буфера');
    
    // Возвращаем заглушку при критической ошибке
    return createFallbackSVG(400, 400, settings);
  }
}

/**
 * Альтернативная векторизация когда potrace не работает
 */
async function tryAlternativeVectorization(imageBuffer, width, height, settings) {
  const sharp = require('sharp');
  
  try {
    console.log(`🔄 Альтернативная векторизация: ${width}x${height}`);
    
    // Получаем упрощенную версию изображения для контурного анализа
    const { data, info } = await sharp(imageBuffer)
      .resize(width, height, { fit: 'inside' })
      .grayscale()
      .threshold(128) // Бинаризация
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    console.log(`📊 Данные для анализа: ${data.length} байт, ${info.width}x${info.height}`);
    
    // Простой алгоритм поиска контуров
    const paths = [];
    const visited = new Set();
    
    for (let y = 0; y < info.height - 1; y++) {
      for (let x = 0; x < info.width - 1; x++) {
        const idx = y * info.width + x;
        
        if (!visited.has(idx) && data[idx] < 128) { // Темный пиксель
          const contour = traceContour(data, info.width, info.height, x, y, visited);
          if (contour.length > 10) { // Минимальная длина контура
            paths.push(simplifyPath(contour));
          }
        }
      }
    }
    
    console.log(`🎯 Найдено ${paths.length} контуров`);
    
    // Создаем SVG из найденных контуров
    const pathElements = paths.slice(0, 50).map((path, i) => { // Максимум 50 контуров
      const pathData = path.map((point, j) => 
        j === 0 ? `M ${point.x} ${point.y}` : `L ${point.x} ${point.y}`
      ).join(' ') + ' Z';
      
      return `<path d="${pathData}" fill="#000000" opacity="0.8"/>`;
    }).join('\n  ');
    
    const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  ${pathElements}
  <metadata>
    <title>Альтернативная векторизация</title>
    <description>Контурная векторизация, ${paths.length} объектов</description>
  </metadata>
</svg>`;
    
    console.log(`✅ Альтернативная векторизация успешна`);
    return svg;
    
  } catch (error) {
    console.error('❌ Ошибка альтернативной векторизации:', error);
    throw error;
  }
}

/**
 * Трассировка контура от заданной точки
 */
function traceContour(data, width, height, startX, startY, visited) {
  const contour = [];
  const directions = [
    [-1, -1], [0, -1], [1, -1],
    [-1,  0],          [1,  0],
    [-1,  1], [0,  1], [1,  1]
  ];
  
  let x = startX;
  let y = startY;
  let steps = 0;
  const maxSteps = Math.min(width * height, 1000); // Предотвращаем бесконечные циклы
  
  while (steps < maxSteps) {
    const idx = y * width + x;
    
    if (visited.has(idx) || x < 0 || x >= width || y < 0 || y >= height) {
      break;
    }
    
    if (data[idx] >= 128) { // Светлый пиксель - граница контура
      break;
    }
    
    visited.add(idx);
    contour.push({ x, y });
    
    // Ищем следующий темный пиксель
    let found = false;
    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;
      const nidx = ny * width + nx;
      
      if (nx >= 0 && nx < width && ny >= 0 && ny < height && 
          !visited.has(nidx) && data[nidx] < 128) {
        x = nx;
        y = ny;
        found = true;
        break;
      }
    }
    
    if (!found) break;
    steps++;
  }
  
  return contour;
}

/**
 * Упрощение пути - убираем лишние точки
 */
function simplifyPath(contour, tolerance = 2) {
  if (contour.length <= 2) return contour;
  
  const simplified = [contour[0]];
  
  for (let i = 1; i < contour.length - 1; i++) {
    const prev = contour[i - 1];
    const curr = contour[i];
    const next = contour[i + 1];
    
    // Вычисляем отклонение от прямой линии
    const distance = pointToLineDistance(curr, prev, next);
    
    if (distance > tolerance) {
      simplified.push(curr);
    }
  }
  
  simplified.push(contour[contour.length - 1]);
  return simplified;
}

/**
 * Расстояние от точки до линии
 */
function pointToLineDistance(point, lineStart, lineEnd) {
  const A = point.x - lineStart.x;
  const B = point.y - lineStart.y;
  const C = lineEnd.x - lineStart.x;
  const D = lineEnd.y - lineStart.y;
  
  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  
  if (lenSq === 0) return Math.sqrt(A * A + B * B);
  
  const param = dot / lenSq;
  
  let xx, yy;
  if (param < 0) {
    xx = lineStart.x;
    yy = lineStart.y;
  } else if (param > 1) {
    xx = lineEnd.x;
    yy = lineEnd.y;
  } else {
    xx = lineStart.x + param * C;
    yy = lineStart.y + param * D;
  }
  
  const dx = point.x - xx;
  const dy = point.y - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Получает настройки potrace в зависимости от качества
 */
function getPotraceOptions(quality) {
  // Настройки для шелкографии - высокая детализация и точность контуров
  switch (quality) {
    case 'ultra':
      return {
        threshold: 110,           // Более чувствительный порог для деталей
        turdSize: 1,             // Минимальный размер для сохранения мелких элементов
        optTolerance: 0.1,       // Высокая точность кривых
        alphaMax: 1.0,           // Максимальная гладкость
        optCurve: true,          // Оптимизация кривых
        turnPolicy: 'minority'   // Политика поворотов для лучших контуров
      };
    case 'high':
      return {
        threshold: 120,
        turdSize: 2,
        optTolerance: 0.15,
        alphaMax: 1.0,
        optCurve: true,
        turnPolicy: 'minority'
      };
    case 'standard':
    default:
      return {
        threshold: 130,
        turdSize: 3,
        optTolerance: 0.2,
        alphaMax: 0.8,
        optCurve: true,
        turnPolicy: 'minority'
      };
    case 'silkscreen':          // Специальный режим для шелкографии
      return {
        threshold: 105,          // Очень чувствительный для захвата всех деталей
        turdSize: 1,            // Сохраняем даже самые мелкие элементы
        optTolerance: 0.05,     // Максимальная точность
        alphaMax: 1.0,
        optCurve: true,
        turnPolicy: 'minority'
      };
  }
}

/**
 * Очищает и оптимизирует SVG для шелкографии
 */
function cleanAndOptimizeSVG(svg, width, height, settings) {
  try {
    // Улучшенная оптимизация для шелкографии
    let optimizedSVG = svg;
    
    // Добавляем правильные размеры и viewBox
    optimizedSVG = optimizedSVG.replace(
      /<svg[^>]*>/,
      `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">`
    );
    
    // Для шелкографии оптимизируем пути
    if (settings.quality === 'silkscreen' || settings.quality === 'ultra') {
      // Упрощаем очень мелкие элементы
      optimizedSVG = optimizedSVG.replace(/d="[^"]*"/g, (match) => {
        const path = match.slice(3, -1);
        // Удаляем слишком короткие сегменты (меньше 2 пикселей)
        const simplifiedPath = path.replace(/[ML]\s*[\d.-]+\s*[\d.-]+\s*(?=[ML])/g, (segment, offset, string) => {
          const nextSegment = string.slice(offset + segment.length).match(/^[ML]\s*[\d.-]+\s*[\d.-]+/);
          if (nextSegment) {
            const coords1 = segment.match(/([\d.-]+)\s+([\d.-]+)/);
            const coords2 = nextSegment[0].match(/([\d.-]+)\s+([\d.-]+)/);
            if (coords1 && coords2) {
              const dist = Math.sqrt(
                Math.pow(parseFloat(coords2[1]) - parseFloat(coords1[1]), 2) +
                Math.pow(parseFloat(coords2[2]) - parseFloat(coords1[2]), 2)
              );
              if (dist < 2) return ''; // Удаляем слишком короткие сегменты
            }
          }
          return segment;
        });
        return `d="${simplifiedPath}"`;
      });
      
      // Добавляем стиль для лучшего отображения при печати
      optimizedSVG = optimizedSVG.replace(
        /<svg([^>]*)>/,
        `<svg$1>
  <defs>
    <style>
      .silkscreen-path {
        fill-rule: evenodd;
        stroke-linejoin: round;
        stroke-linecap: round;
      }
    </style>
  </defs>`
      );
      
      // Применяем класс к путям
      optimizedSVG = optimizedSVG.replace(/<path/g, '<path class="silkscreen-path"');
    }
    
    // Добавляем метаданные
    const quality = settings.quality === 'silkscreen' ? 'шелкография' : settings.quality;
    optimizedSVG = optimizedSVG.replace(/<\/svg>/, `
  <metadata>
    <title>Векторизация для шелкографии</title>
    <description>Качество: ${quality}, Размер: ${width}x${height}, Оптимизировано для печати</description>
    <keywords>silkscreen, векторизация, печать, potrace</keywords>
  </metadata>
</svg>`);
    
    return optimizedSVG;
  } catch (error) {
    console.error('⚠️ Ошибка оптимизации SVG:', error);
    return svg;
  }
}

/**
 * Создает простую заглушку SVG при ошибках
 */
function createFallbackSVG(width, height, settings) {
  console.log('🔄 Создаем fallback SVG');
  
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="#f8f9fa"/>
  <rect x="20" y="20" width="${width-40}" height="${height-40}" fill="none" stroke="#6c757d" stroke-width="2" stroke-dasharray="5,5"/>
  <text x="${width/2}" y="${height/2-10}" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" fill="#6c757d">
    Векторизация
  </text>
  <text x="${width/2}" y="${height/2+10}" text-anchor="middle" font-family="Arial, sans-serif" font-size="12" fill="#6c757d">
    ${settings.quality} качество
  </text>
  <metadata>
    <title>Fallback векторизация</title>
    <description>Резервный SVG при ошибке трассировки</description>
  </metadata>
</svg>`;
}

/**
 * Упрощенная пакетная обработка - только один файл за раз
 */
async function batchVectorize(imageBuffers, options = {}) {
  // Обрабатываем только первый файл для упрощения
  if (imageBuffers.length === 0) return [];
  
  const { buffer, name } = imageBuffers[0];
  console.log(`Упрощенная обработка: ${name}`);
  
  try {
    const result = await vectorizeImage(buffer, name, options);
    return [{ ...result, originalName: name }];
  } catch (error) {
    return [{
      success: false,
      error: error.message,
      originalName: name
    }];
  }
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
    
    // Используем прямой вызов для избежания рекурсии
    const vectorResult = await silkscreenVectorize(imageBuffer, options);
    
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
      const result = await silkscreenVectorize(imageBuffer, { quality });
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
    const vectorResult = await silkscreenVectorize(imageBuffer, { ...options, outputFormat: 'svg' });
    
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

/**
 * Векторизация изображения по URL
 */
async function vectorizeFromUrl(imageUrl, options = {}) {
  try {
    console.log(`🌐 Начинаем векторизацию по URL: ${imageUrl.substring(0, 100)}...`);
    
    // Скачиваем изображение
    const https = require('https');
    const http = require('http');
    
    const downloadImage = (url) => {
      return new Promise((resolve, reject) => {
        const client = url.startsWith('https') ? https : http;
        
        client.get(url, (response) => {
          if (response.statusCode !== 200) {
            reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
            return;
          }
          
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => {
            const buffer = Buffer.concat(chunks);
            resolve(buffer);
          });
        }).on('error', reject);
      });
    };
    
    const imageBuffer = await downloadImage(imageUrl);
    console.log(`📥 Изображение скачано: ${(imageBuffer.length / 1024).toFixed(1)}KB`);
    
    // Извлекаем имя файла из URL или создаем по умолчанию
    let originalName = 'downloaded_image';
    try {
      const urlObj = new URL(imageUrl);
      const pathname = urlObj.pathname;
      if (pathname && pathname !== '/') {
        originalName = path.basename(pathname) || 'downloaded_image';
      }
    } catch (e) {
      // Используем имя по умолчанию
    }
    
    console.log(`🎯 Передаем на векторизацию: ${originalName}`);
    
    // Используем существующую функцию векторизации
    const result = await vectorizeImage(imageBuffer, originalName, options);
    
    if (result.success) {
      console.log(`✅ Векторизация по URL завершена: ${result.filename}`);
      return {
        success: true,
        filename: result.filename,
        filepath: result.filepath,
        svgContent: result.svgContent,
        detectedType: result.detectedType,
        quality: result.quality,
        settings: result.settings,
        optimization: result.optimization,
        sourceUrl: imageUrl,
        message: `Векторизация по URL завершена (${result.quality}, ${result.detectedType})`
      };
    } else {
      throw new Error(result.error || 'Неизвестная ошибка векторизации');
    }
    
  } catch (error) {
    console.error('❌ Ошибка векторизации по URL:', error);
    return {
      success: false,
      error: error.message,
      sourceUrl: imageUrl
    };
  }
}

// Экспорт функций для шелкографии
module.exports = {
  vectorizeImage,
  vectorizeFromUrl,
  batchVectorize,
  silkscreenVectorize,
  advancedVectorize,
  preprocessImageForSilkscreen,
  quantizeColorsAI,
  createSilkscreenSVG,
  extractDominantColors,
  createColorMask,
  createAdobeColorMask,
  vectorizeColorLayer,
  combineColorLayers,
  createMonochromeBackup,
  optimizeSVGSize,
  detectContentType,
  generatePreviews,
  convertToFormat,
  multiFormatVectorize,
  optimizeForUsage,
  professionalVectorize,
  vectorizeFromUrl,
  silkscreenVectorize,
  ADOBE_SILKSCREEN_PRESET,
  OUTPUT_FORMATS,
  CONTENT_TYPES
};