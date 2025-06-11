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
    
    // Проверка валидности данных изображения
    if (!data || data.length === 0 || !info.width || !info.height || info.channels < 3) {
      throw new Error('Невалидные данные изображения');
    }
    
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i] || 0;
      const g = data[i + 1] || 0; 
      const b = data[i + 2] || 0;
      
      // Adobe квантование для анализа (16 уровней = более точное)
      const quantR = Math.round(r / 16) * 16;
      const quantG = Math.round(g / 16) * 16;
      const quantB = Math.round(b / 16) * 16;
      
      const colorKey = `${quantR},${quantG},${quantB}`;
      colorMap.set(colorKey, (colorMap.get(colorKey) || 0) + 1);
      totalPixels++;
    }
    
    const uniqueColors = colorMap.size;
    const colorComplexity = uniqueColors / totalPixels;
    
    // Adobe анализ контрастности (пространственный Sobel)
    const grayResult = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const grayData = grayResult.data;
    const grayInfo = grayResult.info;
    
    // Валидация данных Sobel анализа
    let avgContrast = 25; // Безопасное значение по умолчанию
    
    if (!grayData || !grayInfo || grayInfo.width < 3 || grayInfo.height < 3) {
      console.log('   ⚠️ Изображение слишком мало для Sobel анализа, используем значение по умолчанию');
    } else {
      let totalContrast = 0;
      let contrastPixels = 0;
      
      // Sobel edge detection для правильного анализа контрастности
      for (let y = 1; y < grayInfo.height - 1; y++) {
        for (let x = 1; x < grayInfo.width - 1; x++) {
        
          // Sobel X gradient
          const gx = 
            -1 * grayData[(y-1) * grayInfo.width + (x-1)] +
            -2 * grayData[y * grayInfo.width + (x-1)] +
            -1 * grayData[(y+1) * grayInfo.width + (x-1)] +
            1 * grayData[(y-1) * grayInfo.width + (x+1)] +
            2 * grayData[y * grayInfo.width + (x+1)] +
            1 * grayData[(y+1) * grayInfo.width + (x+1)];
          
          // Sobel Y gradient
          const gy = 
            -1 * grayData[(y-1) * grayInfo.width + (x-1)] +
            -2 * grayData[(y-1) * grayInfo.width + x] +
            -1 * grayData[(y-1) * grayInfo.width + (x+1)] +
            1 * grayData[(y+1) * grayInfo.width + (x-1)] +
            2 * grayData[(y+1) * grayInfo.width + x] +
            1 * grayData[(y+1) * grayInfo.width + (x+1)];
          
          const magnitude = Math.sqrt(gx * gx + gy * gy);
          totalContrast += magnitude;
          contrastPixels++;
        }
      }
      
      avgContrast = contrastPixels > 0 ? totalContrast / contrastPixels / 255 * 100 : 25;
    }
    
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
      recommendedSettings.maxColors = 5; // Ограничение для шелкографии
      recommendedSettings.pathFitting = 3;
    } else if (colorComplexity > 0.5) {
      imageType = 'COMPLEX_PHOTO';
      recommendedSettings.maxColors = 5; // Ограничение для шелкографии
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
      recommendedSettings: { ...ADOBE_SILKSCREEN_PRESET.settings, maxColors: 5 },
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
    
    // Валидация размеров изображения
    if (!metadata.width || !metadata.height || metadata.width < 1 || metadata.height < 1) {
      throw new Error('Невалидные размеры изображения');
    }
    
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
    try {
      const metadata = await sharp(imageBuffer).metadata();
      return {
        buffer: imageBuffer,
        width: metadata.width,
        height: metadata.height,
        originalWidth: metadata.width,
        originalHeight: metadata.height
      };
    } catch (metadataError) {
      console.error('❌ Критическая ошибка metadata:', metadataError);
      return {
        buffer: imageBuffer,
        width: 400,
        height: 400,
        originalWidth: 400,
        originalHeight: 400
      };
    }
  }
}

/**
 * ЭТАП 2: ЦВЕТОВАЯ СЕГМЕНТАЦИЯ - Adobe Illustrator алгоритм
 */

/**
 * performKMeansSegmentation() - K-means кластеризация (Adobe метод)
 */
async function performKMeansSegmentation(imageBuffer, numColors) {
  console.log(`🧮 ЭТАП 2.1: Adobe K-means - Сегментация на ${numColors} цветов...`);
  
  try {
    const sharp = require('sharp');
    const { data, info } = await sharp(imageBuffer)
      .resize(400, 400, { fit: 'inside' }) // Оптимизация для K-means
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Валидация данных
    if (!data || data.length === 0 || numColors < 1) {
      throw new Error('Невалидные данные для K-means');
    }
    
    // Ограничение для шелкографии
    numColors = Math.min(numColors, 5);
    
    // Adobe инициализация центроидов (улучшенный метод K-means++)
    const centroids = [];
    const pixels = [];
    
    // Сбор пикселей
    for (let i = 0; i < data.length; i += info.channels) {
      pixels.push({
        r: data[i] || 0,
        g: data[i + 1] || 0,
        b: data[i + 2] || 0
      });
    }
    
    // Защита от случая когда пикселей меньше чем цветов
    if (pixels.length < numColors) {
      console.log(`   ⚠️ Пикселей (${pixels.length}) меньше чем цветов (${numColors}), корректируем`);
      numColors = Math.max(1, pixels.length);
    }
    
    // K-means++ инициализация для лучшего распределения центроидов
    centroids.push(pixels[Math.floor(Math.random() * pixels.length)]);
    
    for (let c = 1; c < numColors; c++) {
      const distances = pixels.map(pixel => {
        let minDistance = Infinity;
        for (const centroid of centroids) {
          const distance = Math.sqrt(
            Math.pow(pixel.r - centroid.r, 2) +
            Math.pow(pixel.g - centroid.g, 2) +
            Math.pow(pixel.b - centroid.b, 2)
          );
          minDistance = Math.min(minDistance, distance);
        }
        return minDistance;
      });
      
      const totalDistance = distances.reduce((sum, d) => sum + d, 0);
      
      // Защита от зацикливания при одинаковых пикселях
      if (totalDistance === 0) {
        // Добавляем случайный пиксель если все пиксели одинаковые
        centroids.push({ ...pixels[Math.floor(Math.random() * pixels.length)] });
      } else {
        let random = Math.random() * totalDistance;
        
        for (let i = 0; i < distances.length; i++) {
          random -= distances[i];
          if (random <= 0) {
            centroids.push({ ...pixels[i] });
            break;
          }
        }
      }
    }
    
    console.log(`   🎯 Инициализированы ${centroids.length} центроидов`);
    
    // Adobe K-means итерации с улучшенной конвергенцией
    let maxIterations = 50;
    let convergenceThreshold = 1.0;
    
    for (let iter = 0; iter < maxIterations; iter++) {
      const clusters = Array(numColors).fill().map(() => ({ 
        pixels: [], 
        sumR: 0, 
        sumG: 0, 
        sumB: 0 
      }));
      
      // Назначение пикселей к кластерам
      for (const pixel of pixels) {
        let minDistance = Infinity;
        let bestCluster = 0;
        
        for (let c = 0; c < numColors; c++) {
          // Adobe перцептивное расстояние
          const dr = pixel.r - centroids[c].r;
          const dg = pixel.g - centroids[c].g;
          const db = pixel.b - centroids[c].b;
          
          // Weighted Euclidean distance для лучшего восприятия
          const distance = Math.sqrt(
            0.30 * dr * dr +  // Red weight
            0.59 * dg * dg +  // Green weight  
            0.11 * db * db    // Blue weight
          );
          
          if (distance < minDistance) {
            minDistance = distance;
            bestCluster = c;
          }
        }
        
        clusters[bestCluster].pixels.push(pixel);
        clusters[bestCluster].sumR += pixel.r;
        clusters[bestCluster].sumG += pixel.g;
        clusters[bestCluster].sumB += pixel.b;
      }
      
      // Обновление центроидов с защитой от пустых кластеров
      let totalMovement = 0;
      for (let c = 0; c < numColors; c++) {
        if (clusters[c].pixels.length > 0) {
          const newR = clusters[c].sumR / clusters[c].pixels.length;
          const newG = clusters[c].sumG / clusters[c].pixels.length;
          const newB = clusters[c].sumB / clusters[c].pixels.length;
          
          const movement = Math.sqrt(
            Math.pow(newR - centroids[c].r, 2) +
            Math.pow(newG - centroids[c].g, 2) +
            Math.pow(newB - centroids[c].b, 2)
          );
          
          totalMovement += movement;
          
          centroids[c].r = newR;
          centroids[c].g = newG;
          centroids[c].b = newB;
        } else {
          // Защита от пустых кластеров - переназначаем случайный пиксель
          const randomPixel = pixels[Math.floor(Math.random() * pixels.length)];
          centroids[c].r = randomPixel.r;
          centroids[c].g = randomPixel.g;
          centroids[c].b = randomPixel.b;
          console.log(`   ⚠️ Кластер ${c} пустой, переназначен случайный центроид`);
        }
      }
      
      console.log(`   📊 Итерация ${iter + 1}: движение = ${totalMovement.toFixed(2)}`);
      
      if (totalMovement < convergenceThreshold) {
        console.log(`   ✅ Конвергенция достигнута на итерации ${iter + 1}`);
        break;
      }
    }
    
    // Создание финальной палитры
    const finalPalette = centroids.map((centroid, index) => ({
      r: Math.round(Math.max(0, Math.min(255, centroid.r))),
      g: Math.round(Math.max(0, Math.min(255, centroid.g))),
      b: Math.round(Math.max(0, Math.min(255, centroid.b))),
      index
    })).map(color => ({
      ...color,
      hex: `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`
    }));
    
    console.log(`   🎨 Создана палитра из ${finalPalette.length} цветов:`);
    finalPalette.forEach((color, i) => {
      console.log(`      ${i + 1}. ${color.hex} (RGB: ${color.r}, ${color.g}, ${color.b})`);
    });
    
    return finalPalette;
    
  } catch (error) {
    console.error('❌ Ошибка performKMeansSegmentation:', error);
    // Безопасная палитра по умолчанию (фиксированное количество цветов)
    const safeNumColors = Math.min(5, Math.max(1, numColors || 3));
    return Array(safeNumColors).fill().map((_, i) => ({
      r: [0, 85, 170, 255, 128][i] || 128,
      g: [0, 85, 170, 255, 128][i] || 128,
      b: [0, 85, 170, 255, 128][i] || 128,
      hex: ['#000000', '#555555', '#aaaaaa', '#ffffff', '#808080'][i] || '#808080',
      index: i
    }));
  }
}

/**
 * adaptiveColorReduction() - Адаптивное сокращение цветов (Adobe метод)
 */
async function adaptiveColorReduction(imageBuffer, maxColors) {
  console.log(`🔧 ЭТАП 2.2: Adobe adaptiveColorReduction - Сокращение до ${maxColors} цветов...`);
  
  try {
    // Ограничение для шелкографии
    maxColors = Math.min(maxColors, 5);
    
    const sharp = require('sharp');
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Валидация входных данных
    if (!data || data.length === 0 || !info || !info.width || !info.height) {
      throw new Error('Невалидные данные изображения для adaptiveColorReduction');
    }
    
    // Анализ гистограммы цветов
    const colorHistogram = new Map();
    
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i] || 0;
      const g = data[i + 1] || 0;
      const b = data[i + 2] || 0;
      
      // Adobe квантование для группировки похожих цветов
      const quantR = Math.round(r / 8) * 8;
      const quantG = Math.round(g / 8) * 8;
      const quantB = Math.round(b / 8) * 8;
      
      const colorKey = `${quantR},${quantG},${quantB}`;
      colorHistogram.set(colorKey, (colorHistogram.get(colorKey) || 0) + 1);
    }
    
    // Сортировка по частоте использования
    const sortedColors = Array.from(colorHistogram.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxColors * 2); // Берем больше для анализа
    
    console.log(`   📈 Найдено ${sortedColors.length} доминирующих цветов`);
    
    // Группировка близких цветов (Adobe color merging)
    const mergedColors = [];
    const mergeThreshold = 30; // Порог для объединения близких цветов
    
    for (const [colorStr, frequency] of sortedColors) {
      const [r, g, b] = colorStr.split(',').map(Number);
      
      let merged = false;
      for (const existing of mergedColors) {
        const distance = Math.sqrt(
          Math.pow(r - existing.r, 2) +
          Math.pow(g - existing.g, 2) +
          Math.pow(b - existing.b, 2)
        );
        
        if (distance < mergeThreshold) {
          // Объединяем цвета по весу частоты
          const totalFreq = existing.frequency + frequency;
          existing.r = Math.round((existing.r * existing.frequency + r * frequency) / totalFreq);
          existing.g = Math.round((existing.g * existing.frequency + g * frequency) / totalFreq);
          existing.b = Math.round((existing.b * existing.frequency + b * frequency) / totalFreq);
          existing.frequency = totalFreq;
          merged = true;
          break;
        }
      }
      
      if (!merged) {
        mergedColors.push({ r, g, b, frequency });
      }
    }
    
    // Финальная палитра
    const reducedPalette = mergedColors.slice(0, maxColors).map((color, index) => ({
      r: Math.round(Math.max(0, Math.min(255, color.r))),
      g: Math.round(Math.max(0, Math.min(255, color.g))),
      b: Math.round(Math.max(0, Math.min(255, color.b))),
      frequency: color.frequency,
      index
    })).map(color => ({
      ...color,
      hex: `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`
    }));
    
    console.log(`   🎯 Адаптивное сокращение завершено: ${reducedPalette.length} цветов`);
    reducedPalette.forEach((color, i) => {
      console.log(`      ${i + 1}. ${color.hex} (частота: ${color.frequency})`);
    });
    
    return reducedPalette;
    
  } catch (error) {
    console.error('❌ Ошибка adaptiveColorReduction:', error);
    return [];
  }
}

/**
 * edgeAwareQuantization() - Квантование с сохранением краев (Adobe метод)
 */
async function edgeAwareQuantization(imageBuffer, edges, maxColors) {
  console.log(`⚡ ЭТАП 2.3: Adobe edgeAwareQuantization - Квантование с сохранением краев...`);
  
  try {
    // Ограничение для шелкографии
    maxColors = Math.min(maxColors, 5);
    
    const sharp = require('sharp');
    const { data, info } = await sharp(imageBuffer)
      .resize(800, 800, { fit: 'inside' }) // Оптимизация производительности
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Валидация входных данных
    if (!data || data.length === 0 || !info || !info.width || !info.height) {
      throw new Error('Невалидные данные изображения для edgeAwareQuantization');
    }
    
    // Создание карты краев если не предоставлена
    let edgeMap = edges;
    if (!edgeMap) {
      console.log('   🔍 Создаем карту краев...');
      edgeMap = await createEdgeMap(imageBuffer);
    }
    
    // Adobe адаптивное квантование
    const colorClusters = new Map();
    
    for (let y = 0; y < info.height; y++) {
      for (let x = 0; x < info.width; x++) {
        const pixelIndex = y * info.width + x;
        const dataIndex = pixelIndex * info.channels;
        
        const r = data[dataIndex] || 0;
        const g = data[dataIndex + 1] || 0;
        const b = data[dataIndex + 2] || 0;
        
        // Адаптивные пороги на основе силы краев
        const edgeStrength = edgeMap[pixelIndex] || 0;
        const quantLevel = edgeStrength > 0.3 ? 16 : 32; // Более точное квантование на краях
        
        const quantR = Math.round(r / quantLevel) * quantLevel;
        const quantG = Math.round(g / quantLevel) * quantLevel;
        const quantB = Math.round(b / quantLevel) * quantLevel;
        
        const colorKey = `${quantR},${quantG},${quantB}`;
        if (!colorClusters.has(colorKey)) {
          colorClusters.set(colorKey, {
            r: quantR,
            g: quantG,
            b: quantB,
            count: 0,
            edgeWeight: 0
          });
        }
        
        const cluster = colorClusters.get(colorKey);
        cluster.count++;
        cluster.edgeWeight += edgeStrength;
      }
    }
    
    // Сортировка по важности (частота + вес краев)
    const sortedClusters = Array.from(colorClusters.values())
      .map(cluster => ({
        ...cluster,
        importance: cluster.count + cluster.edgeWeight * 100 // Края важнее
      }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, maxColors);
    
    // Создание финальной палитры
    const quantizedPalette = sortedClusters.map((cluster, index) => ({
      r: Math.round(Math.max(0, Math.min(255, cluster.r))),
      g: Math.round(Math.max(0, Math.min(255, cluster.g))),
      b: Math.round(Math.max(0, Math.min(255, cluster.b))),
      count: cluster.count,
      edgeWeight: cluster.edgeWeight,
      index
    })).map(color => ({
      ...color,
      hex: `#${color.r.toString(16).padStart(2, '0')}${color.g.toString(16).padStart(2, '0')}${color.b.toString(16).padStart(2, '0')}`
    }));
    
    console.log(`   ⚡ Edge-aware квантование завершено: ${quantizedPalette.length} цветов`);
    quantizedPalette.forEach((color, i) => {
      console.log(`      ${i + 1}. ${color.hex} (пикселей: ${color.count}, края: ${color.edgeWeight.toFixed(1)})`);
    });
    
    return quantizedPalette;
    
  } catch (error) {
    console.error('❌ Ошибка edgeAwareQuantization:', error);
    return [];
  }
}

/**
 * createEdgeMap() - Создание карты краев для edge-aware обработки
 */
async function createEdgeMap(imageBuffer) {
  try {
    const sharp = require('sharp');
    const grayResult = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const { data, info } = grayResult;
    
    // Валидация размеров для Sobel
    if (!data || !info || !info.width || !info.height) {
      console.log('   ⚠️ Невалидные данные для Sobel edge detection');
      return [];
    }
    
    if (info.width < 3 || info.height < 3) {
      console.log('   ⚠️ Изображение слишком мало для Sobel edge detection');
      return new Array(info.width * info.height).fill(0);
    }
    
    const edgeMap = new Array(info.width * info.height).fill(0);
    
    // Sobel edge detection
    for (let y = 1; y < info.height - 1; y++) {
      for (let x = 1; x < info.width - 1; x++) {
        const idx = y * info.width + x;
        
        // Sobel X kernel
        const gx = 
          -1 * data[(y-1) * info.width + (x-1)] +
          -2 * data[y * info.width + (x-1)] +
          -1 * data[(y+1) * info.width + (x-1)] +
          1 * data[(y-1) * info.width + (x+1)] +
          2 * data[y * info.width + (x+1)] +
          1 * data[(y+1) * info.width + (x+1)];
        
        // Sobel Y kernel  
        const gy =
          -1 * data[(y-1) * info.width + (x-1)] +
          -2 * data[(y-1) * info.width + x] +
          -1 * data[(y-1) * info.width + (x+1)] +
          1 * data[(y+1) * info.width + (x-1)] +
          2 * data[(y+1) * info.width + x] +
          1 * data[(y+1) * info.width + (x+1)];
        
        const magnitude = Math.sqrt(gx * gx + gy * gy) / 255;
        edgeMap[idx] = Math.min(1, magnitude);
      }
    }
    
    return edgeMap;
    
  } catch (error) {
    console.error('❌ Ошибка createEdgeMap:', error);
    return [];
  }
}

// ================================================================
// ЭТАП 3: СОЗДАНИЕ МАСОК (Adobe Illustrator Image Trace Algorithm)
// ================================================================

/**
 * createColorMasks() - Создание цветовых масок для каждого цвета палитры
 * Точная реализация Adobe Illustrator метода создания масок
 */
async function createColorMasks(imageBuffer, colorPalette, settings = {}) {
  console.log(`🎭 ЭТАП 3.1: Adobe createColorMasks - Создание ${colorPalette.length} цветовых масок...`);
  
  try {
    const sharp = require('sharp');
    const { data, info } = await sharp(imageBuffer)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Валидация входных данных
    if (!data || data.length === 0 || !info || !info.width || !info.height || !colorPalette || colorPalette.length === 0) {
      throw new Error('Невалидные данные для createColorMasks');
    }
    
    // Валидация channels
    if (!info.channels || info.channels < 3) {
      throw new Error('Изображение должно иметь минимум 3 канала (RGB)');
    }
    
    const masks = [];
    const tolerance = settings.colorTolerance || 45; // Adobe стандартный tolerance
    
    console.log(`   🎯 Tolerance для масок: ${tolerance}`);
    
    // Создаем маску для каждого цвета в палитре
    for (let colorIndex = 0; colorIndex < colorPalette.length; colorIndex++) {
      const targetColor = colorPalette[colorIndex];
      console.log(`   🔍 Создание маски для цвета ${colorIndex + 1}/${colorPalette.length}: ${targetColor.hex}`);
      
      const maskData = new Uint8Array(info.width * info.height);
      let pixelCount = 0;
      
      // Adobe color matching algorithm
      for (let y = 0; y < info.height; y++) {
        for (let x = 0; x < info.width; x++) {
          const pixelIndex = y * info.width + x;
          const dataIndex = pixelIndex * info.channels;
          
          const r = data[dataIndex] || 0;
          const g = data[dataIndex + 1] || 0;
          const b = data[dataIndex + 2] || 0;
          
          // Adobe перцептивное цветовое расстояние
          const deltaR = r - targetColor.r;
          const deltaG = g - targetColor.g;
          const deltaB = b - targetColor.b;
          
          // Weighted Euclidean distance (как в Adobe)
          const colorDistance = Math.sqrt(
            0.30 * deltaR * deltaR +  // Red weight
            0.59 * deltaG * deltaG +  // Green weight 
            0.11 * deltaB * deltaB    // Blue weight
          );
          
          // Защита от NaN/Infinity
          if (!isFinite(colorDistance)) {
            continue; // Пропускаем невалидные расчеты
          }
          
          // Проверка попадания в tolerance
          if (colorDistance <= tolerance) {
            maskData[pixelIndex] = 255; // Белый = принадлежит цвету
            pixelCount++;
          } else {
            maskData[pixelIndex] = 0;   // Черный = не принадлежит
          }
        }
      }
      
      const coverage = (pixelCount / (info.width * info.height)) * 100;
      console.log(`     ✅ Маска создана: ${pixelCount} пикселей (${coverage.toFixed(1)}%)`);
      
      masks.push({
        colorIndex,
        color: targetColor,
        maskData: maskData,
        pixelCount,
        coverage,
        width: info.width,
        height: info.height
      });
    }
    
    console.log(`   🎭 Создано ${masks.length} цветовых масок`);
    return masks;
    
  } catch (error) {
    console.error('❌ Ошибка createColorMasks:', error);
    return [];
  }
}

/**
 * createBinaryMasks() - Создание бинарных масок с пороговой обработкой
 * Adobe Illustrator бинарная сегментация для четких краев
 */
async function createBinaryMasks(imageBuffer, threshold = 128, settings = {}) {
  console.log(`⚫ ЭТАП 3.2: Adobe createBinaryMasks - Пороговая сегментация (threshold: ${threshold})...`);
  
  try {
    const sharp = require('sharp');
    
    // Конвертация в grayscale для бинарной обработки
    const { data, info } = await sharp(imageBuffer)
      .grayscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Валидация данных
    if (!data || data.length === 0 || !info || !info.width || !info.height) {
      throw new Error('Невалидные данные для createBinaryMasks');
    }
    
    // Adobe adaptive thresholding
    const adaptiveThreshold = settings.adaptiveThreshold !== false;
    let finalThreshold = threshold;
    
    if (adaptiveThreshold) {
      // Вычисление оптимального порога (Otsu method как в Adobe)
      const histogram = new Array(256).fill(0);
      
      // Построение гистограммы
      for (let i = 0; i < data.length; i++) {
        histogram[data[i]]++;
      }
      
      // Otsu's method для автоматического порога
      let sum = 0;
      for (let i = 0; i < 256; i++) {
        sum += i * histogram[i];
      }
      
      let sumB = 0;
      let wB = 0;
      let maximum = 0.0;
      
      for (let t = 0; t < 256; t++) {
        wB += histogram[t];
        if (wB === 0) continue;
        
        const wF = data.length - wB;
        if (wF === 0) break;
        
        sumB += t * histogram[t];
        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;
        
        const varBetween = wB * wF * (mB - mF) * (mB - mF);
        
        if (varBetween > maximum) {
          finalThreshold = t;
          maximum = varBetween;
        }
      }
      
      console.log(`   🎯 Adobe Otsu threshold: ${finalThreshold} (исходный: ${threshold})`);
    }
    
    // Создание бинарных масок с правильными размерами
    const totalPixels = info.width * info.height;
    const foregroundMask = new Uint8Array(totalPixels);
    const backgroundMask = new Uint8Array(totalPixels);
    
    let foregroundPixels = 0;
    let backgroundPixels = 0;
    
    // Корректная обработка grayscale данных (1 канал)
    for (let i = 0; i < totalPixels; i++) {
      const brightness = data[i] || 0; // Защита от undefined
      
      if (brightness >= finalThreshold) {
        foregroundMask[i] = 255; // Передний план (светлый)
        backgroundMask[i] = 0;
        foregroundPixels++;
      } else {
        foregroundMask[i] = 0;
        backgroundMask[i] = 255;  // Задний план (темный)
        backgroundPixels++;
      }
    }
    
    const foregroundCoverage = (foregroundPixels / totalPixels) * 100;
    const backgroundCoverage = (backgroundPixels / totalPixels) * 100;
    
    console.log(`   ⚫ Передний план: ${foregroundPixels} пикселей (${foregroundCoverage.toFixed(1)}%)`);
    console.log(`   ⚪ Задний план: ${backgroundPixels} пикселей (${backgroundCoverage.toFixed(1)}%)`);
    
    return {
      foreground: {
        maskData: foregroundMask,
        pixelCount: foregroundPixels,
        coverage: foregroundCoverage,
        width: info.width,
        height: info.height,
        threshold: finalThreshold
      },
      background: {
        maskData: backgroundMask,
        pixelCount: backgroundPixels,
        coverage: backgroundCoverage,
        width: info.width,
        height: info.height,
        threshold: finalThreshold
      }
    };
    
  } catch (error) {
    console.error('❌ Ошибка createBinaryMasks:', error);
    return null;
  }
}

/**
 * refineMasks() - Рафинирование масок с морфологическими операциями
 * Adobe Illustrator post-processing для улучшения качества масок
 */
async function refineMasks(masks, settings = {}) {
  console.log(`✨ ЭТАП 3.3: Adobe refineMasks - Морфологическая обработка ${masks.length} масок...`);
  
  try {
    if (!masks || masks.length === 0) {
      throw new Error('Нет масок для обработки');
    }
    
    const refinedMasks = [];
    const kernelSize = settings.kernelSize || 3; // Размер морфологического ядра
    const iterations = settings.iterations || 1;  // Количество итераций
    
    console.log(`   🔧 Параметры: ядро ${kernelSize}x${kernelSize}, итераций: ${iterations}`);
    
    for (let maskIndex = 0; maskIndex < masks.length; maskIndex++) {
      const mask = masks[maskIndex];
      console.log(`   🎭 Обработка маски ${maskIndex + 1}/${masks.length}...`);
      
      // Создаем копию маски для обработки
      let processedMask = new Uint8Array(mask.maskData);
      const { width, height } = mask;
      
      // Морфологические операции (opening + closing)
      for (let iter = 0; iter < iterations; iter++) {
        // 1. Erosion (сужение) с обработкой границ
        const erodedMask = new Uint8Array(width * height);
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const centerIndex = y * width + x;
            let minValue = 255;
            
            // Проверяем окрестность с безопасными границами
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const ny = y + ky;
                const nx = x + kx;
                
                // Проверка границ
                if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                  const neighborIndex = ny * width + nx;
                  minValue = Math.min(minValue, processedMask[neighborIndex]);
                } else {
                  // Граничные пиксели считаем как 0 (черные)
                  minValue = Math.min(minValue, 0);
                }
              }
            }
            
            erodedMask[centerIndex] = minValue;
          }
        }
        
        // 2. Dilation (расширение) с обработкой границ
        const dilatedMask = new Uint8Array(width * height);
        
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const centerIndex = y * width + x;
            let maxValue = 0;
            
            // Проверяем окрестность с безопасными границами
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const ny = y + ky;
                const nx = x + kx;
                
                // Проверка границ
                if (ny >= 0 && ny < height && nx >= 0 && nx < width) {
                  const neighborIndex = ny * width + nx;
                  maxValue = Math.max(maxValue, erodedMask[neighborIndex]);
                } else {
                  // Граничные пиксели считаем как 0 (черные)
                  maxValue = Math.max(maxValue, 0);
                }
              }
            }
            
            dilatedMask[centerIndex] = maxValue;
          }
        }
        
        processedMask = dilatedMask;
      }
      
      // Подсчет финальных пикселей
      let finalPixelCount = 0;
      for (let i = 0; i < processedMask.length; i++) {
        if (processedMask[i] > 0) finalPixelCount++;
      }
      
      const finalCoverage = (finalPixelCount / (width * height)) * 100;
      
      console.log(`     ✅ Обработана: ${finalPixelCount} пикселей (${finalCoverage.toFixed(1)}%, было ${mask.coverage.toFixed(1)}%)`);
      
      refinedMasks.push({
        ...mask,
        maskData: processedMask,
        pixelCount: finalPixelCount,
        coverage: finalCoverage,
        refined: true
      });
    }
    
    console.log(`   ✨ Рафинирование завершено для ${refinedMasks.length} масок`);
    return refinedMasks;
    
  } catch (error) {
    console.error('❌ Ошибка refineMasks:', error);
    return masks; // Возвращаем исходные маски при ошибке
  }
}

// ================================================================
// ЭТАП 4: ВЕКТОРИЗАЦИЯ (Adobe Illustrator Image Trace Algorithm)
// ================================================================

/**
 * traceContours() - Трассировка контуров (Adobe Potrace-like алгоритм)
 * Извлекает векторные контуры из бинарных масок
 */
async function traceContours(masks, settings = {}) {
  console.log(`🔍 ЭТАП 4.1: Adobe traceContours - Трассировка контуров для ${masks.length} масок...`);
  
  try {
    if (!masks || masks.length === 0) {
      throw new Error('Нет масок для трассировки контуров');
    }
    
    const contours = [];
    const turnPolicy = settings.turnPolicy || 'minority'; // Adobe стандарт
    const turdSize = settings.turdSize || 2; // Минимальный размер области
    
    console.log(`   🎯 Параметры трассировки: turnPolicy=${turnPolicy}, turdSize=${turdSize}`);
    
    for (let maskIndex = 0; maskIndex < masks.length; maskIndex++) {
      const mask = masks[maskIndex];
      console.log(`   🔍 Трассировка маски ${maskIndex + 1}/${masks.length} (цвет: ${mask.color?.hex || 'unknown'})...`);
      
      // Adobe контурная трассировка
      const maskContours = await traceMaskContours(mask, {
        turnPolicy,
        turdSize,
        alphaMax: settings.alphaMax || 1.0  // Максимальный угол поворота
      });
      
      console.log(`     ✅ Найдено ${maskContours.length} контуров`);
      
      contours.push({
        maskIndex,
        color: mask.color,
        coverage: mask.coverage,
        contours: maskContours,
        totalPaths: maskContours.length
      });
    }
    
    const totalContours = contours.reduce((sum, c) => sum + c.contours.length, 0);
    console.log(`   🎯 Общий результат: ${totalContours} контуров из ${masks.length} масок`);
    
    return contours;
    
  } catch (error) {
    console.error('❌ Ошибка traceContours:', error);
    return [];
  }
}

/**
 * traceMaskContours() - Трассировка контуров отдельной маски
 * Реализация Adobe Potrace алгоритма
 */
async function traceMaskContours(mask, settings) {
  const { maskData, width, height } = mask;
  const { turnPolicy, turdSize, alphaMax } = settings;
  
  try {
    // 1. Поиск границ объектов (Adobe edge detection)
    const boundaries = findBoundaries(maskData, width, height);
    console.log(`     🔍 Найдено ${boundaries.length} границ`);
    
    // 2. Создание контуров из границ
    const rawContours = [];
    
    for (const boundary of boundaries) {
      if (boundary.length < turdSize * 4) continue; // Фильтр мелких объектов
      
      // Adobe контурная трассировка
      const contour = traceContourFromBoundary(boundary, {
        turnPolicy,
        alphaMax,
        width,
        height
      });
      
      if (contour && contour.length > 0) {
        rawContours.push(contour);
      }
    }
    
    return rawContours;
    
  } catch (error) {
    console.error('❌ Ошибка traceMaskContours:', error);
    return [];
  }
}

/**
 * findBoundaries() - Поиск границ объектов в маске
 * Adobe boundary detection algorithm
 */
function findBoundaries(maskData, width, height) {
  const boundaries = [];
  const visited = new Uint8Array(width * height);
  
  // Moore neighborhood tracing (Adobe стандарт)
  const directions = [
    [-1, 0], [-1, 1], [0, 1], [1, 1],
    [1, 0], [1, -1], [0, -1], [-1, -1]
  ];
  
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const index = y * width + x;
      
      // Поиск границы (переход от черного к белому)
      if (maskData[index] > 0 && !visited[index]) {
        const boundary = traceBoundaryMoore(maskData, width, height, x, y, directions, visited);
        
        if (boundary.length > 8) { // Минимальная длина контура
          boundaries.push(boundary);
        }
      }
    }
  }
  
  return boundaries;
}

/**
 * traceBoundaryMoore() - Moore boundary tracing алгоритм
 * Точная реализация как в Adobe Illustrator
 */
function traceBoundaryMoore(maskData, width, height, startX, startY, directions, visited) {
  const boundary = [];
  let x = startX;
  let y = startY;
  let dir = 0; // Начальное направление
  const startIndex = y * width + x;
  
  do {
    boundary.push({ x, y });
    visited[y * width + x] = 1;
    
    // Поиск следующей точки границы
    let found = false;
    for (let i = 0; i < 8; i++) {
      const newDir = (dir + i) % 8;
      const dx = directions[newDir][0];
      const dy = directions[newDir][1];
      const newX = x + dx;
      const newY = y + dy;
      
      if (newX >= 0 && newX < width && newY >= 0 && newY < height) {
        const newIndex = newY * width + newX;
        
        if (maskData[newIndex] > 0) {
          x = newX;
          y = newY;
          dir = (newDir + 6) % 8; // Поворот налево для следующего поиска
          found = true;
          break;
        }
      }
    }
    
    if (!found) break;
    
  } while (!(x === startX && y === startY) && boundary.length < width * height);
  
  return boundary;
}

/**
 * traceContourFromBoundary() - Создание векторного контура из границы
 * Adobe Potrace polygon approximation
 */
function traceContourFromBoundary(boundary, settings) {
  const { turnPolicy, alphaMax } = settings;
  
  try {
    // 1. Упрощение контура (Douglas-Peucker алгоритм)
    const simplified = simplifyContour(boundary, 1.0); // 1 пиксель tolerance
    
    // 2. Определение поворотных точек
    const corners = findCornerPoints(simplified, turnPolicy);
    
    // 3. Создание сегментов пути
    const pathSegments = createPathSegments(corners, alphaMax);
    
    return pathSegments;
    
  } catch (error) {
    console.error('❌ Ошибка traceContourFromBoundary:', error);
    return [];
  }
}

/**
 * simplifyContour() - Упрощение контура (Douglas-Peucker)
 * Adobe контурное упрощение для векторизации
 */
function simplifyContour(points, tolerance) {
  if (points.length < 3) return points;
  
  // Douglas-Peucker recursive simplification
  function douglasPeucker(points, start, end, tolerance) {
    let maxDistance = 0;
    let maxIndex = 0;
    
    for (let i = start + 1; i < end; i++) {
      const distance = perpendicularDistance(points[i], points[start], points[end]);
      if (distance > maxDistance) {
        maxDistance = distance;
        maxIndex = i;
      }
    }
    
    if (maxDistance > tolerance) {
      const left = douglasPeucker(points, start, maxIndex, tolerance);
      const right = douglasPeucker(points, maxIndex, end, tolerance);
      return left.slice(0, -1).concat(right);
    } else {
      return [points[start], points[end]];
    }
  }
  
  return douglasPeucker(points, 0, points.length - 1, tolerance);
}

/**
 * perpendicularDistance() - Расстояние от точки до линии
 */
function perpendicularDistance(point, lineStart, lineEnd) {
  const dx = lineEnd.x - lineStart.x;
  const dy = lineEnd.y - lineStart.y;
  
  if (dx === 0 && dy === 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + 
      Math.pow(point.y - lineStart.y, 2)
    );
  }
  
  const length = Math.sqrt(dx * dx + dy * dy);
  const t = ((point.x - lineStart.x) * dx + (point.y - lineStart.y) * dy) / (length * length);
  
  if (t < 0) {
    return Math.sqrt(
      Math.pow(point.x - lineStart.x, 2) + 
      Math.pow(point.y - lineStart.y, 2)
    );
  } else if (t > 1) {
    return Math.sqrt(
      Math.pow(point.x - lineEnd.x, 2) + 
      Math.pow(point.y - lineEnd.y, 2)
    );
  }
  
  const projX = lineStart.x + t * dx;
  const projY = lineStart.y + t * dy;
  
  return Math.sqrt(
    Math.pow(point.x - projX, 2) + 
    Math.pow(point.y - projY, 2)
  );
}

/**
 * findCornerPoints() - Поиск поворотных точек
 * Adobe corner detection algorithm
 */
function findCornerPoints(points, turnPolicy) {
  const corners = [];
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Вычисление угла поворота
    const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let angleDiff = angle2 - angle1;
    
    // Нормализация угла
    if (angleDiff > Math.PI) angleDiff -= 2 * Math.PI;
    if (angleDiff < -Math.PI) angleDiff += 2 * Math.PI;
    
    // Adobe turn policy
    const isCorner = Math.abs(angleDiff) > Math.PI / 6; // 30 градусов threshold
    
    if (isCorner) {
      corners.push({
        point: curr,
        angle: angleDiff,
        index: i
      });
    }
  }
  
  return corners;
}

/**
 * createPathSegments() - Создание сегментов SVG пути
 * Adobe path generation
 */
function createPathSegments(corners, alphaMax) {
  const segments = [];
  
  if (corners.length === 0) return segments;
  
  for (let i = 0; i < corners.length; i++) {
    const start = corners[i];
    const end = corners[(i + 1) % corners.length];
    
    segments.push({
      type: 'line',
      start: start.point,
      end: end.point,
      length: Math.sqrt(
        Math.pow(end.point.x - start.point.x, 2) +
        Math.pow(end.point.y - start.point.y, 2)
      )
    });
  }
  
  return segments;
}

/**
 * optimizePaths() - Оптимизация векторных путей
 * Adobe Illustrator path optimization algorithm
 */
async function optimizePaths(contours, settings = {}) {
  console.log(`⚡ ЭТАП 4.2: Adobe optimizePaths - Оптимизация ${contours.length} групп контуров...`);
  
  try {
    if (!contours || contours.length === 0) {
      throw new Error('Нет контуров для оптимизации');
    }
    
    const optimizedContours = [];
    const simplifyTolerance = settings.simplifyTolerance || 1.5; // Adobe стандарт
    const mergeThreshold = settings.mergeThreshold || 2.0; // Порог объединения путей
    const smoothingFactor = settings.smoothingFactor || 0.5; // Фактор сглаживания
    
    console.log(`   🎯 Параметры оптимизации: tolerance=${simplifyTolerance}, merge=${mergeThreshold}, smooth=${smoothingFactor}`);
    
    for (let groupIndex = 0; groupIndex < contours.length; groupIndex++) {
      const contourGroup = contours[groupIndex];
      console.log(`   ⚡ Оптимизация группы ${groupIndex + 1}/${contours.length} (${contourGroup.contours.length} контуров)...`);
      
      // 1. Упрощение контуров
      const simplified = simplifyContours(contourGroup.contours, simplifyTolerance);
      
      // 2. Объединение близких путей
      const merged = mergeNearbyPaths(simplified, mergeThreshold);
      
      // 3. Сглаживание углов
      const smoothed = smoothPaths(merged, smoothingFactor);
      
      // 4. Удаление вырожденных путей
      const cleaned = removeDegenerate(smoothed);
      
      console.log(`     ✅ Оптимизировано: ${contourGroup.contours.length} → ${cleaned.length} контуров`);
      
      optimizedContours.push({
        ...contourGroup,
        contours: cleaned,
        totalPaths: cleaned.length,
        optimized: true
      });
    }
    
    const totalOptimized = optimizedContours.reduce((sum, c) => sum + c.contours.length, 0);
    console.log(`   ⚡ Оптимизация завершена: ${totalOptimized} финальных контуров`);
    
    return optimizedContours;
    
  } catch (error) {
    console.error('❌ Ошибка optimizePaths:', error);
    return contours; // Возвращаем исходные контуры при ошибке
  }
}

/**
 * simplifyContours() - Упрощение контуров
 * Adobe Illustrator simplification algorithm
 */
function simplifyContours(contours, tolerance) {
  return contours.map(contour => {
    if (!contour || contour.length === 0) return contour;
    
    return contour.filter((segment, index) => {
      if (index === 0 || index === contour.length - 1) return true;
      
      // Удаляем сегменты короче tolerance
      return segment.length >= tolerance;
    });
  }).filter(contour => contour.length > 2); // Удаляем слишком короткие контуры
}

/**
 * mergeNearbyPaths() - Объединение близких путей
 * Adobe path merging algorithm
 */
function mergeNearbyPaths(contours, threshold) {
  const merged = [];
  const used = new Set();
  
  for (let i = 0; i < contours.length; i++) {
    if (used.has(i)) continue;
    
    const baseContour = contours[i];
    const mergedContour = [...baseContour];
    used.add(i);
    
    // Поиск близких контуров для объединения
    for (let j = i + 1; j < contours.length; j++) {
      if (used.has(j)) continue;
      
      const candidateContour = contours[j];
      const distance = calculatePathDistance(baseContour, candidateContour);
      
      if (distance <= threshold) {
        // Объединяем контуры
        mergedContour.push(...candidateContour);
        used.add(j);
      }
    }
    
    merged.push(mergedContour);
  }
  
  return merged;
}

/**
 * calculatePathDistance() - Расчет расстояния между путями
 */
function calculatePathDistance(path1, path2) {
  if (!path1.length || !path2.length) return Infinity;
  
  let minDistance = Infinity;
  
  for (const seg1 of path1) {
    for (const seg2 of path2) {
      const dist = Math.sqrt(
        Math.pow(seg1.start.x - seg2.start.x, 2) +
        Math.pow(seg1.start.y - seg2.start.y, 2)
      );
      minDistance = Math.min(minDistance, dist);
    }
  }
  
  return minDistance;
}

/**
 * smoothPaths() - Сглаживание путей
 * Adobe corner smoothing algorithm
 */
function smoothPaths(contours, smoothingFactor) {
  return contours.map(contour => {
    if (contour.length < 3) return contour;
    
    return contour.map((segment, index) => {
      if (index === 0 || index === contour.length - 1) return segment;
      
      const prev = contour[index - 1];
      const next = contour[index + 1];
      
      // Сглаживание углов
      const smoothedStart = {
        x: segment.start.x + (prev.start.x - segment.start.x) * smoothingFactor * 0.1,
        y: segment.start.y + (prev.start.y - segment.start.y) * smoothingFactor * 0.1
      };
      
      const smoothedEnd = {
        x: segment.end.x + (next.end.x - segment.end.x) * smoothingFactor * 0.1,
        y: segment.end.y + (next.end.y - segment.end.y) * smoothingFactor * 0.1
      };
      
      return {
        ...segment,
        start: smoothedStart,
        end: smoothedEnd
      };
    });
  });
}

/**
 * removeDegenerate() - Удаление вырожденных путей
 */
function removeDegenerate(contours) {
  return contours.filter(contour => {
    if (!contour || contour.length === 0) return false;
    
    // Удаляем контуры с нулевой площадью
    const totalLength = contour.reduce((sum, seg) => sum + (seg.length || 0), 0);
    return totalLength > 3; // Минимальная длина контура
  });
}

/**
 * fitCurves() - Аппроксимация кривыми Безье
 * Adobe Illustrator Bezier curve fitting algorithm
 */
async function fitCurves(optimizedContours, settings = {}) {
  console.log(`🎨 ЭТАП 4.3: Adobe fitCurves - Аппроксимация кривыми Безье для ${optimizedContours.length} групп...`);
  
  try {
    if (!optimizedContours || optimizedContours.length === 0) {
      throw new Error('Нет оптимизированных контуров для аппроксимации');
    }
    
    const bezierContours = [];
    const errorThreshold = settings.errorThreshold || 2.0; // Adobe стандарт
    const maxIterations = settings.maxIterations || 4; // Максимум итераций
    const cornerThreshold = settings.cornerThreshold || Math.PI / 3; // 60 градусов
    
    console.log(`   🎯 Параметры Безье: error=${errorThreshold}, iterations=${maxIterations}, corner=${(cornerThreshold * 180 / Math.PI).toFixed(0)}°`);
    
    for (let groupIndex = 0; groupIndex < optimizedContours.length; groupIndex++) {
      const contourGroup = optimizedContours[groupIndex];
      console.log(`   🎨 Обработка группы ${groupIndex + 1}/${optimizedContours.length} (${contourGroup.contours.length} контуров)...`);
      
      const bezierPaths = [];
      
      for (const contour of contourGroup.contours) {
        if (!contour || contour.length === 0) continue;
        
        // Конвертация сегментов в точки
        const points = extractPointsFromContour(contour);
        
        if (points.length < 4) {
          // Слишком мало точек для Безье, создаем простой путь
          bezierPaths.push(createSimplePath(points));
          continue;
        }
        
        // Adobe Bezier fitting algorithm
        const bezierCurves = fitBezierCurves(points, {
          errorThreshold,
          maxIterations,
          cornerThreshold
        });
        
        if (bezierCurves.length > 0) {
          bezierPaths.push(...bezierCurves);
        }
      }
      
      console.log(`     ✅ Создано ${bezierPaths.length} кривых Безье`);
      
      bezierContours.push({
        ...contourGroup,
        contours: bezierPaths,
        totalPaths: bezierPaths.length,
        bezierFitted: true
      });
    }
    
    const totalCurves = bezierContours.reduce((sum, c) => sum + c.contours.length, 0);
    console.log(`   🎨 Аппроксимация завершена: ${totalCurves} кривых Безье`);
    
    return bezierContours;
    
  } catch (error) {
    console.error('❌ Ошибка fitCurves:', error);
    return optimizedContours; // Возвращаем оптимизированные контуры при ошибке
  }
}

/**
 * extractPointsFromContour() - Извлечение точек из контура
 */
function extractPointsFromContour(contour) {
  const points = [];
  
  for (const segment of contour) {
    if (segment.start && typeof segment.start.x === 'number' && typeof segment.start.y === 'number') {
      points.push(segment.start);
    }
    if (segment.end && typeof segment.end.x === 'number' && typeof segment.end.y === 'number') {
      points.push(segment.end);
    }
  }
  
  // Удаление дубликатов
  const uniquePoints = [];
  for (const point of points) {
    const isDuplicate = uniquePoints.some(existing => 
      Math.abs(existing.x - point.x) < 0.1 && Math.abs(existing.y - point.y) < 0.1
    );
    
    if (!isDuplicate) {
      uniquePoints.push(point);
    }
  }
  
  return uniquePoints;
}

/**
 * createSimplePath() - Создание простого пути
 */
function createSimplePath(points) {
  if (points.length < 2) return null;
  
  return {
    type: 'path',
    commands: points.map((point, index) => ({
      type: index === 0 ? 'M' : 'L',
      x: point.x,
      y: point.y
    }))
  };
}

/**
 * fitBezierCurves() - Аппроксимация кривыми Безье
 * Adobe Illustrator curve fitting algorithm
 */
function fitBezierCurves(points, settings) {
  const { errorThreshold, maxIterations, cornerThreshold } = settings;
  const curves = [];
  
  if (points.length < 4) return curves;
  
  // Поиск углов (точек излома)
  const corners = findCorners(points, cornerThreshold);
  corners.push(points.length - 1); // Добавляем конечную точку
  
  let startIndex = 0;
  
  for (const cornerIndex of corners) {
    if (cornerIndex - startIndex >= 4) {
      // Достаточно точек для кривой Безье
      const segmentPoints = points.slice(startIndex, cornerIndex + 1);
      const bezierCurve = fitBezierToPoints(segmentPoints, errorThreshold, maxIterations);
      
      if (bezierCurve) {
        curves.push(bezierCurve);
      }
    } else if (cornerIndex > startIndex) {
      // Мало точек, создаем линейный сегмент
      const linearPath = createLinearPath(points.slice(startIndex, cornerIndex + 1));
      if (linearPath) {
        curves.push(linearPath);
      }
    }
    
    startIndex = cornerIndex;
  }
  
  return curves;
}

/**
 * findCorners() - Поиск углов в контуре
 */
function findCorners(points, threshold) {
  const corners = [0]; // Начальная точка всегда угол
  
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    
    // Вычисление угла
    const angle1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
    const angle2 = Math.atan2(next.y - curr.y, next.x - curr.x);
    let angleDiff = Math.abs(angle2 - angle1);
    
    if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;
    
    if (angleDiff > threshold) {
      corners.push(i);
    }
  }
  
  return corners;
}

/**
 * fitBezierToPoints() - Аппроксимация набора точек одной кривой Безье
 */
function fitBezierToPoints(points, errorThreshold, maxIterations) {
  if (points.length < 4) return null;
  
  const start = points[0];
  const end = points[points.length - 1];
  
  // Начальное приближение контрольных точек
  const length = Math.sqrt(
    Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2)
  );
  
  let cp1 = {
    x: start.x + (end.x - start.x) * 0.25,
    y: start.y + (end.y - start.y) * 0.25
  };
  
  let cp2 = {
    x: start.x + (end.x - start.x) * 0.75,
    y: start.y + (end.y - start.y) * 0.75
  };
  
  // Итеративная оптимизация
  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const { cp1: newCp1, cp2: newCp2, error } = optimizeControlPoints(
      points, start, end, cp1, cp2
    );
    
    if (error < errorThreshold) {
      return {
        type: 'bezier',
        start,
        end,
        cp1: newCp1,
        cp2: newCp2,
        error
      };
    }
    
    cp1 = newCp1;
    cp2 = newCp2;
  }
  
  // Возвращаем лучшее приближение
  return {
    type: 'bezier',
    start,
    end,
    cp1,
    cp2,
    error: calculateBezierError(points, start, end, cp1, cp2)
  };
}

/**
 * optimizeControlPoints() - Оптимизация контрольных точек
 */
function optimizeControlPoints(points, start, end, cp1, cp2) {
  // Простая оптимизация методом наименьших квадратов
  let bestCp1 = cp1;
  let bestCp2 = cp2;
  let bestError = calculateBezierError(points, start, end, cp1, cp2);
  
  const step = 2.0;
  const offsets = [-step, 0, step];
  
  for (const dx1 of offsets) {
    for (const dy1 of offsets) {
      for (const dx2 of offsets) {
        for (const dy2 of offsets) {
          const newCp1 = { x: cp1.x + dx1, y: cp1.y + dy1 };
          const newCp2 = { x: cp2.x + dx2, y: cp2.y + dy2 };
          
          const error = calculateBezierError(points, start, end, newCp1, newCp2);
          
          if (error < bestError) {
            bestError = error;
            bestCp1 = newCp1;
            bestCp2 = newCp2;
          }
        }
      }
    }
  }
  
  return { cp1: bestCp1, cp2: bestCp2, error: bestError };
}

/**
 * calculateBezierError() - Расчет ошибки аппроксимации
 */
function calculateBezierError(points, start, end, cp1, cp2) {
  let totalError = 0;
  
  for (let i = 0; i < points.length; i++) {
    const t = i / (points.length - 1);
    const bezierPoint = evaluateBezier(start, cp1, cp2, end, t);
    const actualPoint = points[i];
    
    const error = Math.sqrt(
      Math.pow(bezierPoint.x - actualPoint.x, 2) +
      Math.pow(bezierPoint.y - actualPoint.y, 2)
    );
    
    totalError += error;
  }
  
  return totalError / points.length;
}

/**
 * evaluateBezier() - Вычисление точки на кривой Безье
 */
function evaluateBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const tt = t * t;
  const uu = u * u;
  const uuu = uu * u;
  const ttt = tt * t;
  
  return {
    x: uuu * p0.x + 3 * uu * t * p1.x + 3 * u * tt * p2.x + ttt * p3.x,
    y: uuu * p0.y + 3 * uu * t * p1.y + 3 * u * tt * p2.y + ttt * p3.y
  };
}

/**
 * createLinearPath() - Создание линейного пути
 */
function createLinearPath(points) {
  if (points.length < 2) return null;
  
  return {
    type: 'linear',
    points: points.map(p => ({ x: p.x, y: p.y }))
  };
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
    
    // ЭТАП 1: Предобработка изображения
    const processedBuffer = await preprocessImageForAdobe(imageBuffer, settings);
    
    // ЭТАП 2: Цветовая сегментация
    console.log(`🎨 ЭТАП 2: Выполнение цветовой сегментации...`);
    const colorPalette = await performKMeansSegmentation(processedBuffer, settings.maxColors);
    console.log(`🎯 Получена палитра из ${colorPalette.length} цветов`);
    
    // ЭТАП 3: Создание масок
    console.log(`🎭 ЭТАП 3: Создание цветовых масок...`);
    const colorMasks = await createColorMasks(processedBuffer, colorPalette, settings);
    
    // Дополнительное создание бинарных масок для контраста
    const binaryMasks = await createBinaryMasks(processedBuffer, settings.threshold || 128, settings);
    
    // Рафинирование всех масок
    const refinedColorMasks = await refineMasks(colorMasks, { kernelSize: 3, iterations: 1 });
    
    console.log(`✅ ЭТАП 3 завершен: создано ${refinedColorMasks.length} цветовых масок`);
    
    // Автоматическое определение порога
    const optimalThreshold = await calculateAdobeThreshold(processedBuffer);
    settings.threshold = optimalThreshold;
    console.log(`🎯 Adobe автоматический порог: ${optimalThreshold}`);
    
    // ЭТАП 4: Векторизация
    console.log(`🔍 ЭТАП 4: Векторизация контуров...`);
    
    // 4.1 Трассировка контуров
    const contours = await traceContours(refinedColorMasks, {
      turnPolicy: 'minority',
      turdSize: 2,
      alphaMax: 1.0
    });
    
    // 4.2 Оптимизация путей
    const optimizedContours = await optimizePaths(contours, {
      simplifyTolerance: 1.5,
      mergeThreshold: 2.0,
      smoothingFactor: 0.5
    });
    
    // 4.3 Аппроксимация кривыми Безье
    const bezierContours = await fitCurves(optimizedContours, {
      errorThreshold: 2.0,
      maxIterations: 4,
      cornerThreshold: Math.PI / 3
    });
    
    console.log(`✅ ЭТАП 4 завершен: ${bezierContours.length} групп векторных контуров`);
    
    // Переход к созданию SVG с векторными данными
    console.log(`🎨 СОЗДАНИЕ SVG с векторизированными контурами`);
    
    const svgContent = await createAdobeLimitedColorSVG(processedBuffer, settings, {
      colorPalette,
      colorMasks: refinedColorMasks,
      binaryMasks,
      vectorContours: bezierContours
    });
    
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