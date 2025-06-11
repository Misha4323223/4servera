/**
 * Тестирование улучшенного Adobe векторизатора
 */

const adobeTracer = require('./adobe-illustrator-tracer.cjs');
const fs = require('fs');
const https = require('https');

async function testImprovedVectorizer() {
    console.log('🚀 Тестирование улучшенного Adobe алгоритма векторизации');
    
    const testImageUrl = 'https://image.pollinations.ai/prompt/simple-red-dragon-silhouette?width=600&height=600';
    
    try {
        // Загружаем изображение
        console.log('📥 Загрузка тестового изображения...');
        const imageBuffer = await downloadImage(testImageUrl);
        
        // Векторизуем с улучшенными настройками
        console.log('🎨 Запуск Adobe Illustrator Image Trace алгоритма...');
        const result = await adobeTracer.adobeImageTrace(imageBuffer, {
            maxColors: 5,
            quality: 'silkscreen'
        });
        
        if (result.success) {
            // Сохраняем результат
            const filename = `adobe-vectorized-${Date.now()}.svg`;
            fs.writeFileSync(filename, result.svgContent);
            
            console.log('✅ ВЕКТОРИЗАЦИЯ УСПЕШНА:');
            console.log(`   📄 Файл: ${filename}`);
            console.log(`   📊 Размер: ${(result.svgContent.length / 1024).toFixed(1)} KB`);
            console.log(`   🎨 Цветов: ${result.colorsUsed}`);
            console.log(`   📏 Качество: ${result.quality}`);
            console.log(`   🔧 Алгоритм: ${result.algorithm}`);
            
            // Создаем превью HTML
            const previewHtml = createPreviewHtml(result.svgContent, filename);
            const previewFilename = filename.replace('.svg', '-preview.html');
            fs.writeFileSync(previewFilename, previewHtml);
            console.log(`   👁️ Превью: ${previewFilename}`);
            
            return { success: true, filename, previewFilename };
        } else {
            console.error('❌ ОШИБКА ВЕКТОРИЗАЦИИ:', result.error);
            return { success: false, error: result.error };
        }
        
    } catch (error) {
        console.error('❌ КРИТИЧЕСКАЯ ОШИБКА:', error.message);
        return { success: false, error: error.message };
    }
}

function downloadImage(url) {
    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            const chunks = [];
            res.on('data', chunk => chunks.push(chunk));
            res.on('end', () => resolve(Buffer.concat(chunks)));
        }).on('error', reject);
    });
}

function createPreviewHtml(svgContent, filename) {
    return `<!DOCTYPE html>
<html>
<head>
    <title>Adobe Vectorizer Preview - ${filename}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            margin: 20px; 
            background: #f5f5f5; 
        }
        .preview-container { 
            max-width: 800px; 
            margin: 0 auto; 
            background: white; 
            padding: 20px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .svg-container { 
            text-align: center; 
            margin: 20px 0; 
            padding: 20px; 
            border: 2px dashed #ddd; 
            border-radius: 5px; 
        }
        .info { 
            background: #e8f4fd; 
            padding: 15px; 
            border-radius: 5px; 
            margin: 10px 0; 
        }
        .title { 
            color: #333; 
            text-align: center; 
            margin-bottom: 20px; 
        }
        .adobe-badge { 
            background: #FF6B35; 
            color: white; 
            padding: 5px 10px; 
            border-radius: 15px; 
            font-size: 12px; 
            display: inline-block; 
        }
    </style>
</head>
<body>
    <div class="preview-container">
        <h1 class="title">
            <span class="adobe-badge">Adobe Illustrator Compatible</span><br>
            Векторизованное изображение
        </h1>
        
        <div class="info">
            <strong>Файл:</strong> ${filename}<br>
            <strong>Размер:</strong> ${(svgContent.length / 1024).toFixed(1)} KB<br>
            <strong>Алгоритм:</strong> Adobe Illustrator Image Trace Limited Color<br>
            <strong>Дата создания:</strong> ${new Date().toLocaleString('ru-RU')}
        </div>
        
        <div class="svg-container">
            ${svgContent}
        </div>
        
        <div class="info">
            <strong>Описание:</strong> Векторизация выполнена с использованием точной копии алгоритма Adobe Illustrator Image Trace в режиме "Limited Color". Создаются заполненные векторные области максимально похожие на результат оригинального Adobe Illustrator.
        </div>
    </div>
</body>
</html>`;
}

// Запускаем тест
if (require.main === module) {
    testImprovedVectorizer()
        .then(result => {
            if (result.success) {
                console.log('\n🎉 ТЕСТ УСПЕШНО ЗАВЕРШЕН');
                console.log(`Откройте ${result.previewFilename} в браузере для просмотра результата`);
            } else {
                console.log('\n❌ ТЕСТ ПРОВАЛЕН');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('\n💥 КРИТИЧЕСКАЯ ОШИБКА ТЕСТА:', error);
            process.exit(1);
        });
}

module.exports = { testImprovedVectorizer };