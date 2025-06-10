/**
 * Тест команды "нужен вектор" напрямую через smart-router
 */

async function testVectorCommandDirect() {
  try {
    console.log('🧪 Тестируем команду "нужен вектор" через smart-router...');
    
    // Загружаем smart-router
    const smartRouter = require('./server/smart-router');
    
    // Тест без изображения - должен показать инструкцию
    console.log('\n1. Тест без изображения:');
    const resultNoImage = await smartRouter.getAIResponseWithSearch('нужен вектор', {
      sessionId: 'test-session-1'
    });
    console.log('Результат без изображения:', JSON.stringify(resultNoImage, null, 2));
    
    // Тест с изображением - должен векторизовать
    console.log('\n2. Тест с изображением:');
    const resultWithImage = await smartRouter.getAIResponseWithSearch('нужен вектор', {
      imageUrl: 'attached_assets/booomerangs_logo_detailed.png',
      sessionId: 'test-session-2'
    });
    console.log('Результат с изображением:', JSON.stringify(resultWithImage, null, 2));
    
  } catch (error) {
    console.error('❌ Ошибка теста:', error.message);
  }
}

// Запускаем тест
testVectorCommandDirect();