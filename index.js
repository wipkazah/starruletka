// Константы
const DEBUG = false; // Режим отладки
const STARS_COST = 25; // Стоимость прокрутки рулетки в звездах
const PAYMENT_TIMEOUT = 30000; // Таймаут ожидания ответа от бота (30 секунд)
const API_URL = 'https://starroulette.pro'; // URL бота для API-запросов

// Глобальные переменные для отслеживания состояния платежа
let pendingPaymentId = null;
let paymentTimeoutId = null;
let isRouletteSpinning = false; // Флаг для отслеживания состояния рулетки
let rouletteInstance = null; // Глобальная переменная для экземпляра рулетки
let isPaymentProcessing = false; // Флаг для предотвращения двойной оплаты

// Константы для адаптивности
const MOBILE_BREAKPOINT = 768; // Точка перехода на мобильную версию

// Данные для рулетки
var WEAPON_PRIZE_ATTRS = {
    weapon_name: 'Хэпи Бездар',
    skin_name: '350 звезд',
    rarity: 'covert',
    steam_image: './assets/happybirthday.png'
};

var WEAPON_ACTORS_ATTRS = [
    {weapon_name: 'Медведь', skin_name: '15 звезд', rarity: 'uncommon', steam_image: './assets/bear.png'},
    {weapon_name: 'Сердце', skin_name: '15 звезд', rarity: 'uncommon', steam_image: './assets/heart.png'},
    {weapon_name: 'Коробка', skin_name: '25 звезд', rarity: 'uncommon', steam_image: './assets/box.png'},
    {weapon_name: 'Роза', skin_name: '25 звезд', rarity: 'uncommon', steam_image: './assets/rose.png'},
    {weapon_name: 'Торт', skin_name: '50 звезд', rarity: 'restricted', steam_image: './assets/cake.png'},
    {weapon_name: 'Бутылка', skin_name: '50 звезд', rarity: 'restricted', steam_image: './assets/bottle.png'},
    {weapon_name: 'Ракета', skin_name: '50 звезд', rarity: 'restricted', steam_image: './assets/rocket.png'},
    {weapon_name: 'Кольцо', skin_name: '100 звезд', rarity: 'classified', steam_image: './assets/ring.png'},
    {weapon_name: 'Кубок', skin_name: '100 звезд', rarity: 'classified', steam_image: './assets/cup.png'},
    {weapon_name: 'Алмаз', skin_name: '100 звезд', rarity: 'classified', steam_image: './assets/diamond.png'},
    {weapon_name: 'Happy Birthday', skin_name: '350 звезд', rarity: 'covert', steam_image: './assets/happybirthday.png'}
];

// Вероятности выпадения в процентах
const PROBABILITIES = {
    'Медведь': 50,
    'Сердце': 50,
    'Коробка': 25,
    'Роза': 25,
    'Торт': 10,
    'Бутылка': 10,
    'Ракета': 10,
    'Кольцо': 3,
    'Кубок': 3,
    'Алмаз': 3,
    'Happy Birthday': 0.5
};

// Функция для получения случайного приза с учетом вероятностей
function getWeightedRandomPrize() {
    const prizes = [];
    for (const [name, prob] of Object.entries(PROBABILITIES)) {
        const count = Math.round(prob * 10); // Увеличиваем точность
        for (let i = 0; i < count; i++) {
            prizes.push(name);
        }
    }
    const randomName = prizes[Math.floor(Math.random() * prizes.length)];
    return WEAPON_ACTORS_ATTRS.find(item => item.weapon_name === randomName) || WEAPON_PRIZE_ATTRS;
}

// Функция для показа конфетти при выигрыше
function showConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}

// Функция для очистки таймаута платежа
function clearPaymentTimeout() {
    if (paymentTimeoutId) {
        clearTimeout(paymentTimeoutId);
        paymentTimeoutId = null;
    }
    
    // Скрываем индикатор загрузки
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }
}

// Функция для отправки информации о выигрыше на сервер
async function sendPrizeToServer(prize) {
    try {
        clearPaymentTimeout(); // Очищаем таймаут платежа при получении приза
        
        const tg = window.Telegram.WebApp;
        let userId = tg.initDataUnsafe?.user?.id;
        
        if (!userId) {
            console.error('User ID not found in Telegram WebApp data');
            userId = 'unknown';
        }
        
        console.log(`Sending prize to server: ${prize} for user ${userId}`);
        
        // В режиме отладки просто показываем попап
        if (DEBUG) {
            console.log('DEBUG mode enabled, not sending prize to server');
            showWinnerPopup(prize);
            return;
        }
        
        // Получаем стоимость подарка в звездах
        const giftCost = getGiftCost(prize);
        
        // Формируем данные для отправки боту
        const prizeData = {
            action: 'send_gift',
            prize: prize,
            cost: giftCost,
            user_id: userId,
            timestamp: Date.now()
        };
        
        console.log('Sending prize data to bot:', prizeData);
        
        // Отправляем данные боту
        tg.sendData(JSON.stringify(prizeData));
        
        // Показываем попап с выигрышем
        showWinnerPopup(prize);
    } catch (error) {
        console.error('Error sending prize to server:', error);
        
        // В случае ошибки все равно показываем попап
        showWinnerPopup(prize);
    }
}

// Функция для получения стоимости подарка в звездах
function getGiftCost(prize) {
    const giftCosts = {
        'heart': 15,      // Сердце
        'bear': 15,       // Медведь
        'gift': 25,       // Коробка
        'rose': 25,       // Роза
        'cake': 50,       // Торт
        'bouquet': 50,    // Букет
        'rocket': 50,     // Ракета
        'cup': 100,       // Кубок
        'ring': 100,      // Кольцо
        'diamond': 100,   // Алмаз
        'bottle': 50,     // Бутылка
        'birthday': 350   // Happy Birthday
    };
    
    return giftCosts[prize] || 15; // По умолчанию 15 звезд, если подарок не найден
}

// Функция для показа конфетти при выигрыше
function showConfetti() {
    confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 }
    });
}

// Функция для отображения попапа с выигрышем
function showWinnerPopup(prize) {
    console.log('Showing winner popup for:', prize);
    
    // Показываем конфетти для визуального эффекта
    showConfetti();
    
    // Получаем стоимость подарка в звездах
    const giftCost = getGiftCost(prize);
    
    // Получаем название подарка на русском
    const giftName = getGiftName(prize);
    
    // Показываем уведомление о выигрыше
    const tg = window.Telegram.WebApp;
    tg.showPopup({
        title: 'Поздравляем!',
        message: `Вы выиграли подарок "${giftName}" стоимостью ${giftCost} звезд!\n\nПодарок будет отправлен вам в боте.`,
        buttons: [{ type: 'ok' }]
    });
}

// Функция для получения названия подарка на русском
function getGiftName(prize) {
    const giftNames = {
        'heart': 'Сердце',
        'bear': 'Медведь',
        'gift': 'Подарок',
        'rose': 'Роза',
        'cake': 'Торт',
        'bouquet': 'Букет',
        'rocket': 'Ракета',
        'cup': 'Кубок',
        'ring': 'Кольцо',
        'diamond': 'Алмаз',
        'bottle': 'Бутылка',
        'birthday': 'Happy Birthday'
    };
    
    return giftNames[prize] || prize;
}

// Функция для запуска рулетки
function startRoulette() {
    console.log("Starting roulette...");
    
    // Проверяем наличие необходимых компонентов
    if (typeof EvRoulette !== 'function') {
        console.error("EvRoulette function is not defined!");
        alert("Ошибка: функция EvRoulette не найдена. Попробуйте перезагрузить страницу.");
        return false;
    }
    
    try {
        // Проверяем, не крутится ли уже рулетка
        if (isRouletteSpinning) {
            console.log("Roulette is already spinning, ignoring request");
            return false;
        }
        
        // Устанавливаем флаг вращения
        isRouletteSpinning = true;
        
        // Отключаем кнопку на время прокрутки
        const spinButton = document.getElementById('spin-button');
        if (spinButton) {
            spinButton.disabled = true;
            spinButton.innerHTML = '<img src="assets/star.png" alt="Star"><span>Крутится...</span>';
        }
        
        // Получаем контейнер для рулетки
        const rouletteContainer = document.getElementById('roulette-container');
        if (!rouletteContainer) {
            console.error("Roulette container not found");
            isRouletteSpinning = false;
            if (spinButton) {
                spinButton.disabled = false;
                spinButton.innerHTML = '<img src="assets/star.png" alt="Star"><span>Крутить за 25 <img src="assets/star.png" alt="Star" class="inline-star"></span>';
            }
            return false;
        }
        
        // Очищаем контейнер
        rouletteContainer.innerHTML = '';
        
        // Создаем массив элементов для рулетки
        const weaponsArray = [];
        
        // Добавляем случайные элементы в начало и конец для плавности
        for (let i = 0; i < 20; i++) {
            const randomIndex = Math.floor(Math.random() * WEAPON_ACTORS_ATTRS.length);
            weaponsArray.push(new EvWeapon(i, WEAPON_ACTORS_ATTRS[randomIndex]));
        }
        
        // Добавляем выигрышный элемент
        const prize = getWeightedRandomPrize();
        weaponsArray.push(new EvWeapon(20, prize));
        
        // Добавляем еще случайные элементы после выигрыша
        for (let i = 21; i < 30; i++) {
            const randomIndex = Math.floor(Math.random() * WEAPON_ACTORS_ATTRS.length);
            weaponsArray.push(new EvWeapon(i, WEAPON_ACTORS_ATTRS[randomIndex]));
        }
        
        // Создаем рулетку
        rouletteInstance = new EvRoulette({
            weapons_array: weaponsArray,
            el_parent: rouletteContainer,
            beforeparty: function() {
                console.log("Roulette started");
            },
            afterparty: function() {
                console.log("Roulette stopped");
                
                // Сбрасываем флаг вращения
                isRouletteSpinning = false;
                
                // Показываем конфетти
                showConfetti();
                
                // Получаем выигранный приз
                const prizeName = prize.weapon_name;
                console.log("Prize won:", prize);
                console.log("Prize name:", prizeName);
                
                // Преобразуем название приза в название подарка
                const giftName = convertPrizeNameToGiftName(prizeName);
                
                // Отправляем информацию о выигрыше на сервер
                sendPrizeToServer(giftName);
                
                // Отображаем попап с выигрышем
                showWinnerPopup(giftName);
                
                // Восстанавливаем кнопку
                const spinButton = document.getElementById('spin-button');
                if (spinButton) {
                    spinButton.disabled = false;
                    spinButton.innerHTML = '<img src="assets/star.png" alt="Star"><span>Крутить за 25 <img src="assets/star.png" alt="Star" class="inline-star"></span>';
                }
            }
        });
        
        // Запускаем рендер рулетки
        if (typeof rouletteInstance.render_immediately === 'function') {
            rouletteInstance.render_immediately();
        } else {
            console.error("render_immediately method is not defined on roulette instance");
            isRouletteSpinning = false;
            
            if (spinButton) {
                spinButton.disabled = false;
                spinButton.innerHTML = '<img src="assets/star.png" alt="Star"><span>Крутить за 25 <img src="assets/star.png" alt="Star" class="inline-star"></span>';
            }
            return false;
        }
        
        return true;
    } catch (error) {
        console.error("Error starting roulette:", error);
        
        // Сбрасываем флаг вращения в случае ошибки
        isRouletteSpinning = false;
        
        // Восстанавливаем кнопку в случае ошибки
        const spinButton = document.getElementById('spin-button');
        if (spinButton) {
            spinButton.disabled = false;
            spinButton.innerHTML = '<img src="assets/star.png" alt="Star"><span>Крутить за 25 <img src="assets/star.png" alt="Star" class="inline-star"></span>';
        }
        return false;
    }
}

// Функция для преобразования названия приза в название подарка для Telegram
function convertPrizeNameToGiftName(prizeName) {
    console.log("Converting prize name to gift name:", prizeName);
    
    // Обработка в случае, если приз передается как объект
    if (typeof prizeName === 'object' && prizeName.weapon_name) {
        prizeName = prizeName.weapon_name;
    }
    
    const prizeToGift = {
        'Сердце': 'heart',
        'Медведь': 'bear',
        'Коробка': 'gift',
        'Роза': 'rose',
        'Торт': 'cake',
        'Букет': 'bouquet',
        'Ракета': 'rocket',
        'Кольцо': 'ring',
        'Кубок': 'cup',
        'Алмаз': 'diamond',
        'Бутылка': 'bottle',
        'Happy Birthday': 'birthday',
        'Хэпи Бездар': 'birthday'
    };
    
    const giftName = prizeToGift[prizeName] || 'heart';
    console.log("Converted to gift name:", giftName);
    return giftName;
}

// Функция для обработки платежа с использованием sendData
function processPayment() {
    console.log("Processing payment...");
    
    // Предотвращаем двойную оплату
    if (isPaymentProcessing) {
        console.log("Payment is already in progress");
        return;
    }
    
    isPaymentProcessing = true;
    
    // Получаем Telegram WebApp
    const tg = window.Telegram.WebApp;
    
    if (!tg) {
        console.error("Telegram WebApp is not available");
        alert("Ошибка: Telegram WebApp недоступен");
        isPaymentProcessing = false;
        return;
    }
    
    // Показываем индикатор загрузки
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'flex';
    }
    
    // Для тестирования в режиме отладки
    if (DEBUG) {
        console.log("DEBUG mode: Starting roulette without payment");
        setTimeout(() => {
            if (loading) {
                loading.style.display = 'none';
            }
            isPaymentProcessing = false;
            startRoulette();
        }, 500);
        return;
    }
    
    // Самый простой и надежный способ - отправляем данные в бот через sendData
    // Бот создаст инвойс и обработает платеж
    try {
        console.log("Sending request to spin roulette...");
        
        // Отправляем команду боту на запуск рулетки
        tg.sendData(JSON.stringify({
            action: 'spin_roulette',
            cost: STARS_COST
        }));
        
        // Показываем загрузку и запускаем рулетку
        setTimeout(() => {
            // Скрываем индикатор загрузки
            if (loading) {
                loading.style.display = 'none';
            }
            
            isPaymentProcessing = false;
            startRoulette();
        }, 1000);
    } catch (error) {
        console.error("Error during payment request:", error);
        
        // Скрываем индикатор загрузки
        if (loading) {
            loading.style.display = 'none';
        }
        
        tg.showPopup({
            title: "Ошибка",
            message: "Не удалось отправить запрос на оплату. Попробуйте снова.",
            buttons: [{ type: 'ok' }]
        });
        
        isPaymentProcessing = false;
    }
}

// Функция для проверки параметров URL
function checkUrlParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Проверяем, есть ли в URL параметр payment_success
    if (urlParams.get('payment_success') === 'true') {
        console.log('Payment success detected in URL, starting roulette...');
        startRoulette();
        return;
    }
    
    // Проверяем, есть ли в URL параметр invoiceLink
    const invoiceLink = urlParams.get('invoiceLink');
    if (invoiceLink) {
        console.log('Invoice link detected in URL:', invoiceLink);
        
        // Получаем экземпляр Telegram WebApp
        const tg = window.Telegram.WebApp;
        
        // Открываем инвойс
        tg.openInvoice(invoiceLink, function(event) {
            console.log('Invoice opened:', event);
        });
        
        // Очищаем URL от параметра invoiceLink
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
    }
}

// Основная функция инициализации
function main() {
    console.log('Starting main initialization...');
    // Always initialize user profile on page load
    initUserProfile();
    
    // Проверяем наличие Telegram WebApp
    if (!window.Telegram || !window.Telegram.WebApp) {
        console.error('Telegram WebApp is not available');
        alert('Ошибка: Telegram WebApp недоступен');
        return;
    }
    
    const tg = window.Telegram.WebApp;
    const spinButton = document.getElementById('spin-button');
    const rouletteContainer = document.getElementById('roulette-container');
    
    if (!spinButton) {
        console.error('Spin button not found');
        return;
    }
    
    if (!rouletteContainer) {
        console.error('Roulette container not found');
        return;
    }
    
    // Используем глобальный режим отладки
    console.log('Debug mode:', DEBUG ? 'enabled' : 'disabled');
    
    // Дебаг информация
    console.log('Telegram WebApp initialized');
    console.log('Version:', tg.version);
    console.log('Platform:', tg.platform);
    console.log('Theme:', tg.colorScheme);
    console.log('Stars payment available:', tg.isStarsPaymentAvailable);
    console.log('InitData available:', !!tg.initData);
    console.log('InitDataUnsafe available:', !!tg.initDataUnsafe);
    
    // Настройка интерфейса
    tg.expand();
    tg.MainButton.hide();
    
    // Устанавливаем тему
    document.documentElement.className = tg.colorScheme || 'light';
    
    // Инициализация статической рулетки
    try {
        initStaticRoulette();
    } catch (e) {
        console.error('Error initializing static roulette:', e);
    }
    
    // Адаптация для мобильных устройств
    try {
        adjustForMobile();
    } catch (e) {
        console.error('Error adjusting for mobile:', e);
    }
    
    // Добавляем обработчик для кнопки
    console.log('Setting up spin button click handler');
    
    // Удаляем все существующие обработчики
    spinButton.replaceWith(spinButton.cloneNode(true));
    
    // Получаем новую ссылку на кнопку после замены
    const newSpinButton = document.getElementById('spin-button');
    
    // Добавляем новый обработчик
    newSpinButton.addEventListener('click', function(event) {
        console.log('Spin button clicked');
        try {
            processPayment();
        } catch (e) {
            console.error('Error processing payment:', e);
            alert('Произошла ошибка при обработке платежа. Попробуйте еще раз.');
        }
    });
    
    console.log('Main initialization completed');
}

// Единственный слушатель загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded");
    
    // Проверяем наличие кнопки и контейнера рулетки
    const spinButton = document.getElementById('spin-button');
    const rouletteContainer = document.getElementById('roulette-container');
    
    if (!spinButton) {
        console.error("Spin button not found on page load!");
    } else {
        console.log("Spin button found on page load");
    }
    
    if (!rouletteContainer) {
        console.error("Roulette container not found on page load!");
    } else {
        console.log("Roulette container found on page load");
    }
    
    // Проверяем наличие Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        console.log("Telegram WebApp available:", window.Telegram.WebApp.version);
        console.log("Stars payment available:", window.Telegram.WebApp.isStarsPaymentAvailable);
    } else {
        console.error("Telegram WebApp not available!");
    }
    
    // Проверяем параметры URL для обработки возврата после платежа
    checkUrlParams();
    
    // Запускаем основную функцию
    main();
    
    // Создаем статичную рулетку без вращения
    setTimeout(() => {
        console.log("Initializing static roulette...");
        initStaticRoulette();
        // Вызываем функцию адаптации после создания рулетки
        setTimeout(() => {
            console.log("Adjusting for mobile...");
            adjustForMobile();
        }, 200);
    }, 500);
    
    // Настраиваем обработчики Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        const tg = window.Telegram.WebApp;
        
        // Устанавливаем обработчики событий
        tg.onEvent('invoiceClosed', function(event) {
            console.log('Invoice closed event:', event);
            
            const loading = document.getElementById('loading');
            if (loading) {
                loading.style.display = 'none';
            }
            
            // Проверяем статус платежа
            if (event.status === 'paid') {
                console.log('Payment successful, starting roulette...');
                startRoulette();
            } else {
                console.log('Payment failed or cancelled:', event.status);
                tg.showPopup({
                    title: 'Платеж не завершен',
                    message: 'Вы не завершили платеж. Попробуйте еще раз.',
                    buttons: [{ type: 'ok' }]
                });
            }
        });
    }
});

// Функция для инициализации профиля пользователя
function initUserProfile() {
    console.log('Initializing user profile...');
    
    // Получаем элементы профиля
    const userProfileElement = document.getElementById('user-profile');
    const userAvatarElement = document.getElementById('user-avatar');
    const userNameElement = document.getElementById('user-name');
    
    if (!userProfileElement || !userAvatarElement || !userNameElement) {
        console.error('User profile elements not found');
        return;
    }
    
    // Устанавливаем базовые стили для профиля, чтобы он был виден в любом случае
    userProfileElement.style.display = 'flex';
    userProfileElement.style.visibility = 'visible';
    userProfileElement.style.opacity = '1';
    userProfileElement.style.zIndex = '1000';
    
    // Проверяем наличие Telegram WebApp
    if (!window.Telegram || !window.Telegram.WebApp) {
        console.error('Telegram WebApp is not available');
        // Показываем демо-профиль
        userNameElement.textContent = 'Гость';
        createDemoAvatar(userAvatarElement);
        return;
    }
    
    const tg = window.Telegram.WebApp;
    console.log('Telegram WebApp version:', tg.version);
    console.log('Platform:', tg.platform);
    console.log('Color scheme:', tg.colorScheme);
    
    try {
        // Проверяем, доступны ли данные пользователя
        console.log('Checking user data availability...');
        
        // Основной метод - получение данных из initDataUnsafe
        if (tg.initDataUnsafe && tg.initDataUnsafe.user) {
            const user = tg.initDataUnsafe.user;
            console.log('User data found:', user);
            
            // Устанавливаем имя пользователя
            userNameElement.textContent = user.first_name || 'Пользователь';
            
            // Если есть фото профиля, используем ее
            if (user.photo_url) {
                console.log('User has photo_url:', user.photo_url);
                userAvatarElement.src = user.photo_url;
                userAvatarElement.alt = user.first_name;
                
                // Добавляем обработчик ошибки загрузки
                userAvatarElement.onerror = function() {
                    console.error('Failed to load user photo, creating initials avatar');
                    createInitialsAvatar(userAvatarElement, user.first_name);
                };
            } else {
                console.log('User has no photo_url, creating initials avatar');
                // Иначе создаем аватар с инициалами
                createInitialsAvatar(userAvatarElement, user.first_name);
            }
            
            console.log('User profile initialized successfully');
            return;
        }
        
        // Альтернативный метод - получение данных из initData
        if (tg.initData) {
            try {
                console.log('Trying to parse initData...');
                const parsedData = JSON.parse(tg.initData);
                if (parsedData && parsedData.user) {
                    const user = parsedData.user;
                    console.log('User data found in initData:', user);
                    
                    // Устанавливаем имя пользователя
                    userNameElement.textContent = user.first_name || 'Пользователь';
                    
                    // Если есть фото профиля, используем ее
                    if (user.photo_url) {
                        userAvatarElement.src = user.photo_url;
                        userAvatarElement.alt = user.first_name;
                        
                        userAvatarElement.onerror = function() {
                            createInitialsAvatar(userAvatarElement, user.first_name);
                        };
                    } else {
                        createInitialsAvatar(userAvatarElement, user.first_name);
                    }
                    
                    console.log('User profile initialized from initData');
                    return;
                }
            } catch (e) {
                console.error('Error parsing initData:', e);
            }
        }
        
        // Если данные пользователя недоступны, показываем демо-профиль
        console.log('User data not available, showing demo profile');
        userNameElement.textContent = 'Гость';
        createDemoAvatar(userAvatarElement);
        
    } catch (error) {
        console.error('Error initializing user profile:', error);
        // В случае ошибки показываем демо-профиль
        userNameElement.textContent = 'Гость';
        createDemoAvatar(userAvatarElement);
    }
}

// Функция для создания аватара с инициалами
function createInitialsAvatar(element, name) {
    try {
        // Получаем первую букву имени
        const initial = name ? name.charAt(0).toUpperCase() : '?';
        
        // Создаем временный канвас
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        
        // Рисуем цветной круг
        ctx.fillStyle = '#3390ec';
        ctx.beginPath();
        ctx.arc(50, 50, 50, 0, Math.PI * 2);
        ctx.fill();
        
        // Добавляем инициал
        ctx.fillStyle = 'white';
        ctx.font = 'bold 50px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(initial, 50, 50);
        
        // Устанавливаем изображение
        element.src = canvas.toDataURL('image/png');
        element.alt = name || 'User';
        
        console.log('Created initials avatar for:', name);
    } catch (e) {
        console.error('Error creating initials avatar:', e);
        // Запасной вариант
        element.src = './assets/default-avatar.png';
        element.alt = name || 'User';
    }
}

// Функция для создания демо-аватара
function createDemoAvatar(element) {
    // Создаем демо-аватар с цветным фоном и текстом Г
    try {
        // Создаем временный канвас
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        const ctx = canvas.getContext('2d');
        // Рисуем цветной круг
        ctx.fillStyle = '#3390ec';
        ctx.beginPath();
        ctx.arc(50, 50, 50, 0, Math.PI * 2);
        ctx.fill();
        
        // Добавляем текст
        ctx.fillStyle = 'white';
        ctx.font = 'bold 50px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Г', 50, 50);
        
        // Устанавливаем изображение
        element.src = canvas.toDataURL('image/png');
        element.alt = 'Гость';
    } catch (e) {
        console.error('Error creating demo avatar:', e);
        // Запасной вариант
        element.src = './assets/default-avatar.png';
        element.alt = 'Гость';
    }
}

// Функция для адаптации интерфейса под мобильные устройства
function adjustForMobile() {
    const isMobile = window.innerWidth <= MOBILE_BREAKPOINT;
    const rouletteContainer = document.getElementById('roulette-container');
    const evRoulette = document.getElementById('ev-roulette');
    
    if (isMobile) {
        // Увеличиваем размеры для мобильных устройств
        if (rouletteContainer) {
            // Убедимся, что контейнер рулетки виден
            rouletteContainer.style.overflow = 'visible';
            rouletteContainer.style.minHeight = '220px';
        }
        
        if (evRoulette) {
            // Если рулетка существует, устанавливаем ей большую высоту
            evRoulette.style.height = '220px';
        }
        
        if (EvRoulette.N_WEAPONS) {
            // Если рулетка уже инициализирована, меняем размеры элементов
            const weapons = document.querySelectorAll('.ev-weapon');
            weapons.forEach(weapon => {
                weapon.style.width = '180px';
            });
            
            const weaponImages = document.querySelectorAll('.ev-weapon img');
            weaponImages.forEach(img => {
                img.style.width = '70px';
                img.style.height = '70px';
            });
            
            // Убедимся, что рулетка видна на экране
            setTimeout(() => {
                if (rouletteContainer) {
                    rouletteContainer.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }, 500);
        }
    } else {
        // Возвращаем стандартные размеры для десктопа
        if (rouletteContainer) {
            rouletteContainer.style.minHeight = '150px';
        }
        
        if (evRoulette) {
            evRoulette.style.height = '200px';
        }
        
        if (EvRoulette.N_WEAPONS) {
            const weapons = document.querySelectorAll('.ev-weapon');
            weapons.forEach(weapon => {
                weapon.style.width = '200px';
            });
            
            const weaponImages = document.querySelectorAll('.ev-weapon img');
            weaponImages.forEach(img => {
                img.style.width = '80px';
                img.style.height = '80px';
            });
        }
    }
}

// Функция для создания статичной рулетки без вращения
function initStaticRoulette() {
    console.log('Initializing static roulette...');
    
    const rouletteContainer = document.getElementById('roulette-container');
    
    if (!rouletteContainer) {
        console.error('Roulette container not found!');
        return;
    }
    
    // Убедимся, что контейнер рулетки виден
    rouletteContainer.style.display = 'block';
    rouletteContainer.style.visibility = 'visible';
    rouletteContainer.style.opacity = '1';
    
    // Очищаем контейнер рулетки
    while (rouletteContainer.firstChild) {
        rouletteContainer.removeChild(rouletteContainer.firstChild);
    }
    
    try {
        // Проверяем наличие необходимых компонентов
        if (typeof EvRoulette !== 'function') {
            console.error('EvRoulette function is not defined!');
            return;
        }
        
        if (typeof EvWeapon !== 'function') {
            console.error('EvWeapon function is not defined!');
            return;
        }
        
        // Создание элементов рулетки
        const weaponsArray = [];
        
        // Заполняем рулетку случайными предметами
        for (let i = 0; i < EvRoulette.N_WEAPONS; i++) {
            const randomIndex = Math.floor(Math.random() * WEAPON_ACTORS_ATTRS.length);
            weaponsArray.push(new EvWeapon(i, WEAPON_ACTORS_ATTRS[randomIndex]));
        }
        
        const roulette = new EvRoulette({
            weapons_array: weaponsArray,
            el_parent: rouletteContainer,
            beforeparty: () => {},
            afterparty: () => {}
        });
        
        // Просто показываем рулетку без вращения
        roulette.render_immediately();
        
        // Отключаем вращение
        if (roulette.el_weapons) {
            roulette.el_weapons.style.transition = 'none';
        }
        
        console.log('Static roulette initialized successfully');
    } catch (error) {
        console.error('Error initializing static roulette:', error);
    }
    
    // Адаптируем для мобильных устройств
    setTimeout(() => {
        adjustForMobile();
    }, 100);
}

// Обработчик изменения размера окна
window.addEventListener('resize', adjustForMobile);

// Добавляем обработчик для Telegram WebApp
if (window.Telegram && window.Telegram.WebApp) {
    console.log("Telegram WebApp detected");
    
    // Убираем принудительную очистку кеша, которая может вызывать проблемы
    // if (!window.location.href.includes('nocache')) {
    //     clearCacheAndReload();
    // } else {
    //     console.log("Skipping cache clear - already cleared");
    // }
    
    window.Telegram.WebApp.onEvent('viewportChanged', function() {
        adjustForMobile();
    });
    
    // Устанавливаем готовность WebApp
    window.Telegram.WebApp.ready();
}

// Добавляем обработчик полной загрузки страницы
window.addEventListener('load', function() {
    // После полной загрузки страницы еще раз вызываем адаптацию
    adjustForMobile();
});

// Добавляем стили для рулетки
const style = document.createElement('style');
style.textContent = `
#ev-roulette {
    position: relative;
    width: 100%;
    height: 200px;
    overflow: hidden;
    background: #2a2e38;
    border-radius: 10px;
}

#ev-target {
    position: absolute;
    top: 0;
    left: 50%;
    width: 2px;
    height: 100%;
    background-color: #ffd700;
    z-index: 10;
}

#ev-weapons {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    display: flex;
    transition: left 0s linear;
}

.ev-weapon {
    width: 200px;
    height: 100%;
    padding: 10px;
    box-sizing: border-box;
}

.ev-weapon-inner {
    position: relative;
    width: 100%;
    height: 100%;
    background-color: #343a4a;
    border-radius: 5px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
}

.ev-weapon-rarity {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 5px;
}

.ev-weapon-rarity-uncommon { background-color: #4b69ff; }
.ev-weapon-rarity-restricted { background-color: #8847ff; }
.ev-weapon-rarity-classified { background-color: #d32ce6; }
.ev-weapon-rarity-covert { background-color: #eb4b4b; }

.ev-weapon img {
    width: 80px;
    height: 80px;
    object-fit: contain;
}

.ev-weapon-text {
    margin-top: 10px;
    text-align: center;
    color: white;
}

.ev-weapon-text p {
    margin: 5px 0;
}

.ev-weapon-text p:first-child {
    font-weight: bold;
}

.ev-weapon-text p:last-child {
    color: #ffd700;
    font-size: 0.9em;
}

.ev-weapon-winner {
    transform: scale(1.05);
    box-shadow: 0 0 20px rgba(255, 215, 0, 0.7);
    z-index: 5;
}

@media (max-width: 600px) {
    .ev-weapon {
        width: 150px;
    }
    
    .ev-weapon img {
        width: 60px;
        height: 60px;
    }
    
    .ev-weapon-text {
        font-size: 0.9em;
    }
}
`;
document.head.appendChild(style);

// Основная функция инициализации
function main() {
    console.log('Starting main initialization...');
    // Always initialize user profile on page load
    initUserProfile();
    
    // Проверяем наличие Telegram WebApp
    if (!window.Telegram || !window.Telegram.WebApp) {
        console.error('Telegram WebApp is not available');
        alert('Ошибка: Telegram WebApp недоступен');
        return;
    }
    
    const tg = window.Telegram.WebApp;
    const spinButton = document.getElementById('spin-button');
    const rouletteContainer = document.getElementById('roulette-container');
    
    if (!spinButton) {
        console.error('Spin button not found');
        return;
    }
    
    if (!rouletteContainer) {
        console.error('Roulette container not found');
        return;
    }
    
    // Используем глобальный режим отладки
    console.log('Debug mode:', DEBUG ? 'enabled' : 'disabled');
    
    // Дебаг информация
    console.log('Telegram WebApp initialized');
    console.log('Version:', tg.version);
    console.log('Platform:', tg.platform);
    console.log('Theme:', tg.colorScheme);
    console.log('Stars payment available:', tg.isStarsPaymentAvailable);
    console.log('InitData available:', !!tg.initData);
    console.log('InitDataUnsafe available:', !!tg.initDataUnsafe);
    
    // Настройка интерфейса
    tg.expand();
    tg.MainButton.hide();
    
    // Устанавливаем тему
    document.documentElement.className = tg.colorScheme || 'light';
    
    // Инициализация статической рулетки
    try {
        initStaticRoulette();
    } catch (e) {
        console.error('Error initializing static roulette:', e);
    }
    
    // Адаптация для мобильных устройств
    try {
        adjustForMobile();
    } catch (e) {
        console.error('Error adjusting for mobile:', e);
    }
    
    // Добавляем обработчик для кнопки
    console.log('Setting up spin button click handler');
    
    // Удаляем все существующие обработчики
    spinButton.replaceWith(spinButton.cloneNode(true));
    
    // Получаем новую ссылку на кнопку после замены
    const newSpinButton = document.getElementById('spin-button');
    
    // Добавляем новый обработчик
    newSpinButton.addEventListener('click', function(event) {
        console.log('Spin button clicked');
        try {
            processPayment();
        } catch (e) {
            console.error('Error processing payment:', e);
            alert('Произошла ошибка при обработке платежа. Попробуйте еще раз.');
        }
    });
    
    console.log('Main initialization completed');
}

// Добавляем обработчик изменения размера окна
window.addEventListener('resize', adjustForMobile);

// Единственный обработчик загрузки DOM
document.addEventListener('DOMContentLoaded', function() {
    console.log("DOM fully loaded");
    
    // Проверяем наличие кнопки и контейнера рулетки
    const spinButton = document.getElementById('spin-button');
    const rouletteContainer = document.getElementById('roulette-container');
    
    if (!spinButton) {
        console.error("Spin button not found on page load!");
    } else {
        console.log("Spin button found on page load");
    }
    
    if (!rouletteContainer) {
        console.error("Roulette container not found on page load!");
    } else {
        console.log("Roulette container found on page load");
    }
    
    // Проверяем наличие Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        console.log("Telegram WebApp available:", window.Telegram.WebApp.version);
        
        const tg = window.Telegram.WebApp;
        
        // Настраиваем основную кнопку
        tg.MainButton.setText('Крутить рулетку');
        tg.MainButton.onClick(function() {
            console.log('Main button clicked');
            processPayment();
        });
        
        // Устанавливаем обработчик события invoiceClosed
        tg.onEvent('invoiceClosed', function(event) {
            console.log('Invoice closed event:', event);
            
            const loading = document.getElementById('loading');
            if (loading) {
                loading.style.display = 'none';
            }
            
            // Проверяем статус платежа
            if (event.status === 'paid') {
                console.log('Payment successful, starting roulette...');
                startRoulette();
            } else {
                console.log('Payment failed or cancelled:', event.status);
                tg.showPopup({
                    title: 'Платеж не завершен',
                    message: 'Вы не завершили платеж. Попробуйте еще раз.',
                    buttons: [{ type: 'ok' }]
                });
            }
        });
    } else {
        console.error("Telegram WebApp not available!");
    }
    
    // Проверяем параметры URL для обработки возврата после платежа
    checkUrlParams();
    
    // Запускаем основную функцию
    main();
    
    // Создаем статичную рулетку без вращения
    setTimeout(() => {
        console.log("Initializing static roulette...");
        initStaticRoulette();
        // Вызываем функцию адаптации после создания рулетки
        setTimeout(() => {
            console.log("Adjusting for mobile...");
            adjustForMobile();
        }, 200);
    }, 500);
});
