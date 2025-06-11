/**
 * Интеграция векторизатора в чат для команды "нужен вектор"
 * Прямое подключение к StreamVectorizer с Adobe Illustrator Image Trace алгоритмом
 */

const fetch = require('node-fetch');

/**
 * Обработчик команды "нужен вектор" в потоковом чате
 */
async function handleVectorizerCommand(message, sessionId, res, previousImage) {
  console.log('🎯 [VECTORIZER-CHAT] Запуск команды векторизации');
  
  try {
    // Проверяем наличие изображения
    let imageUrl = null;
    
    if (previousImage && previousImage.url) {
      imageUrl = previousImage.url;
      console.log('🖼️ [VECTORIZER-CHAT] Используем предыдущее изображение');
    } else {
      // Ищем изображение в истории сессии
      try {
        const { getSessionMessages } = require('./chat-history');
        const messages = await getSessionMessages(sessionId);
        
        if (messages && messages.length > 0) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const msg = messages[i];
            if (msg.sender === 'ai' && msg.text) {
              const imageMatch = msg.text.match(/https:\/\/image\.pollinations\.ai\/prompt\/[^\s\)]+/);
              if (imageMatch) {
                imageUrl = imageMatch[0];
                console.log('🔍 [VECTORIZER-CHAT] Найдено изображение в истории');
                break;
              }
            }
          }
        }
      } catch (historyError) {
        console.log('⚠️ [VECTORIZER-CHAT] Ошибка доступа к истории чата:', historyError.message);
      }
    }
    
    if (!imageUrl) {
      sendStreamMessage(res, 'assistant', 
        '🔍 Для векторизации нужно сначала создать или загрузить изображение. Попробуйте сначала сгенерировать изображение, а затем используйте команду "нужен вектор".'
      );
      return false;
    }
    
    // Начинаем процесс векторизации
    sendStreamMessage(res, 'assistant', 
      '🚀 Запускаю векторизацию с Adobe Illustrator Image Trace алгоритмом...'
    );
    
    // Загружаем изображение
    sendStreamMessage(res, 'assistant', '📥 Загружаю изображение для обработки...');
    
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error('Не удалось загрузить изображение');
    }
    
    const imageBuffer = await imageResponse.buffer();
    const imageSizeKB = Math.round(imageBuffer.length / 1024);
    
    sendStreamMessage(res, 'assistant', 
      `📊 Изображение загружено: ${imageSizeKB}KB\n🔄 Начинаю потоковую векторизацию...`
    );
    
    // Создаем векторизатор с настройками для шелкографии
    const { StreamVectorizer } = require('../advanced-vectorizer.cjs');
    const vectorizer = new StreamVectorizer(imageBuffer, {
      maxColors: 5,           // Максимум для шелкографии
      tileSize: 512,          // Оптимальный размер
      overlap: 32,            // Буферизация границ
      maxMemoryMB: 150,       // Ограничение памяти
      tolerance: 1.0,         // Точность векторизации
      enableOptimization: true
    });
    
    // ЭТАП 1: Предобработка
    sendStreamMessage(res, 'assistant', '📐 Этап 1: Предобработка и разбивка на tiles...');
    
    const imageInfo = await vectorizer.initializeImage();
    await vectorizer.runPreprocessing(imageInfo);
    
    sendStreamMessage(res, 'assistant', 
      `✅ Предобработка завершена\n📐 Размеры: ${imageInfo.width}×${imageInfo.height}\n🧩 Создано ${vectorizer.tileProcessor.tiles.length} tiles`
    );
    
    // ЭТАП 2: Цветовая сегментация
    sendStreamMessage(res, 'assistant', '🎨 Этап 2: Глобальная цветовая сегментация...');
    
    await vectorizer.runColorSegmentation();
    
    const colorInfo = vectorizer.globalColorPalette ? 
      vectorizer.globalColorPalette.map((color, i) => 
        `${i + 1}. #${color.hex} (RGB: ${color.r}, ${color.g}, ${color.b})`
      ).join('\n') : 'Палитра не создана';
    
    sendStreamMessage(res, 'assistant', 
      `✅ Цветовая сегментация завершена\n🎨 Палитра из ${vectorizer.globalColorPalette ? vectorizer.globalColorPalette.length : 0} цветов:\n${colorInfo}`
    );
    
    // ЭТАП 3: Создание масок
    sendStreamMessage(res, 'assistant', '🎭 Этап 3: Создание цветовых масок...');
    
    await vectorizer.runMaskCreation();
    
    sendStreamMessage(res, 'assistant', '✅ Цветовые маски созданы');
    
    // ЭТАП 4: Векторизация
    sendStreamMessage(res, 'assistant', '🔄 Этап 4: Векторизация контуров с Marching Squares...');
    
    await vectorizer.runVectorization();
    
    sendStreamMessage(res, 'assistant', 
      `✅ Векторизация завершена\n📊 Создано ${vectorizer.globalContours ? vectorizer.globalContours.length : 0} векторных контуров`
    );
    
    // ЭТАП 5: Генерация SVG
    sendStreamMessage(res, 'assistant', '📄 Этап 5: Потоковая генерация SVG...');
    
    const result = await vectorizer.runSVGGeneration();
    
    // Получаем статистику памяти
    const memStats = vectorizer.memoryManager.getMemoryStatistics();
    
    // Создаем превью SVG для чата
    let svgPreview = '';
    if (result.svgContent && result.svgContent.includes('<svg')) {
      let previewSvg = result.svgContent
        .replace(/width="[^"]*"/g, 'width="400"')
        .replace(/height="[^"]*"/g, 'height="400"')
        .replace(/viewBox="[^"]*"/g, 'viewBox="0 0 400 400"');
      
      if (!previewSvg.includes('</svg>')) {
        previewSvg += '</svg>';
      }
      
      svgPreview = `

**Превью результата:**
\`\`\`svg
${previewSvg}
\`\`\`

`;
    }
    
    // Сохраняем SVG файл
    const fs = require('fs');
    const path = require('path');
    const outputDir = path.join(__dirname, '../output');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    const filename = `vectorized_${Date.now()}.svg`;
    const filepath = path.join(outputDir, filename);
    fs.writeFileSync(filepath, result.svgContent);
    
    console.log('💾 [VECTORIZER-CHAT] SVG сохранен:', filepath);
    
    // Очистка ресурсов
    vectorizer.memoryManager.destroy();
    
    // Отправляем финальный результат
    sendStreamMessage(res, 'assistant', 
      `🎉 Векторизация успешно завершена!${svgPreview}

📊 **Результаты обработки:**
• Исходный размер: ${imageSizeKB}KB
• SVG размер: ${Math.round(result.fileSize / 1024)}KB
• Сжатие: ${((1 - result.fileSize / imageBuffer.length) * 100).toFixed(1)}%
• Время обработки: ${(result.processingTime / 1000).toFixed(2)}s
• Цветов в палитре: ${result.colorCount}
• Векторных контуров: ${result.contourCount}
• Пиковое потребление памяти: ${memStats.max.toFixed(1)}MB

🎨 **Оптимизировано для шелкографии:**
• Максимум 5 цветов
• Высокая детализация контуров
• Adobe Illustrator Image Trace совместимость

✅ Векторное изображение готово к использованию в печати!
📁 Файл сохранен: ${filename}`
    );
    
    return true;
    
  } catch (error) {
    console.error('❌ [VECTORIZER-CHAT] Ошибка векторизации:', error);
    sendStreamMessage(res, 'assistant', 
      `❌ Ошибка при векторизации: ${error.message}

Попробуйте:
• Убедитесь, что изображение загружено корректно
• Проверьте размер файла (рекомендуется до 5MB)
• Попробуйте другое изображение`
    );
    return false;
  }
}

/**
 * Вспомогательная функция для отправки потокового сообщения
 */
function sendStreamMessage(res, role, content) {
  res.write(`event: message\n`);
  res.write(`data: ${JSON.stringify({
    role: role,
    content: content
  })}\n\n`);
}

/**
 * Проверяет, является ли сообщение командой векторизации
 */
function isVectorizerCommand(message) {
  const vectorizerKeywords = [
    'нужен вектор', 
    'векторизуй', 
    'в вектор', 
    'сделай векторным',
    'преобразуй в вектор',
    'svg из изображения',
    'векторная графика'
  ];
  
  const messageLower = message.toLowerCase();
  return vectorizerKeywords.some(keyword => messageLower.includes(keyword));
}

/**
 * Извлекает настройки векторизации из сообщения пользователя
 */
function extractVectorizerSettings(message) {
  const settings = {
    maxColors: 5,           // По умолчанию для шелкографии
    tileSize: 512,
    tolerance: 1.0,
    enableOptimization: true
  };
  
  const messageLower = message.toLowerCase();
  
  // Анализ количества цветов
  const colorMatch = messageLower.match(/(\d+)\s*цвет/);
  if (colorMatch) {
    const colors = parseInt(colorMatch[1]);
    if (colors >= 2 && colors <= 10) {
      settings.maxColors = colors;
    }
  }
  
  // Анализ качества
  if (messageLower.includes('высокое качество') || messageLower.includes('детально')) {
    settings.tolerance = 0.5;
    settings.tileSize = 256;
  } else if (messageLower.includes('быстро') || messageLower.includes('просто')) {
    settings.tolerance = 2.0;
    settings.tileSize = 1024;
  }
  
  return settings;
}

module.exports = {
  handleVectorizerCommand,
  isVectorizerCommand,
  extractVectorizerSettings,
  sendStreamMessage
};