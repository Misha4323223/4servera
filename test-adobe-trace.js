/**
 * Тест Adobe Illustrator алгоритма с реальным изображением
 */

const adobeTracer = require('./adobe-illustrator-tracer.cjs');
const fs = require('fs');
const https = require('https');

async function downloadImage(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (response) => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve(Buffer.concat(chunks)));
      response.on('error', reject);
    }).on('error', reject);
  });
}

async function testWithRealImage() {
  console.log('🧪 Тестирование Adobe алгоритма с реальным изображением...');
  
  try {
    // Загружаем простое изображение для тестирования
    const imageUrl = 'https://image.pollinations.ai/prompt/simple-red-dragon-silhouette?width=400&height=400';
    console.log('📥 Загрузка изображения...');
    
    const imageBuffer = await downloadImage(imageUrl);
    console.log(`✅ Изображение загружено: ${imageBuffer.length} байт`);
    
    // Применяем Adobe алгоритм
    const result = await adobeTracer.adobeImageTrace(imageBuffer, { maxColors: 5 });
    
    if (result.success) {
      console.log('\n🎉 УСПЕХ! Adobe Illustrator Trace работает');
      console.log(`📊 Использовано цветов: ${result.colorsUsed}`);
      console.log(`📏 Размер SVG: ${result.svgContent.length} символов`);
      
      // Анализируем контуры
      const pathMatches = result.svgContent.match(/<path[^>]*>/g) || [];
      console.log(`🎯 Создано контуров: ${pathMatches.length}`);
      
      // Анализируем цвета
      const colorMatches = result.svgContent.match(/fill="[^"]*"/g) || [];
      const uniqueColors = [...new Set(colorMatches)];
      console.log(`🎨 Уникальных цветов: ${uniqueColors.length}`);
      
      uniqueColors.forEach((color, index) => {
        console.log(`  ${index + 1}. ${color}`);
      });
      
      // Сохраняем результат
      const filename = `test-adobe-result-${Date.now()}.svg`;
      fs.writeFileSync(filename, result.svgContent);
      console.log(`💾 Результат сохранен: ${filename}`);
      
      console.log('\n✅ КОНТУРЫ СОЗДАНЫ КАК В ADOBE ILLUSTRATOR');
      
    } else {
      console.log('❌ Ошибка:', result.error);
    }
    
  } catch (error) {
    console.log('❌ Ошибка теста:', error.message);
  }
}

testWithRealImage();