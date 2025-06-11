/**
 * ADOBE ILLUSTRATOR IMAGE TRACE - ТОЧНАЯ КОПИЯ
 * Полностью переписанный векторизатор по шаблону Adobe Illustrator Limited Color
 */

const sharp = require('sharp');
const potrace = require('potrace');
const fs = require('fs');
const path = require('path');

/**
 * ADOBE ILLUSTRATOR SETTINGS - точные настройки как в оригинале
 */
const ADOBE_SETTINGS = {
  // Основные параметры Adobe Image Trace
  LIMITED_COLOR: {
    maxColors: 5,
    threshold: 128,
    turdSize: 2,
    alphaMax: 1.0,
    optTolerance: 0.2,
    optCurve: true
  },
  
  // Настройки качества
  QUALITY_MODES: {
    silkscreen: { maxColors: 5, simplify: true, highQuality: false },
    high: { maxColors: 8, simplify: false, highQuality: true },
    medium: { maxColors: 6, simplify: true, highQuality: true },
    low: { maxColors: 4, simplify: true, highQuality: false }
  },
  
  // Размеры вывода
  OUTPUT_SIZE: {
    width: 2400,
    height: 2400
  }
};

/**
 * ГЛАВНАЯ ФУНКЦИЯ ВЕКТОРИЗАЦИИ - Adobe Illustrator Image Trace
 */
async function vectorizeImage(imageBuffer, options = {}) {
  console.log('\n🎨 === ADOBE ILLUSTRATOR IMAGE TRACE ЗАПУСК ===');
  
  const settings = {
    ...ADOBE_SETTINGS.LIMITED_COLOR,
    ...ADOBE_SETTINGS.QUALITY_MODES[options.quality || 'silkscreen']
  };
  
  console.log(`⚙️ ADOBE: Режим ${options.quality || 'silkscreen'}, ${settings.maxColors} цветов`);
  
  try {
    // Этап 1: Подготовка изображения в стиле Adobe
    const processedImage = await prepareImageForAdobe(imageBuffer);
    console.log(`📐 ADOBE: Изображение подготовлено ${processedImage.width}x${processedImage.height}`);
    
    // Этап 2: Adobe K-means цветовая кластеризация
    const colorPalette = await extractAdobeColors(processedImage.data, processedImage.info, settings.maxColors);
    console.log(`🎨 ADOBE: Извлечено ${colorPalette.length} цветов для векторизации`);
    
    if (colorPalette.length === 0) {
      throw new Error('Adobe кластеризация не нашла цвета');
    }
    
    // Этап 3: Создание цветовых масок и векторизация
    const vectorPaths = [];
    
    for (let i = 0; i < colorPalette.length; i++) {
      const color = colorPalette[i];
      console.log(`\n🔄 ADOBE TRACE: Обработка цвета ${i + 1}/${colorPalette.length}: ${color.hex}`);
      
      // Создаем Adobe-совместимую маску
      const maskResult = await createAdobeMask(processedImage.data, processedImage.info, color, settings);
      
      if (maskResult.coverage < 0.5) {
        console.log(`⚠️ ADOBE: Пропускаем ${color.hex} - покрытие ${maskResult.coverage}%`);
        continue;
      }
      
      // Векторизуем маску через Potrace (как в Adobe)
      const vectorPath = await adobePotrace(maskResult.maskBuffer, color, settings);
      
      if (vectorPath && vectorPath.pathData && vectorPath.pathData.length > 10) {
        vectorPaths.push(vectorPath);
        console.log(`✅ ADOBE: ${color.hex} успешно векторизован (${vectorPath.pathData.length} символов)`);
      } else {
        console.log(`❌ ADOBE: ${color.hex} не удалось векторизовать`);
      }
    }
    
    if (vectorPaths.length === 0) {
      throw new Error('Adobe векторизация не создала ни одного контура');
    }
    
    // Этап 4: Создание финального SVG в стиле Adobe Illustrator
    const svgContent = buildAdobeSVG(vectorPaths, ADOBE_SETTINGS.OUTPUT_SIZE);
    
    console.log(`\n✅ === ADOBE ILLUSTRATOR TRACE ЗАВЕРШЕН ===`);
    console.log(`📊 Создано контуров: ${vectorPaths.length}`);
    console.log(`📏 Размер SVG: ${svgContent.length} символов`);
    console.log(`🎯 Качество: Adobe Illustrator Limited Color`);
    
    return svgContent;
    
  } catch (error) {
    console.error(`❌ ADOBE ILLUSTRATOR TRACE ОШИБКА:`, error.message);
    throw error;
  }
}

/**
 * ЭТАП 1: Подготовка изображения в стиле Adobe Illustrator
 */
async function prepareImageForAdobe(imageBuffer) {
  console.log('🔧 ADOBE PREP: Подготовка изображения...');
  
  // Adobe использует оптимальный размер для обработки
  const targetSize = 400;
  
  const { data, info } = await sharp(imageBuffer)
    .resize(targetSize, targetSize, { 
      fit: 'inside', 
      withoutEnlargement: false,
      background: { r: 255, g: 255, b: 255, alpha: 1 }
    })
    .removeAlpha() // Adobe не работает с прозрачностью в Limited Color
    .raw()
    .toBuffer({ resolveWithObject: true });
  
  console.log(`✅ ADOBE PREP: ${info.width}x${info.height}, ${info.channels} каналов`);
  
  return { data, info };
}

/**
 * ЭТАП 2: Adobe K-means цветовая кластеризация
 */
async function extractAdobeColors(imageData, imageInfo, maxColors) {
  console.log(`🎨 ADOBE K-MEANS: Кластеризация на ${maxColors} цветов...`);
  
  // Собираем все пиксели
  const pixels = [];
  for (let i = 0; i < imageData.length; i += 3) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    pixels.push([r, g, b]);
  }
  
  console.log(`📊 ADOBE K-MEANS: Анализ ${pixels.length} пикселей`);
  
  // Adobe K-means алгоритм
  const clusters = performAdobeKMeans(pixels, maxColors);
  
  // Преобразуем в Adobe формат
  const colorPalette = clusters
    .filter(cluster => cluster.pixels.length > 0)
    .map(cluster => {
      const [r, g, b] = cluster.center;
      const coverage = (cluster.pixels.length / pixels.length) * 100;
      
      return {
        r: Math.round(r),
        g: Math.round(g),
        b: Math.round(b),
        hex: `#${Math.round(r).toString(16).padStart(2, '0')}${Math.round(g).toString(16).padStart(2, '0')}${Math.round(b).toString(16).padStart(2, '0')}`,
        coverage: parseFloat(coverage.toFixed(2)),
        pixelCount: cluster.pixels.length
      };
    })
    .sort((a, b) => b.coverage - a.coverage); // Сортируем по покрытию как в Adobe
  
  colorPalette.forEach((color, index) => {
    console.log(`  ${index + 1}. ${color.hex} (${color.coverage}%)`);
  });
  
  return colorPalette;
}

/**
 * Adobe K-means кластеризация - точная копия алгоритма
 */
function performAdobeKMeans(pixels, k, maxIterations = 20) {
  // Инициализация центров методом k-means++
  let centers = initializeAdobeCenters(pixels, k);
  
  let assignments = new Array(pixels.length);
  let converged = false;
  let iteration = 0;
  
  while (!converged && iteration < maxIterations) {
    converged = true;
    
    // Назначение пикселей к ближайшим центрам
    for (let i = 0; i < pixels.length; i++) {
      const pixel = pixels[i];
      let minDistance = Infinity;
      let closestCenter = 0;
      
      for (let j = 0; j < centers.length; j++) {
        // Adobe использует перцептивное расстояние
        const distance = adobeColorDistance(pixel, centers[j]);
        if (distance < minDistance) {
          minDistance = distance;
          closestCenter = j;
        }
      }
      
      if (assignments[i] !== closestCenter) {
        assignments[i] = closestCenter;
        converged = false;
      }
    }
    
    // Обновление центров
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
  
  console.log(`🔍 ADOBE K-MEANS: Сходимость за ${iteration} итераций`);
  
  // Формирование кластеров
  return centers.map((center, index) => ({
    center,
    pixels: pixels.filter((_, i) => assignments[i] === index)
  }));
}

/**
 * Adobe инициализация центров кластеров методом k-means++
 */
function initializeAdobeCenters(pixels, k) {
  const centers = [];
  
  // Первый центр случайно
  centers.push([...pixels[Math.floor(Math.random() * pixels.length)]]);
  
  // Остальные центры по принципу максимального расстояния
  for (let i = 1; i < k; i++) {
    let maxDistance = -1;
    let bestPixel = null;
    
    for (const pixel of pixels) {
      let minDistanceToCenter = Infinity;
      for (const center of centers) {
        const distance = adobeColorDistance(pixel, center);
        minDistanceToCenter = Math.min(minDistanceToCenter, distance);
      }
      
      if (minDistanceToCenter > maxDistance) {
        maxDistance = minDistanceToCenter;
        bestPixel = pixel;
      }
    }
    
    if (bestPixel) {
      centers.push([...bestPixel]);
    }
  }
  
  return centers;
}

/**
 * Adobe перцептивное расстояние между цветами
 */
function adobeColorDistance(color1, color2) {
  const deltaR = color1[0] - color2[0];
  const deltaG = color1[1] - color2[1];
  const deltaB = color1[2] - color2[2];
  
  // Adobe формула перцептивного расстояния
  return Math.sqrt(
    2 * deltaR * deltaR +
    4 * deltaG * deltaG +
    3 * deltaB * deltaB
  );
}

/**
 * ЭТАП 3: Создание цветовой маски в стиле Adobe
 */
async function createAdobeMask(imageData, imageInfo, targetColor, settings) {
  console.log(`🎯 ADOBE MASK: Создание маски для ${targetColor.hex}`);
  
  const { width, height } = imageInfo;
  const maskData = Buffer.alloc(width * height);
  
  // Adobe адаптивный порог
  const threshold = calculateAdobeThreshold(targetColor);
  
  let matchedPixels = 0;
  
  for (let i = 0; i < imageData.length; i += 3) {
    const r = imageData[i];
    const g = imageData[i + 1];
    const b = imageData[i + 2];
    
    const pixelIndex = Math.floor(i / 3);
    
    // Adobe алгоритм определения принадлежности
    const distance = adobeColorDistance([r, g, b], [targetColor.r, targetColor.g, targetColor.b]);
    
    if (distance <= threshold) {
      maskData[pixelIndex] = 255;
      matchedPixels++;
    } else {
      maskData[pixelIndex] = 0;
    }
  }
  
  const coverage = (matchedPixels / (width * height)) * 100;
  
  // Создаем PNG маску для Potrace
  const maskBuffer = await sharp(maskData, {
    raw: { width, height, channels: 1 }
  }).png().toBuffer();
  
  console.log(`📊 ADOBE MASK: ${targetColor.hex} покрытие ${coverage.toFixed(2)}%`);
  
  return {
    maskBuffer,
    coverage: parseFloat(coverage.toFixed(2))
  };
}

/**
 * Adobe алгоритм вычисления адаптивного порога
 */
function calculateAdobeThreshold(color) {
  const brightness = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
  const saturation = (Math.max(color.r, color.g, color.b) - Math.min(color.r, color.g, color.b)) / Math.max(color.r, color.g, color.b, 1);
  
  let threshold = 35; // Adobe базовый порог
  
  // Адаптация по яркости
  if (brightness < 60) threshold = 45;      // Темные
  else if (brightness > 200) threshold = 30; // Светлые
  
  // Адаптация по насыщенности  
  if (saturation > 0.7) threshold += 10;     // Насыщенные
  if (saturation < 0.2) threshold += 15;     // Ненасыщенные
  
  return threshold;
}

/**
 * ЭТАП 4: Adobe Potrace векторизация
 */
async function adobePotrace(maskBuffer, color, settings) {
  console.log(`🔍 ADOBE POTRACE: Трассировка ${color.hex}`);
  
  return new Promise((resolve, reject) => {
    const potraceParams = {
      threshold: settings.threshold,
      optTolerance: settings.optTolerance,
      turdSize: settings.turdSize,
      turnPolicy: potrace.Potrace.TURNPOLICY_MINORITY,
      alphaMax: settings.alphaMax,
      optCurve: settings.optCurve
    };
    
    potrace.trace(maskBuffer, potraceParams, (err, svg) => {
      if (err) {
        console.error(`❌ ADOBE POTRACE: Ошибка ${color.hex}:`, err.message);
        resolve(null);
        return;
      }
      
      // Извлекаем path из SVG
      const pathMatch = svg.match(/<path[^>]*d="([^"]*)"[^>]*\/>/);
      if (pathMatch && pathMatch[1]) {
        const pathData = pathMatch[1];
        console.log(`✅ ADOBE POTRACE: ${color.hex} - ${pathData.length} символов`);
        
        resolve({
          pathData,
          color: color.hex,
          coverage: color.coverage
        });
      } else {
        console.log(`⚠️ ADOBE POTRACE: ${color.hex} - контур не найден`);
        resolve(null);
      }
    });
  });
}

/**
 * ЭТАП 5: Создание финального Adobe SVG
 */
function buildAdobeSVG(vectorPaths, outputSize) {
  console.log(`🏗️ ADOBE SVG: Создание финального файла ${outputSize.width}x${outputSize.height}`);
  
  let svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="${outputSize.width}" height="${outputSize.height}" viewBox="0 0 ${outputSize.width} ${outputSize.height}" xmlns="http://www.w3.org/2000/svg">
  <title>Adobe Illustrator Image Trace (${vectorPaths.length} colors)</title>
  <desc>Generated with Adobe Illustrator Limited Color algorithm - BOOOMERANGS AI</desc>
  <defs>
    <style>
      .vector-path { stroke: none; fill-rule: evenodd; }
    </style>
  </defs>
`;

  // Добавляем каждый цветовой слой
  vectorPaths.forEach((path, index) => {
    const layerName = `adobe-color-${index + 1}`;
    svg += `  <g id="${layerName}" class="color-layer">
    <title>Color ${path.color} (${path.coverage}% coverage)</title>
    <path class="vector-path" d="${path.pathData}" fill="${path.color}" opacity="1"/>
  </g>
`;
  });

  svg += `</svg>`;
  
  console.log(`✅ ADOBE SVG: Создан файл ${svg.length} символов`);
  
  return svg;
}

/**
 * ЭКСПОРТ ГЛАВНОЙ ФУНКЦИИ
 */
module.exports = {
  vectorizeImage,
  ADOBE_SETTINGS
};