/**
 * Интеллектуальный маршрутизатор сообщений к наиболее подходящим провайдерам
 * Анализирует сообщение и направляет его к специализированным провайдерам
 */

const express = require('express');
const router = express.Router();

// Система логирования
const SmartLogger = {
  route: (message, data) => {
    const timestamp = new Date().toISOString();
    console.log(`🎯 [${timestamp}] SMART ROUTER: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  provider: (message, data) => {
    const timestamp = new Date().toISOString();
    console.log(`🤖 [${timestamp}] PROVIDER: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  success: (message, data) => {
    const timestamp = new Date().toISOString();
    console.log(`✅ [${timestamp}] SUCCESS: ${message}`, data ? JSON.stringify(data, null, 2) : '');
  },
  error: (message, error) => {
    const timestamp = new Date().toISOString();
    console.error(`❌ [${timestamp}] ERROR: ${message}`, error);
  }
};

// Импортируем провайдеры
const chatFreeProvider = require('./chatfree-provider');
const advancedVectorizer = require('../advanced-vectorizer.cjs');
const vectorizerManager = require('./vectorizer-manager');
const printOptimizer = require('./print-optimizer');
const deepspeekProvider = require('./deepspeek-provider');
const claudeProvider = require('./claude-provider');
const deepInfraProvider = require('./deepinfra-provider');
const pythonProviderRoutes = require('./python_provider_routes');
const embroideryHandler = require('./embroidery-chat-handler');
const aiEmbroideryPipeline = require('./ai-embroidery-pipeline');
const webSearchProvider = require('./web-search-provider');
const chatMemory = require('./chat-memory');
// const svgPrintConverter = require('./svg-print-converter'); // Заменен на advancedVectorizer

/**
 * AI с автоматическим поиском при необходимости
 */
async function getAIResponseWithSearch(userQuery, options = {}) {
  try {
    SmartLogger.route(`🤖 Получаем ответ AI с памятью и контекстом`);
    
    // Получаем контекст сессии
    const sessionId = options.sessionId;
    let sessionContext = { context: chatMemory.AI_CAPABILITIES, messageCount: 0 };
    
    if (sessionId) {
      sessionContext = await chatMemory.getSessionContext(sessionId, 5);
      SmartLogger.route(`📋 Загружен контекст сессии ${sessionId}: ${sessionContext.messageCount} сообщений`);
    }

    // Анализируем запрос с учетом контекста
    const requestAnalysis = chatMemory.analyzeRequestWithContext(userQuery, sessionContext);
    SmartLogger.route(`🔍 Анализ запроса:`, requestAnalysis);

    // Сначала проверяем локально на SVG конвертацию  
    const queryLowerForSvg = userQuery.toLowerCase();
    const svgKeywords = ['сохрани в svg', 'сохрани svg', 'экспорт в svg', 'конверт в svg', 'сделай svg', 'сохрани в свг', 'сохрани свг'];
    const isSvgRequest = svgKeywords.some(keyword => queryLowerForSvg.includes(keyword));
    
    // Проверяем запросы на базовую оптимизацию для печати
    const basicPrintKeywords = [
      'оптимизируй для печати', 'оптимизация печати',
      'для шелкографии', 'для dtf', 'для трафаретной печати', 'для сублимации',
      'печать на футболке', 'печать на ткани', 'подготовка к печати'
    ];
    const isPrintOptRequest = basicPrintKeywords.some(keyword => queryLowerForSvg.includes(keyword));
    
    // Команды, которые запускают продвинутую обработку
    const advancedPrintKeywords = [
      'подготовь для печати'  // Эта команда теперь запускает полный цикл
    ];
    const isAdvancedPrintRequest = advancedPrintKeywords.some(keyword => queryLowerForSvg.includes(keyword));
    
    // Проверяем запрос на полную обработку (базовая + продвинутая)
    const fullProcessKeywords = [
      'создай для печати', 'полная обработка', 'всё для печати',
      'комплексная обработка', 'полный цикл'
    ];
    const isFullProcessRequest = fullProcessKeywords.some(keyword => queryLowerForSvg.includes(keyword));
    
    // Проверяем запросы на векторизацию и продвинутую обработку
    const vectorKeywords = [
      'векторизуй', 'сделай вектор', 'создай контуры', 'векторная версия',
      'трафарет', 'контуры для печати', 'черно-белый вариант',
      'векторизация', 'профессиональное качество',
      'продвинутая обработка', 'высокое качество', 'svg', 'свг',
      'в векторы', 'в вектор', 'превратить в svg', 'конвертировать в svg',
      'сделай svg', 'переведи в svg', 'векторный формат', 'trace', 'трейс'
    ];
    
    // Специальная команда для прямого обращения к векторизатору на порту 5006
    const directVectorizerKeywords = ['нужен вектор', 'векторизатор 5006', 'вектор 5006'];
    const isDirectVectorizerRequest = directVectorizerKeywords.some(keyword => queryLowerForSvg.includes(keyword));
    
    // Обработка прямого запроса к векторизатору на порту 5006
    if (isDirectVectorizerRequest) {
      let imageUrl = null;
      
      // Всегда ищем последнее сгенерированное изображение в сессии
      if (options.sessionId) {
        try {
          const sessionContext = await chatMemory.getSessionContext(options.sessionId, 10);
          const lastImageMatch = sessionContext.context.match(/https:\/\/image\.pollinations\.ai\/prompt\/[^\s\)]+/);
          if (lastImageMatch) {
            imageUrl = lastImageMatch[0];
            SmartLogger.route(`🔍 Найдено последнее изображение в сессии: ${imageUrl.substring(0, 100)}...`);
          }
        } catch (error) {
          SmartLogger.error(`Ошибка поиска изображения в сессии:`, error);
        }
      }
      
      if (imageUrl) {
        SmartLogger.route(`🎯 ПРЯМОЙ ЗАПРОС К ВЕКТОРИЗАТОРУ 5006`);
        
        try {
          const fetch = require('node-fetch');
          
          SmartLogger.route(`🌐 Отправляем URL напрямую на векторизатор: ${imageUrl.substring(0, 100)}...`);
          
          // Подготавливаем JSON данные для отправки на /convert-url
          const requestData = {
            imageUrl: imageUrl,
            quality: 'simple',
            outputFormat: 'svg'
          };
        
        const response = await fetch('http://localhost:5006/api/vectorizer/convert-url', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestData),
          timeout: 30000
        });
        
        if (response.ok) {
          const result = await response.json();
          
          if (result.success) {
            const svgResponse = `✅ Векторизация завершена через сервер 5006!

📄 Формат: SVG (5 цветов максимум)  
🎨 Качество: Упрощенная обработка
📁 Файл: ${result.result.filename}

🔗 [Просмотреть изображение](/output/vectorizer/${result.result.filename})
📥 [Скачать SVG файл](/output/vectorizer/${result.result.filename}?download=true)`;

            return {
              success: true,
              response: svgResponse,
              provider: 'Vectorizer-5006',
              model: 'simple-vectorizer',
              category: 'vectorization',
              vectorUrl: `/output/vectorizer/${result.result.filename}`,
              svgContent: result.result.svgContent
            };
          } else {
            throw new Error(result.error || 'Векторизация не удалась');
          }
        } else {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        SmartLogger.error(`Ошибка прямого обращения к векторизатору 5006:`, error);
        return {
          success: false,
          response: `❌ Ошибка векторизатора на порту 5006: ${error.message}`,
          provider: 'Vectorizer-5006',
          error: error.message
        };
      }
    } else {
        // Изображение не найдено в истории сессии
        return {
          success: false,
          response: `❌ Не найдено изображение в истории чата для векторизации.\n\nСначала сгенерируйте изображение, а затем используйте команду "нужен вектор".`,
          provider: 'Vectorizer-5006',
          error: 'No image found in session history'
        };
      }
    }
    
    // Новые ключевые слова для продвинутого векторизатора
    const advancedVectorKeywords = [
      'супер векторизация', 'профи качество', 'ультра svg', 'премиум векторизация',
      'профессиональная векторизация', 'многоформатная векторизация', 'превью векторизации',
      'оптимизация для печати', 'оптимизация для веба', 'векторизация в eps',
      'векторизация в pdf', 'пакетная векторизация', 'потрейс', 'детальная векторизация',
      'качественная векторизация', 'точная векторизация', 'автотрейс', 'автовекторизация'
    ];
    
    const isVectorRequest = vectorKeywords.some(keyword => queryLowerForSvg.includes(keyword));
    const isAdvancedVectorRequest = advancedVectorKeywords.some(keyword => queryLowerForSvg.includes(keyword));
    
    // Проверяем запросы специально на цветовую сепарацию
    const colorSeparationKeywords = [
      'сепарация цветов', 'цветовая сепарация', 'разделение цветов',
      'сепарируй цвета', 'раздели на цвета', 'сепарация',
      'повторно выполнить цветовую сепарацию', 'повтори сепарацию',
      'сделай сепарацию', 'выполни сепарацию', 'запусти сепарацию'
    ];
    
    // Дополнительная проверка точного совпадения
    const exactColorSeparationMatch = queryLowerForSvg === 'сепарация цветов';
    const isColorSeparationRequest = colorSeparationKeywords.some(keyword => queryLowerForSvg.includes(keyword)) || exactColorSeparationMatch;
    
    // Детальная отладка для всех запросов
    console.log(`🔍 ПОЛНАЯ ОТЛАДКА:`);
    console.log(`   Исходный запрос: "${userQuery}"`);
    console.log(`   Нижний регистр: "${queryLowerForSvg}"`);
    console.log(`   Содержит "сепарация": ${queryLowerForSvg.includes('сепарация')}`);
    console.log(`   Содержит "цветов": ${queryLowerForSvg.includes('цветов')}`);
    console.log(`   Точное совпадение: ${exactColorSeparationMatch}`);
    console.log(`   Результат проверки: ${isColorSeparationRequest}`);
    
    // Отладочная информация
    if (isColorSeparationRequest) {
      SmartLogger.route(`🎨 Обнаружен запрос на цветовую сепарацию: "${userQuery}"`);
    }

    // Обработка продвинутых запросов векторизации
    if (isAdvancedVectorRequest) {
      SmartLogger.route(`🚀 Обнаружен запрос на продвинутую векторизацию: "${userQuery}"`);
      
      // Ищем последнее изображение в контексте сессии
      let lastImageUrl = null;
      
      // Получаем сообщения напрямую из базы данных через SQL
      const { db } = require('./db');
      const { aiMessages } = require('../shared/schema');
      const { eq } = require('drizzle-orm');
      
      const messages = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.sessionId, sessionId))
        .orderBy(aiMessages.createdAt);
      
      if (messages && messages.length > 0) {
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          if (msg.content && msg.sender === 'ai' && (msg.content.includes('![') || msg.content.includes('https://image.pollinations.ai'))) {
            const imageMatch1 = msg.content.match(/!\[.*?\]\((https:\/\/image\.pollinations\.ai[^)]+)\)/);
            const imageMatch2 = msg.content.match(/(https:\/\/image\.pollinations\.ai[^\s\)]+)/);
            const imageMatch = imageMatch1 || imageMatch2;
            
            if (imageMatch) {
              lastImageUrl = imageMatch[1];
              break;
            }
          }
        }
      }
      
      if (lastImageUrl) {
        try {
          const advancedVectorizer = require('../advanced-vectorizer.cjs');
          
          // Определяем параметры из запроса
          let quality = 'premium';
          let formats = ['svg'];
          let optimizeFor = 'web';
          let generatePreviews = false;
          
          // Анализируем запрос для выбора режима Adobe Illustrator
          if (queryLowerForSvg.includes('высок') || queryLowerForSvg.includes('детал') || queryLowerForSvg.includes('точн')) {
            quality = 'high-fidelity';
          } else if (queryLowerForSvg.includes('мало цвет') || queryLowerForSvg.includes('упрощ')) {
            quality = 'low-color';
          } else if (queryLowerForSvg.includes('шелкогр') || queryLowerForSvg.includes('печат')) {
            quality = 'silkscreen';
          } else {
            quality = 'auto-color'; // Adobe Illustrator Auto-Color по умолчанию
          }
          
          // Определяем форматы
          if (queryLowerForSvg.includes('eps')) {
            formats.push('eps');
          }
          if (queryLowerForSvg.includes('pdf')) {
            formats.push('pdf');
          }
          if (queryLowerForSvg.includes('многоформат') || queryLowerForSvg.includes('все форматы')) {
            formats = ['svg', 'eps', 'pdf'];
          }
          
          // Определяем оптимизацию
          if (queryLowerForSvg.includes('печат')) {
            optimizeFor = 'print';
          } else if (queryLowerForSvg.includes('лого')) {
            optimizeFor = 'logo';
          } else if (queryLowerForSvg.includes('икон')) {
            optimizeFor = 'icon';
          }
          
          // Отключаем превью по умолчанию для более быстрой обработки
          generatePreviews = false;
          
          SmartLogger.route(`🎯 Параметры векторизации:`, {
            quality,
            formats,
            optimizeFor,
            generatePreviews
          });
          
          // Загружаем изображение
          const fetch = require('node-fetch');
          const response = await fetch(lastImageUrl);
          const imageBuffer = await response.buffer();
          
          // Используем Adobe Illustrator трассировку
          let result;
          try {
            SmartLogger.route(`🎨 Запуск Adobe Illustrator Image Trace (режим: ${quality})`);
            
            result = await advancedVectorizer.adobeIllustratorTrace(
              imageBuffer,
              {
                quality,
                outputFormat: 'svg',
                maxFileSize: 20 * 1024 * 1024 // 20МБ максимум
              }
            );
            
            if (!result.success) {
              throw new Error(result.error || 'Ошибка Adobe Illustrator трассировки');
            }
          } catch (adobeError) {
            SmartLogger.route('Adobe Illustrator трассировка недоступна, используем fallback');
            // Fallback к обычной векторизации
            result = await advancedVectorizer.vectorizeImage(
              imageBuffer,
              'user_image',
              { quality, outputFormat: 'svg' }
            );
          }
          
          if (result.success) {
            let responseText = `✅ **Adobe Illustrator Image Trace завершен!**\n\n`;
            responseText += `🎨 **Режим:** ${result.quality}\n`;
            responseText += `📄 **Формат:** SVG (максимум 5 цветов)\n`;
            responseText += `📏 **Размер файла:** ${(result.fileSize / 1024).toFixed(1)}KB\n`;
            if (result.optimized) {
              responseText += `🗜️ **Оптимизирован:** Да (ограничение 20МБ)\n`;
            }
            responseText += `💾 **Совместимость:** Adobe Illustrator, Figma, Canva\n\n`;
            
            // Информация о качестве
            responseText += `📊 **Параметры обработки:**\n`;
            responseText += `• Качество: ${quality.toUpperCase()}\n`;
            responseText += `• Оптимизация: ${optimizeFor}\n`;
            responseText += `• Обнаруженный тип: ${result.main.detectedType}\n\n`;
            
            // Создаем файлы и ссылки для доступа
            let downloadLinks = '';
            let viewLinks = '';
            
            if (result.main.formats && result.main.formats.length > 0) {
              result.main.formats.forEach(format => {
                const fileName = format.filename;
                downloadLinks += `📥 [Скачать ${format.format.toUpperCase()}](/output/${fileName}) `;
                viewLinks += `👁️ [Просмотр ${format.format.toUpperCase()}](/output/${fileName}) `;
              });
              
              responseText += `📁 **Готовые файлы:**\n`;
              responseText += `${viewLinks}\n`;
              responseText += `${downloadLinks}\n\n`;
            }
            
            // Краткая статистика
            if (result.optimization && result.optimization.success) {
              responseText += `⚡ **Статистика:** Сжатие ${result.optimization.compressionRatio}% | Размер: ${Math.round(result.optimization.optimizedSize/1024)}KB\n\n`;
            }
            
            responseText += `✅ Векторизация выполнена с использованием продвинутого алгоритма`;
            
            return {
              success: true,
              response: responseText,
              provider: 'advanced-vectorizer'
            };
          } else {
            return {
              success: false,
              response: `❌ Ошибка векторизации: ${result.error}`,
              provider: 'advanced-vectorizer'
            };
          }
          
        } catch (error) {
          SmartLogger.error('Ошибка продвинутой векторизации:', error);
          return {
            success: false,
            response: `❌ Ошибка при выполнении векторизации: ${error.message}`,
            provider: 'advanced-vectorizer'
          };
        }
      } else {
        return {
          success: false,
          response: '❌ Для векторизации нужно сначала загрузить или сгенерировать изображение',
          provider: 'advanced-vectorizer'
        };
      }
    }

    if (isSvgRequest) {
      SmartLogger.route(`🎨 Обнаружен запрос на SVG конвертацию локально`);
      
      // Ищем последнее изображение в контексте сессии
      let lastImageUrl = null;
      
      // Получаем сообщения напрямую из базы данных через SQL
      const { db } = require('./db');
      const { aiMessages } = require('../shared/schema');
      const { eq } = require('drizzle-orm');
      
      const messages = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.sessionId, sessionId))
        .orderBy(aiMessages.createdAt);
      
      SmartLogger.route(`🔍 Ищем изображения в базе данных:`, {
        sessionId,
        messagesCount: messages?.length || 0
      });
      
      if (messages && messages.length > 0) {
        // Ищем последнее изображение в сообщениях AI
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          SmartLogger.route(`🔍 Проверяем сообщение ${i}:`, {
            sender: msg.sender,
            hasContent: !!msg.content,
            contentLength: msg.content?.length || 0,
            hasImage: msg.content?.includes('![') || false,
            hasPollinations: msg.content?.includes('https://image.pollinations.ai') || false
          });
          
          if (msg.content && msg.sender === 'ai' && (msg.content.includes('![') || msg.content.includes('https://image.pollinations.ai'))) {
            // Проверяем разные форматы изображений
            const imageMatch1 = msg.content.match(/!\[.*?\]\((https:\/\/image\.pollinations\.ai[^)]+)\)/);
            const imageMatch2 = msg.content.match(/(https:\/\/image\.pollinations\.ai[^\s\)]+)/);
            
            const imageMatch = imageMatch1 || imageMatch2;
            
            if (imageMatch) {
              lastImageUrl = imageMatch[1];
              SmartLogger.route(`🖼️ Найдено последнее изображение: ${lastImageUrl.substring(0, 80)}...`);
              break;
            }
          }
        }
      }
      
      SmartLogger.route(`🔍 Результат поиска изображения:`, {
        found: !!lastImageUrl,
        url: lastImageUrl ? lastImageUrl.substring(0, 50) + '...' : null
      });
      
      if (lastImageUrl) {
        try {
          SmartLogger.route(`🎨 Создаем SVG файлы для найденного изображения`);
          const printType = svgPrintConverter.detectPrintTypeFromRequest(userQuery);
          const svgResult = await svgPrintConverter.convertImageToPrintSVG(
            lastImageUrl, 
            `converted-${Date.now()}`, 
            printType,
            userQuery
          );
          
          if (svgResult.success) {
            let response = `Готово! Я преобразовал ваше изображение в SVG формат для печати:\n\n📄 **Файлы для печати созданы:**`;
            
            svgResult.result.files.forEach(file => {
              if (file.type === 'screenprint') {
                response += `\n• [SVG для шелкографии](${file.url}) - ${(file.size / 1024).toFixed(1)} КБ`;
              } else if (file.type === 'dtf') {
                response += `\n• [SVG для DTF печати](${file.url}) - ${(file.size / 1024).toFixed(1)} КБ`;
              } else if (file.type === 'colorscheme') {
                response += `\n• [Цветовая схема](${file.url}) - палитра цветов`;
              }
            });
            
            if (svgResult.result.recommendations.screenprint) {
              response += `\n\n**Рекомендации для шелкографии:** ${svgResult.result.recommendations.screenprint.notes}`;
            }
            if (svgResult.result.recommendations.dtf) {
              response += `\n**Рекомендации для DTF:** ${svgResult.result.recommendations.dtf.notes}`;
            }
            
            if (svgResult.result.aiAnalysis && svgResult.result.aiAnalysis.recommendations) {
              response += `\n\n🤖 **Экспертные рекомендации AI:** ${svgResult.result.aiAnalysis.recommendations}`;
            }
            
            return {
              success: true,
              response: response,
              provider: 'SVG_Print_Converter',
              searchUsed: false,
              svgGenerated: true,
              svgFiles: svgResult.result.files
            };
          } else {
            return {
              success: true,
              response: `Извините, произошла ошибка при создании SVG файлов: ${svgResult.error}`,
              provider: 'SVG_Print_Converter',
              searchUsed: false,
              svgGenerated: false
            };
          }
        } catch (error) {
          SmartLogger.error('Ошибка при создании SVG файлов:', error);
          return {
            success: true,
            response: `Извините, произошла ошибка при обработке изображения. Попробуйте позже.`,
            provider: 'SVG_Print_Converter',
            searchUsed: false,
            svgGenerated: false
          };
        }
      } else {
        return {
          success: true,
          response: `Я не нашел изображений в нашей беседе для конвертации в SVG. Сначала создайте изображение, а затем попросите сохранить его в SVG формате.`,
          provider: 'SVG_Print_Converter',
          searchUsed: false,
          svgGenerated: false
        };
      }
    }

    // Обработка запросов оптимизации для печати
    if (isPrintOptRequest || isVectorRequest || isFullProcessRequest || isAdvancedPrintRequest || isColorSeparationRequest) {
      SmartLogger.route(`🖨️ Обнаружен запрос на оптимизацию для печати`);
      
      // Специальная отладка для цветовой сепарации
      if (isColorSeparationRequest) {
        SmartLogger.route(`🎨 Подтверждено: это запрос на цветовую сепарацию!`);
      }
      
      // Ищем последнее изображение в контексте сессии
      let lastImageUrl = null;
      
      // Получаем сообщения напрямую из базы данных через SQL
      const { db } = require('./db');
      const { aiMessages } = require('../shared/schema');
      const { eq } = require('drizzle-orm');
      
      const messages = await db
        .select()
        .from(aiMessages)
        .where(eq(aiMessages.sessionId, sessionId))
        .orderBy(aiMessages.createdAt);
      
      SmartLogger.route(`🔍 Ищем изображения для оптимизации:`, {
        sessionId,
        messagesCount: messages?.length || 0
      });
      
      if (messages && messages.length > 0) {
        // Ищем последнее изображение в сообщениях AI
        for (let i = messages.length - 1; i >= 0; i--) {
          const msg = messages[i];
          
          if (msg.content && msg.sender === 'ai' && (msg.content.includes('![') || msg.content.includes('https://image.pollinations.ai'))) {
            // Проверяем разные форматы изображений
            const imageMatch1 = msg.content.match(/!\[.*?\]\((https:\/\/image\.pollinations\.ai[^)]+)\)/);
            const imageMatch2 = msg.content.match(/(https:\/\/image\.pollinations\.ai[^\s\)]+)/);
            
            const imageMatch = imageMatch1 || imageMatch2;
            
            if (imageMatch) {
              lastImageUrl = imageMatch[1];
              SmartLogger.route(`🖼️ Найдено изображение для оптимизации: ${lastImageUrl.substring(0, 80)}...`);
              break;
            }
          }
        }
      }
      
      if (lastImageUrl) {
        try {
          SmartLogger.route(`🖨️ Начинаем оптимизацию изображения для печати`);
          
          // Определяем тип обработки из запроса
          let printType = 'both'; // по умолчанию и шелкография и DTF
          let useAdvanced = false;
          
          if (queryLowerForSvg.includes('шелкографи') || queryLowerForSvg.includes('трафарет')) {
            printType = 'screen-print';
          } else if (queryLowerForSvg.includes('dtf') || queryLowerForSvg.includes('сублимаци')) {
            printType = 'dtf';
          }
          
          // Проверяем, нужна ли продвинутая обработка
          if (queryLowerForSvg.includes('вектор') || queryLowerForSvg.includes('сепараци') || 
              queryLowerForSvg.includes('профессиональ') || queryLowerForSvg.includes('качеств') ||
              isFullProcessRequest || isAdvancedPrintRequest || isColorSeparationRequest) {
            useAdvanced = true;
          }
          
          let optimization;
          
          if (useAdvanced) {
            // Используем продвинутую обработку
            const { processImageAdvanced } = require('./advanced-vector-processor');
            
            const advancedOptions = {
              createVector: isFullProcessRequest || isAdvancedPrintRequest || queryLowerForSvg.includes('вектор') || queryLowerForSvg.includes('svg'),
              colorSeparation: isFullProcessRequest || isAdvancedPrintRequest || isColorSeparationRequest || queryLowerForSvg.includes('сепараци') || queryLowerForSvg.includes('цвет'),
              targetColors: 4
            };
            
            const advancedResult = await processImageAdvanced(lastImageUrl, advancedOptions);
            
            // Также выполняем стандартную оптимизацию
            optimization = await printOptimizer.optimizeImageForPrint(lastImageUrl, printType);
            optimization.advanced = advancedResult;
          } else {
            optimization = await printOptimizer.optimizeImageForPrint(lastImageUrl, printType);
          }
          
          if (optimization.success) {
            let response;
            if (isFullProcessRequest || isAdvancedPrintRequest) {
              response = `Готово! Выполнен полный цикл обработки изображения:\n\n📁 **Созданы файлы с прямыми ссылками (базовая + продвинутая обработка):**`;
            } else {
              response = `Готово! Я оптимизировал ваше изображение для профессиональной печати:\n\n📁 **Созданы файлы с прямыми ссылками:**`;
            }
            
            if (optimization.optimizations.screenPrint) {
              response += `\n\n🖨️ **Для шелкографии:**`;
              
              // Добавляем информацию об интеллектуальном анализе
              if (optimization.optimizations.screenPrint.intelligentAnalysis) {
                const analysis = optimization.optimizations.screenPrint.intelligentAnalysis;
                response += `\n📊 *Интеллектуальный анализ: ${analysis.complexity} изображение, рекомендуется ${analysis.colors} цветов*`;
                response += `\n💡 *${analysis.reason}*`;
              }
              
              const screenFiles = optimization.optimizations.screenPrint.files;
              if (screenFiles.enhanced) {
                const filename = screenFiles.enhanced.split('/').pop();
                response += `\n• [Улучшенная версия (3000x3000)](/output/screen-print/${filename})`;
              }
              if (screenFiles.highContrast) {
                const filename = screenFiles.highContrast.split('/').pop();
                response += `\n• [Высококонтрастная версия](/output/screen-print/${filename})`;
              }
              if (screenFiles.limitedPalette) {
                const filename = screenFiles.limitedPalette.split('/').pop();
                response += `\n• [Версия с ограниченной палитрой](/output/screen-print/${filename})`;
              }
              if (screenFiles.edges) {
                const filename = screenFiles.edges.split('/').pop();
                response += `\n• [Контуры для трафаретов](/output/screen-print/${filename})`;
              }
            }
            
            if (optimization.optimizations.dtf) {
              response += `\n\n🎨 **Для DTF печати (цветные):**`;
              const dtfFiles = optimization.optimizations.dtf.files;
              if (dtfFiles.main) {
                const filename = dtfFiles.main.split('/').pop();
                response += `\n• [Основная версия (3600x3600)](/output/dtf-print/${filename})`;
              }
              if (dtfFiles.large) {
                const filename = dtfFiles.large.split('/').pop();
                response += `\n• [Увеличенная версия (5400x5400)](/output/dtf-print/${filename})`;
              }
              if (dtfFiles.transparent) {
                const filename = dtfFiles.transparent.split('/').pop();
                response += `\n• [Версия с прозрачным фоном](/output/dtf-print/${filename})`;
              }
              if (dtfFiles.whiteBase) {
                const filename = dtfFiles.whiteBase.split('/').pop();
                response += `\n• [Белая подложка для темных тканей](/output/dtf-print/${filename})`;
              }
            }
            
            if (optimization.optimizations.vector) {
              response += `\n\n📐 **Векторные версии:**`;
              const vectorFiles = optimization.optimizations.vector.files;
              if (vectorFiles.blackWhite) {
                const filename = vectorFiles.blackWhite.split('/').pop();
                response += `\n• [Черно-белая версия (2048x2048)](/output/vector/${filename})`;
              }
              if (vectorFiles.contours) {
                const filename = vectorFiles.contours.split('/').pop();
                response += `\n• [Контурная версия](/output/vector/${filename})`;
              }
            }
            
            // Добавляем результаты продвинутой обработки
            if (optimization.advanced && optimization.advanced.success) {
              response += `\n\n🎯 **Продвинутая обработка:**`;
              
              // Векторные файлы
              const vectorFiles = optimization.advanced.files.filter(f => f.type === 'vector');
              if (vectorFiles.length > 0) {
                response += `\n\n📐 **Векторные файлы:**`;
                vectorFiles.forEach(file => {
                  response += `\n• [SVG векторная версия](${file.url})`;
                  if (file.colors && file.colors.length > 0) {
                    response += ` (${file.colors.length} цветов)`;
                  }
                });
              }
              
              // Цветовые сепарации
              const separationFiles = optimization.advanced.files.filter(f => f.type === 'color-separation');
              if (separationFiles.length > 0) {
                response += `\n\n🎨 **Цветовые сепарации:**`;
                separationFiles.forEach(sepFile => {
                  if (sepFile.separations) {
                    sepFile.separations.forEach((sep, index) => {
                      response += `\n• [Сепарация цвета ${index + 1}](${sep.url}) - ${sep.color}`;
                    });
                  }
                  if (sepFile.composite) {
                    response += `\n• [Композитная версия](${sepFile.composite.url})`;
                  }
                });
              }
              
              // Анализ цветов
              if (optimization.advanced.analysis) {
                const analysis = optimization.advanced.analysis;
                response += `\n\n📊 **Анализ цветов:**`;
                response += `\n• Доминирующий цвет: ${analysis.dominant}`;
                if (analysis.distribution && analysis.distribution.length > 0) {
                  response += `\n• Распределение цветов:`;
                  analysis.distribution.slice(0, 3).forEach(color => {
                    response += `\n  - ${color.hex} (${color.percentage}%)`;
                  });
                }
              }
            }
            
            response += `\n\n✅ Все файлы готовы к скачиванию по ссылкам выше. DTF файлы сохранили полную цветовую гамму для качественной печати.`;
            
            return {
              success: true,
              response: response,
              provider: 'Print_Optimizer',
              searchUsed: false,
              printOptimized: true
            };
          } else {
            return {
              success: true,
              response: `Извините, произошла ошибка при оптимизации изображения: ${optimization.error}`,
              provider: 'Print_Optimizer',
              searchUsed: false,
              printOptimized: false
            };
          }
        } catch (error) {
          SmartLogger.error('Ошибка при оптимизации изображения:', error);
          return {
            success: true,
            response: `Извините, произошла ошибка при обработке изображения. Попробуйте позже.`,
            provider: 'Print_Optimizer',
            searchUsed: false,
            printOptimized: false
          };
        }
      } else {
        return {
          success: true,
          response: `Я не нашел изображений в нашей беседе для оптимизации. Сначала создайте изображение, а затем попросите оптимизировать его для печати.`,
          provider: 'Print_Optimizer',
          searchUsed: false,
          printOptimized: false
        };
      }
    }

    const pythonProvider = require('./python_provider_routes');
    
    // Проверяем запросы на генерацию изображений напрямую
    const imageKeywords = ['нарисуй', 'создай', 'сгенерируй', 'принт', 'дизайн', 'картинка', 'изображение', 'логотип', 'баннер', 'футболка', 'рисунок', 'вышивка', 'вышивку', 'embroidery'];
    const isImageRequest = imageKeywords.some(keyword => queryLowerForSvg.includes(keyword));
    
    if (isImageRequest) {
      SmartLogger.route(`🎨 Обнаружен запрос на генерацию изображения`);
      
      // Проверяем, это запрос на вышивку
      const isEmbroideryRequest = userQuery.toLowerCase().includes('вышивка') || 
                                 userQuery.toLowerCase().includes('вышивку') || 
                                 userQuery.toLowerCase().includes('embroidery');
      
      // Импортируем генератор изображений
      const aiImageGenerator = require('./ai-image-generator');
      
      try {
        // Определяем правильный стиль для генерации
        let imageStyle = 'realistic';
        if (isEmbroideryRequest) {
          imageStyle = 'embroidery';
        } else if (userQuery.toLowerCase().includes('принт') || userQuery.toLowerCase().includes('футболка') || userQuery.toLowerCase().includes('дизайн')) {
          imageStyle = 'vector';
        }
        
        const imageResult = await aiImageGenerator.generateImage(userQuery, imageStyle);
        
        if (imageResult.success && imageResult.imageUrl) {
          let response = `Я создал изображение по вашему запросу! Вот результат:

![Сгенерированное изображение](${imageResult.imageUrl})

Изображение сохранено и готово к использованию.`;

          // Если это запрос на вышивку, добавляем конвертацию в файлы вышивки
          if (isEmbroideryRequest) {
            try {
              const embroideryHandler = require('./embroidery-chat-handler');
              const embroideryResult = await embroideryHandler.processEmbroideryGeneration(imageResult.imageUrl, userQuery);
              
              if (embroideryResult.success && embroideryResult.files && embroideryResult.files.length > 0) {
                response += `\n\n📄 **Файлы для вышивки созданы:**`;
                
                // Группируем файлы по типу
                const embroideryFiles = embroideryResult.files.filter(f => f.type === 'embroidery');
                const preparedImage = embroideryResult.files.find(f => f.type === 'prepared_image');
                const colorScheme = embroideryResult.files.find(f => f.type === 'color_scheme');
                
                embroideryFiles.forEach(file => {
                  const sizeKB = (file.size / 1024).toFixed(1);
                  response += `\n• [${file.format.toUpperCase()} файл](${file.url}) - ${sizeKB} КБ`;
                });
                
                if (preparedImage) {
                  const sizeKB = (preparedImage.size / 1024).toFixed(1);
                  response += `\n• [Подготовленное изображение](${preparedImage.url}) - ${sizeKB} КБ`;
                }
                
                if (colorScheme) {
                  const sizeKB = (colorScheme.size / 1024).toFixed(1);
                  response += `\n• [Цветовая схема](${colorScheme.url}) - ${sizeKB} КБ`;
                }
                
                // Добавляем превью вышивки на ткани
                if (embroideryResult.previewUrl) {
                  response += `\n\n🧵 **Превью на ткани:** [Как будет выглядеть вышивка](${embroideryResult.previewUrl})`;
                }
                
                if (embroideryResult.recommendations) {
                  response += `\n\n🧵 **Рекомендации для вышивки:** ${embroideryResult.recommendations}`;
                }
              }
            } catch (embError) {
              SmartLogger.error('Ошибка конвертации в файлы вышивки:', embError);
              response += `\n\nДля конвертации в файлы вышивки напишите "конвертировать в вышивку".`;
            }
          } else {
            response += ` Если нужно что-то изменить, просто опишите что хотите поправить.`;
          }
          
          return {
            success: true,
            response: response,
            provider: 'AI_Image_Generator',
            searchUsed: false,
            imageGenerated: true,
            imageUrl: imageResult.imageUrl
          };
        } else {
          return {
            success: true,
            response: `К сожалению, произошла ошибка при генерации изображения. Попробуйте переформулировать запрос или попробовать позже.`,
            provider: 'AI_Image_Generator',
            searchUsed: false,
            imageGenerated: false
          };
        }
      } catch (error) {
        SmartLogger.error('Ошибка генерации изображения:', error);
        return {
          success: true,
          response: `Извините, система генерации изображений временно недоступна. Попробуйте позже.`,
          provider: 'AI_Image_Generator',
          searchUsed: false,
          imageGenerated: false
        };
      }
    }
    
    // Проверяем запросы времени/даты напрямую
    const timeQueries = ['время', 'сейчас время', 'какое время', 'который час', 'сегодня число', 'какое число', 'какая дата'];
    const isTimeQuery = timeQueries.some(q => queryLowerForSvg.includes(q));
    
    if (isTimeQuery) {
      const now = new Date();
      const timeStr = now.toLocaleString('ru-RU', { 
        timeZone: 'Europe/Moscow',
        year: 'numeric',
        month: 'long', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        weekday: 'long'
      });
      
      return {
        success: true,
        response: `Сейчас: ${timeStr} (московское время)`,
        provider: 'TimeProvider',
        searchUsed: false
      };
    }

    // Проверяем запросы автоматизации BOOOMERANGS
    const automationResult = await handleAutomationRequest(userQuery);
    if (automationResult) {
      SmartLogger.route(`🤖 Обработан запрос автоматизации`);
      return automationResult;
    }

    // Сначала проверяем поисковые запросы напрямую
    const searchKeywords = [
      'найди', 'поищи', 'найти', 'поиск', 'новости', 'последние', 
      'актуальные', 'свежие', 'что происходит', 'что случилось',
      'курс', 'цена', 'стоимость', 'погода', 'информация о'
    ];
    
    const needsSearchDirect = searchKeywords.some(keyword => 
      userQuery.toLowerCase().includes(keyword)
    );
    
    SmartLogger.route(`🔍 ПРОВЕРКА ПОИСКА: "${userQuery}"`);
    SmartLogger.route(`🔍 Найдены ключевые слова: ${needsSearchDirect}`);
    
    if (needsSearchDirect) {
      SmartLogger.route(`🔍 АКТИВИРОВАН ПРЯМОЙ ПОИСК!`);
      
      try {
        // Выполняем поиск напрямую через Python
        SmartLogger.route(`🔍 Выполняем Python поиск для: "${userQuery}"`);
        
        const { spawn } = require('child_process');
        
        const searchResult = await new Promise((resolve) => {
          const pythonScript = `
import sys
import json
try:
    from duckduckgo_search import DDGS
    
    query = "${userQuery.replace(/"/g, '\\"')}"
    results = []
    
    with DDGS() as ddgs:
        search_results = list(ddgs.text(query, max_results=10))
        for result in search_results:
            results.append({
                'title': result.get('title', ''),
                'snippet': result.get('body', ''),
                'url': result.get('href', ''),
                'source': 'DuckDuckGo'
            })
    
    print(json.dumps({
        'success': True,
        'results': results,
        'total': len(results)
    }))
    
except Exception as e:
    print(json.dumps({
        'success': False,
        'error': str(e),
        'results': []
    }))
`;

          const python = spawn('python3', ['-c', pythonScript]);
          let output = '';
          
          python.stdout.on('data', (data) => {
            output += data.toString();
          });
          
          python.on('close', (code) => {
            SmartLogger.route(`🔍 Python поиск завершен с кодом: ${code}`);
            try {
              const result = JSON.parse(output.trim());
              SmartLogger.route(`🔍 Результатов найдено: ${result.results?.length || 0}`);
              resolve(result);
            } catch (parseError) {
              SmartLogger.error(`🔍 Ошибка парсинга: ${parseError}`);
              resolve({ success: false, error: 'Ошибка парсинга', results: [] });
            }
          });
          
          python.on('error', (error) => {
            SmartLogger.error(`🔍 Ошибка Python: ${error}`);
            resolve({ success: false, error: error.message, results: [] });
          });
        });
        
        if (searchResult && searchResult.success && searchResult.results && searchResult.results.length > 0) {
          SmartLogger.route(`🔍 ПОИСК УСПЕШЕН! Найдено ${searchResult.results.length} результатов`);
          
          try {
            // Загружаем и парсим содержимое найденных страниц
            const { enrichSearchResults } = require('./web-content-parser');
            SmartLogger.route(`🔍 Загружаем содержимое страниц...`);
            
            const enrichedResults = await enrichSearchResults(searchResult.results);
            
            SmartLogger.route(`🔍 СОДЕРЖИМОЕ ЗАГРУЖЕНО! Обработано ${enrichedResults.length} страниц`);
            
            // Формируем ответ с актуальным содержимым
            const formattedResponse = `🔍 **Актуальная информация:**

${enrichedResults.slice(0, 3).map((r, i) => 
`**${i + 1}. ${r.title}**

${r.content}

*Источник: ${new URL(r.source).hostname}*

---

`).join('')}📊 **Обработано источников:** ${enrichedResults.length}`;

            return {
              success: true,
              response: formattedResponse,
              provider: 'Search_Content',
              searchUsed: true,
              searchType: 'content_parsed',
              resultsCount: enrichedResults.length
            };
            
          } catch (parseError) {
            SmartLogger.route(`❌ Ошибка парсинга: ${parseError.message}, используем базовые результаты`);
            
            // Fallback к обычному отображению
            const formattedResponse = `🔍 **Найдена актуальная информация:**

${searchResult.results.slice(0, 5).map((r, i) => 
`**${i + 1}. ${r.title}**  
${r.snippet}  
🔗 [Источник](${r.url})

`).join('')}📊 **Всего найдено:** ${searchResult.results.length} результатов`;

            return {
              success: true,
              response: formattedResponse,
              provider: 'Search_DuckDuckGo',
              searchUsed: true,
              searchType: 'duckduckgo',
              resultsCount: searchResult.results.length
            };
          }
        } else {
          SmartLogger.route(`🔍 Поиск не дал результатов`);
        }
      } catch (error) {
        SmartLogger.error(`🔍 Ошибка поиска: ${error.message}`);
      }
    }

    const prompt = `Проанализируй запрос пользователя и определи тип действия:

Запрос: "${userQuery}"

КОНТЕКСТ СЕССИИ:
${sessionContext.context}

СТРОГО СЛЕДУЙ ЭТИМ ПРАВИЛАМ:
1. Если пользователь просит НАРИСОВАТЬ, СОЗДАТЬ ИЗОБРАЖЕНИЕ, СГЕНЕРИРОВАТЬ КАРТИНКУ, ПРИНТ или ДИЗАЙН - отвечай ТОЛЬКО: "ГЕНЕРАЦИЯ_ИЗОБРАЖЕНИЯ"
2. Иначе дай обычный ответ

Ключевые слова для генерации изображений: нарисуй, создай, сгенерируй, принт, дизайн, картинка, изображение, логотип, баннер`;

    const initialResult = await pythonProvider.callPythonAI(prompt, 'Qwen_Qwen_2_72B');
    
    let responseText = '';
    if (typeof initialResult === 'string') {
      responseText = initialResult;
    } else if (initialResult && initialResult.response) {
      responseText = initialResult.response;
    }
    
    SmartLogger.route(`🤖 AI ответил: "${responseText.substring(0, 50)}..."`);
    
    // Если AI говорит, что нужна генерация изображения
    if (responseText.includes('ГЕНЕРАЦИЯ_ИЗОБРАЖЕНИЯ')) {
      SmartLogger.route(`🎨 AI запросил генерацию изображения`);
      
      // Импортируем генератор изображений
      const aiImageGenerator = require('./ai-image-generator');
      
      try {
        const imageResult = await aiImageGenerator.generateImage(userQuery, 'realistic');
        
        if (imageResult.success && imageResult.imageUrl) {
          return {
            success: true,
            response: `Я создал изображение по вашему запросу! Вот результат:

![Сгенерированное изображение](${imageResult.imageUrl})

Изображение сохранено и готово к использованию. Если нужно что-то изменить, просто опишите что хотите поправить.`,
            provider: 'AI_Image_Generator',
            searchUsed: false,
            imageGenerated: true,
            imageUrl: imageResult.imageUrl
          };
        } else {
          return {
            success: true,
            response: `К сожалению, произошла ошибка при генерации изображения. Попробуйте переформулировать запрос или попробовать позже.`,
            provider: 'AI_Image_Generator',
            searchUsed: false,
            imageGenerated: false
          };
        }
      } catch (error) {
        SmartLogger.error('Ошибка генерации изображения:', error);
        return {
          success: true,
          response: `Извините, система генерации изображений временно недоступна. Попробуйте позже.`,
          provider: 'AI_Image_Generator',
          searchUsed: false,
          imageGenerated: false
        };
      }
    }
    

    
    // Если AI говорит, что нужен поиск
    if (responseText.includes('НУЖЕН_ПОИСК')) {
      SmartLogger.route(`🔍 AI запросил поиск`);
      
      // Определяем тип поиска
      const advancedSearchKeywords = [
        'найди подробно', 'полный поиск', 'всестороннее исследование', 
        'академический поиск', 'научные статьи', 'последние новости',
        'поиск в реальном времени', 'свежая информация', 'актуальные данные',
        'комплексный анализ', 'детальное исследование'
      ];
      
      const needsAdvancedSearch = advancedSearchKeywords.some(keyword => 
        userQuery.toLowerCase().includes(keyword)
      );
      
      let searchResults;
      
      if (needsAdvancedSearch) {
        SmartLogger.route(`🔍 Выполняем расширенный поиск`);
        const { performAdvancedSearch } = require('./advanced-search-provider');
        
        // Определяем тип расширенного поиска
        let searchType = 'comprehensive';
        if (userQuery.toLowerCase().includes('новости')) searchType = 'news';
        if (userQuery.toLowerCase().includes('академический') || userQuery.toLowerCase().includes('научны')) searchType = 'academic';
        if (userQuery.toLowerCase().includes('изображени') || userQuery.toLowerCase().includes('картинк')) searchType = 'images';
        
        searchResults = await performAdvancedSearch(userQuery, {
          searchType,
          maxResults: 15,
          includeAnalysis: true
        });
      } else {
        SmartLogger.route(`🔍 Выполняем обычный веб-поиск`);
        searchResults = await webSearchProvider.performWebSearch(userQuery);
      }
      
      if (searchResults.success && searchResults.results && searchResults.results.length > 0) {
        let searchContext;
        
        if (needsAdvancedSearch && searchResults.analysis) {
          // Формируем расширенный контекст с анализом
          searchContext = `РЕЗУЛЬТАТЫ РАСШИРЕННОГО ПОИСКА:
Найдено ${searchResults.totalResults} результатов из ${searchResults.analysis.sources.length} источников.

КРАТКИЙ АНАЛИЗ: ${searchResults.analysis.summary}

КЛЮЧЕВЫЕ ФАКТЫ:
${searchResults.analysis.keyFacts.join('\n')}

ТОП РЕЗУЛЬТАТЫ:
${searchResults.analysis.topResults.map(r => `• ${r.title}: ${r.snippet} (${r.url})`).join('\n')}

УРОВЕНЬ ДОСТОВЕРНОСТИ: ${searchResults.analysis.confidence}%`;
        } else {
          searchContext = webSearchProvider.formatSearchResultsForAI(searchResults);
        }
        
        SmartLogger.route(`🔍 Найдено результатов: ${searchResults.results.length}`);
        SmartLogger.route(`🔍 Контекст: ${searchContext.substring(0, 200)}...`);
        
        // Отправляем AI данные из поиска
        const searchPrompt = `Ты - AI ассистент с доступом к расширенному поиску. Пользователь спрашивает: "${userQuery}"

${searchContext}

ОБЯЗАТЕЛЬНО:
- Отвечай на основе ТОЛЬКО актуальных данных выше
- Упоминай источники информации и уровень достоверности
- Если использовался расширенный поиск, укажи это
- Структурируй ответ логично с ключевыми фактами

Ответь подробно на основе этих данных.`;

        SmartLogger.route(`🔍 Отправляем AI промпт с данными поиска`);
        const finalResult = await pythonProvider.callPythonAI(searchPrompt, 'Qwen_Qwen_2_72B');
        
        let finalText = '';
        if (typeof finalResult === 'string') {
          finalText = finalResult;
        } else if (finalResult && finalResult.response) {
          finalText = finalResult.response;
        }
        
        if (finalText && finalText.length > 20) {
          return {
            success: true,
            response: finalText,
            provider: 'Qwen_Qwen_2_72B',
            searchUsed: true,
            searchType: needsAdvancedSearch ? 'advanced' : 'basic'
          };
        }
      }
      
      return { success: false, reason: 'search_failed' };
    } else {
      // AI дал обычный ответ - но нужно проверить, не является ли это запросом на генерацию
      
      // Проверяем специфичные промпты для разных типов генерации
      const isGeneralImageRequest = queryLowerForSvg.includes('создай изображение');
      const isPrintRequest = queryLowerForSvg.includes('создай принт');
      const isEmbroideryGeneration = queryLowerForSvg.includes('создай вышивку');
      
      // Дополнительные ключевые слова для совместимости
      const additionalImageKeywords = ['нарисуй', 'сгенерируй', 'картинка', 'логотип', 'баннер'];
      const embroideryKeywords = ['dst', 'pes', 'jef', 'exp', 'vp3'];
      
      // Исключаем запросы на анализ трендов и бизнес-функции
      const isTrendAnalysis = queryLowerForSvg.includes('тренд') || queryLowerForSvg.includes('анализ') || queryLowerForSvg.includes('популярн');
      const isBusinessFunction = queryLowerForSvg.includes('рассчит') || queryLowerForSvg.includes('калькул') || queryLowerForSvg.includes('предложение');
      
      const hasEmbroideryFormats = embroideryKeywords.some(keyword => queryLowerForSvg.includes(keyword));
      const needsEmbroideryConversion = isEmbroideryGeneration || hasEmbroideryFormats;
      
      const isImageRequest = !isTrendAnalysis && !isBusinessFunction && (
        isGeneralImageRequest || 
        isPrintRequest || 
        isEmbroideryGeneration ||
        additionalImageKeywords.some(keyword => queryLowerForSvg.includes(keyword))
      );
      
      if (isImageRequest) {
        SmartLogger.route(`🎨 Обнаружен запрос на генерацию изображения через ключевые слова`);
        
        // Проверяем, нужна ли конвертация в формат вышивки
        if (needsEmbroideryConversion) {
          SmartLogger.route(`🧵 Запрос включает создание вышивки`);
          
          try {
            const aiEmbroideryPipeline = require('./ai-embroidery-pipeline');
            const embroideryResult = await aiEmbroideryPipeline.generateAndConvertToEmbroidery(userQuery, options);
            
            if (embroideryResult.success) {
              // Формируем ответ с изображением и файлами вышивки
              let response = `Готово! Я создал дизайн для вышивки по вашему запросу.

![Дизайн для вышивки](${embroideryResult.generatedImage})

🧵 **Файлы для вышивальной машины:**`;

              if (embroideryResult.files && embroideryResult.files.length > 0) {
                embroideryResult.files.forEach(file => {
                  response += `\n• [${file.filename}](${file.url}) - ${file.format} (${(file.size / 1024).toFixed(1)} КБ)`;
                });
              }

              response += `\n\n📊 **Характеристики:**
• Формат: ${embroideryResult.embroideryFormat.name}
• Размер: ${embroideryResult.details.size}
• Цветов: ${embroideryResult.details.colors}
• Нити: ${embroideryResult.details.threadsNeeded}

${embroideryResult.instructions.join('\n')}`;

              if (embroideryResult.aiOptimizationReport) {
                response += `\n\n🤖 **AI Рекомендации:**\n${embroideryResult.aiOptimizationReport}`;
              }

              return {
                success: true,
                response: response,
                provider: 'AI_Embroidery_Pipeline',
                searchUsed: false,
                imageGenerated: true,
                embroideryGenerated: true,
                imageUrl: embroideryResult.generatedImage,
                embroideryFiles: embroideryResult.files
              };
            } else {
              // Если пайплайн вышивки не сработал, делаем обычное изображение
              SmartLogger.route(`⚠️ Пайплайн вышивки не сработал, создаем обычное изображение`);
            }
          } catch (error) {
            SmartLogger.error('Ошибка пайплайна вышивки:', error);
            SmartLogger.route(`⚠️ Ошибка пайплайна вышивки, создаем обычное изображение`);
          }
        }
        
        // Обычная генерация изображения
        const aiImageGenerator = require('./ai-image-generator');
        
        try {
          const imageResult = await aiImageGenerator.generateImage(userQuery, 'realistic');
          
          if (imageResult.success && imageResult.imageUrl) {
            let response = `Я создал изображение по вашему запросу! Вот результат:

![Сгенерированное изображение](${imageResult.imageUrl})

Изображение сохранено и готово к использованию.`;

            // Проверяем, нужно ли создать SVG файлы для печати
            const lowerQuery = userQuery.toLowerCase();
            const hasPrint = lowerQuery.includes('принт');
            const hasShirt = lowerQuery.includes('футболка');
            const hasPrinting = lowerQuery.includes('печать');
            const svgCheck = svgPrintConverter.isPrintConversionRequest(userQuery);
            
            const needsPrintFiles = svgCheck || hasPrint || hasShirt || hasPrinting;
            
            SmartLogger.route(`🔍 Проверка на создание SVG файлов:`, {
              userQuery: userQuery.substring(0, 50),
              hasPrint,
              hasShirt, 
              hasPrinting,
              svgCheck,
              needsPrintFiles
            });

            let svgFiles = [];
            if (needsPrintFiles) {
              try {
                SmartLogger.route(`🎨 Создаем SVG файлы для печати`);
                const printType = svgPrintConverter.detectPrintTypeFromRequest(userQuery);
                const svgResult = await svgPrintConverter.convertImageToPrintSVG(
                  imageResult.imageUrl, 
                  `design-${Date.now()}`, 
                  printType,
                  userQuery
                );
                
                if (svgResult.success) {
                  svgFiles = svgResult.result.files;
                  response += `\n\n📄 **Файлы для печати созданы:**`;
                  
                  svgResult.result.files.forEach(file => {
                    if (file.type === 'screenprint') {
                      response += `\n• [SVG для шелкографии](${file.url}) - ${(file.size / 1024).toFixed(1)} КБ`;
                    } else if (file.type === 'dtf') {
                      response += `\n• [SVG для DTF печати](${file.url}) - ${(file.size / 1024).toFixed(1)} КБ`;
                    } else if (file.type === 'colorscheme') {
                      response += `\n• [Цветовая схема](${file.url}) - палитра цветов`;
                    }
                  });
                  
                  if (svgResult.result.recommendations.screenprint) {
                    response += `\n\n**Рекомендации для шелкографии:** ${svgResult.result.recommendations.screenprint.notes}`;
                  }
                  if (svgResult.result.recommendations.dtf) {
                    response += `\n**Рекомендации для DTF:** ${svgResult.result.recommendations.dtf.notes}`;
                  }
                  
                  // Добавляем AI рекомендации
                  if (svgResult.result.aiAnalysis && svgResult.result.aiAnalysis.recommendations) {
                    response += `\n\n🤖 **Экспертные рекомендации AI:** ${svgResult.result.aiAnalysis.recommendations}`;
                  }
                  
                  SmartLogger.success(`SVG файлы созданы: ${svgFiles.length} файлов`);
                } else {
                  SmartLogger.error('Ошибка создания SVG файлов:', svgResult.error);
                }
              } catch (error) {
                SmartLogger.error('Ошибка при создании SVG файлов:', error);
              }
            }

            if (isEmbroideryRequest) {
              response += `\n\n🧵 Чтобы конвертировать это изображение в формат для вышивальной машины (DST, PES, JEF), загрузите его и попросите "конвертируй в DST".`;
            } else if (!needsPrintFiles) {
              response += ` Если нужно что-то изменить, просто опишите что хотите поправить.`;
            }
            
            return {
              success: true,
              response: response,
              provider: 'AI_Image_Generator',
              searchUsed: false,
              imageGenerated: true,
              imageUrl: imageResult.imageUrl,
              svgFiles: svgFiles
            };
          } else {
            return {
              success: true,
              response: `К сожалению, произошла ошибка при генерации изображения. Попробуйте переформулировать запрос или попробовать позже.`,
              provider: 'AI_Image_Generator',
              searchUsed: false,
              imageGenerated: false
            };
          }
        } catch (error) {
          SmartLogger.error('Ошибка генерации изображения:', error);
          return {
            success: true,
            response: `Извините, система генерации изображений временно недоступна. Попробуйте позже.`,
            provider: 'AI_Image_Generator',
            searchUsed: false,
            imageGenerated: false
          };
        }
      }
      
      // Если не генерация изображения, даем обычный ответ с полным контекстом
      const enhancedPrompt = chatMemory.createEnhancedPrompt(userQuery, sessionContext);

      // Получаем новый ответ с информацией о возможностях и контекстом
      const enhancedResult = await pythonProvider.callPythonAI(enhancedPrompt, 'Qwen_Qwen_2_72B');
      
      let enhancedText = '';
      if (typeof enhancedResult === 'string') {
        enhancedText = enhancedResult;
      } else if (enhancedResult && enhancedResult.response) {
        enhancedText = enhancedResult.response;
      }
      
      return {
        success: true,
        response: enhancedText || responseText,
        provider: 'Qwen_Qwen_2_72B',
        searchUsed: false
      };
    }
    
  } catch (error) {
    SmartLogger.error(`Ошибка AI с поиском: ${error.message}`);
    return { success: false, reason: 'error' };
  }
}

/**
 * Упрощенная интеграция веб-поиска и AI (старая версия)
 */
async function getSmartResponse(userQuery) {
  try {
    SmartLogger.route(`🚀 ВЫЗВАНА УПРОЩЕННАЯ ИНТЕГРАЦИЯ для: "${userQuery}"`);
    
    // Проверяем, нужен ли поиск
    const searchNeeded = webSearchProvider.needsWebSearch(userQuery);
    SmartLogger.route(`🔍 Проверка поиска в упрощенной функции: ${searchNeeded}`);
    
    if (!searchNeeded) {
      SmartLogger.route(`❌ Поиск не нужен, выходим`);
      return { success: false, reason: 'no_search_needed' };
    }
    
    SmartLogger.route(`✅ Выполняем поиск + AI для: "${userQuery}"`);
    
    // Получаем данные из интернета
    const searchResults = await webSearchProvider.performWebSearch(userQuery);
    
    if (searchResults.success && searchResults.results && searchResults.results.length > 0) {
      const searchContext = webSearchProvider.formatSearchResultsForAI(searchResults);
      
      // Простой промпт для AI
      const prompt = `Вопрос: ${userQuery}

Актуальные данные:
${searchContext}

Ответь на основе этих данных на русском языке.`;

      // Пробуем получить ответ от AI
      const pythonProvider = require('./python_provider_routes');
      const result = await pythonProvider.callPythonAI(prompt, 'Qwen_Qwen_2_72B');
      
      SmartLogger.route(`📊 Тип результата: ${typeof result}`);
      SmartLogger.route(`📊 Полная структура результата:`, result);
      
      // Если result - это строка (прямой ответ), используем её
      let responseText = '';
      if (typeof result === 'string') {
        responseText = result;
      } else if (result && result.response) {
        responseText = result.response;
      }
      
      SmartLogger.route(`📝 Извлеченный текст ответа: "${responseText.substring(0, 100)}..."`);
      
      if (responseText && responseText.length > 20) {
        // Проверяем, что ответ содержит полезную информацию
        const hasWeatherData = responseText.includes('°C') || 
                              responseText.includes('градус') || 
                              responseText.includes('температура') ||
                              responseText.includes('дождь') ||
                              responseText.includes('влажность');
        
        const isRefusal = responseText.toLowerCase().includes('не могу предоставить');
        
        SmartLogger.route(`🔍 Анализ ответа: hasWeatherData=${hasWeatherData}, isRefusal=${isRefusal}`);
        
        if (hasWeatherData && !isRefusal) {
          SmartLogger.success(`✅ Упрощенная интеграция получила реальные данные!`);
          return {
            success: true,
            response: responseText,
            provider: 'Qwen_Qwen_2_72B',
            searchUsed: true
          };
        }
        
        SmartLogger.route(`⚠️ Ответ не содержит реальных данных: hasWeatherData=${hasWeatherData}, isRefusal=${isRefusal}`);
      } else {
        SmartLogger.route(`❌ AI не вернул текст или текст слишком короткий`);
      }
    }
    
    return { success: false, reason: 'search_failed' };
    
  } catch (error) {
    SmartLogger.error(`Ошибка поиска: ${error.message}`);
    return { success: false, reason: 'error' };
  }
}

// Специализации провайдеров
const PROVIDER_SPECIALTIES = {
  technical: {
    // Технические вопросы, код, программирование
    providers: ["Phind", "DeepSpeek", "DeepInfra_CodeLlama", "DeepInfra_Mistral"],
    keywords: [
      "код", "программирование", "javascript", "python", "java", "c++", "c#", 
      "coding", "programming", "code", "алгоритм", "algorithm", "функция", "function",
      "api", "сервер", "server", "backend", "frontend", "фронтенд", "бэкенд",
      "database", "база данных", "sql", "nosql", "mongodb", "json", "html", "css",
      "git", "github", "docker", "kubernetes", "devops", "react", "angular", "vue",
      "node", "npm", "yarn", "webpack", "babel", "typescript", "rust", "golang"
    ]
  },
  creative: {
    // Творческие запросы, генерация текста, истории
    providers: ["GeminiPro", "Claude", "Liaobots"],
    keywords: [
      "творчество", "креатив", "придумай", "сочини", "напиши", "создай", "генерация",
      "стих", "поэма", "рассказ", "история", "сказка", "роман", "новелла", "песня",
      "creative", "poem", "story", "tale", "fiction", "writing", "screenplay", "script",
      "слоган", "лозунг", "реклама", "маркетинг", "рифма", "метафора", "аллегория"
    ]
  },
  analytical: {
    // Аналитические вопросы, требующие глубоких рассуждений
    providers: ["Qwen_Qwen_2_72B", "Claude", "DeepInfra_Mixtral", "GeminiPro", "Qwen_Qwen_2_5_Max"],
    keywords: [
      "анализ", "объясни", "почему", "сравни", "логика", "философия", "размышление",
      "докажи", "опровергни", "дилемма", "аргумент", "точка зрения", "критика",
      "analyze", "explain", "compare", "contrast", "philosophy", "ethics", "morality",
      "pros and cons", "advantages", "disadvantages", "thesis", "hypothesis", 
      "научный метод", "research", "study", "investigation", "exploration"
    ]
  },
  factual: {
    // Фактические вопросы, требующие точной информации
    providers: ["Qwen_Qwen_2_72B", "You", "Phind", "Qwen_Qwen_2_5_Max", "PerplexityApi"],
    keywords: [
      "факт", "информация", "статистика", "данные", "история", "событие", "дата",
      "кто", "что", "где", "когда", "fact", "information", "statistics", "data",
      "history", "event", "date", "who", "what", "where", "when", "how many", "how much",
      "определение", "definition", "термин", "term", "concept", "понятие"
    ]
  },
  current: {
    // Вопросы о текущих событиях, новостях
    providers: ["Qwen_Qwen_2_72B", "You", "PerplexityApi", "Qwen_Qwen_2_5_Max"],
    keywords: [
      "новости", "актуальный", "последний", "текущий", "событие", "сегодня", "вчера",
      "новость", "news", "recent", "current", "latest", "today", "yesterday", "update",
      "тренд", "trend", "breaking", "headline", "заголовок", "месяц", "неделя", "год"
    ]
  },
  mathematical: {
    // Математические вопросы, вычисления
    providers: ["Qwen_Qwen_2_72B", "Claude", "DeepInfra_Mixtral", "Qwen_Qwen_2_5_Max"],
    keywords: [
      "математика", "вычисления", "расчет", "формула", "уравнение", "интеграл", 
      "производная", "тригонометрия", "геометрия", "алгебра", "math", "calculation",
      "compute", "formula", "equation", "integral", "derivative", "trigonometry",
      "geometry", "algebra", "statistics", "calculus", "probability", "theorem"
    ]
  },
  image_generation: {
    // Генерация изображений, принтов, дизайна
    providers: ["image_generator"],
    keywords: [
      "создай изображение", "нарисуй", "сгенерируй картинку", "создай принт", "дизайн для футболки",
      "create image", "generate picture", "draw", "design", "artwork", "illustration",
      "принт для футболки", "принт на футболку", "логотип", "иконка", "графика", "постер", "баннер", "стикер",
      "print", "logo", "icon", "graphic", "poster", "banner", "sticker", "t-shirt design",
      "футболка", "одежда", "streetwear", "мерч", "merchandise", "clothing",
      "visualize", "sketch", "art", "creative", "visual", "picture", "image",
      "рисунок", "картинка", "изображение", "визуализация", "концепт", "макет"
    ]
  },
  image_editing: {
    // Редактирование изображений через Replicate AI
    providers: ["replicate_editor"],
    keywords: [
      "убери", "удали", "измени", "замени", "отредактируй", "улучши", "поменяй",
      "remove", "delete", "edit", "modify", "change", "replace", "enhance", "improve",
      "фон", "background", "стиль", "style", "качество", "quality", "объект", "object",
      "редактирование", "editing", "обработка", "processing", "коррекция", "correction"
    ]
  },
  shopping: {
    // Поиск магазинов, покупки, торговые центры, услуги
    providers: ["Qwen_Qwen_2_72B", "You", "PerplexityApi", "Qwen_Qwen_2_5_Max", "Phind"],
    keywords: [
      "магазин", "магазины", "купить", "где купить", "торговый центр", "тц", "мол", "супермаркет",
      "shop", "store", "shopping", "buy", "purchase", "mall", "supermarket", "market",
      "аптека", "pharmacy", "ресторан", "кафе", "restaurant", "cafe", "бар", "bar",
      "банк", "bank", "отделение", "офис", "салон", "центр", "сервис", "service",
      "найди", "где находится", "адрес", "местоположение", "рядом", "близко",
      "find", "locate", "address", "location", "near", "nearby", "close", "around"
    ]
  },
  business: {
    // Бизнес-вопросы, экономика, финансы
    providers: ["Qwen_Qwen_2_72B", "Claude", "GeminiPro", "Qwen_Qwen_2_5_Max"],
    keywords: [
      "бизнес", "экономика", "финансы", "маркетинг", "стартап", "инвестиции", "продажи",
      "business", "economy", "finance", "marketing", "startup", "investment", "sales",
      "management", "strategy", "market", "customer", "client", "product", "service",
      "revenue", "profit", "loss", "bankruptcy", "accounting", "tax", "taxation"
    ]
  },
  translation: {
    // Перевод текста, языковые вопросы
    providers: ["Qwen_Qwen_2_72B", "Claude", "Qwen_Qwen_2_5_Max", "GeminiPro"],
    keywords: [
      "перевод", "переведи", "перевести", "язык", "translation", "translate", "language",
      "с русского на", "с английского на", "from english to", "from russian to",
      "грамматика", "grammar", "spelling", "правописание", "синоним", "synonym",
      "антоним", "antonym", "идиома", "idiom", "фразеологизм", "phraseology"
    ]
  },
  multimodal: {
    // Мультимодальные запросы с изображениями
    providers: ["Claude", "GeminiPro", "You"],
    keywords: [
      "изображение", "картинка", "фото", "фотография", "скриншот", "image", "picture",
      "photo", "screenshot", "опиши", "describe", "что изображено", "what is shown",
      "что на картинке", "what's in the picture", "проанализируй изображение"
    ]
  }
};

// Провайдеры по умолчанию
const DEFAULT_PROVIDERS = ["FreeGpt", "Liaobots", "HuggingChat", "DeepInfra", "You"];

/**
 * Анализирует запрос и определяет его тематику
 * @param {string} message - Сообщение пользователя
 * @returns {Object} Категория запроса и провайдеры
 */
function analyzeMessage(message) {
  // Преобразуем сообщение в нижний регистр для поиска ключевых слов
  const lowerMessage = message.toLowerCase();
  
  // Массив обнаруженных категорий с количеством совпадений
  const detectedCategories = [];
  
  // Специальная проверка для генерации изображений с более гибким распознаванием
  const imageGenerationPatterns = [
    /создай.*принт/i,
    /нарисуй/i,
    /сгенерируй.*картинк/i,
    /дизайн.*футболк/i,
    /принт.*футболк/i,
    /создай.*изображение/i,
    /логотип/i,
    /рисунок/i,
    /макет/i,
    /концепт/i
  ];
  
  // Специальная проверка для редактирования изображений
  const imageEditingPatterns = [
    /убери.*с.*изображения/i,
    /удали.*с.*картинки/i,
    /замени.*фон/i,
    /поменяй.*фон/i,
    /отредактируй.*изображение/i,
    /улучши.*качество/i,
    /измени.*стиль/i,
    /remove.*from.*image/i,
    /edit.*image/i,
    /change.*background/i,
    /enhance.*image/i
  ];
  
  let isImageGeneration = false;
  for (const pattern of imageGenerationPatterns) {
    if (pattern.test(message)) {
      isImageGeneration = true;
      break;
    }
  }
  
  let isImageEditing = false;
  for (const pattern of imageEditingPatterns) {
    if (pattern.test(message)) {
      isImageEditing = true;
      break;
    }
  }
  
  if (isImageEditing) {
    detectedCategories.push({
      category: 'image_editing',
      matchCount: 15, // Самый высокий приоритет для редактирования
      providers: PROVIDER_SPECIALTIES.image_editing.providers
    });
  } else if (isImageGeneration) {
    detectedCategories.push({
      category: 'image_generation',
      matchCount: 10, // Высокий приоритет
      providers: PROVIDER_SPECIALTIES.image_generation.providers
    });
  }
  
  // Проверка на редактирование изображений
  const imageEditPatterns = [
    // Команды добавления
    /добавь.*к.*изображени/i,
    /измени.*изображени/i,
    /сделай.*ярче/i,
    /сделай.*темнее/i,
    /добавь.*логотип/i,
    /добавь.*текст/i,
    /поменяй.*цвет/i,
    /убери.*фон/i,
    // Команды удаления объектов
    /убери(?!.*фон)/i,  // убери (но не фон)
    /удали/i,
    /убрать/i,
    /удалить/i,
    /remove/i,
    /delete/i,
    /добавь.*фон/i,
    /сделай.*больше/i,
    /сделай.*меньше/i,
    /добавь.*к.*этому/i,
    /измени.*на/i,
    /переделай/i,
    /улучши/i,
    /модифицируй/i,
    /добавь.*сзади/i,
    /добавь.*спереди/i,
    /добавь.*рядом/i,
    /добавь.*на.*фон/i,
    /добавь.*него/i,
    /добавь.*неё/i,
    /добавь.*них/i,
    /добавь.*грибы/i,
    /добавь.*цветы/i,
    /добавь.*деревья/i,
    /добавь.*облака/i,
    /добавь.*звезды/i,
    // Команды удаления - НОВЫЕ ПАТТЕРНЫ
    /убери/i,
    /удали/i,
    /скрой/i,
    /убрать/i,
    /удалить/i,
    /без/i,
    /убери.*сапоги/i,
    /убери.*шляпу/i,
    /убери.*очки/i,
    /убери.*фон/i,
    /убери.*предмет/i,
    /убери.*объект/i,
    /удали.*сапоги/i,
    /удали.*шляпу/i,
    /удали.*очки/i,
    /без.*сапог/i,
    /без.*шляпы/i,
    /без.*очков/i
  ];
  
  let isImageEdit = false;
  for (const pattern of imageEditPatterns) {
    if (pattern.test(message)) {
      isImageEdit = true;
      break;
    }
  }
  
  if (isImageEdit) {
    detectedCategories.push({
      category: 'image_edit',
      matchCount: 10, // Высокий приоритет
      providers: PROVIDER_SPECIALTIES.image_generation.providers
    });
  }
  
  // Проверяем каждую категорию на наличие ключевых слов
  for (const [category, details] of Object.entries(PROVIDER_SPECIALTIES)) {
    if (category === 'image_generation' && isImageGeneration) {
      continue; // Уже обработали выше
    }
    
    let matchCount = 0;
    
    for (const keyword of details.keywords) {
      if (lowerMessage.includes(keyword)) {
        matchCount++;
      }
    }
    
    if (matchCount > 0) {
      detectedCategories.push({
        category,
        matchCount,
        providers: details.providers
      });
    }
  }
  
  // Сортируем категории по количеству совпадений (от большего к меньшему)
  detectedCategories.sort((a, b) => b.matchCount - a.matchCount);
  
  // Если ни одна категория не подошла, используем провайдеры по умолчанию
  if (detectedCategories.length === 0) {
    return {
      category: "general",
      providers: DEFAULT_PROVIDERS,
      matchCount: 0
    };
  }
  
  // Возвращаем наиболее подходящую категорию
  return {
    category: detectedCategories[0].category,
    providers: detectedCategories[0].providers,
    matchCount: detectedCategories[0].matchCount,
    allMatches: detectedCategories // Для отладки и логирования
  };
}

/**
 * Выбирает наиболее подходящего провайдера и получает ответ
 * @param {string} message - Сообщение пользователя
 * @param {Object} options - Дополнительные параметры
 * @returns {Promise<Object>} - Результат от провайдера
 */
async function routeMessage(message, options = {}) {
  const startTime = Date.now();
  SmartLogger.route(`Начинаем маршрутизацию сообщения`, { 
    messageLength: message.length, 
    hasImage: !!options.imageUrl,
    options: Object.keys(options)
  });

  // Проверяем, нужен ли веб-поиск для актуальной информации
  SmartLogger.route(`=== ДЕТАЛЬНАЯ ПРОВЕРКА ВЕБ-ПОИСКА ===`);
  SmartLogger.route(`Исходное сообщение: "${message}"`);
  SmartLogger.route(`Сообщение в нижнем регистре: "${message.toLowerCase()}"`);
  
  const needsSearch = webSearchProvider.needsWebSearch(message);
  SmartLogger.route(`Результат needsWebSearch: ${needsSearch}`);
  
  // Новый подход: AI сам определяет, нужен ли поиск
  SmartLogger.route(`🤖 Отправляем запрос AI с возможностью поиска`);
  
  try {
    const aiWithSearchResult = await getAIResponseWithSearch(message, options);
    if (aiWithSearchResult.success) {
      SmartLogger.success(`Получен ответ от AI ${aiWithSearchResult.searchUsed ? 'с поиском' : 'без поиска'}`);
      
      // Сохраняем информацию об операции
      if (options.sessionId) {
        await chatMemory.saveOperationInfo(options.sessionId, 'ai_response', {
          provider: aiWithSearchResult.provider,
          searchUsed: aiWithSearchResult.searchUsed,
          imageGenerated: aiWithSearchResult.imageGenerated
        });
      }
      
      return aiWithSearchResult;
    }
  } catch (error) {
    SmartLogger.error(`Ошибка AI с поиском: ${error.message}`);
  }
  
  if (needsSearch) {
    SmartLogger.route(`Обнаружен запрос, требующий веб-поиска`);
    
    try {
      const searchResults = await webSearchProvider.performWebSearch(message);
      
      if (searchResults.success && searchResults.results.length > 0) {
        // Формируем контекст для AI с результатами поиска
        const searchContext = webSearchProvider.formatSearchResultsForAI(searchResults);
        const enhancedMessage = `ВАЖНО: Ты ДОЛЖЕН использовать информацию из интернета ниже для ответа пользователю!

Пользователь спрашивает: ${message}

${searchContext}

ОБЯЗАТЕЛЬНО используй эту актуальную информацию в своём ответе. НЕ говори, что не можешь предоставить данные в реальном времени - у тебя есть свежая информация выше!`;
        
        // Продолжаем обработку с обогащенным сообщением
        SmartLogger.route(`Веб-поиск успешен, найдено результатов: ${searchResults.results.length}`);
        SmartLogger.route(`Отправляем AI обогащенное сообщение: "${enhancedMessage.substring(0, 200)}..."`);
        
        // Используем специализированные провайдеры для ответа с актуальной информацией
        const searchProviders = ["Qwen_Qwen_2_72B", "You", "PerplexityApi", "Qwen_Qwen_2_5_Max"];
        
        for (const provider of searchProviders) {
          try {
            const pythonProvider = require('./python_provider_routes');
            const result = await pythonProvider.callPythonAI(enhancedMessage, provider);
            
            // Проверяем, что ответ содержит реальную информацию, а не отказ
            const hasRealData = result.response && (
              result.response.includes('°C') ||
              result.response.includes('градус') ||
              result.response.includes('температура') ||
              result.response.includes('влажность') ||
              result.response.includes('ветер') ||
              result.response.includes('дождь') ||
              result.response.includes('снег') ||
              result.response.includes('новости') ||
              result.response.includes('событи')
            );
            
            const isRefusal = result.response && (
              result.response.toLowerCase().includes('не могу предоставить') &&
              !hasRealData
            );
            
            if (result.success && result.response && !isRefusal) {
              SmartLogger.success(`Веб-поиск + AI ответ готов от провайдера: ${provider}`);
              
              return {
                success: true,
                response: result.response,
                provider: `WebSearch+${provider}`,
                model: result.model || provider,
                category: 'web_search',
                searchResults: searchResults.results,
                processingTime: Date.now() - startTime
              };
            } else {
              SmartLogger.route(`Провайдер ${provider} дал стандартный отказ, пробуем следующий`);
            }
          } catch (providerError) {
            SmartLogger.error(`Ошибка провайдера ${provider} с веб-поиском:`, providerError);
            continue;
          }
        }
        
        SmartLogger.error(`Не удалось получить ответ от AI провайдеров с веб-поиском`);
      } else {
        SmartLogger.route(`Веб-поиск не дал результатов, продолжаем обычную обработку`);
      }
    } catch (searchError) {
      SmartLogger.error(`Ошибка веб-поиска:`, searchError);
      // Продолжаем обычную обработку при ошибке поиска
    }
  }

  // Проверяем запросы на генерацию изображений для вышивки
  if (aiEmbroideryPipeline.isEmbroideryGenerationRequest(message)) {
    SmartLogger.route(`Обнаружен запрос на создание дизайна для вышивки`);
    
    try {
      const result = await aiEmbroideryPipeline.generateAndConvertToEmbroidery(message, {
        sessionId: options.sessionId,
        userId: options.userId,
        conversionOptions: {}
      });
      
      if (result.success) {
        // Формируем полный ответ с AI-анализом
        let fullResponse = result.message;
        
        // Добавляем информацию о файлах для скачивания
        if (result.files && result.files.length > 0) {
          fullResponse += '\n\n📁 **Файлы для скачивания:**\n';
          result.files.forEach(file => {
            const emoji = file.path.includes('.dst') ? '🧵' : 
                         file.path.includes('.png') ? '🖼️' : '🎨';
            const shortName = file.path.includes('.dst') ? 'DST файл' :
                             file.path.includes('.png') ? 'PNG превью' : 'JSON схема';
            fullResponse += `\n${emoji} [${shortName}](${file.path})`;
          });
        }
        
        // Добавляем детали
        if (result.details) {
          fullResponse += '\n\n📋 **Детали:**\n';
          fullResponse += `\n• Цветов: ${result.details.colors}`;
          fullResponse += `\n• Размер: ${result.details.size}`;
          fullResponse += `\n• Формат: ${result.details.machineFormat}`;
        }
        
        // Добавляем изображение
        if (result.generatedImage) {
          fullResponse += `\n\n![Сгенерированное изображение](${result.generatedImage})`;
        }
        
        // Добавляем AI-отчет об оптимизации, если он есть
        if (result.aiOptimizationReport) {
          fullResponse += '\n\n' + result.aiOptimizationReport;
        }
        
        return {
          success: true,
          response: fullResponse,
          provider: 'AI-EmbroideryPipeline',
          model: 'ai-embroidery-generator',
          type: 'embroidery_generation',
          details: result.details,
          files: result.files,
          instructions: result.instructions,
          generatedImage: result.generatedImage,
          embroideryFormat: result.embroideryFormat
        };
      } else {
        return {
          success: false,
          response: `Ошибка создания дизайна: ${result.error}`,
          provider: 'AI-EmbroideryPipeline',
          error: result.error,
          step: result.step
        };
      }
    } catch (error) {
      SmartLogger.error('Ошибка пайплайна создания дизайна для вышивки', error);
      return {
        success: false,
        response: 'Произошла ошибка при создании дизайна для вышивки',
        provider: 'AI-EmbroideryPipeline',
        error: error.message
      };
    }
  }

  // Проверяем запросы на конвертацию в форматы вышивки
  if (embroideryHandler.isEmbroideryRequest(message)) {
    SmartLogger.route(`Обнаружен запрос на конвертацию в формат вышивки`);
    
    try {
      let imageData = null;
      if (options.imageUrl) {
        // Подготавливаем данные изображения для обработки
        const fs = require('fs');
        const path = require('path');
        const imageBuffer = fs.readFileSync(options.imageUrl);
        imageData = {
          buffer: imageBuffer,
          filename: path.basename(options.imageUrl)
        };
      }
      
      const result = await embroideryHandler.handleEmbroideryRequest(message, imageData);
      
      if (result.success) {
        return {
          success: true,
          response: result.message,
          provider: 'EmbroideryConverter',
          model: 'embroidery-processor',
          type: result.type,
          details: result.details || {},
          files: result.files,
          instructions: result.instructions
        };
      } else {
        return {
          success: false,
          response: `Ошибка конвертации: ${result.error}`,
          provider: 'EmbroideryConverter',
          error: result.error
        };
      }
    } catch (error) {
      SmartLogger.error('Ошибка обработки запроса на вышивку', error);
      return {
        success: false,
        response: 'Произошла ошибка при обработке запроса на конвертацию в формат вышивки',
        provider: 'EmbroideryConverter',
        error: error.message
      };
    }
  }

  // Если изображение, используем наш собственный детектор объектов
  if (options.imageUrl) {
    SmartLogger.route(`Обнаружено изображение! Используем собственный детектор объектов`);
    
    try {
      const imageDetector = require('./image-object-detector');
      const result = await imageDetector.analyzeLocalImage(options.imageUrl, message);
      
      if (result.success) {
        // Сохраняем ответ в память разговора
        if (options.userId) {
          const conversationMemory = require('./conversation-memory');
          conversationMemory.addAiResponse(options.userId, result.response, result.provider, result.model);
        }
        
        return {
          success: true,
          response: result.response,
          provider: result.provider,
          model: result.model,
          category: "multimodal",
          bestProvider: "Advanced Object Detection"
        };
      } else {
        console.log('⚠️ Собственный детектор не сработал, пробуем внешние провайдеры...');
        // Если наш детектор не сработал, переходим к внешним провайдерам
        const analysis = { 
          category: "multimodal", 
          providers: PROVIDER_SPECIALTIES.multimodal.providers 
        };
        return await getResponseFromProviders(message, analysis, options);
      }
    } catch (error) {
      console.error(`❌ Ошибка собственного детектора: ${error.message}`);
      // В случае ошибки переходим к внешним провайдерам
      const analysis = { 
        category: "multimodal", 
        providers: PROVIDER_SPECIALTIES.multimodal.providers 
      };
      console.log(`Переходим к внешним мультимодальным провайдерам...`);
      return await getResponseFromProviders(message, analysis, options);
    }
  }

  // Если есть предпочтительный провайдер (продолжение разговора)
  if (options.preferredProvider) {
    SmartLogger.provider(`Продолжаем разговор с провайдером`, { 
      provider: options.preferredProvider,
      hasContext: !!options.context 
    });
    
    // Добавляем контекст к сообщению
    const messageWithContext = options.context ? options.context + message : message;
    
    try {
      const result = await trySpecificProvider(options.preferredProvider, messageWithContext, options);
      if (result && result.success) {
        // Сохраняем ответ в память разговора
        if (options.userId) {
          const conversationMemory = require('./conversation-memory');
          conversationMemory.addAiResponse(options.userId, result.response, result.provider, result.model);
        }
        return result;
      }
    } catch (error) {
      console.log(`⚠️ Предпочтительный провайдер ${options.preferredProvider} не ответил, выбираем нового...`);
    }
  }

  // Анализируем сообщение для выбора нового провайдера
  const analysis = analyzeMessage(message);
  console.log(`Категория сообщения: ${analysis.category} (совпадений: ${analysis.matchCount})`);
  console.log(`Рекомендуемые провайдеры: ${analysis.providers.join(', ')}`);
  
  // Специальная обработка для генерации изображений
  if (analysis.category === 'image_generation') {
    SmartLogger.route('🎨 Обнаружен запрос на генерацию изображения!');
    try {
      const imageGenerator = require('./ai-image-generator');
      
      // Извлекаем промпт для генерации из сообщения
      let prompt = message;
      
      // Определяем стиль для принтов футболок
      let style = 'realistic';
      if (message.toLowerCase().includes('футболка') || 
          message.toLowerCase().includes('принт') ||
          message.toLowerCase().includes('t-shirt') ||
          message.toLowerCase().includes('streetwear')) {
        style = 'artistic';
        prompt = `Дизайн принта для футболки: ${prompt}`;
      }
      
      const result = await imageGenerator.generateImage(prompt, style, null, options.sessionId, options.userId);
      
      if (result.success) {
        // Сохраняем ответ в память разговора
        if (options.userId) {
          const conversationMemory = require('./conversation-memory');
          const response = `🎨 Изображение создано! Вот ваш дизайн:\n![Сгенерированное изображение](${result.imageUrl})`;
          conversationMemory.addAiResponse(options.userId, response, 'AI_Image_Generator', 'DALL-E_Style');
        }
        
        return {
          success: true,
          response: `🎨 Изображение создано! Вот ваш дизайн:\n![Сгенерированное изображение](${result.imageUrl})`,
          provider: 'AI_Image_Generator',
          model: 'Multi_Provider_Generator',
          category: 'image_generation',
          imageUrl: result.imageUrl,
          bestProvider: 'Image Generator'
        };
      } else {
        SmartLogger.error('Ошибка генерации изображения:', result.error);
        return {
          success: false,
          response: `😔 Извините, не удалось создать изображение. Попробуйте переформулировать запрос или попросить текстовое описание дизайна.`,
          provider: 'AI_Image_Generator',
          error: result.error
        };
      }
    } catch (error) {
      SmartLogger.error('Критическая ошибка генератора изображений:', error);
      // Переключаемся на текстовое описание дизайна
      const analysis = { 
        category: "creative", 
        providers: PROVIDER_SPECIALTIES.creative.providers 
      };
      const fallbackMessage = `Создай детальное текстовое описание дизайна: ${message}`;
      return await getResponseFromProviders(fallbackMessage, analysis, options);
    }
  }
  
  // Добавляем контекст к сообщению, если есть
  const messageWithContext = options.context ? options.context + message : message;
  
  const result = await getResponseFromProviders(messageWithContext, analysis, options);
  
  // Сохраняем ответ в память разговора
  if (result && result.success && options.userId) {
    const conversationMemory = require('./conversation-memory');
    conversationMemory.addAiResponse(options.userId, result.response, result.provider || result.bestProvider, result.model);
  }
  
  return result;
}

/**
 * Получает ответ от провайдеров из списка, пробуя каждый до первого успешного
 * @param {string} message - Сообщение пользователя
 * @param {Object} analysis - Результат анализа
 * @param {Object} options - Дополнительные параметры
 * @returns {Promise<Object>} - Ответ от провайдера
 */
async function getResponseFromProviders(message, analysis, options = {}) {
  const { category, providers } = analysis;
  let lastError = null;
  
  // Формируем системный промпт в зависимости от категории
  let systemPrompt = "Вы полезный ассистент. Отвечайте точно и по существу.";
  
  switch (category) {
    case "technical":
      systemPrompt = "Вы опытный программист. Давайте точные и подробные технические объяснения с примерами кода, где это уместно.";
      break;
    case "creative":
      systemPrompt = "Вы творческий ассистент. Создавайте оригинальные, интересные и увлекательные тексты.";
      break;
    case "analytical":
      systemPrompt = "Вы аналитический ассистент с критическим мышлением. Предоставляйте глубокий анализ, рассматривайте вопросы с разных сторон.";
      break;
    case "factual":
      systemPrompt = "Вы информационный ассистент. Предоставляйте точные, проверенные факты, ссылайтесь на источники, где это возможно.";
      break;
    case "current":
      systemPrompt = "Вы информационный ассистент с доступом к текущим данным. Предоставляйте актуальную информацию, где это возможно.";
      break;
    case "mathematical":
      systemPrompt = "Вы математический эксперт. Предоставляйте точные формулы, шаги решения и объяснения математических концепций.";
      break;
    case "business":
      systemPrompt = "Вы бизнес-консультант. Давайте практичные и реалистичные советы по бизнесу, маркетингу и финансам.";
      break;
    case "translation":
      systemPrompt = "Вы профессиональный переводчик. Обеспечивайте точный и естественный перевод, сохраняя стиль и нюансы оригинала.";
      break;
    case "multimodal":
      systemPrompt = "Вы визуальный аналитик. Детально описывайте содержимое изображений и отвечайте на вопросы о них.";
      break;
  }
  
  // Проверяем каждый провайдер из списка
  for (const provider of providers) {
    try {
      console.log(`Пробуем провайдер: ${provider} для категории: ${category}...`);
      
      let result;
      
      if (provider === "DeepSpeek") {
        // Для DeepSpeek используем специальный провайдер
        result = await deepspeekProvider.getDeepSpeekResponse(message);
      } else if (provider === "Claude") {
        // Для Claude используем Anthropic через Python G4F
        result = await claudeProvider.getClaudeResponse(message, {
          promptType: category,
          systemPrompt
        });
      } else if (provider.startsWith("DeepInfra")) {
        // Для DeepInfra используем специальный провайдер
        result = await deepInfraProvider.getDeepInfraResponse(message, {
          model: provider.replace("DeepInfra_", "").toLowerCase(),
          promptType: category
        });
      } else if (provider === "FreeChat" || provider === "ChatFree") {
        // Для FreeChat/ChatFree используем улучшенный провайдер
        result = await freechatEnhanced.getChatFreeEnhancedResponse(message, {
          systemPrompt
        });
      } else {
        // Для всех остальных используем Python G4F
        const pythonResponse = await pythonProviderRoutes.callPythonAI(
          message, 
          provider, 
          systemPrompt
        );
        
        if (pythonResponse) {
          result = {
            success: true,
            response: pythonResponse,
            provider: provider
          };
        } else {
          throw new Error(`Провайдер ${provider} не вернул ответ`);
        }
      }
      
      // Проверяем ответ
      if (result && result.success) {
        // Добавляем мета-информацию о категории
        result.category = category;
        result.bestProvider = provider;
        
        return result;
      }
    } catch (error) {
      console.error(`Ошибка при использовании провайдера ${provider}: ${error.message}`);
      lastError = error;
    }
  }
  
  // Если все указанные провайдеры отказали, пробуем Qwen_Qwen_2_72B как самый надежный
  if (!providers.includes("Qwen_Qwen_2_72B")) {
    try {
      console.log(`Пробуем резервный провайдер Qwen_Qwen_2_72B...`);
      
      const pythonResponse = await pythonProviderRoutes.callPythonAI(
        message, 
        "Qwen_Qwen_2_72B", 
        systemPrompt
      );
      
      if (pythonResponse) {
        return {
          success: true,
          response: pythonResponse,
          provider: "Qwen_Qwen_2_72B (fallback)",
          category,
          bestProvider: "Qwen_Qwen_2_72B"
        };
      }
    } catch (qwenError) {
      console.error(`Ошибка при использовании Qwen: ${qwenError.message}`);
    }
  }
  
  // В крайнем случае используем FreeChat, который имеет внутреннюю систему fallback
  try {
    console.log(`Последняя попытка: используем FreeChat с системой автоматического выбора...`);
    
    const result = await freechatEnhanced.getChatFreeEnhancedResponse(message, {
      systemPrompt
    });
    
    if (result && result.success) {
      result.category = category;
      result.bestProvider = "FreeChat (auto)";
      return result;
    }
  } catch (freechatError) {
    console.error(`Ошибка при использовании FreeChat: ${freechatError.message}`);
  }
  
  // Если все провайдеры отказали, возвращаем ошибку
  return {
    success: false,
    error: `Не удалось получить ответ от провайдеров категории ${category}. Последняя ошибка: ${lastError?.message || 'Неизвестная ошибка'}`,
    category,
    providers
  };
}

// API маршрут для обработки сообщений
router.post('/message', async (req, res) => {
  const { message, imageUrl, userId = 'anonymous' } = req.body;
  
  if (!message && !imageUrl) {
    return res.status(400).json({
      success: false,
      error: 'Сообщение или изображение должны быть предоставлены'
    });
  }
  
  // Если есть только изображение без текста, используем стандартный запрос для анализа
  const messageText = message || 'Проанализируй это изображение';
  
  try {
    // Получаем контекст разговора
    const conversationMemory = require('./conversation-memory');
    const contextData = conversationMemory.getMessageContext(userId, messageText);
    
    console.log(`💭 Пользователь ${userId}: ${contextData.shouldContinueWithProvider ? 'продолжаем с ' + contextData.currentProvider : 'выбираем нового провайдера'}`);
    
    // Маршрутизируем сообщение к подходящему провайдеру с учетом контекста
    const result = await routeMessage(messageText, { 
      imageUrl, 
      userId,
      context: contextData.context,
      preferredProvider: contextData.shouldContinueWithProvider ? contextData.currentProvider : null
    });
    
    res.json(result);
  } catch (error) {
    console.error(`Ошибка при маршрутизации сообщения: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: `Ошибка при обработке сообщения: ${error.message}`
    });
  }
});

// API маршрут для анализа сообщения (без отправки)
router.post('/analyze', (req, res) => {
  const { message } = req.body;
  
  if (!message) {
    return res.status(400).json({
      success: false,
      error: 'Сообщение не может быть пустым'
    });
  }
  
  try {
    // Анализируем сообщение
    const analysis = analyzeMessage(message);
    
    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    console.error(`Ошибка при анализе сообщения: ${error.message}`);
    
    res.status(500).json({
      success: false,
      error: `Ошибка при анализе сообщения: ${error.message}`
    });
  }
});

/**
 * Обработка запросов автоматизации BOOOMERANGS
 */
async function handleAutomationRequest(query) {
  const lowerQuery = query.toLowerCase();
  
  // Детекция запросов автоматизации
  const automationPatterns = {
    priceCalculation: /рассчит|стоимость|цен|калькул|сколько стоит|прайс|расценк/,
    proposal: /предложение|кп|коммерческое|договор|смет/,
    trends: /тренд|мод|популярн|стиль|что носят|актуальн/
  };

  try {
    const { BOOOMERANGSAutomation } = require('./booomerangs-automation');
    const automation = new BOOOMERANGSAutomation();

    // Расчет стоимости
    if (automationPatterns.priceCalculation.test(lowerQuery)) {
      return await handlePriceCalculation(query, automation);
    }

    // Генерация КП
    if (automationPatterns.proposal.test(lowerQuery)) {
      return await handleProposalGeneration(query, automation);
    }

    // Анализ трендов
    if (automationPatterns.trends.test(lowerQuery)) {
      return await handleTrendAnalysis(query, automation);
    }

    return null; // Не автоматизационный запрос
    
  } catch (error) {
    SmartLogger.error(`Ошибка автоматизации: ${error.message}`);
    return null;
  }
}

/**
 * Обработка расчета стоимости
 */
async function handlePriceCalculation(query, automation) {
  SmartLogger.route(`💰 Обрабатываем запрос расчета стоимости`);
  
  // Извлекаем параметры из запроса
  const params = extractCalculationParams(query);
  
  if (!params.width || !params.height || !params.quantity) {
    return {
      success: true,
      response: `**Калькулятор стоимости BOOOMERANGS**

Для расчета укажите:
• Размер дизайна (например: 20x15 см)
• Количество цветов (или "полноцвет")
• Тираж (количество изделий)
• Тип изделия (футболка, худи, кепка)

**Пример:** "Рассчитай стоимость печати 25x20 см, 3 цвета, 50 футболок"

**Доступные методы:**
• DTF печать - полноцветная, любые тиражи
• Трафаретная печать - от 50 шт, до 6 цветов  
• Машинная вышивка - для простых дизайнов`,
      provider: 'BOOOMERANGS_Calculator',
      searchUsed: false
    };
  }

  const result = automation.priceCalculator.getRecommendation(
    params.width,
    params.height,
    params.colors,
    params.quantity,
    params.hasDetails
  );

  const formattedResponse = `**Расчет стоимости производства**

**Рекомендуем: ${result.recommendation.method}**
• Размер: ${params.width}x${params.height} см
• Тираж: ${params.quantity} шт.
• Цена за единицу: ${result.recommendation.pricePerUnit} руб.
• **Общая стоимость: ${result.recommendation.totalCost.toLocaleString()} руб.**

${result.alternatives.length > 0 ? `**Альтернативные варианты:**
${result.alternatives.map(alt => `• ${alt.method}: ${alt.pricePerUnit || Math.round(alt.totalCost / params.quantity)} руб/шт`).join('\n')}` : ''}

${result.summary}

*Цены указаны без учета стоимости изделий*`;

  return {
    success: true,
    response: formattedResponse,
    provider: 'BOOOMERANGS_Calculator',
    searchUsed: false
  };
}

/**
 * Извлечение параметров расчета из запроса
 */
function extractCalculationParams(query) {
  const params = {
    width: null,
    height: null,
    colors: 'full',
    quantity: null,
    hasDetails: false
  };

  // Размеры (20x15, 25*20, 30 на 25)
  const sizeMatch = query.match(/(\d+)[x*х на ]+(\d+)/i);
  if (sizeMatch) {
    params.width = parseInt(sizeMatch[1]);
    params.height = parseInt(sizeMatch[2]);
  }

  // Количество изделий
  const qtyMatch = query.match(/(\d+)\s*(шт|штук|футбол|худи|кепок|изделий)/i);
  if (qtyMatch) {
    params.quantity = parseInt(qtyMatch[1]);
  }

  // Цвета
  const colorMatch = query.match(/(\d+)\s*цвет/i);
  if (colorMatch) {
    params.colors = parseInt(colorMatch[1]);
  } else if (query.includes('полноцвет') || query.includes('фулл')) {
    params.colors = 'full';
  }

  return params;
}

/**
 * Обработка генерации коммерческого предложения
 */
async function handleProposalGeneration(query, automation) {
  return {
    success: true,
    response: `**Генератор коммерческих предложений**

Для создания КП укажите:

**Данные клиента:**
• Имя контактного лица
• Название компании
• Email и телефон

**Параметры заказа:**
• Тип изделия (футболка, худи, кепка)
• Описание дизайнов с размерами
• Количество и срок изготовления

**Пример:** "Создай КП для ООО Ромашка, контакт Иван Петров, 50 футболок с логотипом 15x10 см, срок 10 дней"`,
    provider: 'BOOOMERANGS_Proposals',
    searchUsed: false
  };
}

/**
 * Обработка анализа трендов
 */
async function handleTrendAnalysis(query, automation) {
  SmartLogger.route(`📈 Анализируем тренды для: ${query}`);
  
  const trendQuery = query.replace(/тренд|мод|популярн|стиль|что носят|актуальн/gi, '').trim();
  const result = await automation.trendAnalyzer.analyzeTrends(trendQuery || 'дизайн одежды');

  if (result.error) {
    return {
      success: true,
      response: `**Анализ трендов**

${result.recommendation}

**Рекомендуем отслеживать:**
• Pinterest - актуальные дизайны
• Behance - профессиональные работы  
• Instagram - уличная мода
• Dribbble - графический дизайн`,
      provider: 'BOOOMERANGS_Trends',
      searchUsed: false
    };
  }

  let formattedResponse = `**Анализ трендов: ${result.query}**\n\n`;

  if (result.trends.length > 0) {
    formattedResponse += `**Актуальные направления:**\n`;
    result.trends.forEach(trend => {
      formattedResponse += `• **${trend.category}** (найдено совпадений: ${trend.strength})\n`;
    });
    formattedResponse += '\n';
  }

  if (result.recommendations.length > 0) {
    formattedResponse += `**Детальные рекомендации:**\n\n`;
    result.recommendations.forEach((rec, index) => {
      formattedResponse += `**${index + 1}. ${rec.trend}**\n`;
      formattedResponse += `${rec.description}\n\n`;
      formattedResponse += `🎨 **Цветовая палитра:** ${rec.colors.join(', ')}\n`;
      formattedResponse += `⚙️ **Техники:** ${rec.techniques.join(', ')}\n`;
      formattedResponse += `💡 **Примеры:** ${rec.examples.join(', ')}\n\n`;
    });
  }

  formattedResponse += `**Источников проанализировано:** ${result.sources}\n`;
  formattedResponse += `**Обновлено:** ${result.lastUpdated}`;

  return {
    success: true,
    response: formattedResponse,
    provider: 'BOOOMERANGS_Trends',
    searchUsed: true
  };
}

module.exports = router;
module.exports.routeMessage = routeMessage;
module.exports.getChatResponse = getAIResponseWithSearch;
module.exports.analyzeMessage = analyzeMessage;