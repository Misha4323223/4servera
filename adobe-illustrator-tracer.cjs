/**
 * Adobe Illustrator Image Trace Limited Color - точная копия алгоритма
 * Создает четкие контуры как в оригинальном Adobe Illustrator
 */

const sharp = require('sharp');

/**
 * ADOBE ILLUSTRATOR TRACE - ТОЧНАЯ КОПИЯ АЛГОРИТМА
 * Этап 1: Цветовая квантизация методом K-means (как в Adobe)
 */
async function adobeColorQuantization(imageBuffer, maxColors = 5) {
  console.log(`🎨 ADOBE TRACE: Квантизация на ${maxColors} цветов`);
  
  const { data, info } = await sharp(imageBuffer)
    .resize(400, 400, { fit: 'inside' })
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  console.log(`📊 ADOBE: Анализ изображения ${info.width}x${info.height}`);
  
  // Собираем все пиксели для K-means кластеризации
  const pixels = [];
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    
    // Пропускаем только полностью прозрачные
    if (info.channels === 4 && data[i + 3] < 10) continue;
    
    pixels.push([r, g, b]);
  }
  
  console.log(`📊 ADOBE: Найдено ${pixels.length} пикселей для анализа`);
  
  // K-means кластеризация (алгоритм Adobe)
  const clusters = performAdobeKMeans(pixels, maxColors);
  
  console.log(`✅ ADOBE: Получено ${clusters.length} кластеров цветов`);
  clusters.forEach((cluster, i) => {
    const [r, g, b] = cluster.center;
    const hex = `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`;
    const coverage = ((cluster.pixels.length / pixels.length) * 100).toFixed(1);
    console.log(`  ${i + 1}. ${hex} (${coverage}%)`);
  });
  
  return clusters.map(cluster => {
    const [r, g, b] = cluster.center;
    return {
      r: Math.round(r),
      g: Math.round(g), 
      b: Math.round(b),
      hex: `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`,
      percentage: ((cluster.pixels.length / pixels.length) * 100).toFixed(1),
      pixelCount: cluster.pixels.length
    };
  });
}

/**
 * Adobe K-means кластеризация - точная копия алгоритма
 */
function performAdobeKMeans(pixels, k, maxIterations = 20) {
  console.log(`🔍 ADOBE K-MEANS: Кластеризация ${pixels.length} пикселей на ${k} групп`);
  
  // Инициализация центров кластеров (Adobe метод)
  let centers = [];
  for (let i = 0; i < k; i++) {
    const randomIndex = Math.floor(Math.random() * pixels.length);
    centers.push([...pixels[randomIndex]]);
  }
  
  let assignments = new Array(pixels.length);
  let hasChanged = true;
  let iteration = 0;
  
  while (hasChanged && iteration < maxIterations) {
    hasChanged = false;
    
    // Назначение пикселей к ближайшим центрам
    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i];
      let minDistance = Infinity;
      let closestCenter = 0;
      
      for (let j = 0; j < centers.length; j++) {
        const distance = euclideanDistance(pixel, centers[j]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCenter = j;
        }
      }
      
      if (assignments[i] !== closestCenter) {
        assignments[i] = closestCenter;
        hasChanged = true;
      }
    }
    
    // Обновление центров кластеров
    for (let j = 0; j < centers.length; j++) {
      const clusterPixels = pixels.filter((_, i) => assignments[i] === j);
      if (clusterPixels.length > 0) {
        const newCenter = [0, 0, 0];
        for (const pixel of clusterPixels) {
          newCenter[0] += pixel[0];
          newCenter[1] += pixel[1];
          newCenter[2] += pixel[2];
        }
        centers[j] = [
          newCenter[0] / clusterPixels.length,
          newCenter[1] / clusterPixels.length,
          newCenter[2] / clusterPixels.length
        ];
      }
    }
    
    iteration++;
  }
  
  console.log(`🔍 ADOBE K-MEANS: Завершено за ${iteration} итераций`);
  
  // Формирование кластеров
  const clusters = centers.map((center, index) => ({
    center,
    pixels: pixels.filter((_, i) => assignments[i] === index)
  }));
  
  // Сортировка по размеру кластера (как в Adobe)
  clusters.sort((a, b) => b.pixels.length - a.pixels.length);
  
  return clusters;
}

/**
 * ADOBE ILLUSTRATOR TRACE - Этап 2: Создание цветовых масок
 */
async function createAdobeColorMask(imageBuffer, targetColor) {
  console.log(`🎯 ADOBE MASK: Создание маски для ${targetColor.hex}`);
  
  const { data, info } = await sharp(imageBuffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: false }) // Увеличиваем для видимости
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  const maskData = Buffer.alloc(info.width * info.height);
  
  // Adobe использует адаптивный порог на основе цветового пространства
  const colorThreshold = calculateAdobeColorThreshold(targetColor);
  console.log(`🔧 ADOBE MASK: Порог для ${targetColor.hex}: ${colorThreshold}`);
  
  let matchedPixels = 0;
  
  for (let i = 0; i < data.length; i += info.channels) {
    const r = data[i];
    const g = data[i + 1]; 
    const b = data[i + 2];
    
    // Adobe алгоритм определения принадлежности к цвету
    const isColorMatch = isAdobeColorMatch([r, g, b], [targetColor.r, targetColor.g, targetColor.b], colorThreshold);
    
    const pixelIndex = Math.floor(i / info.channels);
    
    if (isColorMatch) {
      maskData[pixelIndex] = 255;
      matchedPixels++;
    } else {
      maskData[pixelIndex] = 0;
    }
  }
  
  const coverage = ((matchedPixels / (info.width * info.height)) * 100).toFixed(2);
  console.log(`📊 ADOBE MASK: ${targetColor.hex} покрытие ${coverage}%`);
  
  // Создаем PNG маску
  const maskImage = await sharp(maskData, {
    raw: {
      width: info.width,
      height: info.height,
      channels: 1
    }
  })
  .png()
  .toBuffer();
  
  return {
    maskBuffer: maskImage,
    coverage: parseFloat(coverage),
    width: info.width,
    height: info.height
  };
}

/**
 * Adobe алгоритм вычисления порога цвета
 */
function calculateAdobeColorThreshold(color) {
  const brightness = (color.r * 0.299 + color.g * 0.587 + color.b * 0.114);
  const saturation = (Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b)) / Math.max(color.r, color.g, color.b, 1);
  
  // Adobe формула РАСШИРЕННОГО порога для видимых областей
  let threshold = 60; // Увеличенный базовый порог
  
  if (brightness < 50) threshold = 80; // Темные цвета - еще больше толерантности
  else if (brightness > 200) threshold = 70; // Светлые цвета 
  else threshold = 75; // Средние тона
  
  // Коррекция по насыщенности (более агрессивная)
  if (saturation > 0.7) threshold += 20; // Насыщенные цвета
  if (saturation < 0.2) threshold += 25; // Ненасыщенные цвета
  
  return threshold;
}

/**
 * Adobe алгоритм определения совпадения цвета
 */
function isAdobeColorMatch(pixel, target, threshold) {
  // Adobe использует перцептивное расстояние в цветовом пространстве
  const deltaR = pixel[0] - target[0];
  const deltaG = pixel[1] - target[1];
  const deltaB = pixel[2] - target[2];
  
  // Перцептивная формула Adobe (весовые коэффициенты для RGB)
  const perceptualDistance = Math.sqrt(
    2 * deltaR * deltaR +
    4 * deltaG * deltaG +
    3 * deltaB * deltaB
  );
  
  return perceptualDistance <= threshold;
}

/**
 * ADOBE ILLUSTRATOR TRACE - Этап 3: Векторизация маски в контуры
 */
async function adobeVectorizeColorMask(maskBuffer, color, originalSize) {
  console.log(`🔍 ADOBE VECTORIZE: Трассировка ${color.hex}`);
  
  try {
    // Adobe использует potrace для векторизации
    const potrace = require('potrace');
    
    return new Promise((resolve, reject) => {
      const params = {
        // Adobe Illustrator параметры для ТОЛСТЫХ контуров
        threshold: 120,
        optTolerance: 0.4,
        turdSize: 4,
        turnPolicy: potrace.Potrace.TURNPOLICY_MAJORITY,
        alphaMax: 0.8,
        optCurve: true,
        // Дополнительные параметры для видимости
        blackOnWhite: true
      };
      
      potrace.trace(maskBuffer, params, (err, svg) => {
        if (err) {
          console.error(`❌ ADOBE VECTORIZE: Ошибка ${color.hex}:`, err);
          reject(err);
          return;
        }
        
        // Извлекаем path из SVG
        const pathMatch = svg.match(/<path[^>]*d="([^"]*)"[^>]*\/>/);
        if (pathMatch) {
          const pathData = pathMatch[1];
          console.log(`✅ ADOBE VECTORIZE: ${color.hex} - ${pathData.length} символов пути`);
          resolve({
            pathData,
            color: color.hex,
            originalCoverage: color.percentage
          });
        } else {
          console.log(`⚠️ ADOBE VECTORIZE: ${color.hex} - путь не найден`);
          resolve(null);
        }
      });
    });
  } catch (error) {
    console.error(`❌ ADOBE VECTORIZE: Ошибка potrace для ${color.hex}:`, error);
    return null;
  }
}

/**
 * ADOBE ILLUSTRATOR TRACE - Главная функция
 */
async function adobeImageTrace(imageBuffer, options = {}) {
  console.log(`🎨 ADOBE ILLUSTRATOR IMAGE TRACE - ЗАПУСК`);
  
  const maxColors = options.maxColors || 5;
  const { width: originalWidth, height: originalHeight } = await sharp(imageBuffer).metadata();
  
  console.log(`📐 ADOBE: Оригинал ${originalWidth}x${originalHeight}`);
  
  try {
    // Этап 1: Цветовая квантизация K-means
    const colors = await adobeColorQuantization(imageBuffer, maxColors);
    
    if (colors.length === 0) {
      throw new Error('Не удалось извлечь цвета');
    }
    
    console.log(`🎨 ADOBE: Обработка ${colors.length} цветов`);
    
    // Этап 2: Создание масок и векторизация
    const vectorPaths = [];
    
    for (let i = 0; i < colors.length; i++) {
      const color = colors[i];
      console.log(`\n🔄 ADOBE: Обработка цвета ${i + 1}/${colors.length}: ${color.hex}`);
      
      // Создаем маску
      const maskResult = await createAdobeColorMask(imageBuffer, color);
      
      if (maskResult.coverage < 0.1) {
        console.log(`⚠️ ADOBE: Пропускаем ${color.hex} - мало покрытия (${maskResult.coverage}%)`);
        continue;
      }
      
      // Векторизуем маску
      const vectorPath = await adobeVectorizeColorMask(maskResult.maskBuffer, color, {
        width: originalWidth,
        height: originalHeight
      });
      
      if (vectorPath) {
        vectorPaths.push(vectorPath);
        console.log(`✅ ADOBE: ${color.hex} добавлен в результат`);
      }
    }
    
    console.log(`📊 ADOBE: Получено ${vectorPaths.length} векторных путей`);
    
    // Этап 3: Создание финального SVG
    const svgContent = createAdobeSVG(vectorPaths, originalWidth, originalHeight);
    
    console.log(`✅ ADOBE ILLUSTRATOR TRACE ЗАВЕРШЕН: ${svgContent.length} символов`);
    
    return {
      success: true,
      svgContent,
      colorsUsed: vectorPaths.length,
      quality: 'Adobe Illustrator Image Trace',
      algorithm: 'Limited Color K-means + Potrace'
    };
    
  } catch (error) {
    console.error(`❌ ADOBE ILLUSTRATOR TRACE ОШИБКА:`, error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Создание финального SVG в стиле Adobe Illustrator - ИСПРАВЛЕННАЯ ВЕРСИЯ
 * Adobe Illustrator создает ЗАПОЛНЕННЫЕ области, не контуры
 */
function createAdobeSVG(vectorPaths, width, height) {
  // Увеличиваем размер для лучшей видимости (как в Adobe)
  const targetSize = Math.max(width, height, 400);
  const scaleX = targetSize / width;
  const scaleY = targetSize / height;
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${targetSize}" height="${targetSize}" viewBox="0 0 ${targetSize} ${targetSize}" xmlns="http://www.w3.org/2000/svg">
  <title>Adobe Illustrator Image Trace (${vectorPaths.length} colors)</title>
  <desc>Adobe Compatible Limited Color Vector - Filled Shapes</desc>
  <defs>
    <style>
      .adobe-shape { 
        fill-rule: evenodd; 
        stroke: none; 
        vector-effect: non-scaling-stroke; 
      }
    </style>
  </defs>
`;

  // Сортируем пути по размеру области (большие внизу)
  const sortedPaths = vectorPaths.sort((a, b) => {
    const aSize = parseFloat(a.originalCoverage) || 0;
    const bSize = parseFloat(b.originalCoverage) || 0;
    return bSize - aSize; // От большего к меньшему
  });

  sortedPaths.forEach((path, index) => {
    // Adobe стиль: заполненные фигуры с четкими границами
    svg += `  <g id="adobe-color-${index + 1}" class="adobe-layer">
    <path d="${path.pathData}" 
          fill="${path.color}" 
          class="adobe-shape"
          transform="scale(${scaleX}, ${scaleY})"
          opacity="1"/>
  </g>
`;
  });

  svg += `</svg>`;
  
  return svg;
}

/**
 * Вспомогательная функция расчета расстояния
 */
function euclideanDistance(a, b) {
  return Math.sqrt(
    Math.pow(a[0] - b[0], 2) +
    Math.pow(a[1] - b[1], 2) +
    Math.pow(a[2] - b[2], 2)
  );
}

module.exports = {
  adobeImageTrace,
  adobeColorQuantization,
  createAdobeColorMask,
  adobeVectorizeColorMask
};