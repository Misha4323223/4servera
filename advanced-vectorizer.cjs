/**
 * Упрощенный векторизатор - базовая конвертация изображений в SVG
 * Минимальная функциональность для снижения нагрузки на Event Loop
 */

// Только необходимые зависимости
const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

// Единственная настройка для шелкографии (максимум 5 цветов, до 20МБ)
const SILKSCREEN_PRESET = {
  name: 'Шелкография',
  description: 'Оптимизировано для печати, максимум 5 цветов',
  settings: {
    maxSize: 1500,
    maxColors: 5,
    threshold: 105,
    turdSize: 1,
    turnPolicy: 'black',
    optTolerance: 0.05,
    alphaMax: 1.0,
    optiCurve: true,
    preprocess: true
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
 * Упрощенное определение типа контента без тяжелых библиотек
 */
function detectContentType(imageBuffer) {
  // Простое определение на основе размера файла
  const size = imageBuffer.length;
  if (size < 50000) return 'simple';
  return 'simple'; // Всегда возвращаем простой тип
}

/**
 * Векторизация для шелкографии - единственный режим
 */
async function silkscreenVectorize(imageBuffer, options = {}) {
  const { outputFormat = 'svg', maxFileSize = 20 * 1024 * 1024 } = options;
  
  try {
    console.log(`🎨 Векторизация для шелкографии (макс. 5 цветов, до 20МБ)`);
    
    const settings = { ...SILKSCREEN_PRESET.settings };
    
    // Предобработка для шелкографии
    const processedBuffer = await preprocessImageForSilkscreen(imageBuffer, settings);
    
    // Квантизация цветов до максимум 5
    const colorQuantizedBuffer = await quantizeColorsAI(processedBuffer, settings.maxColors);
    
    // Векторизация с оптимальными параметрами для печати
    const svgContent = await createSilkscreenSVG(colorQuantizedBuffer, settings);
    
    // Проверка размера файла (ограничение 20МБ)
    const svgSize = Buffer.byteLength(svgContent, 'utf8');
    if (svgSize > maxFileSize) {
      console.log(`⚠️ Файл слишком большой (${(svgSize / 1024 / 1024).toFixed(2)}МБ), оптимизация...`);
      const optimizedSVG = await optimizeSVGSize(svgContent, maxFileSize);
      return {
        success: true,
        svgContent: optimizedSVG,
        settings,
        quality: SILKSCREEN_PRESET.name,
        fileSize: Buffer.byteLength(optimizedSVG, 'utf8'),
        optimized: true,
        silkscreenMode: true
      };
    }
    
    return {
      success: true,
      svgContent,
      settings,
      quality: SILKSCREEN_PRESET.name,
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
    
    // Создаем отдельный слой для каждого цвета
    const colorLayers = [];
    
    for (let i = 0; i < dominantColors.length; i++) {
      const color = dominantColors[i];
      console.log(`\n🔍 ЭТАП 3.${i + 1}: Обрабатываем цвет ${color.hex} (${color.percentage}%)`);
      
      // Создаем маску для этого цвета
      const colorMask = await createColorMask(imageBuffer, color, settings);
      
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
    console.log(`🔍 ЭТАП 1: Анализ исходного изображения для извлечения ${maxColors} доминирующих цветов`);
    
    // Работаем с исходным изображением, уменьшенным для анализа
    const { data, info } = await sharp(imageBuffer)
      .resize(100, 100, { fit: 'inside' })
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    console.log(`📊 Анализируем изображение ${info.width}x${info.height}, каналов: ${info.channels}`);
    
    const colorMap = new Map();
    let totalPixels = 0;
    
    // Собираем ВСЕ цвета без агрессивной фильтрации
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Пропускаем только полностью прозрачные пиксели
      if (info.channels === 4 && data[i + 3] < 10) continue;
      
      // Легкая квантизация для группировки похожих цветов (менее агрессивная)
      const quantR = Math.round(r / 16) * 16;
      const quantG = Math.round(g / 16) * 16;
      const quantB = Math.round(b / 16) * 16;
      
      const colorKey = `${quantR},${quantG},${quantB}`;
      const count = colorMap.get(colorKey) || 0;
      colorMap.set(colorKey, count + 1);
      totalPixels++;
    }
    
    console.log(`🎨 Найдено уникальных цветов: ${colorMap.size}, всего пикселей: ${totalPixels}`);
    
    // Сортируем цвета по частоте и берем топ
    const sortedColors = Array.from(colorMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors)
      .map(([colorKey, count]) => {
        const [r, g, b] = colorKey.split(',').map(Number);
        const percentage = ((count / totalPixels) * 100).toFixed(1);
        return {
          r, g, b,
          hex: `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`,
          count,
          percentage
        };
      });
    
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
    
    // Адаптивный допуск на основе распространенности цвета
    const baseTolerance = 50;
    const adaptiveTolerance = Math.min(80, baseTolerance + (parseFloat(targetColor.percentage) * 2));
    
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
      
      // Используем квантизованное сравнение (как при извлечении цветов)
      const quantR = Math.round(r / 16) * 16;
      const quantG = Math.round(g / 16) * 16;
      const quantB = Math.round(b / 16) * 16;
      
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
    
    // Проверяем минимальное покрытие
    const minCoverageThreshold = Math.max(0.5, parseFloat(targetColor.percentage) * 0.3);
    if (parseFloat(coveragePercent) < minCoverageThreshold) {
      console.log(`⚠️ ЭТАП 2: Недостаточное покрытие для ${targetColor.hex} (${coveragePercent}% < ${minCoverageThreshold}%), пропускаем`);
      return null;
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
    const potraceParams = {
      threshold: 128,
      turdSize: settings.turdSize || 1,
      turnPolicy: settings.turnPolicy || 'black',
      alphaMax: settings.alphaMax || 1.0,
      optCurve: settings.optiCurve !== false,
      optTolerance: settings.optTolerance || 0.05
    };
    
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
  <title>Шелкография (${colorLayers.length} цветов)</title>
  <desc>Векторизация с сохранением цветов для печати</desc>
`;
    
    let totalPaths = 0;
    
    // Добавляем каждый цветной слой с детальным логированием
    colorLayers.forEach((layer, index) => {
      const layerNumber = index + 1;
      console.log(`🎨 ЭТАП 4.${layerNumber}: Добавляем слой для цвета ${layer.color}`);
      console.log(`   - Путей в слое: ${layer.paths.length}`);
      console.log(`   - Исходное покрытие: ${layer.originalPercentage}%`);
      
      svgContent += `  <g id="color-layer-${layerNumber}" fill="${layer.color}" stroke="none">\n`;
      
      let validPaths = 0;
      layer.paths.forEach((path, pathIndex) => {
        if (path && path.trim() && path.length > 10) { // Фильтруем слишком короткие пути
          svgContent += `    <path d="${path}" />\n`;
          validPaths++;
          totalPaths++;
        }
      });
      
      svgContent += `  </g>\n`;
      
      console.log(`✅ ЭТАП 4.${layerNumber}: Добавлено ${validPaths} валидных путей для ${layer.color}`);
    });
    
    svgContent += `</svg>`;
    
    console.log(`📊 ЭТАП 4: Итоговая статистика SVG:`);
    console.log(`   - Всего слоев: ${colorLayers.length}`);
    console.log(`   - Всего путей: ${totalPaths}`);
    console.log(`   - Размер контента: ${(svgContent.length / 1024).toFixed(1)} КБ`);
    
    if (totalPaths === 0) {
      console.log('❌ ЭТАП 4: Нет валидных путей, создаем резервный SVG');
      return createMonochromeBackup(originalImageBuffer, { threshold: 128 });
    }
    
    console.log(`✅ ЭТАП 4 ЗАВЕРШЕН: Многослойный SVG создан успешно`);
    return svgContent;
    
  } catch (error) {
    console.error('❌ ЭТАП 4 ОШИБКА - Объединение слоев:', error);
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
 * Автоматическое определение оптимального порога как в Adobe Illustrator
 */
async function calculateOptimalThreshold(data, info) {
  // Простой алгоритм Otsu для автоматического определения порога
  const histogram = new Array(256).fill(0);
  
  // Подсчет гистограммы
  for (let i = 0; i < data.length; i += info.channels) {
    const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
    histogram[gray]++;
  }
  
  const total = data.length / info.channels;
  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }
  
  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let varMax = 0;
  let threshold = 0;
  
  for (let i = 0; i < 256; i++) {
    wB += histogram[i];
    if (wB === 0) continue;
    
    wF = total - wB;
    if (wF === 0) break;
    
    sumB += i * histogram[i];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const varBetween = wB * wF * (mB - mF) * (mB - mF);
    
    if (varBetween > varMax) {
      varMax = varBetween;
      threshold = i;
    }
  }
  
  console.log(`🎯 Автоматический порог (Otsu): ${threshold}`);
  return threshold;
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
      console.log(`🎨 ВЫБРАН: Цветной алгоритм createColoredSVG`);
      return await createColoredSVG(imageBuffer, options);
    } else {
      console.log(`⚫ ВЫБРАН: Монохромный алгоритм silkscreenVectorize`);
      return await silkscreenVectorize(imageBuffer, options);
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
    const maxSize = settings.maxSize || 1200; // Увеличено для лучшей детализации
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
  SILKSCREEN_PRESET,
  OUTPUT_FORMATS,
  CONTENT_TYPES
};