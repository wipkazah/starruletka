// КЛАСС ОРУЖИЯ
// -----------------------------------------------------------------------------

function EvWeapon(id, attrs) {
    this.id = id;
    this.weapon_name = attrs.weapon_name;
    this.skin_name = attrs.skin_name;
    this.rarity = attrs.rarity;
    this.steam_image = attrs.steam_image;
    this.el = null;
}

// Ширина элемента теперь зависит от устройства
EvWeapon.getElWidth = function() {
    // Увеличиваем ширину элемента для мобильных устройств
    if (window.innerWidth < 768) {
        return 180;
    } else if (window.innerWidth < 992) {
        return 190;
    } else {
        return 200;
    }
};

// КЛАСС РУЛЕТКИ
// -----------------------------------------------------------------------------

function EvRoulette(attrs) {
    this.weapons = attrs.weapons_array || [];
    this.el_parent = attrs.el_parent;
    this.el = null;
    this.el_weapons = null;
    this.beforeparty = attrs.beforeparty;
    this.afterparty = attrs.afterparty;
}

// ПАРАМЕТРЫ РУЛЕТКИ
// -----------------------------------------------------------------------------

EvRoulette.N_WEAPONS = 25;
EvRoulette.WEAPON_PRIZE_ID = EvRoulette.N_WEAPONS - 3;
EvRoulette.SPIN_SECS = 10;
EvRoulette.START_DELAY_MSECS = 100;
EvRoulette.SOUND_SPIN_INTERVAL = 100;
EvRoulette.IMAGE_LOAD_INTERVAL = 500;
EvRoulette.IMAGE_LOAD_WAIT_MSECS = 10 * 1000;
EvRoulette.SOUND_START = 'snd/roulette_start.wav';
EvRoulette.SOUND_SPIN = 'snd/roulette_spin.wav';
EvRoulette.SOUND_STOP = 'snd/roulette_stop.wav';

// ВСПОМОГАТЕЛЬНЫЙ МЕТОД ДЛЯ ОПРЕДЕЛЕНИЯ ВЕСА ЭЛЕМЕНТА
// -----------------------------------------------------------------------------

EvRoulette.prototype.getWeightForItem = function(itemName) {
    const weights = {
        'Сердце': 15,
        'Коробка': 25,
        'Роза': 25,
        'Торт': 15,
        'Бутылка': 15,
        'Ракета': 15,
        'Кольцо': 10,
        'Кубок': 10,
        'Алмаз': 10,
        'Happy Birthday': 5
    };
    return weights[itemName] || 1;
};

// РЕНДЕР
// -----------------------------------------------------------------------------

EvRoulette.prototype.render_immediately = function() {
    var self = this,
        el_roulette = document.createElement('div'),
        el_target = document.createElement('div'),
        el_weapons = document.createElement('div');

    el_roulette.id = 'ev-roulette';
    el_target.id = 'ev-target';
    el_weapons.id = 'ev-weapons';

    // Задаем высоту рулетки в зависимости от устройства
    el_roulette.style.height = window.innerWidth < 768 ? '220px' : '200px';
    
    const elWidth = EvWeapon.getElWidth();
    el_weapons.style.width = (self.weapons.length * elWidth) + 'px';
    
    self.weapons.forEach(function(weapon) {
        var el_weapon = document.createElement('div'),
            el_weapon_inner = document.createElement('div'),
            el_weapon_rarity = document.createElement('div'),
            el_weapon_img = document.createElement('img'),
            el_weapon_text = document.createElement('div'),
            el_weapon_text_name = document.createElement('p'),
            el_weapon_text_skin_name = document.createElement('p');

        el_weapon_img.src = weapon.steam_image;
        el_weapon_img.alt = weapon.weapon_name;
        el_weapon_text_name.textContent = weapon.weapon_name;
        
        // Создаем красивую вкладку со стоимостью вместо обычного текста
        el_weapon_text_skin_name.className = 'stars-cost-badge';
        
        // Извлекаем число звезд из строки (например, из "50 звезд" получаем "50")
        const starsMatch = weapon.skin_name.match(/\d+/);
        const starsCount = starsMatch ? starsMatch[0] : '?';
        
        // Создаем элемент для иконки звезды (с контролем размера)
        const starIcon = document.createElement('img');
        starIcon.src = './assets/star.png';
        starIcon.alt = 'Stars';
        starIcon.className = 'stars-icon';
        starIcon.style.width = '0.9em'; // Размер как у смайлика
        starIcon.style.height = '0.9em';
        starIcon.style.display = 'inline-block';
        starIcon.style.verticalAlign = 'middle';
        starIcon.style.marginLeft = '2px';
        
        // Создаем элемент для числа звезд
        const starsText = document.createElement('span');
        starsText.textContent = starsCount;
        starsText.style.fontWeight = 'bold';
        starsText.style.fontFamily = '"Montserrat", sans-serif';
        starsText.style.verticalAlign = 'middle';
        
        // Очищаем и добавляем новые элементы
        el_weapon_text_skin_name.innerHTML = '';
        el_weapon_text_skin_name.appendChild(starsText);
        el_weapon_text_skin_name.appendChild(starIcon);
    
        el_weapon.className = 'ev-weapon';
        el_weapon_inner.className = 'ev-weapon-inner';
        el_weapon_rarity.className = 'ev-weapon-rarity ev-weapon-rarity-' + weapon.rarity;
        el_weapon_text.className = 'ev-weapon-text';
    
        el_weapon_text.appendChild(el_weapon_text_name);
        el_weapon_text.appendChild(el_weapon_text_skin_name);
        el_weapon_inner.appendChild(el_weapon_rarity);
        el_weapon_inner.appendChild(el_weapon_img);
        el_weapon_inner.appendChild(el_weapon_text);
        el_weapon.appendChild(el_weapon_inner);
    
        weapon.el = el_weapon;    
        el_weapons.appendChild(weapon.el);
    });

    el_roulette.appendChild(el_target);
    el_roulette.appendChild(el_weapons);

    self.el_weapons = el_weapons;
    self.el = el_roulette;
    self.el_parent.appendChild(self.el);
    
    // Запускаем вращение сразу
    self.spin();
};

// Получаем индекс выигравшего элемента
EvRoulette.prototype.getWinnerIndex = function() {
    const currentLeft = Math.abs(parseInt(window.getComputedStyle(this.el_weapons).left, 10));
    const elWidth = EvWeapon.getElWidth();
    return Math.floor((currentLeft + elWidth / 2) / elWidth) % this.weapons.length;
};

EvRoulette.prototype.make_sound = function(sound) {
    var audio = new Audio(sound);
    audio.volume = 0.2;
    audio.play();
};

// ВРАЩЕНИЕ РУЛЕТКИ
// -----------------------------------------------------------------------------

EvRoulette.prototype.spin = function() {
    const self = this;
    const centerIndex = Math.floor(self.weapons.length / 2);
    const elWidth = EvWeapon.getElWidth();
    // Стрелка (центр экрана) должна указывать на середину ячейки:
    const stopPosition = centerIndex * elWidth + (elWidth / 2) - (self.el_parent.offsetWidth / 2);

    // Убедимся, что рулетка видна на мобильных устройствах
    if (window.innerWidth < 768) {
        // Для мобильных устройств скроллим к рулетке
        self.el_parent.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    self.el_weapons.style.transition = `left ${EvRoulette.SPIN_SECS}s ease-out`;
    setTimeout(() => {
        self.beforeparty();
        self.el_weapons.style.left = `-${stopPosition}px`;
        
        self.el_weapons.addEventListener('transitionend', () => {
            // Подсвечиваем победителя
            self.weapons[centerIndex].el.classList.add('ev-weapon-winner');
            self.afterparty();
        }, { once: true });
    }, EvRoulette.START_DELAY_MSECS);
};

// ЗАПУСК
// -----------------------------------------------------------------------------

EvRoulette.prototype.start = function() {
    this.set_weapons();
    this.render();
};